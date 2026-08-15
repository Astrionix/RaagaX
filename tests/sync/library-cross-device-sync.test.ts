import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDbState = {
  liked_songs: [] as { user_id: string; song_id: string }[],
  playlists: [] as any[],
  playlist_songs: [] as any[],
  user_favorites: [] as any[],
  user_downloads: [] as any[],
  user_library_state: [] as any[],
};

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
            in: vi.fn((col: string, vals: any[]) => {
              const rows = (mockDbState as any)[table] || [];
              const filtered = rows.filter((r: any) => vals.includes(r[col]));
              return {
                order: vi.fn().mockResolvedValue({ data: filtered, error: null }),
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
            } else if (table === 'playlist_songs') {
              const existingIdx = rows.findIndex((r: any) => r.playlist_id === item.playlist_id && r.song_id === item.song_id);
              if (existingIdx >= 0) rows[existingIdx] = item;
              else rows.push(item);
            } else if (table === 'user_favorites') {
              const existingIdx = rows.findIndex((r: any) => r.user_id === item.user_id && r.item_id === item.item_id && r.item_type === item.item_type);
              if (existingIdx >= 0) rows[existingIdx] = item;
              else rows.push(item);
            } else {
              rows.push(item);
            }
          });
          (mockDbState as any)[table] = rows;
          return Promise.resolve({ data: record, error: null });
        }),
        insert: vi.fn((record: any) => {
          const rows = (mockDbState as any)[table] || [];
          rows.push(record);
          (mockDbState as any)[table] = rows;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: record, error: null }),
              then: (resolve: any) => resolve({ data: [record], error: null }),
            }),
            then: (resolve: any) => resolve({ data: record, error: null }),
          };
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
            match: vi.fn((matchObj: Record<string, any>) => {
              const rows = (mockDbState as any)[table] || [];
              (mockDbState as any)[table] = rows.filter((r: any) => {
                return !Object.entries(matchObj).every(([k, v]) => r[k] === v);
              });
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    }),
  }
}));

import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { AccountSyncEngine } from '@/lib/sync/AccountSyncEngine';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_sync_1',
  title: 'Chuttamalle',
  artist: 'Devara',
  duration: 215,
  coverUrl: '/covers/devara.jpg',
  audioUrl: 'https://cdn.raagax.com/devara.mp3',
} as Song;

const mockSongB: Song = {
  id: 'song_sync_2',
  title: 'Fear Song',
  artist: 'Devara',
  duration: 198,
  coverUrl: '/covers/fear.jpg',
  audioUrl: 'https://cdn.raagax.com/fear.mp3',
} as Song;

describe('RaagaX Cross-Device Library Synchronization Architecture Tests', () => {
  const testUserId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockDbState.liked_songs = [];
    mockDbState.playlists = [];
    mockDbState.playlist_songs = [];
    mockDbState.user_favorites = [];
    mockDbState.user_downloads = [];
    mockDbState.user_library_state = [];

    usePlayerStore.setState({
      likedSongIds: [],
      likedSongs: [],
      favoriteArtistIds: [],
      favoriteAlbumIds: [],
      downloadedSongIds: [],
      cloudDownloadedSongIds: [],
    });

    usePlaylistStore.setState({
      playlists: [],
      isLoading: false,
    });
  });

  // ── SCENARIO 1 & 2: Realtime Like Event (Mobile ❤️ -> Laptop Immediately) ───
  it('Scenario 1 & 2: Realtime like event immediately updates store without waiting for pull', async () => {
    const syncEngine = AccountSyncEngine.getInstance();

    // Mobile sends like event payload through Realtime to Laptop
    await syncEngine.handleRealtimeLikedSongs(testUserId, {
      eventType: 'INSERT',
      new: { user_id: testUserId, song_id: mockSongA.id },
    });

    const store = usePlayerStore.getState();
    expect(store.likedSongIds).toContain(mockSongA.id);
  });

  // ── SCENARIO 3 & 4: Realtime Unlike Event (Laptop unlike -> Mobile Immediately)
  it('Scenario 3 & 4: Realtime unlike event immediately removes song from store', async () => {
    usePlayerStore.setState({
      likedSongIds: [mockSongA.id, mockSongB.id],
      likedSongs: [mockSongA, mockSongB],
    });

    const syncEngine = AccountSyncEngine.getInstance();

    // Realtime DELETE event arrives
    await syncEngine.handleRealtimeLikedSongs(testUserId, {
      eventType: 'DELETE',
      old: { user_id: testUserId, song_id: mockSongA.id },
    });

    const store = usePlayerStore.getState();
    expect(store.likedSongIds).not.toContain(mockSongA.id);
    expect(store.likedSongIds).toContain(mockSongB.id);
  });

  // ── SCENARIO 5 & 6: Realtime Playlist Creation ─────────────────────────────
  it('Scenario 5 & 6: Realtime playlist creation event adds playlist to other device store', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    const playlistId = 'pl_telugu_party_55';

    await syncEngine.handleRealtimePlaylists(testUserId, {
      eventType: 'INSERT',
      new: {
        id: playlistId,
        name: 'Telugu Party 2026',
        description: 'High energy party songs',
        cover_url: '/covers/party.jpg',
        owner_id: testUserId,
        visibility: 'public',
      },
    });

    const playlists = usePlaylistStore.getState().playlists;
    expect(playlists.some(p => p.id === playlistId)).toBe(true);
    expect(playlists.find(p => p.id === playlistId)?.title).toBe('Telugu Party 2026');
  });

  // ── SCENARIO 7 & 8: Realtime Add Song to Playlist ─────────────────────────
  it('Scenario 7 & 8: Realtime playlist_songs INSERT event updates track list in playlist', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    const playlistId = 'pl_telugu_party_55';

    usePlaylistStore.setState({
      playlists: [
        {
          id: playlistId,
          title: 'Telugu Party 2026',
          description: '',
          coverUrl: '',
          visibility: 'private',
          ownerId: testUserId,
          creator: 'You',
          songIds: [],
          songs: [],
        },
      ],
    });

    // Mobile adds song -> Laptop receives Realtime event
    await syncEngine.handleRealtimePlaylistSongs({
      eventType: 'INSERT',
      new: {
        playlist_id: playlistId,
        song_id: mockSongA.id,
        position: 1,
      },
    });

    const playlist = usePlaylistStore.getState().playlists.find(p => p.id === playlistId);
    expect(playlist?.songIds).toContain(mockSongA.id);
  });

  // ── SCENARIO 9 & 10: Realtime Remove Song from Playlist ────────────────────
  it('Scenario 9 & 10: Realtime playlist_songs DELETE event removes track from playlist', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    const playlistId = 'pl_telugu_party_55';

    usePlaylistStore.setState({
      playlists: [
        {
          id: playlistId,
          title: 'Telugu Party 2026',
          description: '',
          coverUrl: '',
          visibility: 'private',
          ownerId: testUserId,
          creator: 'You',
          songIds: [mockSongA.id, mockSongB.id],
          songs: [mockSongA, mockSongB],
        },
      ],
    });

    // Realtime DELETE event arrives
    await syncEngine.handleRealtimePlaylistSongs({
      eventType: 'DELETE',
      old: {
        playlist_id: playlistId,
        song_id: mockSongA.id,
      },
    });

    const playlist = usePlaylistStore.getState().playlists.find(p => p.id === playlistId);
    expect(playlist?.songIds).not.toContain(mockSongA.id);
    expect(playlist?.songIds).toContain(mockSongB.id);
  });

  // ── SCENARIO 11: Realtime Playlist Rename / Update ─────────────────────────
  it('Scenario 11: Realtime playlist UPDATE event renames playlist on other device', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    const playlistId = 'pl_telugu_party_55';

    usePlaylistStore.setState({
      playlists: [
        {
          id: playlistId,
          title: 'Old Title',
          description: 'Old Desc',
          coverUrl: '',
          visibility: 'private',
          ownerId: testUserId,
          creator: 'You',
          songIds: [],
          songs: [],
        },
      ],
    });

    await syncEngine.handleRealtimePlaylists(testUserId, {
      eventType: 'UPDATE',
      new: {
        id: playlistId,
        name: 'New Telugu Vibes 2026',
        description: 'Updated Description',
        owner_id: testUserId,
      },
    });

    const playlist = usePlaylistStore.getState().playlists.find(p => p.id === playlistId);
    expect(playlist?.title).toBe('New Telugu Vibes 2026');
    expect(playlist?.description).toBe('Updated Description');
  });

  // ── SCENARIO 12: Realtime Delete Playlist ──────────────────────────────────
  it('Scenario 12: Realtime playlist DELETE event immediately removes playlist from store', async () => {
    const syncEngine = AccountSyncEngine.getInstance();
    const playlistId = 'pl_delete_target';

    usePlaylistStore.setState({
      playlists: [
        {
          id: playlistId,
          title: 'To Be Deleted',
          description: '',
          coverUrl: '',
          visibility: 'private',
          ownerId: testUserId,
          creator: 'You',
          songIds: [],
          songs: [],
        },
      ],
    });

    await syncEngine.handleRealtimePlaylists(testUserId, {
      eventType: 'DELETE',
      old: { id: playlistId },
    });

    const playlists = usePlaylistStore.getState().playlists;
    expect(playlists.some(p => p.id === playlistId)).toBe(false);
  });

  // ── SCENARIO 13: Duplicate Realtime Event (Idempotent UI) ───────────────────
  it('Scenario 13: Duplicate Realtime events do not cause duplicate song entries in store', async () => {
    const syncEngine = AccountSyncEngine.getInstance();

    const payload = {
      eventType: 'INSERT',
      new: { user_id: testUserId, song_id: mockSongA.id },
    };

    await syncEngine.handleRealtimeLikedSongs(testUserId, payload);
    await syncEngine.handleRealtimeLikedSongs(testUserId, payload);
    await syncEngine.handleRealtimeLikedSongs(testUserId, payload);

    const store = usePlayerStore.getState();
    const matches = store.likedSongIds.filter(id => id === mockSongA.id);
    expect(matches).toHaveLength(1);
  });

  // ── SCENARIO 14 & 15: Realtime User Favorites (Artist & Album) ─────────────
  it('Scenario 14 & 15: Realtime user_favorites INSERT separates artist and album favorites', async () => {
    const syncEngine = AccountSyncEngine.getInstance();

    await syncEngine.handleRealtimeUserFavorites(testUserId, {
      eventType: 'INSERT',
      new: { user_id: testUserId, item_id: 'artist_dsp', item_type: 'artist' },
    });

    await syncEngine.handleRealtimeUserFavorites(testUserId, {
      eventType: 'INSERT',
      new: { user_id: testUserId, item_id: 'album_pushpa_2', item_type: 'album' },
    });

    const store = usePlayerStore.getState();
    expect(store.favoriteArtistIds).toContain('artist_dsp');
    expect(store.favoriteAlbumIds).toContain('album_pushpa_2');
    expect(store.favoriteArtistIds).not.toContain('album_pushpa_2');
  });

  // ── SCENARIO 16: Realtime Remove Favorite ──────────────────────────────────
  it('Scenario 16: Realtime user_favorites DELETE removes favorite without affecting others', async () => {
    usePlayerStore.setState({
      favoriteArtistIds: ['artist_dsp', 'artist_thaman'],
      favoriteAlbumIds: ['album_pushpa_2'],
    });

    const syncEngine = AccountSyncEngine.getInstance();

    await syncEngine.handleRealtimeUserFavorites(testUserId, {
      eventType: 'DELETE',
      old: { item_id: 'artist_dsp', item_type: 'artist' },
    });

    const store = usePlayerStore.getState();
    expect(store.favoriteArtistIds).not.toContain('artist_dsp');
    expect(store.favoriteArtistIds).toContain('artist_thaman');
    expect(store.favoriteAlbumIds).toContain('album_pushpa_2');
  });

  // ── SCENARIO 17 & 18: Simultaneous Likes & Unlike Race ─────────────────────
  it('Scenario 17 & 18: Simultaneous likes and unlike race resolve cleanly', async () => {
    const syncEngine = AccountSyncEngine.getInstance();

    // Simulate Device A liking and Device B immediately unliking
    await syncEngine.handleRealtimeLikedSongs(testUserId, {
      eventType: 'INSERT',
      new: { user_id: testUserId, song_id: mockSongA.id },
    });
    await syncEngine.handleRealtimeLikedSongs(testUserId, {
      eventType: 'DELETE',
      old: { user_id: testUserId, song_id: mockSongA.id },
    });

    const store = usePlayerStore.getState();
    expect(store.likedSongIds).not.toContain(mockSongA.id);
  });

  // ── SCENARIO 19 & 20: Full Reconcile Consistency ───────────────────────────
  it('Scenario 19 & 20: Full reconcile maintains integrity of all library tables', async () => {
    const syncEngine = AccountSyncEngine.getInstance();

    mockDbState.liked_songs = [{ user_id: testUserId, song_id: mockSongB.id }];
    mockDbState.user_favorites = [{ user_id: testUserId, item_id: 'artist_thaman', item_type: 'artist' }];
    mockDbState.playlists = [{
      id: 'pl_sync_99',
      name: 'Consistent Playlist',
      description: '',
      cover_url: '',
      owner_id: testUserId,
      visibility: 'private',
    }];
    mockDbState.playlist_songs = [{
      playlist_id: 'pl_sync_99',
      song_id: mockSongB.id,
      position: 1,
    }];

    await syncEngine.reconcile(testUserId);

    const store = usePlayerStore.getState();
    const plStore = usePlaylistStore.getState();

    expect(store.likedSongIds).toEqual([mockSongB.id]);
    expect(store.favoriteArtistIds).toEqual(['artist_thaman']);
    expect(plStore.playlists).toHaveLength(1);
    expect(plStore.playlists[0].songIds).toEqual([mockSongB.id]);
  });
});
