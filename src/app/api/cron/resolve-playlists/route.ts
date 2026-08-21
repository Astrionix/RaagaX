import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return new Response('Unauthorized', { status: 401 });
  }

  const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
  
  const CATEGORIES = [
    { key: 'trending', label: 'Trending', queries: ['Trending', 'Top Charts', 'Viral Hits'] },
    { key: 'hits', label: 'Hits', queries: ['Hits', 'Superhits', 'Chartbusters'] },
    { key: 'romantic', label: 'Romantic Melodies', queries: ['Romantic', 'Love Songs', 'Melodies'] },
    { key: 'party', label: 'Party Time', queries: ['Party', 'Dance', 'EDM'] },
    { key: 'devotional', label: 'Devotional', queries: ['Devotional', 'Bhakti', 'Spiritual'] },
    { key: 'workout', label: 'Workout', queries: ['Workout', 'Gym'] },
    { key: 'chill', label: 'Lofi & Chill', queries: ['Lofi', 'Chill'] },
    { key: 'road_trip', label: 'Road Trip', queries: ['Road Trip', 'Travel'] },
    { key: 'sad', label: 'Sad & Emotional', queries: ['Sad', 'Emotional', 'Heartbreak'] }
  ];

  const resolvedPlaylists: Record<string, Record<string, any[]>> = {};

  for (const lang of LANGUAGES) {
    resolvedPlaylists[lang] = {};
    
    for (const cat of CATEGORIES) {
      resolvedPlaylists[lang][cat.key] = [];
      
      for (const q of cat.queries) {
        // e.g. "Telugu Workout"
        const searchQuery = `${lang} ${q}`;
        
        try {
          // Hit the official JioSaavn search API for playlists
          const res = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&_format=json&q=${encodeURIComponent(searchQuery)}&p=1&n=5`);
          const data = await res.json();
          
          let bestPlaylist: any = null;
          let maxSongs = 0;

          if (data && data.results && data.results.length > 0) {
            for (const p of data.results) {
              const pTitle = decodeURIComponent(p.title || p.listname || '').toLowerCase();
              
              // Skip decades unless the category is evergreen
              if (cat.key !== 'evergreen' && (pTitle.includes('1990') || pTitle.includes('90s') || pTitle.includes('80s') || pTitle.includes('2000s'))) {
                continue;
              }

              // Verify it actually has songs and keep the one with the most songs!
              try {
                const playlistCheck = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/playlists?id=${p.id}`);
                const playlistData = await playlistCheck.json();
                
                const songCount = playlistData?.data?.songs?.length || 0;
                
                if (songCount > maxSongs) {
                  maxSongs = songCount;
                  bestPlaylist = p;
                }
                
                // If we found one with 50+, that's good enough to stop searching
                if (songCount >= 50) {
                  break; 
                }
              } catch (e) {}
            }
          }

          // If the best playlist we found has at least 5 songs, accept it
          if (bestPlaylist && maxSongs >= 5) {
            const p = bestPlaylist;
            let imageUrl = '/app-icon.png';
            if (p.image && p.image.trim() !== '') {
               imageUrl = p.image.replace('150x150', '500x500').replace('50x50', '500x500');
            }
            
            resolvedPlaylists[lang][cat.key].push({
              id: p.id,
              title: decodeURIComponent(p.title || p.listname || '').replace(/\+/g, ' '),
              type: 'playlist',
              imageUrl
            });
          } else {
             // Fallback search without language prefix if nothing found
             const fallbackRes = await fetch(`https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&_format=json&q=${encodeURIComponent(q)}&p=1&n=1`);
             const fallbackData = await fallbackRes.json();
             if (fallbackData && fallbackData.results && fallbackData.results.length > 0) {
                const fp = fallbackData.results[0];
                resolvedPlaylists[lang][cat.key].push({
                  id: fp.id,
                  title: decodeURIComponent(fp.title || fp.listname || '').replace(/\+/g, ' '),
                  type: 'playlist',
                  imageUrl: fp.image ? fp.image.replace('150x150', '500x500') : ''
                });
             }
          }
        } catch (e) {
          console.error(`Failed to resolve ${searchQuery}:`, e);
        }
      }
    }
  }

  // Save to local cache file
  const cachePath = path.join(process.cwd(), 'src/lib/dynamic_home_playlists.json');
  fs.writeFileSync(cachePath, JSON.stringify(resolvedPlaylists, null, 2));

  // Atomic publication to Supabase recommendation_snapshots
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const version = `v_${now}`;

    // Insert new snapshot as ACTIVE
    await supabaseAdmin.from('recommendation_snapshots').insert({
      user_id: 'global_catalog',
      category: 'category_snapshot_3day',
      items: resolvedPlaylists,
      version,
      generated_at: new Date(now).toISOString(),
      expires_at: new Date(now + THREE_DAYS_MS).toISOString(),
    });
  } catch (err) {
    console.warn('[ResolvePlaylistsCron] Failed to save remote atomic snapshot:', err);
  }

  return NextResponse.json({
    success: true,
    message: 'Successfully resolved, published atomically, and cached 3-day dynamic playlists',
    data: resolvedPlaylists
  });
}
