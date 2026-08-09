import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { DiscoveryEngine } from '@/lib/discoveryEngine';
import channelsData from '@/lib/youtubeChannels.json';

const parser = new Parser();

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
    const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
    
    for (const lang of LANGUAGES) {
      let langSongCount = 0;
      let addedIds: string[] = [];
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Filter channels that support this language
      const validChannels = channelsData.filter(c => c.languages.includes(lang));

      for (const channel of validChannels) {
        const channelId = channel.channelId;
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
