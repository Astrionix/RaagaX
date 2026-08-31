/**
 * RaagaX Connect — Spotify Parity Feature Test Suite
 *
 * Tests:
 * 1. SSE Real-Time Stream Event Dispatching
 * 2. Remote Queue Management (ADD_TO_QUEUE, REMOVE_FROM_QUEUE)
 * 3. Remote Volume Control
 * 4. Lockscreen MediaSession Remote Control Binding
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';
import { PlaybackAuthority } from '@/lib/connect/session/PlaybackAuthority';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_parity_1',
  title: 'Kesariya',
  artist: 'Arijit Singh',
  artistId: 'art_arijit',
  album: 'Brahmastra',
  albumId: 'alb_brahmastra',
  duration: 268,
  coverUrl: 'https://c.saavncdn.com/kesariya.jpg',
  audioUrl: 'https://aac.saavncdn.com/kesariya_320.mp4',
  genre: 'Bollywood',
  category: 'melody',
  releaseYear: 2022,
  plays: 5000,
  likes: 1200,
};

const mockSongB: Song = {
  id: 'song_parity_2',
  title: 'Deva Deva',
  artist: 'Arijit Singh',
  artistId: 'art_arijit',
  album: 'Brahmastra',
  albumId: 'alb_brahmastra',
  duration: 279,
  coverUrl: 'https://c.saavncdn.com/deva_deva.jpg',
  audioUrl: 'https://aac.saavncdn.com/deva_deva_320.mp4',
  genre: 'Bollywood',
  category: 'melody',
  releaseYear: 2022,
  plays: 4000,
  likes: 900,
};

describe('RaagaX Connect — Spotify Parity Feature Suite', () => {
  beforeEach(() => {
    ConnectDeviceRegistry.unregisterDevice('test_target_speaker');
  });

  it('1. SSE Stream: Pushes queued commands immediately to active subscriber', () => {
    let receivedEvent: any = null;

    const unsubscribe = ConnectDeviceRegistry.subscribeStream('test_target_speaker', (event) => {
      receivedEvent = event;
    });

    ConnectDeviceRegistry.queueCommand({
      commandId: 'cmd_sse_test_1',
      requestId: 'req_sse_1',
      senderDeviceId: 'test_phone_ctrl',
      targetDeviceId: 'test_target_speaker',
      action: 'PAUSE',
      timestamp: Date.now(),
    });

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.type).toBe('COMMAND');
    expect(receivedEvent.payload.action).toBe('PAUSE');
    expect(receivedEvent.payload.senderDeviceId).toBe('test_phone_ctrl');

    unsubscribe();
  });

  it('2. Remote Queue: ADD_TO_QUEUE and REMOVE_FROM_QUEUE append and prune queue items', async () => {
    const authority = PlaybackAuthority.getInstance();

    // Initialize session with Song A
    await authority.executeCommand({
      commandId: 'cmd_init_queue',
      requestId: 'req_q_init',
      senderDeviceId: 'test_phone_ctrl',
      targetDeviceId: 'test_target_speaker',
      action: 'TRANSFER_PLAYBACK',
      payload: {
        song: mockSongA,
        queue: [mockSongA],
        queueIndex: 0,
        isPlaying: true,
      },
      timestamp: Date.now(),
    });

    let session = authority.getSession();
    expect(session.queue.length).toBe(1);

    // Add Song B remotely
    await authority.executeCommand({
      commandId: 'cmd_add_q',
      requestId: 'req_q_add_1',
      senderDeviceId: 'test_phone_ctrl',
      targetDeviceId: 'test_target_speaker',
      action: 'ADD_TO_QUEUE',
      payload: {
        song: mockSongB,
      },
      timestamp: Date.now(),
    });

    session = authority.getSession();
    expect(session.queue.length).toBe(2);
    expect(session.queue[1].title).toBe('Deva Deva');

    // Remove Song B remotely
    await authority.executeCommand({
      commandId: 'cmd_rem_q',
      requestId: 'req_q_rem_1',
      senderDeviceId: 'test_phone_ctrl',
      targetDeviceId: 'test_target_speaker',
      action: 'REMOVE_FROM_QUEUE',
      payload: {
        newIndex: 1,
      },
      timestamp: Date.now(),
    });

    session = authority.getSession();
    expect(session.queue.length).toBe(1);
    expect(session.queue[0].title).toBe('Kesariya');
  });

  it('3. Remote Volume: SET_VOLUME adjusts speaker session gain', async () => {
    const authority = PlaybackAuthority.getInstance();

    await authority.executeCommand({
      commandId: 'cmd_vol_1',
      requestId: 'req_vol_1',
      senderDeviceId: 'test_phone_ctrl',
      targetDeviceId: 'test_target_speaker',
      action: 'SET_VOLUME',
      payload: {
        volume: 0.45,
      },
      timestamp: Date.now(),
    });

    const session = authority.getSession();
    expect(session.volume).toBe(0.45);
  });

  it('4. Lockscreen MediaSession: Registers remote media handlers without throwing', () => {
    const mediaSession = MediaSessionManager.getInstance();
    expect(() => {
      mediaSession.setupRemoteMediaHandlers();
      mediaSession.updateSongMetadata(mockSongA, { remoteSpeakerName: "Ram's Laptop" });
      mediaSession.restoreLocalMediaHandlers();
    }).not.toThrow();
  });
});
