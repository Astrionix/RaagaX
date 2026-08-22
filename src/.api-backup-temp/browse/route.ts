import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, NEW_RELEASES_SOURCES, CLASSICS_SOURCES } from '@/lib/spotifySources';
import { DiscoveryQueue } from '@/lib/discovery/DiscoveryQueue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang') || 'Telugu';

  try {
    const trendingSource = TRENDING_SOURCES[lang] || TRENDING_SOURCES['Telugu'];
    const newReleasesSource = NEW_RELEASES_SOURCES[lang] || NEW_RELEASES_SOURCES['Telugu'];
    const classicsSource = CLASSICS_SOURCES[lang] || CLASSICS_SOURCES['Telugu'];
    const extraPlaylists = BROWSE_5_PLAYLISTS[lang] || BROWSE_5_PLAYLISTS['Telugu'];

    const requestedSections = [
      { id: 'trending', source: trendingSource },
      { id: 'new_releases', source: newReleasesSource },
      { id: 'classics', source: classicsSource },
      { id: 'p1', source: extraPlaylists[0] },
      { id: 'p2', source: extraPlaylists[1] },
      { id: 'p3', source: extraPlaylists[2] },
      { id: 'p4', source: extraPlaylists[3] },
      { id: 'p5', source: extraPlaylists[4] },
    ].filter(s => s.source && s.source.id);

    const playlistIds = requestedSections.map(s => s.source.id);

    // 1. Single batch query to Supabase for all requested playlists
    const { data: cachedPlaylists, error } = await supabaseAdmin
      .from('spotify_playlist_cache')
      .select('playlist_id, playlist_name, data, expires_at')
      .in('playlist_id', playlistIds);

    if (error) {
      console.error('[BROWSE API] DB Cache Error:', error);
    }

    const cacheMap = new Map();
    if (cachedPlaylists) {
      cachedPlaylists.forEach(row => {
        cacheMap.set(row.playlist_id, row);
      });
    }

    const sections: any[] = [];
    const addedPlaylistIds = new Set<string>();

    for (const section of requestedSections) {
      if (addedPlaylistIds.has(section.source.id)) continue;
      addedPlaylistIds.add(section.source.id);

      const cached = cacheMap.get(section.source.id);
      let status: 'ready' | 'stale' | 'loading' = 'loading';
      let items: any[] = [];
      let total = 0;

      let cachedSongs: any[] = [];
      if (cached && cached.data) {
        if (Array.isArray(cached.data)) {
          cachedSongs = cached.data;
        } else if (typeof cached.data === 'object' && Array.isArray((cached.data as any).songs)) {
          cachedSongs = (cached.data as any).songs;
        }
      }

      if (cachedSongs.length > 0) {
        const isStale = cached?.expires_at ? new Date(cached.expires_at).getTime() < Date.now() : false;
        const isUndersized = cachedSongs.length < 15;
        total = cachedSongs.length;

        if (isStale || isUndersized) {
          status = 'stale';
          // Enqueue refresh without awaiting
          DiscoveryQueue.enqueue(section.source.id, lang, section.source.title);
        } else {
          status = 'ready';
        }
        items = cachedSongs;
      } else {
        // Cache MISS - enqueue immediately and return loading
        status = 'loading';
        DiscoveryQueue.enqueue(section.source.id, lang, section.source.title);
      }

      // Apply 3-day recommendation cycle window & repetition penalty
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const cycleIndex = Math.floor(Date.now() / THREE_DAYS_MS);
      
      // Rotate starting offset per 3-day cycle to introduce fresh candidates without altering section titles
      if (items.length > 10) {
        const offset = (cycleIndex * 5) % Math.max(1, items.length - 10);
        items = [...items.slice(offset), ...items.slice(0, offset)].slice(0, 20);
      } else {
        items = items.slice(0, 20);
      }

      sections.push({
        id: section.id,
        sourceId: section.source.id,
        title: section.source.title,
        type: 'carousel',
        status,
        total,
        cycleIndex,
        hasMore: total > items.length,
        items: items.map(song => ({
          id: song.id,
          title: song.title,
          subtitle: song.artist,
          type: 'song',
          imageUrl: song.coverUrl,
          rawItem: song
        }))
      });
    }

    return NextResponse.json({ success: true, cycleDays: 3, sections });
  } catch (err) {
    console.error('[BROWSE API] Error:', err);
    return NextResponse.json({ success: false, sections: [] }, { status: 500 });
  }
}
