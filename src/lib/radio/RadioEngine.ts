import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { getApiUrl } from '@/lib/config/apiConfig';
import { haptics } from '@/lib/haptics/HapticEngine';

export type RadioType = 'song' | 'artist' | 'album' | 'genre' | 'mood' | 'language' | 'for_you';

export interface RadioSession {
  stationId: string;
  type: RadioType;
  seedId: string;
  seedTitle: string;
  seedCover?: string;
  language: string;
  fetchedSongIds: Set<string>;
  isFetching: boolean;
  hasMore: boolean;
}

export interface StartRadioOptions {
  type: RadioType;
  seedId: string;
  seedTitle: string;
  seedCover?: string;
  initialSong?: Song;
  language?: string;
}

export class RadioEngine {
  private static instance: RadioEngine;
  private currentSession: RadioSession | null = null;

  private constructor() {}

  public static getInstance(): RadioEngine {
    if (!RadioEngine.instance) {
      RadioEngine.instance = new RadioEngine();
    }
    return RadioEngine.instance;
  }

  public getActiveSession(): RadioSession | null {
    return this.currentSession;
  }

  public isRadioActive(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Start a new continuous Radio stream based on a seed (Song, Artist, Album, Genre, Mood, Language, ForYou).
   * Fetches the initial batch of 20 tracks and plays the seed immediately.
   */
  public async startRadio(options: StartRadioOptions): Promise<boolean> {
    haptics.mediumImpact();
    const { type, seedId, seedTitle, seedCover, initialSong } = options;
    const language = options.language || usePlayerStore.getState().preferredLanguage || 'Telugu';

    let stationId = `station_${type}_${Date.now()}`;

    try {
      // 1. Attempt to create Radio Station on backend adapter
      try {
        const stationRes = await fetch(getApiUrl('/api/radio'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            seedId,
            seedTitle,
            language,
          }),
        });

        if (stationRes.ok) {
          const stationData = await stationRes.json();
          if (stationData?.data?.stationId) {
            stationId = stationData.data.stationId;
          }
        }
      } catch (e) {
        console.warn('[RadioEngine] API station creation fallback active:', e);
      }

      // Initialize session tracker
      const fetchedIds = new Set<string>();
      if (initialSong?.id) fetchedIds.add(initialSong.id);

      this.currentSession = {
        stationId,
        type,
        seedId,
        seedTitle,
        seedCover,
        language,
        fetchedSongIds: fetchedIds,
        isFetching: false,
        hasMore: true,
      };

      // 2. Fetch first batch of tracks
      const initialBatch = await this.fetchBatch(20);

      const allTracks: Song[] = [];
      if (initialSong) {
        allTracks.push(initialSong);
      }

      for (const track of initialBatch) {
        if (!allTracks.some((s) => s.id === track.id)) {
          allTracks.push(track);
        }
      }

      // If batch was empty and we have no initial song, fallback to direct search
      if (allTracks.length === 0) {
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const query = type === 'song' || type === 'artist' 
          ? seedTitle 
          : `${seedTitle} ${language} Hit Songs`;
        const fallbackResults = await RealMusicEngine.getInstance().searchRealSongs(query, 20);
        allTracks.push(...fallbackResults);
      }

      if (allTracks.length === 0) {
        console.warn('[RadioEngine] Initial radio batch was empty');
        return false;
      }

      // 3. Play first song with radio queue and context
      usePlayerStore.getState().playSong(allTracks[0], allTracks, {
        type: 'radio',
        id: stationId,
        title: `${seedTitle} Radio`,
        contextType: 'RADIO',
        contextUri: `raagax:radio:${type}:${encodeURIComponent(seedId)}`,
      });

      return true;
    } catch (err) {
      console.error('[RadioEngine] Failed to start radio:', err);
      return false;
    }
  }

  /**
   * Fetches the next batch of radio tracks from the active station.
   */
  private async fetchBatch(count = 20): Promise<Song[]> {
    if (!this.currentSession || this.currentSession.isFetching || !this.currentSession.hasMore) {
      return [];
    }

    this.currentSession.isFetching = true;
    const { stationId, type, seedId, seedTitle, language, fetchedSongIds } = this.currentSession;
    const excludeIds = Array.from(fetchedSongIds).join(',');

    try {
      const params = new URLSearchParams({
        stationId,
        type,
        seedId,
        seedTitle,
        language,
        count: String(count),
        excludeIds,
      });

      let newSongs: Song[] = [];

      try {
        const res = await fetch(getApiUrl(`/api/radio?${params.toString()}`));
        if (res.ok) {
          const json = await res.json();
          newSongs = json?.data?.songs || [];
        }
      } catch (netErr) {
        console.warn('[RadioEngine] /api/radio endpoint fallback:', netErr);
      }

      // Fallback: RealMusicEngine
      if (newSongs.length === 0) {
        const { RealMusicEngine } = await import('@/lib/realMusicEngine');
        const query = type === 'song' || type === 'artist' 
          ? seedTitle 
          : `${seedTitle} ${language} Songs`;
        const fallbackResults = await RealMusicEngine.getInstance().searchRealSongs(query, count);
        newSongs = fallbackResults.filter((s) => !fetchedSongIds.has(s.id));
      }

      newSongs.forEach((song) => {
        if (song.id) this.currentSession?.fetchedSongIds.add(song.id);
      });

      if (newSongs.length === 0) {
        if (this.currentSession) this.currentSession.hasMore = false;
      }

      return newSongs;
    } catch (err) {
      console.error('[RadioEngine] Failed to fetch radio batch:', err);
      return [];
    } finally {
      if (this.currentSession) {
        this.currentSession.isFetching = false;
      }
    }
  }

  /**
   * Called by queue management when remaining unplayed songs fall below threshold.
   */
  public async ensureContinuousRadioQueue(remainingTracksCount: number, threshold = 3): Promise<void> {
    if (!this.currentSession || !this.currentSession.hasMore || this.currentSession.isFetching) {
      return;
    }

    if (remainingTracksCount <= threshold) {
      const nextBatch = await this.fetchBatch(15);
      if (nextBatch.length > 0) {
        const store = usePlayerStore.getState();
        const currentQueue = store.queue || [];
        const filteredNewTracks = nextBatch.filter((newSong) => !currentQueue.some((q) => q.id === newSong.id));

        if (filteredNewTracks.length > 0) {
          const updatedQueue = [...currentQueue, ...filteredNewTracks];
          usePlayerStore.setState({ queue: updatedQueue });
        }
      }
    }
  }

  /**
   * Alias for continuous queue replenishment.
   */
  public async extendQueueIfNeeded(remainingTracksCount: number, threshold = 3): Promise<void> {
    return this.ensureContinuousRadioQueue(remainingTracksCount, threshold);
  }

  /**
   * Stop and reset current radio session.
   */
  public stopRadio(): void {
    this.currentSession = null;
  }
}
