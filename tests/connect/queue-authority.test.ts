import { describe, it, expect } from 'vitest';
import { QueueManager } from '../../src/lib/queue/QueueManager';
import { Song } from '../../src/types/music';

describe('Authoritative Queue Architecture & Revisioning Tests', () => {
  const sampleSongA: Song = { id: 'song_a', title: 'Song A', artist: 'Artist A', duration: 200, coverUrl: '', audioUrl: '' } as any;
  const sampleSongB: Song = { id: 'song_b', title: 'Song B', artist: 'Artist B', duration: 180, coverUrl: '', audioUrl: '' } as any;

  it('should assign unique queueItemId to each song added to queue', () => {
    const manager = QueueManager.getInstance();
    const item1 = manager.createQueueItem(sampleSongA, 'USER');
    const item2 = manager.createQueueItem(sampleSongA, 'USER'); // Duplicate track added twice

    expect(item1.trackId).toBe('song_a');
    expect(item2.trackId).toBe('song_a');
    expect(item1.queueItemId).not.toBe(item2.queueItemId);
  });
});
