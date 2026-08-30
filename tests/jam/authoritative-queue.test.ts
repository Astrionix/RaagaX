import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_a',
  title: 'Samajavaragamana',
  artist: 'Sid Sriram',
  artistId: 'art_sid',
  album: 'Ala Vaikunthapurramuloo',
  albumId: 'alb_avpl',
  duration: 214,
  coverUrl: 'https://cdn.test/samaja.jpg',
  audioUrl: 'https://cdn.test/samaja.mp3',
  genre: 'Tollywood',
  category: 'latest_telugu',
  releaseYear: 2020,
  plays: 500000,
  likes: 12000,
};

const mockSongB: Song = {
  id: 'song_b',
  title: 'Butta Bomma',
  artist: 'Armaan Malik',
  artistId: 'art_armaan',
  album: 'Ala Vaikunthapurramuloo',
  albumId: 'alb_avpl',
  duration: 198,
  coverUrl: 'https://cdn.test/butta.jpg',
  audioUrl: 'https://cdn.test/butta.mp3',
  genre: 'Tollywood',
  category: 'latest_telugu',
  releaseYear: 2020,
  plays: 800000,
  likes: 24000,
};

describe('Authoritative Shared Jam Queue Engine', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('1. Generates unique queueItemId per queue item independent of trackId', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Ravi',
      initialSong: mockSongA,
    });

    // Add Song B
    const res1 = engine.executeCommand({
      commandId: 'c1',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    // Add Song B AGAIN (duplicate track)
    const res2 = engine.executeCommand({
      commandId: 'c2',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    const queue = res2.session!.queue;
    expect(queue.length).toBe(2);

    // Both items are Song B, but have different unique queueItemIds
    expect(queue[0].trackId).toBe('song_b');
    expect(queue[1].trackId).toBe('song_b');
    expect(queue[0].queueItemId).not.toBe(queue[1].queueItemId);
  });

  it('2. Preserves track attribution and contributor metadata in queue items', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host Ravi',
      initialSong: mockSongA,
    });

    // Participant Priya joins
    engine.joinSession(session.jamId, {
      userId: 'user_priya',
      displayName: 'Priya Sharma',
      avatarUrl: 'https://cdn.test/priya.png',
    });

    // Priya adds a track
    const res = engine.executeCommand({
      commandId: 'c3',
      jamId: session.jamId,
      userId: 'user_priya',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    expect(res.success).toBe(true);
    const addedItem = res.session!.queue[0];
    expect(addedItem.addedBy).toBe('user_priya');
    expect(addedItem.addedByName).toBe('Priya Sharma');
    expect(addedItem.addedByAvatar).toBe('https://cdn.test/priya.png');
    expect(addedItem.addedAt).toBeGreaterThan(0);
  });

  it('3. Reordering queue updates authoritative queue array with deterministic order', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host Ravi',
      initialSong: mockSongA,
    });

    engine.executeCommand({
      commandId: 'c1',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'ADD_TRACK',
      payload: { song: mockSongA },
    });

    engine.executeCommand({
      commandId: 'c2',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    const currentQueue = engine.getSession(session.jamId)!.queue;
    expect(currentQueue[0].trackId).toBe('song_a');
    expect(currentQueue[1].trackId).toBe('song_b');

    // Invert queue order
    const reversedQueue = [currentQueue[1], currentQueue[0]];
    const reorderRes = engine.executeCommand({
      commandId: 'c3',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'REORDER_QUEUE',
      payload: { queue: reversedQueue },
    });

    expect(reorderRes.success).toBe(true);
    const updatedQueue = reorderRes.session!.queue;
    expect(updatedQueue[0].trackId).toBe('song_b');
    expect(updatedQueue[1].trackId).toBe('song_a');
  });

  it('4. Removing a specific queue item removes only that matching queueItemId', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host Ravi',
      initialSong: mockSongA,
    });

    // Add Song B twice
    engine.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'user_host', action: 'ADD_TRACK', payload: { song: mockSongB } });
    engine.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'user_host', action: 'ADD_TRACK', payload: { song: mockSongB } });

    const queueBefore = engine.getSession(session.jamId)!.queue;
    const targetToRemove = queueBefore[0].queueItemId;
    const itemToKeep = queueBefore[1].queueItemId;

    const removeRes = engine.executeCommand({
      commandId: 'c3',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'REMOVE_TRACK',
      payload: { queueItemId: targetToRemove },
    });

    expect(removeRes.success).toBe(true);
    const queueAfter = removeRes.session!.queue;
    expect(queueAfter.length).toBe(1);
    expect(queueAfter[0].queueItemId).toBe(itemToKeep);
  });
});
