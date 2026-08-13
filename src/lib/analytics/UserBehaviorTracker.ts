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
  playlist_id?: string;
  language?: string;
  genre?: string;
  query?: string;
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

  private constructor() {}

  public static getInstance(): UserBehaviorTracker {
    if (!UserBehaviorTracker.instance) {
      UserBehaviorTracker.instance = new UserBehaviorTracker();
    }
    return UserBehaviorTracker.instance;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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

    // 2. Persist event log & update language score in Supabase if authenticated
    if (userId && this.isUUID(userId) && navigator.onLine) {
      try {
        await supabase.from('user_events').insert({
          user_id: userId,
          event_type: event.event_type,
          song_id: event.song_id,
          album_id: event.album_id,
          artist_id: event.artist_id,
          playlist_id: event.playlist_id,
          query: event.query,
          metadata: event.metadata,
        });

        // Upsert artist affinity if present
        if (event.artist_id) {
          try {
            await supabase.rpc('increment_artist_affinity', {
              p_user_id: userId,
              p_artist_id: event.artist_id,
              p_weight: weight,
            });
          } catch (err) {}
        }

        // Update language affinity via RPC
        if (event.language) {
          try {
            await supabase.rpc('update_user_language_score', {
              p_user_id: userId,
              p_language: event.language,
              p_weight: weight,
              p_action: event.event_type,
            });
          } catch (err) {}
        }
      } catch (e) {
        console.warn('[UserBehaviorTracker] Failed to record event remote:', e);
      }
    }
  }
}
