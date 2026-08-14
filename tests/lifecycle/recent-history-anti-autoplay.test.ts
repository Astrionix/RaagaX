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
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { Song } from '@/types/music';

describe('RaagaX Chronological Listening History vs Silent Startup Anti-Autoplay Tests', () => {
  const songTabahi: Song = {
    id: 'song_tabahi',
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

  const songA: Song = {
    id: 'song_a',
    title: 'Song A',
    artist: 'Artist A',
    artistId: 'art_a',
    album: 'Album A',
    albumId: 'alb_a',
    duration: 200,
    audioUrl: 'https://test.com/a.mp3',
    coverUrl: '/a.jpg',
    genre: 'Telugu Hits',
    language: 'Telugu',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 20000,
    likes: 1000,
  };

  const songB: Song = {
    id: 'song_b',
    title: 'Song B',
    artist: 'Artist B',
    artistId: 'art_b',
    album: 'Album B',
    albumId: 'alb_b',
    duration: 210,
    audioUrl: 'https://test.com/b.mp3',
    coverUrl: '/b.jpg',
    genre: 'Telugu Hits',
    language: 'Telugu',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 30000,
    likes: 1200,
  };

  const songC: Song = {
    id: 'song_c',
    title: 'Song C',
    artist: 'Artist C',
    artistId: 'art_c',
    album: 'Album C',
    albumId: 'alb_c',
    duration: 195,
    audioUrl: 'https://test.com/c.mp3',
    coverUrl: '/c.jpg',
    genre: 'Telugu Melodies',
    language: 'Telugu',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 40000,
    likes: 1500,
  };

  const songD: Song = {
    id: 'song_d',
    title: 'Song D',
    artist: 'Artist D',
    artistId: 'art_d',
    album: 'Album D',
    albumId: 'alb_d',
    duration: 220,
    audioUrl: 'https://test.com/d.mp3',
    coverUrl: '/d.jpg',
    genre: 'Telugu Hits',
    language: 'Telugu',
    category: 'global_trending',
    releaseYear: 2024,
    plays: 50000,
    likes: 2000,
  };

  beforeEach(() => {
    mockStorage.clear();
    const history = QueueHistory.getInstance();
    (history as any).history = [];
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

  it('Test 1 (4-Day Multi-Song History Scenario): Determines Recent Song as Song D (NOT 3-day-old Tabahi)', async () => {
    const history = QueueHistory.getInstance();

    // Day 1: User played Tabahi
    history.recordPlay({ queueItemId: 'q_1', trackId: songTabahi.id, song: songTabahi, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });
    
    // Day 2: User played Song A & Song B
    history.recordPlay({ queueItemId: 'q_2', trackId: songA.id, song: songA, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });
    history.recordPlay({ queueItemId: 'q_3', trackId: songB.id, song: songB, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });

    // Day 3: User played Song C & Song D
    history.recordPlay({ queueItemId: 'q_4', trackId: songC.id, song: songC, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });
    history.recordPlay({ queueItemId: 'q_5', trackId: songD.id, song: songD, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });

    // Get chronological history
    const allEntries = history.getHistory();
    expect(allEntries).toHaveLength(5);

    // Latest listened song is Song D
    const latestEntry = allEntries[allEntries.length - 1];
    expect(latestEntry.song?.id).toBe('song_d');
    expect(latestEntry.song?.title).toBe('Song D');

    // Tabahi is at index 0 (oldest), not latest
    expect(allEntries[0].song?.id).toBe('song_tabahi');
  });

  it('Test 2 (Day 4 Fresh Launch): Restores Song D in PAUSED state with ZERO autoplay', async () => {
    const history = QueueHistory.getInstance();
    history.recordPlay({ queueItemId: 'q_1', trackId: songTabahi.id, song: songTabahi, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });
    history.recordPlay({ queueItemId: 'q_2', trackId: songA.id, song: songA, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });
    history.recordPlay({ queueItemId: 'q_3', trackId: songD.id, song: songD, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });

    // Simulate Day 4: App launch
    const store = usePlayerStore.getState();
    await store.restoreLocalSession();

    const restoredState = usePlayerStore.getState();
    // Most recent song is Song D
    expect(restoredState.currentSong?.id).toBe('song_d');
    expect(restoredState.currentSong?.title).toBe('Song D');

    // Strict Anti-Autoplay verification
    expect(restoredState.isPlaying).toBe(false); // MUST BE FALSE
    expect(restoredState.playbackIntent).toBe('PAUSED');
    expect(restoredState.trackSource).toBe('SESSION_RESTORE');
  });

  it('Test 3 (User Taps Play): Explicit user interaction transitions player to PLAYING and starts Song D', () => {
    // Current song is Song D (paused on launch)
    usePlayerStore.setState({
      currentSong: songD,
      isPlaying: false,
      playbackIntent: 'PAUSED',
    });

    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(false);

    // User explicitly taps Play
    store.setIsPlaying(true);

    const playingState = usePlayerStore.getState();
    expect(playingState.isPlaying).toBe(true);
    expect(playingState.playbackIntent).toBe('PLAYING');
    expect(playingState.currentSong?.id).toBe('song_d');
  });

  it('Test 4 (Tabahi vs Hellalo Mismatch Prevention): Guarantees Hellalo cover + Hellalo title + Silent Playback on launch', async () => {
    const songHellalo: Song = {
      id: 'song_hellalo',
      title: 'Hellalo',
      artist: 'Artist H',
      artistId: 'art_h',
      album: 'Album H',
      albumId: 'alb_h',
      duration: 215,
      audioUrl: 'https://test.com/hellalo.mp3',
      coverUrl: '/hellalo.jpg',
      genre: 'Telugu Hits',
      language: 'Telugu',
      category: 'global_trending',
      releaseYear: 2024,
      plays: 60000,
      likes: 3000,
    };

    const history = QueueHistory.getInstance();
    // 2 days ago: Tabahi was played
    history.recordPlay({ queueItemId: 'q_tabahi', trackId: songTabahi.id, song: songTabahi, source: 'USER', addedAt: Date.now() - 172800000, playable: true, offlineAvailable: false });
    // Today: Hellalo was played
    history.recordPlay({ queueItemId: 'q_hellalo', trackId: songHellalo.id, song: songHellalo, source: 'USER', addedAt: Date.now(), playable: true, offlineAvailable: false });

    // Cold boot app reopen
    const store = usePlayerStore.getState();
    await store.restoreLocalSession();

    const restoredState = usePlayerStore.getState();
    // Cover, Title & CurrentSong MUST strictly be Hellalo (NOT Tabahi)
    expect(restoredState.currentSong?.id).toBe('song_hellalo');
    expect(restoredState.currentSong?.title).toBe('Hellalo');
    expect(restoredState.currentSong?.coverUrl).toBe('/hellalo.jpg');

    // Player state MUST strictly be PAUSED with ZERO audio playback
    expect(restoredState.isPlaying).toBe(false);
    expect(restoredState.playbackIntent).toBe('PAUSED');
  });
});
