import { describe, it, expect, beforeEach } from 'vitest';
import { useDownloadStore } from '@/context/useDownloadStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

describe('Mobile MP3 Download & Local Music Library System', () => {
  const mockSongA: Song = {
    id: 'song_101',
    title: 'Samajavaragamana: Live / Telugu',
    artist: 'Sid Sriram / Thaman S',
    album: 'Ala Vaikunthapurramuloo',
    duration: 215,
    coverUrl: 'https://example.com/cover1.jpg',
    audioUrl: 'https://example.com/stream1.mp3',
    artistId: 'art-101',
    albumId: 'alb-101',
    genre: 'Tollywood',
    category: 'global_trending',
    releaseYear: 2020,
    plays: 1000,
    likes: 500,
  };

  const mockSongB: Song = {
    id: 'song_102',
    title: 'Butta Bomma',
    artist: 'Armaan Malik',
    album: 'Ala Vaikunthapurramuloo',
    duration: 198,
    coverUrl: 'https://example.com/cover2.jpg',
    audioUrl: 'https://example.com/stream2.mp3',
    artistId: 'art-102',
    albumId: 'alb-101',
    genre: 'Tollywood',
    category: 'global_trending',
    releaseYear: 2020,
    plays: 2000,
    likes: 800,
  };

  beforeEach(() => {
    useDownloadStore.setState({
      tasks: {},
      playlistDownloadProgress: null,
      activeCount: 0,
      wifiOnly: false,
    });
    usePlayerStore.setState({
      downloadedSongIds: [],
    });
  });

  it('1. Correctly initializes and manages download queue state', () => {
    const store = useDownloadStore.getState();
    store.queueDownload(mockSongA, 'offline_sandboxed', '320 kbps');

    const tasks = useDownloadStore.getState().tasks;
    expect(tasks['song_101']).toBeDefined();
    expect(tasks['song_101'].song.title).toBe('Samajavaragamana: Live / Telugu');
    expect(tasks['song_101'].quality).toBe('320 kbps');
  });

  it('2. Prevents duplicate download if song is already marked as downloaded', () => {
    usePlayerStore.setState({ downloadedSongIds: ['song_101'] });

    const store = useDownloadStore.getState();
    store.queueDownload(mockSongA, 'offline_sandboxed', '320 kbps');

    const tasks = useDownloadStore.getState().tasks;
    expect(tasks['song_101']).toBeUndefined();
  });

  it('3. Handles playlist download queue and tracks progress', () => {
    const store = useDownloadStore.getState();
    store.downloadPlaylist([mockSongA, mockSongB], '320 kbps', 'My Hit Playlist', 'pl_100');

    const plState = useDownloadStore.getState().playlistDownloadProgress;
    expect(plState).toBeDefined();
    expect(plState?.playlistTitle).toBe('My Hit Playlist');
    expect(plState?.totalSongs).toBe(2);
    expect(plState?.status).toBe('DOWNLOADING');
  });

  it('4. Updates progress and status cleanly', () => {
    const store = useDownloadStore.getState();
    store.queueDownload(mockSongA, 'offline_sandboxed', '320 kbps');

    store.updateProgress('song_101', 45, 4500000, 10000000, 500000);
    store.setStatus('song_101', 'DOWNLOADING');

    const task = useDownloadStore.getState().tasks['song_101'];
    expect(task.progress).toBe(45);
    expect(task.downloadedBytes).toBe(4500000);
    expect(task.status).toBe('DOWNLOADING');
  });

  it('5. Pause and resume download transitions states correctly', () => {
    const store = useDownloadStore.getState();
    store.queueDownload(mockSongA, 'offline_sandboxed', '320 kbps');

    store.pauseDownload('song_101');
    expect(useDownloadStore.getState().tasks['song_101'].status).toBe('PAUSED');

    store.resumeDownload('song_101');
    expect(['QUEUED', 'DOWNLOADING']).toContain(useDownloadStore.getState().tasks['song_101'].status);
  });

  it('6. Remove download cleans up task and state', async () => {
    usePlayerStore.setState({ downloadedSongIds: ['song_101'] });
    const store = useDownloadStore.getState();
    store.queueDownload(mockSongA, 'offline_sandboxed', '320 kbps');

    await store.removeDownload('song_101');

    expect(useDownloadStore.getState().tasks['song_101']).toBeUndefined();
    expect(usePlayerStore.getState().downloadedSongIds.includes('song_101')).toBe(false);
  });
});
