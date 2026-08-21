import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { Song } from '@/types/music';

describe('RaagaX Playback Desync Protection & Authoritative PlaybackSession', () => {
  const songX: Song = {
    id: 'song_x',
    title: 'Song X (Original)',
    artist: 'Artist X',
    artistId: 'artist_x',
    album: 'Album X',
    albumId: 'album_x',
    genre: 'Soundtrack',
    category: 'latest_telugu',
    releaseYear: 2026,
    language: 'telugu',
    plays: 100,
    likes: 50,
    duration: 200,
    coverUrl: 'https://images.unsplash.com/cover_x.jpg',
    audioUrl: 'https://cdn.example.com/audio_x.mp3',
  };

  const songY: Song = {
    id: 'song_y',
    title: 'Song Y (Next Track)',
    artist: 'Artist Y',
    artistId: 'artist_y',
    album: 'Album Y',
    albumId: 'album_y',
    genre: 'Pop',
    category: 'latest_telugu',
    releaseYear: 2026,
    language: 'telugu',
    plays: 120,
    likes: 60,
    duration: 210,
    coverUrl: 'https://images.unsplash.com/cover_y.jpg',
    audioUrl: 'https://cdn.example.com/audio_y.mp3',
  };

  const songZ: Song = {
    id: 'song_z',
    title: 'Song Z (Third Track)',
    artist: 'Artist Z',
    artistId: 'artist_z',
    album: 'Album Z',
    albumId: 'album_z',
    genre: 'Classical',
    category: 'latest_telugu',
    releaseYear: 2026,
    language: 'telugu',
    plays: 90,
    likes: 45,
    duration: 190,
    coverUrl: 'https://images.unsplash.com/cover_z.jpg',
    audioUrl: 'https://cdn.example.com/audio_z.mp3',
  };

  const queue = [songX, songY, songZ];

  beforeEach(() => {
    usePlayerStore.setState({
      queue,
      queueIndex: 0,
      currentSong: songX,
      currentTime: 0,
      duration: 200,
      isPlaying: true,
      playbackRequestId: 0,
      isActiveDevice: true,
    });
  });

  it('1. Atomically updates authoritative session with matching audio, artwork, title, and artist', async () => {
    const store = usePlayerStore.getState();
    const success = await store.switchTrack(songY, 1, true);

    expect(success).toBe(true);
    const updated = usePlayerStore.getState();
    expect(updated.currentSong?.id).toBe('song_y');
    expect(updated.currentSong?.title).toBe('Song Y (Next Track)');
    expect(updated.currentSong?.artist).toBe('Artist Y');
    expect(updated.queueIndex).toBe(1);
    expect(updated.playbackRequestId).toBeGreaterThan(0);
  });

  it('2. Rapid NEXT then PREVIOUS (X -> NEXT -> PREVIOUS -> X) resolves authoritatively to X', async () => {
    const store = usePlayerStore.getState();

    // Start with X playing at 0s
    usePlayerStore.setState({ currentTime: 0, queueIndex: 0, currentSong: songX });

    // User taps NEXT then immediately taps PREVIOUS
    const nextPromise = store.playNext();
    const prevPromise = store.playPrev();

    await Promise.all([nextPromise, prevPromise]);

    const finalState = usePlayerStore.getState();
    expect(finalState.currentSong?.id).toBe('song_x');
    expect(finalState.currentSong?.title).toBe('Song X (Original)');
    expect(finalState.currentSong?.artist).toBe('Artist X');
    expect(finalState.queueIndex).toBe(0);
  });

  it('3. Rapid sequence X -> NEXT -> NEXT -> PREVIOUS resolves authoritatively to Y', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({ currentTime: 0, queueIndex: 0, currentSong: songX });

    const p1 = store.playNext(); // -> Y (index 1)
    const p2 = store.playNext(); // -> Z (index 2)
    const p3 = store.playPrev(); // -> Y (index 1)

    await Promise.all([p1, p2, p3]);

    const finalState = usePlayerStore.getState();
    expect(finalState.currentSong?.id).toBe('song_y');
    expect(finalState.currentSong?.title).toBe('Song Y (Next Track)');
    expect(finalState.queueIndex).toBe(1);
  });

  it('4. PREVIOUS restarts song at 0:00 when position > 3 seconds without changing track', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      currentSong: songY,
      queueIndex: 1,
      currentTime: 14.5, // > 3 seconds
    });

    const seekSpy = vi.spyOn(PlaybackService.getInstance(), 'seek');

    await store.playPrev();

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_y'); // Still Song Y
    expect(state.queueIndex).toBe(1); // Still index 1
    expect(state.currentTime).toBe(0); // Restarted at 0:00
    expect(seekSpy).toHaveBeenCalledWith(0);

    seekSpy.mockRestore();
  });

  it('5. PREVIOUS switches to previous track when position <= 3 seconds', async () => {
    const store = usePlayerStore.getState();
    usePlayerStore.setState({
      currentSong: songY,
      queueIndex: 1,
      currentTime: 1.2, // <= 3 seconds
    });

    await store.playPrev();

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_x'); // Switched to Song X
    expect(state.queueIndex).toBe(0);
    expect(state.currentTime).toBe(0);
  });
});
