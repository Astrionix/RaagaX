'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Song } from '@/types/music';
import { ShelfItem } from '@/types/home';
import { Bell } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from './CarouselShelf';
import { getApiUrl } from '@/lib/config/apiConfig';
import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';

export function FollowedArtistsNewReleasesShelf() {
  const {
    favoriteArtistIds = [],
    preferredLanguage = 'Telugu',
  } = usePlayerStore();

  const [artistReleases, setArtistReleases] = useState<Song[]>([]);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (favoriteArtistIds.length === 0) {
      setArtistReleases([]);
      return;
    }

    let isCancelled = false;
    const topFollowedIds = favoriteArtistIds.slice(0, 4);
    const cacheKey = `followed_releases_${topFollowedIds.sort().join('_')}_${preferredLanguage}`;

    const loadReleases = async () => {
      // 1. Instant Cache Hydration (0ms load time)
      try {
        const db = RaagaDB.getInstance();
        const cached = await db.get<any>(STORES.BROWSE_CACHE, cacheKey);
        if (!isCancelled && cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
          setArtistReleases(cached.data);
          hasHydratedRef.current = true;
        }
      } catch (e) {
        // Cache miss is fine, continue to network
      }

      // 2. Fast background revalidation
      try {
        const songsList: Song[] = [];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout max

        await Promise.all(
          topFollowedIds.map(async (artistId) => {
            try {
              const url = getApiUrl(`/api/artists/${encodeURIComponent(artistId)}?songCount=8&albumCount=4`);
              const res = await fetch(url, { signal: controller.signal });
              if (res.ok) {
                const json = await res.json();
                const artist = json.data;
                if (artist?.topSongs) {
                  artist.topSongs.slice(0, 3).forEach((s: any) => {
                    songsList.push({
                      id: s.id,
                      title: s.name || s.title,
                      artist: artist.name,
                      artistId: artist.id,
                      album: s.album?.name || `${artist.name} Release`,
                      albumId: s.album?.id || `alb-${s.id}`,
                      coverUrl: s.image?.find?.((i: any) => i.quality === '500x500')?.url || s.image?.[s.image?.length - 1]?.url || artist.image?.[0]?.url || '/app-icon.png',
                      audioUrl: s.downloadUrl?.find?.((d: any) => d.quality === '320kbps')?.url || s.downloadUrl?.[s.downloadUrl?.length - 1]?.url || '',
                      duration: Number(s.duration) || 210,
                      genre: s.genre || preferredLanguage,
                      category: 'global_trending',
                      releaseYear: Number(s.year || s.releaseYear) || 2026,
                      plays: Number(s.playCount || s.plays) || 0,
                      likes: 1,
                      language: s.language || preferredLanguage,
                    });
                  });
                }
              }
            } catch {
              // Individual artist fetch error / abort ignored
            }
          })
        );

        clearTimeout(timeoutId);

        if (!isCancelled && songsList.length > 0) {
          const finalSongs = songsList.slice(0, 12);
          setArtistReleases(finalSongs);
          // Persist to IndexedDB cache for instant future loads
          RaagaDB.getInstance()
            .put(STORES.BROWSE_CACHE, { id: cacheKey, data: finalSongs, updatedAt: Date.now() })
            .catch(() => {});
        }
      } catch (e) {
        console.warn('[FollowedArtistsNewReleasesShelf] Background update failed:', e);
      }
    };

    loadReleases();
    return () => {
      isCancelled = true;
    };
  }, [favoriteArtistIds, preferredLanguage]);

  const shelfItems: ShelfItem[] = React.useMemo(() => {
    if (!artistReleases || artistReleases.length === 0) return [];
    return artistReleases.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: `By ${s.artist} • 2026`,
      imageUrl: s.coverUrl,
      type: 'song',
      rawItem: s,
    }));
  }, [artistReleases]);

  if (favoriteArtistIds.length === 0 || artistReleases.length === 0) {
    return null;
  }

  return (
    <section className="animate-in fade-in duration-200">
      <CarouselShelf
        title="New From Artists You Follow"
        subtitle="Latest releases from your subscribed artists"
        icon={<Bell className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
        items={shelfItems}
        showPlayAll
      />
    </section>
  );
}
