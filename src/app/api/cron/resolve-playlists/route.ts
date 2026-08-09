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
            // Diverse fallback images based on category
            const fallbacks: Record<string, string> = {
              'trending': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=500&h=500',
              'hits': 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?auto=format&fit=crop&q=80&w=500&h=500',
              'romantic': 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=500&h=500',
              'party': 'https://images.unsplash.com/photo-1516280440502-86846f4142d1?auto=format&fit=crop&q=80&w=500&h=500',
              'devotional': 'https://images.unsplash.com/photo-1604169720546-b333a595908b?auto=format&fit=crop&q=80&w=500&h=500',
              'workout': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=500&h=500',
              'chill': 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=500&h=500',
              'road_trip': 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f924?auto=format&fit=crop&q=80&w=500&h=500',
              'sad': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=500&h=500',
              'evergreen': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&q=80&w=500&h=500'
            };
            
            let imageUrl = fallbacks[cat.key] || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=500&h=500';
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

  return NextResponse.json({
    success: true,
    message: 'Successfully resolved and cached dynamic playlists',
    data: resolvedPlaylists
  });
}
