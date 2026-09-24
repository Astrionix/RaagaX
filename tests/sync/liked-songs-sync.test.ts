import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountIsolationGuard } from '@/lib/auth/AccountIsolationGuard';

const mockDbState = {
  liked_songs: [] as { user_id: string; song_id: string }[],
  playlists: [] as any[],
  playlist_songs: [] as any[],
  user_favorites: [] as any[],
  user_downloads: [] as any[],
  user_library_state: [] as any[],
};

let capturedRealtimeCallbacks: Record<string, (payload: any) => void> = {};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: '00000000-0000-4000-8000-000000000001' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((table: string) => {
      return {
        select: vi.fn((_cols?: string) => {
          return {
            eq: vi.fn((col: string, val: any) => {
              const rows = (mockDbState as any)[table] || [];
              const filtered = rows.filter((r: any) => r[col] === val);
              return {
                order: vi.fn().mockResolvedValue({ data: filtered, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: filtered[0] || null, error: null }),
                single: vi.fn().mockResolvedValue({ data: filtered[0] || null, error: null }),
                then: (resolve: any) => resolve({ data: filtered, error: null }),
              };
            }),
            order: vi.fn().mockResolvedValue({ data: (mockDbState as any)[table] || [], error: null }),
            then: (resolve: any) => resolve({ data: (mockDbState as any)[table] || [], error: null }),
          };
        }),
        upsert: vi.fn((record: any) => {
          const rows = (mockDbState as any)[table] || [];
          const items = Array.isArray(record) ? record : [record];
          items.forEach(item => {
            if (table === 'liked_songs') {
              const existingIdx = rows.findIndex((r: any) => r.user_id === item.user_id && r.song_id === item.song_id);
              if (existingIdx >= 0) rows[existingIdx] = item;
              else rows.push(item);
            }
          });
          (mockDbState as any)[table] = rows;
          return Promise.resolve({ data: record, error: null });
        }),
        delete: vi.fn(() => {
          return {
            eq: vi.fn((col1: string, val1: any) => {
              return {
                eq: vi.fn((col2: string, val2: any) => {
                  const rows = (mockDbState as any)[table] || [];
                  (mockDbState as any)[table] = rows.filter((r: any) => !(r[col1] === val1 && r[col2] === val2));
                  return Promise.resolve({ data: null, error: null });
                }),
                then: (resolve: any) => {
                  const rows = (mockDbState as any)[table] || [];
                  (mockDbState as any)[table] = rows.filter((r: any) => r[col1] !== val1);
                  return resolve({ data: null, error: null });
                }
              };
            }),
          };
        }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    channel: vi.fn(() => {
      const channelMock: any = {
        on: vi.fn((event: string, config: any, callback: (payload: any) => void) => {
          if (config?.table) {
            capturedRealtimeCallbacks[config.table] = callback;
          }
          return channelMock;
        }),
        subscribe: vi.fn((statusCb) => {
          if (statusCb) statusCb('SUBSCRIBED');
          return channelMock;
        }),
        unsubscribe: vi.fn(() => channelMock),
      };
      return channelMock;
    }),
  }
}));

import { usePlayerStore } from '@/context/usePlayerStore';
import { AccountSyncEngine } from '@/lib/sync/AccountSyncEngine';
import { Song } from '@/types/music';

const testUserId = '00000000-0000-4000-8000-000000000001';

const mockSongA: Song = {
  id: 'song_test_1',
  title: 'Chuttamalle',
  artist: 'Anirudh Ravichander',
  duration: 215,
  coverUrl: '/covers/devara.jpg',
  audioUrl: 'https://cdn.raagax.com/devara.mp3',
} as Song;

const mockSongB: Song = {
  id: 'song_test_2',
  title: 'Daavudi',
  artist: 'Nakash Aziz',
  duration: 230,
  coverUrl: '/covers/daavudi.jpg',
  audioUrl: 'https://cdn.raagax.com/daavudi.mp3',
} as Song;

describe('Liked Songs Cloud Sync & Realtime Integrity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedRealtimeCallbacks = {};
    mockDbState.liked_songs = [];

    usePlayerStore.setState({
      likedSongIds: [],
      likedSongs: [],
    });

    AccountIsolationGuard.getInstance().setAuthenticatedUser(testUserId, 'TEST_LIKED_SONGS_SUITE');
  });

  it('1. Subscribes to liked_songs in Realtime channel and receives remote like event', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    await syncEngine.subscribeToRealtime(testUserId);

    // Verify liked_songs channel listener is registered
    expect(capturedRealtimeCallbacks['liked_songs']).toBeDefined();

    // Trigger realtime INSERT through channel callback
    await capturedRealtimeCallbacks['liked_songs']({
      eventType: 'INSERT',
      new: { user_id: testUserId, song_id: mockSongA.id },
    });

    // Verify store has the liked song
    const store = usePlayerStore.getState();
    expect(store.likedSongIds).toContain(mockSongA.id);
  });

  it('2. Realtime DELETE event removes song immediately from likedSongIds and likedSongs', async () => {
    usePlayerStore.setState({
      likedSongIds: [mockSongA.id, mockSongB.id],
      likedSongs: [mockSongA, mockSongB],
    });

    const syncEngine = AccountSyncEngine.getInstance();
    await syncEngine.handleRealtimeLikedSongs(testUserId, {
      eventType: 'DELETE',
      old: { user_id: testUserId, song_id: mockSongA.id },
    });

    const store = usePlayerStore.getState();
    expect(store.likedSongIds).not.toContain(mockSongA.id);
    expect(store.likedSongIds).toContain(mockSongB.id);
    expect(store.likedSongs.some((s) => s.id === mockSongA.id)).toBe(false);
  });

  it('3. Liking a song removes any opposing UNLIKE mutation and saves to cloud', async () => {
    const syncEngine = AccountSyncEngine.getInstance();

    await syncEngine.likeSong(testUserId, mockSongA.id);

    // Verify it is in database
    expect(mockDbState.liked_songs.some((r) => r.song_id === mockSongA.id)).toBe(true);

    // Now unlike the song
    await syncEngine.unlikeSong(testUserId, mockSongA.id);
    expect(mockDbState.liked_songs.some((r) => r.song_id === mockSongA.id)).toBe(false);
  });

  it('4. Reconcile merges remote liked songs accurately', async () => {
    mockDbState.liked_songs = [
      { user_id: testUserId, song_id: mockSongA.id },
      { user_id: testUserId, song_id: mockSongB.id },
    ];

    const syncEngine = AccountSyncEngine.getInstance();
    await syncEngine.reconcile(testUserId);

    const store = usePlayerStore.getState();
    expect(store.likedSongIds).toContain(mockSongA.id);
    expect(store.likedSongIds).toContain(mockSongB.id);
  });
});
