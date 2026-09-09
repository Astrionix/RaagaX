import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';

export interface FriendActivityState {
  userId: string;
  userTag: string;
  userName: string;
  userAvatar?: string;
  songTitle: string;
  artist: string;
  coverUrl: string;
  isPlaying: boolean;
  timestamp: number;
}

/**
 * Generates and preserves a persistent, unique identity for this device/installation.
 * Ensures that User A and User B always have different, permanent RGX tags.
 */
export function getMyFriendIdentity(): { userId: string; userTag: string; userName: string; userAvatar: string } {
  if (typeof window === 'undefined') {
    return { userId: 'usr_guest', userTag: 'RGX-0000', userName: 'RaagaX Listener', userAvatar: '' };
  }

  let userId = localStorage.getItem('raagax_user_id');
  if (!userId) {
    userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('raagax_user_id', userId);
  }

  let userTag = localStorage.getItem('raagax_user_tag');
  if (!userTag || userTag === 'RGX-0000' || userTag === 'RGX-D295' || !userTag.startsWith('RGX-') || userTag.length < 8) {
    // Generate a permanent random 4-character alphanumeric code (digits + uppercase letters)
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userTag = `RGX-${code}`;
    localStorage.setItem('raagax_user_tag', userTag);
  }

  let userName = localStorage.getItem('raagax_user_name');
  if (!userName || userName === 'RaagaX Listener') {
    userName = `Friend ${userTag.replace('RGX-', '')}`;
    localStorage.setItem('raagax_user_name', userName);
  }

  return { userId, userTag, userName, userAvatar: '' };
}

export class FriendActivityEngine {
  private static instance: FriendActivityEngine;
  private channel: any = null;
  private isSubscribed = false;
  private listeners: Set<(activities: FriendActivityState[]) => void> = new Set();
  private activeActivities: Map<string, FriendActivityState> = new Map();
  private lastBroadcastPayload: FriendActivityState | null = null;
  private pendingPayload: FriendActivityState | null = null;
  private localBroadcastChannel: any = null;

  private constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.localBroadcastChannel = new BroadcastChannel('raagax_friend_activity_local');
        this.localBroadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'FRIEND_ACTIVITY') {
            this.handleIncomingActivity(event.data.payload);
          }
        };
      } catch {}
    }
  }

  public static getInstance(): FriendActivityEngine {
    if (!FriendActivityEngine.instance) {
      FriendActivityEngine.instance = new FriendActivityEngine();
    }
    return FriendActivityEngine.instance;
  }

  public init() {
    if (this.channel) return;

    try {
      const myIdentity = getMyFriendIdentity();

      // Channel config using both broadcast (for 100% reliable instant signals)
      // and presence (with unique client key)
      this.channel = supabase.channel('raaga_friends_stream', {
        config: {
          broadcast: { self: false },
          presence: { key: myIdentity.userId },
        },
      });

      // 1. Instant Realtime Broadcasts
      this.channel.on('broadcast', { event: 'FRIEND_ACTIVITY' }, ({ payload }: { payload: FriendActivityState }) => {
        if (payload && payload.userId) {
          this.handleIncomingActivity(payload);
        }
      });

      // 2. Ping-Pong: When someone joins, they ping so existing players announce their songs
      this.channel.on('broadcast', { event: 'FRIEND_PING' }, () => {
        if (this.lastBroadcastPayload && this.lastBroadcastPayload.isPlaying) {
          this.sendBroadcast(this.lastBroadcastPayload);
        }
      });

      // 3. Presence Sync as fallback
      this.channel.on('presence', { event: 'sync' }, () => {
        try {
          const state = this.channel.presenceState();
          Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p) => {
                if (p.userId && p.songTitle) {
                  this.handleIncomingActivity(p as FriendActivityState);
                }
              });
            }
          });
        } catch {}
      });

      // 4. Subscribe and trigger queued activity
      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          // Ping to discover who is currently online and playing
          try {
            this.channel.send({
              type: 'broadcast',
              event: 'FRIEND_PING',
              payload: { from: myIdentity.userId },
            });
          } catch {}

          // Flush any pending payload that was queued before subscription finished
          if (this.pendingPayload) {
            this.sendBroadcast(this.pendingPayload);
            this.pendingPayload = null;
          }
        }
      });
    } catch (e) {
      console.warn('[FriendActivityEngine] Realtime init warning:', e);
    }
  }

  public broadcastActivity(song: Song | null, isPlaying: boolean) {
    if (typeof window === 'undefined') return;

    const myIdentity = getMyFriendIdentity();

    if (!song) {
      if (this.lastBroadcastPayload) {
        this.lastBroadcastPayload.isPlaying = false;
        this.sendBroadcast(this.lastBroadcastPayload);
      }
      return;
    }

    // Try reading session if user is logged in to get user full name / avatar
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      const userName =
        user?.user_metadata?.full_name?.split(' ')[0] ||
        user?.email?.split('@')[0] ||
        myIdentity.userName;
      const userAvatar = user?.user_metadata?.avatar_url || '';

      const payload: FriendActivityState = {
        userId: myIdentity.userId,
        userTag: myIdentity.userTag,
        userName,
        userAvatar,
        songTitle: song.title,
        artist: song.artist,
        coverUrl: song.coverUrl,
        isPlaying,
        timestamp: Date.now(),
      };

      this.lastBroadcastPayload = payload;
      this.sendBroadcast(payload);
    }).catch(() => {
      const payload: FriendActivityState = {
        userId: myIdentity.userId,
        userTag: myIdentity.userTag,
        userName: myIdentity.userName,
        userAvatar: '',
        songTitle: song.title,
        artist: song.artist,
        coverUrl: song.coverUrl,
        isPlaying,
        timestamp: Date.now(),
      };
      this.lastBroadcastPayload = payload;
      this.sendBroadcast(payload);
    });
  }

  private sendBroadcast(payload: FriendActivityState) {
    // 1. Send via local tab BroadcastChannel
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({ type: 'FRIEND_ACTIVITY', payload });
      } catch {}
    }

    // 2. Send via Supabase Realtime Channel
    if (!this.channel) {
      this.init();
    }

    if (!this.isSubscribed || !this.channel) {
      this.pendingPayload = payload;
      return;
    }

    try {
      this.channel.send({
        type: 'broadcast',
        event: 'FRIEND_ACTIVITY',
        payload,
      });

      // Also track in presence for new joiners
      this.channel.track(payload).catch(() => {});
    } catch (err) {
      console.warn('[FriendActivityEngine] Broadcast send error:', err);
    }
  }

  private handleIncomingActivity(activity: FriendActivityState) {
    if (!activity || !activity.userId) return;

    // Do not register our own activity as a "friend"
    const my = getMyFriendIdentity();
    if (activity.userId === my.userId || (activity.userTag && activity.userTag === my.userTag)) {
      return;
    }

    // If friend paused or stopped, remove their active status immediately
    if (!activity.isPlaying) {
      this.activeActivities.delete(activity.userId);
    } else {
      this.activeActivities.set(activity.userId, activity);
    }
    this.notifyListeners();
  }

  /**
   * Returns active activities, excluding current user and stale activities (> 5m).
   */
  public getActiveActivities(excludeSelf = true): FriendActivityState[] {
    const now = Date.now();
    const list = Array.from(this.activeActivities.values()).filter(
      (item) => item.isPlaying && now - item.timestamp < 300000
    );
    if (!excludeSelf) return list;
    const my = getMyFriendIdentity();
    return list.filter((item) => item.userId !== my.userId && item.userTag !== my.userTag);
  }

  public onActivitiesUpdated(fn: (activities: FriendActivityState[]) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners() {
    const list = this.getActiveActivities(true);
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch {}
    });
  }
}
