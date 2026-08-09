import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { DiscoveryEngine } from '@/lib/discoveryEngine';

const parser = new Parser();

// Dictionary of major music label YouTube channel IDs by language
const YOUTUBE_CHANNELS: Record<string, string[]> = {
  Telugu: [
    'UCvqsJWCGFAJFAzG7k-j2z7g', // Aditya Music
    'UC5z3U5O6b5fB1Tz8gVn_LTw', // Mango Music
    'UCU-uUf0d1_9Z0FkLz4hR8ew'  // Saregama Telugu
  ],
  Tamil: [
    'UC7GvP1y_p-zG9k-yNfVq2fA', // Sony Music South
    'UCvNnsB1fQ0i-gR1nLgQnC3g', // Think Music India
    'UCPe8q0QvYvLpT-XQZc8V21w'  // Sun TV
  ],
  Kannada: [
    'UCgN8N0c1qR4lT8lO-R9Ie_g', // Anand Audio
    'UCEpS1iFwF80dJ809v-tNPAA', // PRK Audio
    'UCkO8yH5-N8tV2F9tVnE2Zfw'  // DBeats
  ],
  Malayalam: [
    'UCP27A23rV9iE3G1T8C8qIkw', // Goodwill Entertainments
    'UCk4vE8i8Zk4N2r8kHn6hOvg', // Muzik247
    'UCp-Y-p2B2VzE_W8s2Jb1l6A'  // Millennium Audios
  ],
  Hindi: [
    'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series
    'UCFFbwnve3yF62-tVXkTyHqg', // Zee Music Company
    'UC56gTxNs4f9xZ7Pa2i5xNtg'  // Sony Music India
  ],
  English: [
    'UCpDJl2EmP7Oh90Vylx0dZtA', // Vevo
    'UCqECaJ8Gagnn7YCbPEzWH6g', // Taylor Swift (example global act)
    'UC0C-w0YjGpqDXGB8IHb662A'  // Ed Sheeran
  ]
};

const MAX_SONGS_PER_LANGUAGE = 150; // Cap to prevent DB bloat

function cleanYouTubeTitle(title: string): string {
  let cleaned = title;
  // Remove common YouTube suffixes and brackets
  cleaned = cleaned.replace(/\|.*$/g, '');
  cleaned = cleaned.replace(/\(.*\)/g, '');
  cleaned = cleaned.replace(/\[.*\]/g, '');
  cleaned = cleaned.replace(/-/g, ' ');
  cleaned = cleaned.replace(/Lyrical Video|Video Song|Official Music Video|Official Video|Teaser|Trailer/gi, '');
  cleaned = cleaned.replace(/Telugu|Tamil|Kannada|Hindi|Malayalam|English/gi, '');
  return cleaned.trim();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const host = request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const baseUrl = `${proto}://${host}`;
  const engine = DiscoveryEngine.getInstance(baseUrl);

  const summary: any = {};
  let totalDiscovered = 0;
  
  try {
    for (const [lang, channels] of Object.entries(YOUTUBE_CHANNELS)) {
      let langSongCount = 0;
      let addedIds: string[] = [];
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      for (const channelId of channels) {
        try {
          const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          const feed = await parser.parseString(await fetch(feedUrl).then(r => r.text()));
          
          for (const item of feed.items) {
            if (!item.pubDate || !item.title) continue;
            
            const pubDate = new Date(item.pubDate);
            if (pubDate < twoDaysAgo) continue; // Only care about recent releases
            
            const cleanTitle = cleanYouTubeTitle(item.title);
            if (cleanTitle.length < 3) continue;

            // Search Saavn for this exact newly released song
            const query = `${cleanTitle} ${lang}`;
            const searchResults = await engine.provider.searchSongs(query, 3);
            
            // Filter by language to ensure we don't grab a dub incorrectly
            const langFiltered = engine.provider.filterByLanguage(searchResults, lang as any);
            const candidates = langFiltered.length > 0 ? langFiltered : searchResults;
            
            // Find the best playable match
            const validMatch = candidates.find(s => s.audioUrl && s.audioUrl.length > 0);
            
            if (validMatch) {
              const canonical = {
                ...validMatch,
                type: 'song',
                language: lang,
                playable: true,
                candidateSource: 'youtube_rss',
                youtube_published_at: pubDate.toISOString(),
                official_release_date: pubDate.toISOString()
              };

              const { error } = await supabase.from('verified_releases').upsert({
                id: canonical.id,
                title: canonical.title,
                artist: canonical.artist,
                cover_url: canonical.coverUrl,
                youtube_published_at: canonical.youtube_published_at,
                official_release_date: canonical.official_release_date,
                language: canonical.language,
                song_metadata: canonical,
                sources: canonical.sources || {},
                verification: canonical.verification || {},
                playable: canonical.playable
              }, { onConflict: 'id' });

              if (!error) {
                addedIds.push(canonical.id);
                langSongCount++;
                totalDiscovered++;
              }
            }
          }
        } catch (err) {
          console.error(`Failed to parse/fetch for channel ${channelId} (${lang})`, err);
        }
      }

      // Purge old songs logic: Keep size capped per language
      if (langSongCount > 0) {
        try {
          // Get total count for this language
          const { count } = await supabase
            .from('verified_releases')
            .select('*', { count: 'exact', head: true })
            .eq('language', lang);
            
          if (count && count > MAX_SONGS_PER_LANGUAGE) {
            const deleteCount = count - MAX_SONGS_PER_LANGUAGE;
            // Fetch the IDs of the oldest songs to delete
            const { data: oldSongs } = await supabase
              .from('verified_releases')
              .select('id')
              .eq('language', lang)
              .order('discovered_at', { ascending: true })
              .limit(deleteCount);
              
            if (oldSongs && oldSongs.length > 0) {
              const oldIds = oldSongs.map(s => s.id);
              await supabase
                .from('verified_releases')
                .delete()
                .in('id', oldIds);
                
              summary[lang] = { added: langSongCount, removed: oldIds.length };
            }
          } else {
            summary[lang] = { added: langSongCount, removed: 0 };
          }
        } catch (purgeErr) {
          console.error(`Failed to purge old songs for ${lang}`, purgeErr);
        }
      } else {
        summary[lang] = { added: 0, removed: 0 };
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Discovered and verified ${totalDiscovered} new releases.`,
      summary
    });
  } catch (e) {
    console.error('Failed', e);
    return NextResponse.json({ error: 'Failed to process discovery' }, { status: 500 });
  }
}
