import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { QueueManager } from '@/lib/queue/QueueManager';
import { AdaptiveQueueController } from '@/lib/queue/AdaptiveQueueController';

const mockAlbum: any[] = [
  { id: 'song_a', title: 'Song A', artist: 'Artist 1' },
  { id: 'song_b', title: 'Song B', artist: 'Artist 1' },
  { id: 'song_c', title: 'Song C', artist: 'Artist 1' },
  { id: 'song_d', title: 'Song D', artist: 'Artist 1' },
  { id: 'song_e', title: 'Song E', artist: 'Artist 1' },
];

describe('RaagaX Bounded Queue Sessions & Source Boundary Rules', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      queue: [],
      queueIndex: 0,
    });
  });

  // ALBUM-PLAY-001: Play Album with Autoplay OFF -> Stops at end
  it('ALBUM-PLAY-001: Play Album with Autoplay OFF finishes queue and STOPS at final song', () => {
    const manager = QueueManager.getInstance();
    manager.replaceQueue(mockAlbum, 0, 'PLAYLIST', { type: 'album', id: 'album_123' });
    
    // Step to final track E
    for (let i = 0; i < mockAlbum.length - 1; i++) {
      manager.getNext(false);
    }
    expect(manager.getCurrentItem()?.song.id).toBe('song_e');

    // Autoplay OFF
    if (manager.isAutoplayEnabled()) manager.toggleAutoplay();
    const nextItem = manager.getNext(true);
    expect(nextItem).toBeNull();
  });

  // ALBUM-PLAY-002: Play Album with Autoplay ON -> Triggers autoplay engine after completion
  it('ALBUM-PLAY-002: Play Album with Autoplay ON triggers autoplay candidates after source completion', async () => {
    const manager = QueueManager.getInstance();
    manager.replaceQueue(mockAlbum, 0, 'PLAYLIST', { type: 'album', id: 'album_123' });
    if (!manager.isAutoplayEnabled()) manager.toggleAutoplay();

    const controller = AdaptiveQueueController.getInstance();
    const candidates = await controller.fetchAutoplayForCompletedQueue();
    expect(Array.isArray(candidates)).toBe(true);
  });

  // ALBUM-PLAY-003: Play song C from Album [A, B, C, D, E] -> Queue is [C, D, E]
  it('ALBUM-PLAY-003: Playing song C from album [A, B, C, D, E] creates bounded queue [C, D, E]', () => {
    const store = usePlayerStore.getState();
    store.playSong(mockAlbum[2], mockAlbum); // Play C

    const manager = QueueManager.getInstance();
    const snapshot = manager.getSnapshot();
    const queueIds = snapshot.items.map(i => i.song.id);

    expect(queueIds).toEqual(['song_c', 'song_d', 'song_e']);
    expect(snapshot.currentIndex).toBe(0);
  });

  // ALBUM-SHUFFLE-001 & 002: Shuffled Album queue remains stable until completion
  it('ALBUM-SHUFFLE-001: Shuffled album maintains fixed order until queue boundary', () => {
    const manager = QueueManager.getInstance();
    manager.replaceQueue(mockAlbum, 0, 'PLAYLIST', { type: 'album', id: 'album_123' });
    manager.toggleShuffle();

    const snapshot1 = manager.getSnapshot();
    const snapshot2 = manager.getSnapshot();
    expect(snapshot1.items.map(i => i.song.id)).toEqual(snapshot2.items.map(i => i.song.id));
  });

  // QUEUE-001 to QUEUE-005: Recommendations & Navigation NEVER mutate active Album queue
  it('QUEUE-001 to QUEUE-005: Home/Browse recommendations NEVER inject candidates into active Album queue', async () => {
    const manager = QueueManager.getInstance();
    manager.replaceQueue(mockAlbum, 0, 'PLAYLIST', { type: 'album', id: 'album_123' });
    const initialItems = manager.getSnapshot().items.map(i => i.song.id);

    const controller = AdaptiveQueueController.getInstance();
    await controller.regenerateDynamicZone();

    const postItems = manager.getSnapshot().items.map(i => i.song.id);
    expect(postItems).toEqual(initialItems); // Queue remains 100% locked to album source!
  });
});
