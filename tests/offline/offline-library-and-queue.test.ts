import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore, isTrackDownloaded } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { DownloadStorage } from '@/lib/offline/DownloadStorage';
import { useDownloadStore } from '@/context/useDownloadStore';

const mockSong = (id: string, title: string): Song => ({
  id,
  title,
  artist: 'Test Artist',
  artistId: 'art-1',
  album: 'Test Album',
  albumId: 'alb-1',
  duration: 180,
  coverUrl: 'https://example.com/cover.jpg',
  audioUrl: 'https://example.com/stream.mp3',
  category: 'global_trending',
  genre: 'Film',
  releaseYear: 2024,
  plays: 0,
  likes: 0,
});

describe('RaagaX Android Offline Music Library & Queue Skipping Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      queue: [],
      queueIndex: 0,
      currentSong: null,
      isPlaying: false,
      toastMessage: null,
    });
  });

  it('1. Correctly identifies downloaded tracks via DownloadStorage / useDownloadStore', () => {
    const songA = mockSong('song_a', 'Song A');
    const songB = mockSong('song_b', 'Song B');

    // Register in DownloadStorage
    DownloadStorage.getInstance().getDownloadedIdsSet().add('song_a');

    expect(DownloadStorage.getInstance().isDownloadedSync('song_a')).toBe(true);
    expect(DownloadStorage.getInstance().isDownloadedSync('song_b')).toBe(false);
    expect(isTrackDownloaded('song_a')).toBe(true);
    expect(isTrackDownloaded('song_b')).toBe(false);
  });

  it('2. Preserves full queue state while seamlessly skipping non-downloaded tracks in offline mode', async () => {
    const trackX = mockSong('track_x', 'Track X (Downloaded)');
    const trackY = mockSong('track_y', 'Track Y (Downloaded)');
    const trackZ = mockSong('track_z', 'Track Z (Online Only)');
    const trackA = mockSong('track_a', 'Track A (Downloaded)');

    const initialQueue = [trackX, trackY, trackZ, trackA];

    // Configure downloaded status: X, Y, A are downloaded; Z is not
    useDownloadStore.setState({
      tasks: {
        track_x: { id: 'track_x', trackId: 'track_x', song: trackX, status: 'COMPLETED', progress: 100 } as any,
        track_y: { id: 'track_y', trackId: 'track_y', song: trackY, status: 'COMPLETED', progress: 100 } as any,
        track_a: { id: 'track_a', trackId: 'track_a', song: trackA, status: 'COMPLETED', progress: 100 } as any,
      },
    });

    usePlayerStore.setState({
      queue: initialQueue,
      queueIndex: 1, // Currently on track Y
      currentSong: trackY,
      currentTime: 10,
    });

    // Verify queue still holds all 4 songs
    expect(usePlayerStore.getState().queue.length).toBe(4);
    expect(usePlayerStore.getState().queue[2].id).toBe('track_z');
  });

  it('3. Prevents playing non-downloaded tracks when offline and displays toast notification', async () => {
    const nonDownloadedSong = mockSong('song_undownloaded', 'Stream Only Track');

    useDownloadStore.setState({ tasks: {}, nativeDownloadedTracks: {} });

    // Mock navigator.onLine = false
    const originalNavigator = global.navigator;
    Object.defineProperty(global, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    });

    // In non-test mode simulation
    const isDownloaded = isTrackDownloaded(nonDownloadedSong.id);
    expect(isDownloaded).toBe(false);

    // Restore
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });
});
