'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '@/types/music';
import { RecommendationResult, FeedbackSignal } from '@/types/recommendation';
import { usePlayerStore } from '@/context/usePlayerStore';
import { MoreLikeRecommendationEngine } from '@/lib/recommendation/MoreLikeRecommendationEngine';
import { RecommendationHeader } from './recommendation/RecommendationHeader';
import { RecommendationCarousel } from './recommendation/RecommendationCarousel';

interface MoreLikeWhatYouHeardShelfProps {
  /** Initial songs from server-side home feed (shown before dynamic refresh). */
  initialSongs: Song[];
  /** Fallback seed song title when no song is playing. */
  seedSongTitle?: string;
  /** Fallback seed song object when no song is playing. */
  seedSong?: Song;
}

export function MoreLikeWhatYouHeardShelf({
  initialSongs,
  seedSongTitle,
  seedSong: initialSeedSong,
}: MoreLikeWhatYouHeardShelfProps) {
  // ── Store ────────────────────────────────────────────────────────────────
  const { currentSong, isPlaying, playSong, shufflePlay, addToQueue, queue, queueIndex } =
    usePlayerStore();

  // ── Engine ───────────────────────────────────────────────────────────────
  const engine = MoreLikeRecommendationEngine.getInstance();

  // ── State ────────────────────────────────────────────────────────────────
  // Convert initial server-side songs into typed RecommendationResult[]
  const toResults = useCallback(
    (songs: Song[]): RecommendationResult[] =>
      songs
        .filter((s) => s.id !== currentSong?.id)
        .map((s) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          album: s.album || '',
          artwork: s.coverUrl || s.albumCoverUrl || '/app-icon.png',
          language: s.language || '',
          genre: s.genre || '',
          duration: s.duration || 0,
          recommendationScore: 50,
          reason: 'Recommended for you',
          rawSong: s,
        })),
    [currentSong?.id]
  );

  const [results, setResults] = useState<RecommendationResult[]>(() =>
    toResults(initialSongs)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);

  // The seed song driving the current recommendations
  const activeSeed = currentSong || initialSeedSong;

  // ── Deduplication / seed tracking ───────────────────────────────────────
  const lastSeedIdRef = useRef<string | null>(activeSeed?.id || null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch recommendations ────────────────────────────────────────────────
  const fetchRecommendations = useCallback(
    async (seed: Song, isInitialLoad = false) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      setIsLoading(true);
      if (!isInitialLoad) {
        setIsTransitioning(true);
      }

      try {
        // Build exclude list: seed + currently queued songs
        const excludeIds = [seed.id, ...queue.map((s) => s.id)];

        const fresh = await engine.getRecommendations(seed, excludeIds, 20, 'song');

        if (signal.aborted) return;

        if (fresh.length > 0) {
          setResults(fresh);
        } else if (isInitialLoad) {
          // Gracefully keep existing initial list if engine returns nothing
          setResults(toResults(initialSongs));
        }

        // Background pre-fetch for the next track in queue
        const nextTrack = queue[queueIndex + 1];
        if (nextTrack?.id && nextTrack.id !== seed.id) {
          engine
            .getRecommendations(nextTrack, [nextTrack.id], 15, 'song')
            .catch(() => {});
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('[MoreLikeWhatYouHeardShelf] fetch failed:', err);
        // On error, keep whatever results we have
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
          setTimeout(() => setIsTransitioning(false), 200);
        }
      }
    },
    [engine, queue, queueIndex, toResults, initialSongs]
  );

  // ── Seed change detection: refresh when currentSong changes ─────────────
  useEffect(() => {
    if (!currentSong?.id) return;
    if (currentSong.id === lastSeedIdRef.current) return;

    lastSeedIdRef.current = currentSong.id;
    fetchRecommendations(currentSong);
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial load (no song playing yet) ──────────────────────────────────
  useEffect(() => {
    if (currentSong?.id) return; // already handled above
    if (!initialSeedSong?.id) return;
    if (results.length >= 4) return; // already have enough from SSR

    fetchRecommendations(initialSeedSong, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  /**
   * User clicks a recommendation card.
   * 1. Start playing that song (with remaining recommendations as queue context).
   * 2. Feedback signal dispatched.
   * 3. The useEffect above will detect the seed change and refresh.
   */
  const handleSongSelect = useCallback(
    (result: RecommendationResult) => {
      const rawSongs = results.map((r) => r.rawSong);
      playSong(result.rawSong, rawSongs.length > 0 ? rawSongs : [result.rawSong]);
      engine.recordFeedback('play', result.rawSong);
    },
    [results, playSong, engine]
  );

  /**
   * Play All: sequential playback of all recommendation songs.
   */
  const handlePlayAll = useCallback(async () => {
    if (results.length === 0) return;
    const songs = results.map((r) => r.rawSong);
    playSong(songs[0], songs);
  }, [results, playSong]);

  /**
   * Shuffle: randomize order (with artist diversity enforcement), then play.
   */
  const handleShuffle = useCallback(async () => {
    if (results.length === 0) return;
    const shuffled = engine.shuffle(results);
    const songs = shuffled.map((r) => r.rawSong);
    await shufflePlay(songs);
  }, [results, engine, shufflePlay]);

  /**
   * User feedback (like, skip, queue, not-interested, etc.)
   * "Not Interested" triggers a slide-out animation then removes the card.
   */
  const handleFeedback = useCallback(
    (signal: FeedbackSignal, result: RecommendationResult) => {
      engine.recordFeedback(signal, result.rawSong);

      if (signal === 'not_interested') {
        // Animate out first, then remove
        setRemovingIds((prev) => new Set([...prev, result.id]));
        setTimeout(() => {
          setResults((prev) => prev.filter((r) => r.id !== result.id));
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(result.id);
            return next;
          });
        }, 380);
      }

      if (signal === 'add_to_queue') {
        addToQueue(result.rawSong);
      }
    },
    [engine, addToQueue]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  // Never render if we have nothing and aren't loading
  if (!isLoading && results.length === 0 && !activeSeed) return null;

  const seedTitle = activeSeed?.title || seedSongTitle;

  return (
    <section
      className={`mb-2.5 sm:mb-4 transition-opacity duration-200 ${
        isTransitioning ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <RecommendationHeader
        seedSongTitle={seedTitle || ''}
        isLoading={isLoading}
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        hasItems={results.length > 0}
      />

      <RecommendationCarousel
        results={results}
        currentSongId={currentSong?.id || null}
        isPlaying={isPlaying}
        isLoading={isLoading}
        onPlay={handleSongSelect}
        onFeedback={handleFeedback}
        removingIds={removingIds}
      />
    </section>
  );
}
