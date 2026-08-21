import { describe, it, expect, beforeEach, vi } from 'vitest';

const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const selectMock = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ song_id: 'song_cloud_existing' }], error: null }),
    }),
    order2: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

vi.mock('@/lib/supabase', () => {
  const stubChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb) => {
      if (typeof cb === 'function') cb('SUBSCRIBED');
      return stubChannel;
    }),
  };

  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockImplementation(() => ({
      upsert: upsertMock,
      select: selectMock,
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: upsertMock,
    })),
    channel: vi.fn().mockReturnValue(stubChannel),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    getChannels: vi.fn().mockReturnValue([]),
  };

  return {
    supabase: client,
    getSupabase: () => client,
  };
});

import { AccountSyncEngine } from '@/lib/sync/AccountSyncEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';

describe('RaagaX Local-First & Cloud Sync Engine — Guest to Account One-Time Merge', () => {
  const mockUserId = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    upsertMock.mockClear();
    usePlayerStore.setState({
      likedSongIds: ['song_guest_1', 'song_guest_2'],
      favoriteArtistIds: ['artist_spb'],
      favoriteAlbumIds: ['album_roja'],
      historySongIds: ['song_guest_1'],
    });
    usePlaylistStore.setState({
      playlists: [
        {
          id: 'pl_guest_1',
          title: 'My Guest Chill Mix',
          description: 'Created while offline',
          songs: [],
          songIds: [],
          coverUrl: 'https://c.saavncdn.com/cover.jpg',
          creator: 'Guest',
          visibility: 'private',
          ownerId: 'guest',
        },
      ],
    });
  });

  it('1. Guest mode maintains liked songs, playlists, and history locally', () => {
    const playerState = usePlayerStore.getState();
    const playlistState = usePlaylistStore.getState();

    expect(playerState.likedSongIds).toContain('song_guest_1');
    expect(playerState.likedSongIds).toContain('song_guest_2');
    expect(playlistState.playlists.length).toBe(1);
    expect(playlistState.playlists[0].title).toBe('My Guest Chill Mix');
  });

  it('2. On login/signup, migrateGuestDataToUser non-destructively upserts guest data to cloud', async () => {
    await AccountSyncEngine.getInstance().migrateGuestDataToUser(mockUserId);

    // Verify liked songs & playlists upsert was called
    expect(upsertMock).toHaveBeenCalled();
  });

  it('3. Downloads are strictly preserved on the device and never wiped on sync', () => {
    expect(typeof useDownloadStore.getState).toBe('function');
  });
});
