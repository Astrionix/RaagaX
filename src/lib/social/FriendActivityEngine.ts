import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';

export interface FriendActivityState {
  userId: string;
  userName: string;
  userAvatar?: string;
  songTitle: string;
  artist: string;
  coverUrl: string;
  isPlaying: boolean;
  timestamp: number;
}

export class FriendActivityEngine {
  private static instance: FriendActivityEngine;
  private channel: any = null;
  private listeners: Set<(activities: FriendActivityState[]) => void> = new Set();
  private activeActivities: Map<string, FriendActivityState> = new Map();

  private constructor() {}

  public static getInstance(): FriendActivityEngine {
    if (!FriendActivityEngine.instance) {
      FriendActivityEngine.instance = new FriendActivityEngine();
    }
    return FriendActivityEngine.instance;
  }

  public init() {
    if (this.channel) return;

    try {
      this.channel = supabase.channel('presence:music_activity', {
        config: { presence: { key: 'music_activity' } },
      });

      this.channel
        .on('presence', { event: 'sync' }, () => {
          const state = this.channel.presenceState();
          const list: FriendActivityState[] = [];
          Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p) => {
                if (p.userId && p.songTitle) {
                  list.push(p as FriendActivityState);
                }
              });
            }
          });
          this.activeActivities.clear();
          list.forEach((item) => this.activeActivities.set(item.userId, item));
          this.notifyListeners();
        })
        .subscribe();
    } catch (e) {
      console.warn('[FriendActivityEngine] Realtime presence sub skipped:', e);
    }
  }

  public broadcastActivity(song: Song | null, isPlaying: boolean) {
    if (!song) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      const userId = user?.id || 'guest-' + Math.random().toString(36).substring(2, 7);
      const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'RaagaX Listener';
      const userAvatar = user?.user_metadata?.avatar_url || '';

      const payload: FriendActivityState = {
        userId,
        userName,
        userAvatar,
        songTitle: song.title,
        artist: song.artist,
        coverUrl: song.coverUrl,
        isPlaying,
        timestamp: Date.now(),
      };

      if (!this.channel) this.init();

      if (this.channel) {
        this.channel.track(payload).catch(() => {});
      }
    }).catch(() => {});
  }

  public getActiveActivities(): FriendActivityState[] {
    return Array.from(this.activeActivities.values());
  }

  public onActivitiesUpdated(fn: (activities: FriendActivityState[]) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners() {
    const list = this.getActiveActivities();
    this.listeners.forEach((fn) => fn(list));
  }
}
