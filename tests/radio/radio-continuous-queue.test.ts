import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RadioEngine } from '@/lib/radio/RadioEngine';
import { QueueManager } from '@/lib/queue/QueueManager';
import { Song } from '@/types/music';

describe('RaagaX Continuous Radio & Non-Destructive Queue Extension', () => {
  const seedSong: Song = {
    id: 'seed_song_1',
    title: 'Chinni Chinni Aasalu',
    artist: 'S.P. Balasubrahmanyam',
    artistId: 'spb_1',
    album: 'Roja',
    albumId: 'roja_1',
    genre: 'Soundtrack',
    category: 'latest_telugu',
    releaseYear: 1992,
    language: 'telugu',
    plays: 50000,
    likes: 2500,
    duration: 240,
    coverUrl: 'https://images.unsplash.com/cover_roja.jpg',
    audioUrl: 'https://cdn.example.com/audio_roja.mp3',
  };

  const radioBatch1: Song[] = [
    {
      id: 'radio_1',
      title: 'Song A (Radio Track 1)',
      artist: 'S.P. Balasubrahmanyam',
      artistId: 'spb_1',
      album: 'Hits of SPB',
      albumId: 'spb_album',
      genre: 'Soundtrack',
      category: 'radio',
      releaseYear: 1995,
      language: 'telugu',
      plays: 30000,
      likes: 1200,
      duration: 210,
      coverUrl: 'https://images.unsplash.com/cover_a.jpg',
      audioUrl: 'https://cdn.example.com/audio_a.mp3',
    },
    {
      id: 'radio_2',
      title: 'Song B (Radio Track 2)',
      artist: 'K.S. Chithra',
      artistId: 'chithra_1',
      album: 'Melody Queen',
      albumId: 'chithra_album',
      genre: 'Soundtrack',
      category: 'radio',
      releaseYear: 1996,
      language: 'telugu',
      plays: 28000,
      likes: 1100,
      duration: 220,
      coverUrl: 'https://images.unsplash.com/cover_b.jpg',
      audioUrl: 'https://cdn.example.com/audio_b.mp3',
    },
  ];

  const radioBatch2: Song[] = [
    {
      id: 'radio_3',
      title: 'Song C (Radio Track 3)',
      artist: 'Hariharan',
      artistId: 'hariharan_1',
      album: 'Classic Duets',
      albumId: 'duets_album',
      genre: 'Soundtrack',
      category: 'radio',
      releaseYear: 1999,
      language: 'telugu',
      plays: 25000,
      likes: 900,
      duration: 230,
      coverUrl: 'https://images.unsplash.com/cover_c.jpg',
      audioUrl: 'https://cdn.example.com/audio_c.mp3',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    RadioEngine.getInstance().stopRadio();
    usePlayerStore.setState({
      queue: [],
      queueIndex: 0,
      currentSong: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      playbackRequestId: 0,
      isActiveDevice: true,
      playbackContext: null,
    });
  });

  it('1. Initializes continuous Song Radio session with seed track and first batch', async () => {
    // Mock global fetch for Radio API
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { stationId: 'station_song_123' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { songs: radioBatch1 } }),
      });
    });

    const success = await RadioEngine.getInstance().startRadio({
      type: 'song',
      seedId: seedSong.id,
      seedTitle: seedSong.title,
      seedCover: seedSong.coverUrl,
      initialSong: seedSong,
      language: seedSong.language,
    });

    expect(success).toBe(true);
    expect(RadioEngine.getInstance().isRadioActive()).toBe(true);

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe(seedSong.id);
    expect(state.queue.length).toBe(3); // seed + 2 batch tracks
    expect(state.playbackContext?.type).toBe('radio');
  });

  it('2. Seamlessly appends new tracks to existing queue when nearing end (non-destructive)', async () => {
    // 1. Initialize station with batch 1
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { stationId: 'station_song_123' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { songs: radioBatch1 } }),
      });
    });

    await RadioEngine.getInstance().startRadio({
      type: 'song',
      seedId: seedSong.id,
      seedTitle: seedSong.title,
      seedCover: seedSong.coverUrl,
      initialSong: seedSong,
      language: seedSong.language,
    });

    expect(usePlayerStore.getState().queue.length).toBe(3);

    // 2. Mock next batch API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { songs: radioBatch2 } }),
    });

    // 3. User progresses to index 1 (remaining unplayed = 1 <= 4)
    await RadioEngine.getInstance().extendQueueIfNeeded(1);

    const state = usePlayerStore.getState();
    expect(state.queue.length).toBe(4); // 3 original + 1 appended
    expect(state.queue[3].id).toBe('radio_3');
    // Verify previous tracks in queue were not mutated
    expect(state.queue[0].id).toBe('seed_song_1');
    expect(state.queue[1].id).toBe('radio_1');
  });

  it('3. Preserves PREVIOUS and NEXT history across dynamically extended radio queue', async () => {
    usePlayerStore.setState({
      queue: [seedSong, radioBatch1[0], radioBatch1[1], radioBatch2[0]],
      queueIndex: 1,
      currentSong: radioBatch1[0],
      playbackContext: { type: 'radio', id: 'station_song_123' },
    });

    const store = usePlayerStore.getState();

    // User presses NEXT -> Advances to index 2 (Song B)
    await store.playNext();
    expect(usePlayerStore.getState().queueIndex).toBe(2);
    expect(usePlayerStore.getState().currentSong?.id).toBe('radio_2');

    // User presses PREVIOUS -> Goes back to index 1 (Song A)
    usePlayerStore.setState({ currentTime: 0 }); // simulate beginning of track
    await store.playPrev();
    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().currentSong?.id).toBe('radio_1');
  });
});
