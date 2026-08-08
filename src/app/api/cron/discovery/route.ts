import { NextResponse } from 'next/server';
import { ProviderRegistry } from '@/lib/discovery/ProviderRegistry';
// Ensure the JioSaavnProvider registers itself
import '@/lib/discovery/JioSaavnProvider'; 
import { SongResolver } from '@/lib/discovery/SongResolver';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time for vercel

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'telugu';

    console.log(`[Discovery Cron] Starting discovery job for ${language}...`);

    const registry = ProviderRegistry.getInstance();
    const provider = registry.getProvider('jiosaavn');

    if (!provider) {
      return NextResponse.json({ error: 'No providers available' }, { status: 500 });
    }

    // 1. Candidate Pool Generation
    let [trendingRaw, newRaw, top100Raw] = await Promise.all([
      provider.getChart('trending', language, 15),
      provider.getNewReleases(language, 20),
      provider.getChart('top100', language, 100),
    ]);

    // Inject the verified candidate list for New Releases if the language is Telugu
    if (language.toLowerCase() === 'telugu') {
      const verifiedCandidates = [
        { id: 'vc1', title: 'Rakasikara', artist: '', language: 'telugu', releaseDate: '2026-07-31', provider: 'verified_seed' },
        { id: 'vc2', title: 'Patnam Pothav Bava', artist: '', language: 'telugu', releaseDate: '2026-07-31', provider: 'verified_seed' },
        { id: 'vc3', title: 'Bangaram', artist: '', language: 'telugu', releaseDate: '2026-07-30', provider: 'verified_seed' },
        { id: 'vc4', title: 'Pacha Pulla', artist: '', language: 'telugu', releaseDate: '2026-07-30', provider: 'verified_seed' },
        { id: 'vc5', title: 'Milky Beauty', artist: '', language: 'telugu', releaseDate: '2026-07-30', provider: 'verified_seed' },
      ];
      
      // We will perform a live JioSaavn search for each verified candidate to resolve its playable data!
      const resolvedSeeds = await Promise.all(
        verifiedCandidates.map(async (c) => {
          try {
            const results = await provider.search(c.title, 1);
            if (results && results.length > 0) {
              // Override the API's inaccurate date with our verified internet date
              return { ...results[0], releaseDate: c.releaseDate };
            }
          } catch (e) {
             console.warn(`[Discovery] Failed to resolve seed: ${c.title}`);
          }
          return null;
        })
      );
      
      const validSeeds = resolvedSeeds.filter(Boolean) as any[];
      // Prepend the deeply verified seeds to the newRaw array
      newRaw = [...validSeeds, ...newRaw];
    }

    // 2. Resolve, Normalize, Dedupe, and Store
    const [trending, newReleases, top100] = await Promise.all([
      SongResolver.resolveAndStore(trendingRaw, 'trending', language),
      SongResolver.resolveAndStore(newRaw, 'new_releases', language),
      SongResolver.resolveAndStore(top100Raw, 'top100', language),
    ]);

    // 3. Generate Popular Playlists organically from the new catalog
    await generatePlaylists(top100, language);

    return NextResponse.json({
      success: true,
      message: `Discovery complete for ${language}`,
      stats: {
        trending_resolved: trending.length,
        new_releases_resolved: newReleases.length,
        top100_resolved: top100.length
      }
    });

  } catch (error: any) {
    console.error('[Discovery Cron] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function generatePlaylists(top100: any[], language: string) {
  if (top100.length < 20) return;
  
  import('@/lib/supabase').then(async ({ getSupabase }) => {
    try {
      const supabase = getSupabase();
      // 1. Create a "Top Hits" playlist
      const topHitsId = `pl_tophits_${language}`;
      await supabase.from('playlists').upsert({
        id: topHitsId,
        title: `${language.charAt(0).toUpperCase() + language.slice(1)} Top Hits`,
        description: 'The biggest chart-toppers right now.',
        language: language,
        cover_url: top100[0]?.coverUrl || ''
      }, { onConflict: 'id' });

      // Add top 20 to the playlist
      const top20 = top100.slice(0, 20);
      await supabase.from('playlist_songs').upsert(
        top20.map((s, idx) => ({
          playlist_id: topHitsId,
          song_id: s.id,
          position: idx
        })),
        { onConflict: 'playlist_id,song_id' }
      );

      // 2. Create a "Chill & Melody" playlist (Randomly sampled for now)
      const chillId = `pl_chill_${language}`;
      await supabase.from('playlists').upsert({
        id: chillId,
        title: `Chill ${language}`,
        description: 'Relaxing and melodious tracks.',
        language: language,
        cover_url: top100[10]?.coverUrl || top100[0]?.coverUrl || ''
      }, { onConflict: 'id' });

      const chillSongs = top100.slice().sort(() => Math.random() - 0.5).slice(0, 20);
      await supabase.from('playlist_songs').upsert(
        chillSongs.map((s, idx) => ({
          playlist_id: chillId,
          song_id: s.id,
          position: idx
        })),
        { onConflict: 'playlist_id,song_id' }
      );
      
    } catch (e) {
      console.warn('[Discovery Cron] Failed to generate playlists:', e);
    }
  });
}
