import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RealMusicEngine } from '@/lib/realMusicEngine';

// Hardcoded Official Telugu Labels for Discovery
const OFFICIAL_CHANNELS = [
  'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series Telugu
  'UCv33xVn3RABVd0-uB8fD1-w', // Aditya Music
  'UC1K0F3f-OQG6lZ-bC1d-TPA', // Sony Music South
  'UCT7nKq3fGhtgGf4TtyhL08Q', // Saregama Telugu
  'UCNU4HqM6tV5NfK6BwB-02Yw', // Mango Music
];

function sanitizeTitle(title: string) {
  return title
    .replace(/\[.*?\]/g, '') // Remove brackets [Lyrical]
    .replace(/\(.*?\)/g, '') // Remove parentheses (Video Song)
    .replace(/Lyrical Video|Lyrical|Video Song|Full Video|Official Video|Trailer|Teaser|Promo/gi, '')
    .split('|')[0] // Sometimes separated by |
    .split('-')[0] // Sometimes separated by -
    .trim();
}

export async function GET(request: Request) {
  // 1. Verify cron secret to prevent unauthorized scraping
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'Missing YouTube API Key' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Need service role to bypass RLS for inserts
  const supabase = createClient(supabaseUrl, supabaseKey);

  const discoveredSongs = [];
  const engine = RealMusicEngine.getInstance();
  
  // Look back 7 days
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - 7);
  const publishedAfterStr = publishedAfter.toISOString();

  for (const channelId of OFFICIAL_CHANNELS) {
    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&publishedAfter=${publishedAfterStr}&key=${YOUTUBE_API_KEY}`;
      const ytRes = await fetch(ytUrl);
      
      if (!ytRes.ok) continue;
      
      const ytData = await ytRes.json();
      const items = ytData.items || [];

      for (const item of items) {
        const rawTitle = item.snippet.title;
        const publishedAt = item.snippet.publishedAt;
        
        // Skip trailers and promos
        if (/trailer|teaser|promo/i.test(rawTitle)) continue;

        const cleanTitle = sanitizeTitle(rawTitle);
        if (!cleanTitle) continue;

        // Verify with JioSaavn
        const jioResults = await engine.searchRealSongs(cleanTitle, 3);
        
        if (jioResults.length > 0) {
          const canonical = jioResults[0];
          
          // Verify it's actually a new release (released this year)
          const currentYear = new Date().getFullYear();
          if (canonical.releaseYear >= currentYear - 1) { // Allow late previous year just in case
            
            // Insert into our cache
            const releaseDate = new Date(canonical.releaseYear, 0, 1); // Mock month/day if only year is available
            
            const { error } = await supabase.from('verified_releases').upsert({
              id: canonical.id,
              title: canonical.title,
              artist: canonical.artist,
              cover_url: canonical.coverUrl,
              audio_url: canonical.audioUrl,
              youtube_published_at: publishedAt,
              official_release_date: releaseDate.toISOString(),
              language: 'Telugu', // Extending later for others
              song_metadata: canonical
            }, { onConflict: 'id' });

            if (!error) {
              discoveredSongs.push(canonical.title);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error processing channel ${channelId}:`, e);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Discovered and verified ${discoveredSongs.length} new releases.`,
    discoveredSongs
  });
}
