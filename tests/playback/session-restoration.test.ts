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

    // Verify localStorage has Song D
    const raw = mockLocalStorage.getItem('raagax_latest_playback_session');
    expect(raw).toBeDefined();
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed.currentSong.id).toBe('song_d_4');
    expect(parsed.currentSong.title).toBe('Song D (Latest Track)');
    expect(parsed.queue.length).toBe(3); // Full queue preserved [songA, songB, songD]
    expect(parsed.queueIndex).toBe(2);
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
  });

  it('3. Cold-boot restoration rule: restores latest track, queue, and index in PAUSED state with position reset to 0:00 (DO NOT AUTOPLAY)', async () => {
    // Simulate saved state from 1 hour ago
    const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); 
    await LocalDatabase.getInstance().savePlaybackSession({
      currentSong: songD,
      currentTime: 0,
      queue: [songA, songB, songD],
      queueIndex: 2,
      historySongIds: ['song_a_1', 'song_b_2', 'song_d_4'],
      searchHistory: [],
      timestamp: recentTimestamp,
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

    // Verification of Strict Rules: Latest song restored in PAUSED state with zero autoplay and position reset to 0:00
    expect(restoredState.currentSong).toBeDefined();
    expect(restoredState.currentSong?.id).toBe('song_d_4');
    expect(restoredState.currentSong?.title).toBe('Song D (Latest Track)');
    expect(restoredState.currentTime).toBe(0); // STRICT RULE: Reset to 0:00 on fresh launch
    expect(restoredState.isPlaying).toBe(false);
    expect(restoredState.playbackIntent).toBe('PAUSED');
    expect(restoredState.trackSource).toBe('SESSION_RESTORE');
    expect(restoredState.queue.length).toBe(3);
    expect(restoredState.queueIndex).toBe(2);
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
      playbackIntent: 'PLAYING',
      trackSource: 'USER_SELECTED',
      currentTime: 0,
    });

    // Advance to next track
    await usePlayerStore.getState().playNext();

    const session = LocalDatabase.getInstance().getSyncPlaybackSession();
    expect(session).not.toBeNull();
    expect(session!.currentSong?.id).toBe('song_b_2');
  });

  it('5. PlaybackIntent strict separation: User play sets PLAYING intent, user pause sets PAUSED intent', () => {
    usePlayerStore.getState().playSong(songA, [songA]);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().playbackIntent).toBe('PLAYING');
    expect(usePlayerStore.getState().trackSource).toBe('USER_SELECTED');

    usePlayerStore.getState().setIsPlaying(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().playbackIntent).toBe('PAUSED');

    usePlayerStore.getState().togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().playbackIntent).toBe('PLAYING');
  });

  it('6. Fresh launch startup: Restores song in PAUSED state and starts from 0:00 on explicit user Play', async () => {
    const songHellalo: Song = {
      ...songD,
      id: 'song_hellalo',
      title: 'Hellalo',
      duration: 240,
    };

    await LocalDatabase.getInstance().savePlaybackSession({
      currentSong: songHellalo,
      currentTime: 0,
      duration: 240,
      queue: [songHellalo],
      queueIndex: 0,
      historySongIds: ['song_hellalo'],
      searchHistory: [],
      timestamp: Date.now(),
    });

    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      queue: [],
    });

    // Cold boot restore
    await usePlayerStore.getState().restoreLocalSession();

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_hellalo');
    expect(state.currentTime).toBe(0); // 0:00 on fresh launch
    expect(state.isPlaying).toBe(false); // PAUSED on launch
    expect(state.playbackIntent).toBe('PAUSED');

    // Explicit user tap on Play
    state.setIsPlaying(true);

    const playingState = usePlayerStore.getState();
    expect(playingState.isPlaying).toBe(true);
    expect(playingState.playbackIntent).toBe('PLAYING');
    expect(playingState.currentTime).toBe(0);
  });
});
