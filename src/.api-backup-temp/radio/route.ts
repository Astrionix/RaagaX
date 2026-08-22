import { NextRequest, NextResponse } from 'next/server';
import { CreateSongStationUseCase } from '@/modules/songs/use-cases/create-song-station';
import { GetSongSuggestionsUseCase } from '@/modules/songs/use-cases/get-song-suggestions';
import { createSongPayload } from '@/modules/songs/helpers';
import { Endpoints } from '@/common/constants';
import { ApiContextEnum } from '@/common/enums';
import { apiFetch } from '@/common/helpers';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { DiscoveryEngine, DiscoveryLanguage } from '@/lib/discoveryEngine';
import { Song } from '@/types/music';

interface StationRequest {
  type: 'song' | 'artist' | 'album' | 'genre' | 'mood' | 'language' | 'for_you';
  seedId: string;
  seedTitle?: string;
  language?: string;
}

// ─── POST /api/radio: Create a radio station ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StationRequest;
    const type = body.type || 'song';
    const seedId = body.seedId || 'station_root';
    const seedTitle = body.seedTitle || 'RaagaX Radio';
    const language = body.language || 'Telugu';

    let stationId = '';

    // If type is song, artist, or album with a numeric/valid entity ID, call native webradio.createEntityStation
    if ((type === 'song' || type === 'artist' || type === 'album') && seedId && !seedId.startsWith('custom_')) {
      try {
        const entityType = type === 'artist' ? 'artist' : type === 'album' ? 'album' : 'queue';
        const encodedEntityId = JSON.stringify([encodeURIComponent(seedId)]);

        const { data, ok } = await apiFetch<{ stationid: string }>({
          endpoint: Endpoints.songs.station,
          params: {
            entity_id: encodedEntityId,
            entity_type: entityType,
          },
          context: ApiContextEnum.ANDROID,
        });

        if (ok && data?.stationid) {
          stationId = data.stationid;
        }
      } catch (e) {
        console.warn('[RADIO API] JioSaavn native station creation fallback:', e);
      }
    }

    // Generate robust synthetic station identifier if native station returned empty
    if (!stationId) {
      stationId = `station_${type}_${encodeURIComponent(seedId)}_${Date.now()}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        type,
        seedId,
        seedTitle,
        language,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[RADIO API] Create station error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Could not create radio station' },
      { status: 500 }
    );
  }
}

// ─── GET /api/radio: Retrieve next batch of radio station songs ───────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stationId = searchParams.get('stationId') || '';
    const seedType = searchParams.get('type') || 'song';
    const seedId = searchParams.get('seedId') || '';
    const seedTitle = searchParams.get('seedTitle') || '';
    const language = searchParams.get('language') || 'Telugu';
    const count = Math.min(Math.max(parseInt(searchParams.get('count') || '20', 10), 5), 40);
    const excludeParam = searchParams.get('excludeIds') || '';
    const excludeIds = new Set(excludeParam.split(',').filter(Boolean));

    let candidateSongs: Song[] = [];

    // 1. Try JioSaavn native webradio.getSong directly if stationId is valid
    if (stationId && !stationId.startsWith('station_')) {
      try {
        const { data, ok } = await apiFetch<any>({
          endpoint: Endpoints.songs.suggestions,
          params: {
            stationid: stationId,
            k: count + 5,
          },
          context: ApiContextEnum.ANDROID,
        });

        if (ok && data) {
          const { stationid: _, ...suggestions } = data;
          const rawSongs = Object.values(suggestions)
            .map((element: any) => element && createSongPayload(element.song))
            .filter(Boolean);

          if (Array.isArray(rawSongs) && rawSongs.length > 0) {
            candidateSongs = rawSongs.map((s: any) => ({
              id: s.id,
              title: s.name || s.title,
              artist: s.artists?.primary?.map((a: any) => a.name).join(', ') || s.primaryArtists || 'RaagaX Radio',
              artistId: s.artists?.primary?.[0]?.id || 'radio_artist',
              album: s.album?.name || 'Radio Mix',
              albumId: s.album?.id || 'radio_album',
              coverUrl: s.image?.[2]?.url || s.image?.[1]?.url || s.image?.[0]?.url || '/app-icon.png',
              audioUrl: s.downloadUrl?.[4]?.url || s.downloadUrl?.[3]?.url || s.downloadUrl?.[0]?.url || '',
              duration: parseInt(s.duration || '240', 10),
              genre: s.language || language,
              language: s.language || language,
              releaseYear: parseInt(s.year || `${new Date().getFullYear()}`, 10),
              plays: parseInt(s.playCount || '10000', 10),
              likes: 1000,
              category: 'radio',
            }));
          }
        }
      } catch (e) {
        console.warn('[RADIO API] Native webradio.getSong error, falling back:', e);
      }
    }

    // 2. Try Song Suggestions use case if candidateSongs is still empty and seedId is available
    if (candidateSongs.length === 0 && seedId && !seedId.startsWith('station_')) {
      try {
        const getSuggestions = new GetSongSuggestionsUseCase();
        const raw = await getSuggestions.execute({ songId: seedId, limit: count + 5 });
        if (Array.isArray(raw) && raw.length > 0) {
          candidateSongs = raw.map((s: any) => ({
            id: s.id,
            title: s.name || s.title,
            artist: s.artists?.primary?.map((a: any) => a.name).join(', ') || s.primaryArtists || 'RaagaX Radio',
            artistId: s.artists?.primary?.[0]?.id || 'radio_artist',
            album: s.album?.name || 'Radio Mix',
            albumId: s.album?.id || 'radio_album',
            coverUrl: s.image?.[2]?.url || s.image?.[1]?.url || s.image?.[0]?.url || '/app-icon.png',
            audioUrl: s.downloadUrl?.[4]?.url || s.downloadUrl?.[3]?.url || s.downloadUrl?.[0]?.url || '',
            duration: parseInt(s.duration || '240', 10),
            genre: s.language || language,
            language: s.language || language,
            releaseYear: parseInt(s.year || `${new Date().getFullYear()}`, 10),
            plays: parseInt(s.playCount || '10000', 10),
            likes: 1000,
            category: 'radio',
          }));
        }
      } catch (e) {
        console.warn('[RADIO API] WebRadio suggestions fallback error:', e);
      }
    }

    // 2. Multi-tier Fallback based on Radio Type
    if (candidateSongs.length < count) {
      const realMusic = RealMusicEngine.getInstance();
      let fallbackQuery = '';

      if (seedType === 'artist') {
        fallbackQuery = `${seedTitle || seedId} ${language} songs`;
      } else if (seedType === 'album') {
        fallbackQuery = `${seedTitle || seedId} songs`;
      } else if (seedType === 'genre') {
        fallbackQuery = `${seedTitle || seedId} ${language} hits`;
      } else if (seedType === 'mood') {
        fallbackQuery = `${seedTitle} ${language} songs`;
      } else if (seedType === 'for_you') {
        fallbackQuery = `Top ${language} trending hits`;
      } else if (seedType === 'language') {
        fallbackQuery = `Best of ${language} music`;
      } else {
        fallbackQuery = `${seedTitle} ${language} songs`;
      }

      try {
        const searchResults = await realMusic.searchRealSongs(fallbackQuery, count * 2);
        if (searchResults && searchResults.length > 0) {
          candidateSongs = [...candidateSongs, ...searchResults];
        }
      } catch (err) {
        console.warn('[RADIO API] Search fallback error:', err);
      }
    }

    // 3. 3rd Tier Fallback: Discovery Engine Top Chart for Language
    if (candidateSongs.length < count) {
      try {
        const host = req.headers.get('host') || 'localhost:3001';
        const proto = req.headers.get('x-forwarded-proto') || 'http';
        const discovery = DiscoveryEngine.getInstance(`${proto}://${host}`);
        const result = await discovery.discover(language as DiscoveryLanguage);
        if (result?.topChart?.length) {
          const chartSongs = result.topChart.map((r) => r.song);
          candidateSongs = [...candidateSongs, ...chartSongs];
        }
      } catch (err) {
        console.warn('[RADIO API] Discovery top chart fallback error:', err);
      }
    }

    // Deduplicate against already played/queued IDs and within this response
    const seenIds = new Set<string>(excludeIds);
    const uniqueBatch: Song[] = [];

    for (const song of candidateSongs) {
      if (song && song.id && !seenIds.has(song.id)) {
        seenIds.add(song.id);
        uniqueBatch.push({
          ...song,
          category: 'radio',
        });
        if (uniqueBatch.length >= count) break;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        count: uniqueBatch.length,
        songs: uniqueBatch,
        hasMore: true,
      },
    });
  } catch (err: any) {
    console.error('[RADIO API] Get station songs error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch radio songs', songs: [] },
      { status: 500 }
    );
  }
}
