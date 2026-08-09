import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RealMusicEngine } from '@/lib/realMusicEngine';

// Hardcoded Official Telugu Labels for Discovery
const OFFICIAL_CHANNELS = [
  // Original / Currently Added
  'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series Telugu
  'UCv33xVn3RABVd0-uB8fD1-w', // Aditya Music
  'UC1K0F3f-OQG6lZ-bC1d-TPA', // Sony Music South
  'UCT7nKq3fGhtgGf4TtyhL08Q', // Saregama Telugu
  'UCNU4HqM6tV5NfK6BwB-02Yw', // Mango Music
  'UCLsSLka8jODBozvi5VTQeaQ', // Zee Music South
  'UCcXqIv2HjTo_c2IPYmUqiQg', // Madhura Audio
  'UCr1dDNc_slCvGcx83ExYFYg', // Silly Monks Music
  
  // Expanded List
  'UCNApqoVYJbYSrni4YsbXzyQ', // Aditya Music (Main)
  'UCn4rEMqKtwBQ6-oEwbd4PcA', // Sony Music South Official
  'UCWqyzn3cDkRDh3kRGWrIQwA', // Mango Music (Main)
  'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series
  'UC56gTxNs4f9xZ7Pa2i5xNzg', // Sony Music India
  'UC2V5vzgmEmoiWqXfM2jN5_w', // Tips Telugu
  'UC-gAtrZkAy6LxLq9_moL7qA', // Mango Mass Media
  'UCSXwEK86-OWEn_QF65X7c7Q', // Junglee Music Telugu
  'UC6Mw_A2tBKiXeVaOhNwWfBQ', // Divo Music
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
        
        // Skip trailers, promos, jukeboxes, making videos, and non-song content
        if (/trailer|teaser|promo|sneak peek|jukebox|making|bgm|mashup|ost|interview/i.test(rawTitle)) continue;

        const cleanTitle = sanitizeTitle(rawTitle);
        if (!cleanTitle || cleanTitle.length < 2) continue;

        // Verify with JioSaavn - Force Telugu query to avoid getting Tamil/Hindi dubs
        const jioResults = await engine.searchRealSongs(`${cleanTitle} telugu`, 3);
        
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
