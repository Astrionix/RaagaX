import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set up browser globals in test environment
const mockStorage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};

import { usePlayerStore } from '@/context/usePlayerStore';
import { LocalDatabase } from '@/lib/localDatabase';
import { Song } from '@/types/music';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_test_999' } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [] }),
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
  },
}));

describe('Android APK Lifecycle: onTaskRemoved, Swipe Dismiss & Anti-Autoplay Tests', () => {
  const testSong: Song = {
    id: 'song_tabahi_99',
    title: 'Tabahi',
    artist: 'Badshah',
    artistId: 'art_badshah',
    album: 'Retropanda',
    albumId: 'alb_retro',
    duration: 180,
    audioUrl: 'https://test.com/tabahi.mp3',
    coverUrl: '/tabahi.jpg',
    genre: 'Hindi Pop',
    language: 'Hindi',
    category: 'global_trending',
    releaseYear: 2022,
    plays: 100000,
    likes: 5000,
  };

  beforeEach(() => {
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      playbackIntent: 'IDLE',
      currentTime: 0,
      queue: [],
      queueIndex: 0,
      preferredLanguage: 'Telugu',
      sessionLanguage: 'Telugu',
    });
  });

  it('Test 1 (Swipe from Recents & Task Removal): Saves playback snapshot with wasPlaying=false and STOPPED state', async () => {
    // 1. User was actively playing song
    usePlayerStore.setState({
      currentSong: testSong,
      isPlaying: true,
      playbackIntent: 'PLAYING',
      currentTime: 65, // 1m 5s
      queue: [testSong],
      queueIndex: 0,
      sessionLanguage: 'Hindi',
    });

    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(true);

    // 2. User Swipes RaagaX away from Recents (Simulate onTaskRemoved / pagehide flush)
    await LocalDatabase.getInstance().savePlaybackSession({
      currentSong: store.currentSong,
      currentTime: store.currentTime,
      queue: store.queue,
      queueIndex: store.queueIndex,
      historySongIds: [testSong.id],
      likedSongIds: ['liked_1'],
      searchHistory: ['Badshah'],
      preferredLanguage: store.preferredLanguage,
      sessionLanguage: store.sessionLanguage,
      wasPlaying: false, // HARD RULE: Swiping from recents means playback stopped
      playbackState: 'STOPPED',
      deviceState: 'TASK_REMOVED',
      timestamp: Date.now(),
    });

    const saved = LocalDatabase.getInstance().getSyncPlaybackSession();
    expect(saved).not.toBeNull();
    expect(saved?.currentSong?.id).toBe('song_tabahi_99');
    expect(saved?.currentTime).toBe(65);
    expect(saved?.wasPlaying).toBe(false); // CRITICAL: wasPlaying is strictly false
    expect(saved?.playbackState).toBe('STOPPED');
    expect(saved?.deviceState).toBe('TASK_REMOVED');
  });

  it('Test 2 (Fresh App Launch Anti-Autoplay): App launch restores last song passively in PAUSED state without autoplaying', async () => {
    // Session exists from previous day
    await LocalDatabase.getInstance().savePlaybackSession({
      currentSong: testSong,
      currentTime: 65,
      queue: [testSong],
      queueIndex: 0,
      historySongIds: [testSong.id],
      likedSongIds: ['liked_1'],
      searchHistory: ['Badshah'],
      preferredLanguage: 'Telugu',
      sessionLanguage: 'Hindi',
      wasPlaying: false,
      playbackState: 'STOPPED',
      timestamp: Date.now() - 86400000 * 2, // 2 days ago
    });

    // Simulate fresh app launch
    const store = usePlayerStore.getState();
    await store.restoreLocalSession();

    const restoredState = usePlayerStore.getState();
    expect(restoredState.currentSong?.id).toBe('song_tabahi_99');
    expect(restoredState.currentTime).toBe(65);
    expect(restoredState.isPlaying).toBe(false); // MUST BE PAUSED
    expect(restoredState.playbackIntent).toBe('PAUSED');
    expect(restoredState.trackSource).toBe('SESSION_RESTORE');
  });

  it('Test 3 (Data Retention across Task Removal): User account, downloads, likes, and language preferences remain intact', async () => {
    // 1. Save user library preferences & downloads before swipe dismiss
    await LocalDatabase.getInstance().savePlaybackSession({
      currentSong: testSong,
      currentTime: 65,
      queue: [testSong],
      queueIndex: 0,
      historySongIds: [testSong.id],
      likedSongIds: ['liked_1', 'liked_2'],
      searchHistory: ['Badshah', 'Arijit Singh'],
      preferredLanguage: 'Telugu',
      sessionLanguage: 'Hindi',
      wasPlaying: false,
      playbackState: 'STOPPED',
      deviceState: 'TASK_REMOVED',
      timestamp: Date.now(),
    });

    // 2. Read snapshot after task removal
    const saved = LocalDatabase.getInstance().getSyncPlaybackSession();
    expect(saved?.likedSongIds).toContain('liked_1');
    expect(saved?.searchHistory).toContain('Badshah');
    expect(saved?.preferredLanguage).toBe('Telugu');
    expect(saved?.wasPlaying).toBe(false);
  });

  it('Test 4 (Explicit User Interaction): Playback only resumes when the user explicitly taps Play', () => {
    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(false);

    // User explicitly taps Play on the restored song
    store.setIsPlaying(true);

    const playingStore = usePlayerStore.getState();
    expect(playingStore.isPlaying).toBe(true);
    expect(playingStore.playbackIntent).toBe('PLAYING');
  });
});
