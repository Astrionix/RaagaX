import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalDatabase } from '@/lib/localDatabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { QueueManager } from '@/lib/queue/QueueManager';
import { Song } from '@/types/music';

// Mock localStorage in Node test runner
const memoryStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStore.get(key) || null,
  setItem: (key: string, value: string) => memoryStore.set(key, value),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

globalThis.localStorage = mockLocalStorage as any;

describe('RaagaX Playback Session State & Startup Restoration Engine', () => {
  const songA: Song = {
    id: 'song_a_1',
    title: 'Song A (First Track)',
    artist: 'Artist One',
    artistId: 'art_1',
    album: 'Album One',
    albumId: 'alb_1',
    duration: 200,
    coverUrl: 'https://images.unsplash.com/photo-1',
    audioUrl: 'https://cdn.example.com/song_a.mp3',
    genre: 'TELUGU HITS',
    category: 'melody',
    releaseYear: 2024,
    plays: 100,
    likes: 10,
  };

  const songB: Song = {
    id: 'song_b_2',
    title: 'Song B (Middle Track)',
    artist: 'Artist Two',
    artistId: 'art_2',
    album: 'Album Two',
    albumId: 'alb_2',
    duration: 220,
    coverUrl: 'https://images.unsplash.com/photo-2',
    audioUrl: 'https://cdn.example.com/song_b.mp3',
    genre: 'TELUGU HITS',
    category: 'melody',
    releaseYear: 2024,
    plays: 200,
    likes: 20,
  };

  const songD: Song = {
    id: 'song_d_4',
    title: 'Song D (Latest Track)',
    artist: 'Artist Four',
    artistId: 'art_4',
    album: 'Album Four',
    albumId: 'alb_4',
    duration: 180,
    coverUrl: 'https://images.unsplash.com/photo-4',
    audioUrl: 'https://cdn.example.com/song_d.mp3',
    genre: 'TELUGU HITS',
    category: 'melody',
    releaseYear: 2024,
    plays: 400,
    likes: 40,
  };

  beforeEach(async () => {
    mockLocalStorage.clear();
    await LocalDatabase.getInstance().clearPlaybackSession();
  });

  it('1. Persists state immediately when user plays songs in sequence', async () => {
    const queue = [songA, songB, songD];
    
    // User plays Song D
    usePlayerStore.getState().playSong(songD, queue);
    usePlayerStore.getState().setCurrentTime(97); // 01:37 in

    // Verify localStorage has Song D at 97s
    const raw = mockLocalStorage.getItem('raagax_latest_playback_session');
    expect(raw).toBeDefined();
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed.currentSong.id).toBe('song_d_4');
    expect(parsed.currentSong.title).toBe('Song D (Latest Track)');
    expect(parsed.currentTime).toBe(97);
    expect(parsed.queue.length).toBe(1); // bounded slice from index of Song D
  });

  it('2. Persists paused state when user pauses audio before exiting', async () => {
    const queue = [songA, songB, songD];
    usePlayerStore.getState().playSong(songB, queue);
    usePlayerStore.getState().setCurrentTime(45);
    
    // User pauses
    usePlayerStore.getState().setIsPlaying(false);

    const syncSession = LocalDatabase.getInstance().getSyncPlaybackSession();
    expect(syncSession).not.toBeNull();
    expect(syncSession!.currentSong?.id).toBe('song_b_2');
    expect(syncSession!.currentTime).toBe(45);
  });

  it('3. Cold-boot restoration rule: restores latest track, position, and queue in PAUSED state (DO NOT AUTOPLAY)', async () => {
    // Simulate saved state from yesterday night
    const yesterdayTimestamp = Date.now() - (18 * 60 * 60 * 1000); // 18 hours ago
    await LocalDatabase.getInstance().savePlaybackSession({
      currentSong: songD,
      currentTime: 97, // 01:37
      queue: [songA, songB, songD],
      queueIndex: 2,
      historySongIds: ['song_a_1', 'song_b_2', 'song_d_4'],
      searchHistory: [],
      timestamp: yesterdayTimestamp,
    });

    // Reset runtime in-memory store to clean slate
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      queue: [],
      queueIndex: 0,
    });

    // App launches -> calls restoreLocalSession
    await usePlayerStore.getState().restoreLocalSession();

    const restoredState = usePlayerStore.getState();

    // Verification of Strict Rules:
    expect(restoredState.currentSong).toBeDefined();
    expect(restoredState.currentSong?.id).toBe('song_d_4');
    expect(restoredState.currentSong?.title).toBe('Song D (Latest Track)');
    expect(restoredState.currentTime).toBe(97); // Restored 01:37
    expect(restoredState.queue.length).toBe(3);
    expect(restoredState.queueIndex).toBe(2);
    
    // CRITICAL: isPlaying MUST BE FALSE (DO NOT AUTOPLAY)
    expect(restoredState.isPlaying).toBe(false);
  });

  it('4. Navigation (playNext / playPrev) immediately updates the persistent session', async () => {
    const queue = [songA, songB, songD];
    const manager = QueueManager.getInstance();
    manager.replaceQueue(queue, 0);

    usePlayerStore.setState({
      isActiveDevice: true,
      currentSong: songA,
      queue,
      queueIndex: 0,
      isPlaying: true,
      currentTime: 0,
    });

    // Advance to next track
    await usePlayerStore.getState().playNext();

    const session = LocalDatabase.getInstance().getSyncPlaybackSession();
    expect(session).not.toBeNull();
    expect(session!.currentSong?.id).toBe('song_b_2');
  });
});
