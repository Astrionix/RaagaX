'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Song } from '@/types/music';
import { ShelfItem } from '@/types/home';
import { Headphones } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CarouselShelf } from './CarouselShelf';
import { PersonalizationEngine } from '@/lib/recommendation/PersonalizationEngine';

interface MoreLikeWhatYouHeardShelfProps {
  initialSongs: Song[];
  seedSongTitle?: string;
  seedSong?: Song;
}

export function MoreLikeWhatYouHeardShelf({
  initialSongs,
  seedSongTitle,
  seedSong: initialSeedSong,
}: MoreLikeWhatYouHeardShelfProps) {
  const { currentSong, queue, queueIndex } = usePlayerStore();
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastSongIdRef = useRef<string | null>(currentSong?.id || null);

  // Active seed song: primarily currently playing song, fallback to initial seed
  const activeSeedSong = currentSong || initialSeedSong;

  useEffect(() => {
    if (!currentSong?.id) return;
    if (currentSong.id === lastSongIdRef.current) return;

    lastSongIdRef.current = currentSong.id;
    let isCancelled = false;

    const updateContextRecommendations = async () => {
      setIsTransitioning(true);
      try {
        const engine = PersonalizationEngine.getInstance();
        const freshList = await engine.getContextualRecommendations(currentSong, 'user', 20);

        if (!isCancelled && freshList && freshList.length > 0) {
          setSongs(freshList);
        }

        // Background Pre-fetch for next song in queue
        const nextTrack = queue[queueIndex + 1];
        if (nextTrack && nextTrack.id) {
          engine.getContextualRecommendations(nextTrack, 'user', 15).catch(() => {});
        }
      } catch (err) {
        console.warn('[MoreLikeWhatYouHeardShelf] Context update failed:', err);
      } finally {
        if (!isCancelled) {
          setTimeout(() => setIsTransitioning(false), 150);
        }
      }
    };

    updateContextRecommendations();

    return () => {
      isCancelled = true;
    };
  }, [currentSong?.id, queue, queueIndex]);

  const shelfItems: ShelfItem[] = React.useMemo(() => {
    if (!songs || songs.length === 0) return [];
    return songs.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: `${s.artist}${s.language ? ` • ${s.language}` : ''}`,
      imageUrl: s.coverUrl,
      type: 'song',
      rawItem: s,
    }));
  }, [songs]);

  if (!songs || songs.length === 0) return null;

  const subtitleText = activeSeedSong?.title
    ? `Based on "${activeSeedSong.title}"`
    : seedSongTitle
    ? `Based on "${seedSongTitle}"`
    : 'Songs inspired by your recent listening';

  return (
    <div className={`relative select-none transition-opacity duration-200 ${isTransitioning ? 'opacity-40 scale-[0.99]' : 'opacity-100 scale-100'}`}>
      <CarouselShelf
        title="More Like What You Heard"
        subtitle={subtitleText}
        icon={<Headphones className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />}
        items={shelfItems}
        showPlayAll={true}
      />
    </div>
  );
}
