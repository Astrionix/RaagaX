import { supabase } from '@/lib/supabase';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';

export type UserEventType =
  | 'SEARCH'
  | 'OPEN_ARTIST'
  | 'OPEN_ALBUM'
  | 'PLAY'
  | 'PLAY_HALF'
  | 'COMPLETE'
  | 'REPLAY'
  | 'LIKE'
  | 'UNLIKE'
  | 'ADD_TO_PLAYLIST'
  | 'REMOVE_FROM_PLAYLIST'
  | 'FOLLOW_ARTIST'
  | 'SKIP';

export interface UserEvent {
  event_type: UserEventType;
  song_id?: string;
  album_id?: string;
  artist_id?: string;
  artist_name?: string;
  playlist_id?: string;
  language?: string;
  genre?: string;
  query?: string;
  position_ms?: number;
  duration_ms?: number;
  metadata?: any;
}

const EVENT_WEIGHTS: Record<UserEventType, number> = {
  SEARCH: 2,
  OPEN_ARTIST: 1,
  OPEN_ALBUM: 1,
  PLAY: 2,
  PLAY_HALF: 4,
  COMPLETE: 5,
  REPLAY: 6,
  LIKE: 10,
  UNLIKE: -8,
  ADD_TO_PLAYLIST: 12,
  REMOVE_FROM_PLAYLIST: -8,
  FOLLOW_ARTIST: 8,
  SKIP: -3,
};

export class UserBehaviorTracker {
  private static instance: UserBehaviorTracker;
  private pendingQueue: Array<UserEvent & { userId: string; timestamp: number }> = [];
  private flushTimer: any = null;
  private isFlushing = false;

  private constructor() {
    this.setupFlushLifecycle();
  }

  public static getInstance(): UserBehaviorTracker {
    if (!UserBehaviorTracker.instance) {
      UserBehaviorTracker.instance = new UserBehaviorTracker();
    }
    return UserBehaviorTracker.instance;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  private setupFlushLifecycle() {
    if (typeof window === 'undefined') return;

    // Periodic flush every 30s
    this.flushTimer = setInterval(() => {
      this.flushBatch();
    }, 30000);

    // Flush on page unload / background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushBatch();
      }
    });
    window.addEventListener('beforeunload', () => {
      this.flushBatch();
    });
  }

  public async trackEvent(userId: string, event: UserEvent): Promise<void> {
    const weight = EVENT_WEIGHTS[event.event_type] || 0;
    const localDb = LocalDatabase.getInstance();

    // 1. Update local affinity scores optimistically
    if (event.artist_id) {
      const current = (await localDb.getUserStore<Record<string, number>>(userId, 'artist_affinity')) || {};
      current[event.artist_id] = Math.max(0, (current[event.artist_id] || 0) + weight);
      await localDb.setUserStore(userId, 'artist_affinity', current);
    }

    if (event.language) {
      const current = (await localDb.getUserStore<Record<string, number>>(userId, 'language_affinity')) || {};
      current[event.language] = Math.max(0, (current[event.language] || 0) + weight);
      await localDb.setUserStore(userId, 'language_affinity', current);
    }

    if (event.genre) {
      const current = (await localDb.getUserStore<Record<string, number>>(userId, 'genre_affinity')) || {};
      current[event.genre] = Math.max(0, (current[event.genre] || 0) + weight);
      await localDb.setUserStore(userId, 'genre_affinity', current);
    }

    // 2. Queue event for batched sync
    if (userId && this.isUUID(userId)) {
      this.pendingQueue.push({
        ...event,
        userId,
        timestamp: Date.now(),
      });

      // Flush if queue exceeds batch threshold
      if (this.pendingQueue.length >= 5) {
        this.flushBatch();
      }
    }
  }

  public async flushBatch(): Promise<void> {
    if (this.isFlushing || this.pendingQueue.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isFlushing = true;
    const batch = [...this.pendingQueue];
    this.pendingQueue = [];

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const payload = batch.map((item) => ({
        trackId: item.song_id || item.query || 'unknown',
        eventType: item.event_type,
        positionMs: item.position_ms || 0,
        durationMs: item.duration_ms || 0,
        artistId: item.artist_id,
        artistName: item.artist_name,
        language: item.language,
        genre: item.genre,
        timestamp: item.timestamp,
      }));

      await fetch('/api/preferences/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ events: payload }),
      }).catch(() => {});
    } catch {
      // Re-queue on failure if within reasonable size limit
      if (this.pendingQueue.length < 50) {
        this.pendingQueue.unshift(...batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
