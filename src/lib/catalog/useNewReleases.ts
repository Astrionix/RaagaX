'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Song } from '@/types/music';
import { NewReleasesEngine } from '@/lib/catalog/NewReleasesEngine';

export interface UseNewReleasesResult {
  songs: Song[];
  isLoading: boolean;
  isRevalidating: boolean;
  refresh: () => Promise<void>;
}

/**
 * useNewReleases — Unified Cache-First Hook for New Releases
 *
 * 1. Synchronously reads L1 memory / L2 persistent cache (0ms instant render, zero flicker).
 * 2. If valid cache exists -> displays songs immediately & silently revalidates in the background.
 * 3. If NO cache exists -> sets isLoading=true (shows skeleton UI). NEVER renders fake/old songs.
 * 4. Deduplicates in-flight network requests across the application.
 * 5. Uses request versioning to prevent stale race-condition overwrites.
 * 6. Uses deep ID comparison to prevent unnecessary UI re-rendering when data hasn't changed.
 */
export function useNewReleases(language: string = 'Telugu', limit = 50): UseNewReleasesResult {
  const engine = NewReleasesEngine.getInstance();
  const normalizedLang = language || 'Telugu';

  // 1. Check synchronous cache on initial render
  const cachedInitial = engine.getCachedSongs(normalizedLang);

  const [songs, setSongs] = useState<Song[]>(() => cachedInitial || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedInitial || cachedInitial.length === 0);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const activeLangRef = useRef(normalizedLang);
  activeLangRef.current = normalizedLang;
  const requestVersionRef = useRef(0);

  const loadData = useCallback(async (forceRefresh = false) => {
    const currentVersion = ++requestVersionRef.current;
    const targetLang = activeLangRef.current;

    const existingCache = engine.getCachedSongs(targetLang);
    if (existingCache && existingCache.length > 0 && !forceRefresh) {
      setSongs(existingCache);
      setIsLoading(false);
      setIsRevalidating(true);
    } else if (!existingCache || existingCache.length === 0) {
      setIsLoading(true);
    }

    try {
      const freshSongs = await engine.fetchNewReleases(targetLang, limit, forceRefresh);

      // Race condition guard: ignore if language or request version has changed
      if (currentVersion !== requestVersionRef.current || activeLangRef.current !== targetLang) {
        return;
      }

      if (freshSongs && freshSongs.length > 0) {
        setSongs((prev) => {
          // Compare canonical IDs to prevent layout shift / flash when list is identical
          const prevIds = prev.map((s) => s.id).join(',');
          const freshIds = freshSongs.map((s) => s.id).join(',');
          if (prevIds === freshIds && prev.length > 0) {
            return prev;
          }
          return freshSongs;
        });
      }
    } catch (err) {
      console.warn('[useNewReleases] Failed to revalidate new releases:', err);
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setIsLoading(false);
        setIsRevalidating(false);
      }
    }
  }, [engine, limit]);

  useEffect(() => {
    const langCache = engine.getCachedSongs(normalizedLang);
    if (langCache && langCache.length > 0) {
      setSongs(langCache);
      setIsLoading(false);
    } else {
      setSongs([]);
      setIsLoading(true);
    }

    // Check if the cached data is stale (> 30 min) to decide revalidation mode.
    // If fresh: skip network fetch entirely. If stale or absent: revalidate in background.
    const mem = (engine as any).constructor.languageCache?.get(normalizedLang);
    const CLIENT_TTL = 30 * 60 * 1000;
    const isFresh = mem && typeof mem.fetchedAt === 'number' && Date.now() - mem.fetchedAt < CLIENT_TTL;

    if (!isFresh) {
      loadData(false);
    }
  }, [normalizedLang, loadData, engine]);

  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  return {
    songs,
    isLoading,
    isRevalidating,
    refresh,
  };
}
