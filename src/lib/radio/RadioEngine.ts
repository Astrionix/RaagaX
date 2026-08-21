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

    try {
      // 1. Create Radio Station on backend adapter
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

      const stationData = await stationRes.json();
      const stationId = stationData?.data?.stationId || `station_${type}_${Date.now()}`;

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

      // 2. Fetch first batch of 20 tracks
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

      const res = await fetch(getApiUrl(`/api/radio?${params.toString()}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const newSongs: Song[] = json?.data?.songs || [];

      newSongs.forEach((song) => {
        if (song.id) this.currentSession?.fetchedSongIds.add(song.id);
      });

      if (newSongs.length === 0) {
        if (this.currentSession) this.currentSession.hasMore = false;
      }

      return newSongs;
    } catch (e) {
      console.warn('[RadioEngine] Error fetching radio batch:', e);
      return [];
    } finally {
      if (this.currentSession) this.currentSession.isFetching = false;
    }
  }

  /**
   * Triggered when remaining unplayed songs in queue <= 4.
   * Fetches next 20 songs and seamlessly appends them to the queue without altering history.
   */
  public async extendQueueIfNeeded(remainingCount: number): Promise<void> {
    if (!this.currentSession || remainingCount > 4 || this.currentSession.isFetching || !this.currentSession.hasMore) {
      return;
    }

    const nextBatch = await this.fetchBatch(20);
    if (nextBatch.length > 0) {
      const state = usePlayerStore.getState();
      const currentQueue = state.queue;
      const existingIds = new Set(currentQueue.map((s) => s.id));
      const uniqueNew = nextBatch.filter((s) => !existingIds.has(s.id));

      if (uniqueNew.length > 0) {
        // 1. Non-destructively append to Zustand store queue
        const updatedQueue = [...currentQueue, ...uniqueNew];
        usePlayerStore.setState({ queue: updatedQueue });

        // 2. Non-destructively append to QueueManager
        const { QueueManager } = await import('@/lib/queue/QueueManager');
        QueueManager.getInstance().appendQueue(uniqueNew, 'RADIO');
        console.log(`[RadioEngine] Appended ${uniqueNew.length} fresh radio tracks to queue. (Total: ${updatedQueue.length})`);
      }
    }
  }

  public stopRadio(): void {
    this.currentSession = null;
  }
}
