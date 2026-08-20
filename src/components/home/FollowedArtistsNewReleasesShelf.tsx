'use client';

import React, { useState, useEffect } from 'react';
import { Song } from '@/types/music';
import { ShelfItem } from '@/types/home';
import { Bell, Play, Heart, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from './CarouselShelf';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';

export function FollowedArtistsNewReleasesShelf() {
  const {
    favoriteArtistIds = [],
    setActiveTab,
    setSelectedArtistId,
    playSong,
    likedSongIds = [],
    toggleLikeSong,
    preferredLanguage = 'Telugu',
  } = usePlayerStore();

  const [artistReleases, setArtistReleases] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (favoriteArtistIds.length === 0) {
      setArtistReleases([]);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    const fetchFollowedReleases = async () => {
      try {
        const topFollowedIds = favoriteArtistIds.slice(0, 4);
        const songsList: Song[] = [];

        await Promise.all(
          topFollowedIds.map(async (artistId) => {
            try {
              const res = await fetch(`/api/artists/${encodeURIComponent(artistId)}?songCount=8&albumCount=4`);
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
            } catch {}
          })
        );

        if (!isCancelled && songsList.length > 0) {
          // Shuffle slightly to blend multiple followed artists
          setArtistReleases(songsList.slice(0, 12));
        }
      } catch (e) {
        console.warn('Failed to load followed artists releases:', e);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchFollowedReleases();
    return () => {
      isCancelled = true;
    };
  }, [favoriteArtistIds, preferredLanguage]);

  if (favoriteArtistIds.length === 0 || (!isLoading && artistReleases.length === 0)) {
    return null;
  }

  const shelfItems: ShelfItem[] = artistReleases.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: `By ${s.artist} • 2026`,
    imageUrl: s.coverUrl,
    type: 'song',
    rawItem: s,
  }));

  return (
    <section className="animate-in fade-in duration-200">
      {isLoading && artistReleases.length === 0 ? (
        <div className="h-44 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#fa233b] animate-spin" />
        </div>
      ) : (
        <CarouselShelf
          title="New From Artists You Follow"
          subtitle="Latest releases from your subscribed artists"
          icon={<Bell className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          items={shelfItems}
          showPlayAll
        />
      )}
    </section>
  );
}
