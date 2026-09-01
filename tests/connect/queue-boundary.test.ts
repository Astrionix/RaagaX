/**
 * RaagaX Connect — Queue Boundary & Loop Prevention Test Suite
 * Validates strict queue exhaustion without circular wrapping,
 * repeat mode parity, and deterministic skip navigation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectCoordinatorServer } from '../../src/lib/connect/protocol/server';
import { ConnectServerEngine } from '../../src/lib/connect/ConnectServerEngine';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

describe('Queue Boundary & Replay Loop Elimination Suite', () => {
  const songA: Song = {
    id: 'song_boundary_1',
    title: 'Boundary Song 1',
    artist: 'Artist 1',
    artistId: 'art_1',
    album: 'Album 1',
    albumId: 'alb_1',
    duration: 180,
    coverUrl: 'https://cdn.example.com/1.jpg',
    audioUrl: 'https://cdn.example.com/1.mp3',
    genre: 'Pop',
    category: 'melody',
    releaseYear: 2024,
    plays: 100,
    likes: 10,
  };

  const songB: Song = {
    id: 'song_boundary_2',
    title: 'Boundary Song 2',
    artist: 'Artist 2',
    artistId: 'art_2',
    album: 'Album 2',
    albumId: 'alb_2',
    duration: 200,
    coverUrl: 'https://cdn.example.com/2.jpg',
    audioUrl: 'https://cdn.example.com/2.mp3',
    genre: 'Rock',
    category: 'mass',
    releaseYear: 2024,
    plays: 200,
    likes: 20,
  };

  beforeEach(() => {
    usePlayerStore.setState({
      currentSong: songA,
      queue: [songA, songB],
      queueIndex: 0,
      isPlaying: true,
      currentTime: 10,
      duration: 180,
      repeatMode: 'OFF',
    });
  });

  it('1. ConnectServerEngine: Pauses playback on queue exhaustion when repeat is OFF (No circular wrapping)', async () => {
    const server = ConnectServerEngine.getInstance();
    const now = Date.now();

    // Initialize session at song B (last track in 2-song queue)
    server['currentSession'] = {
      ...server['currentSession'],
      queue: [songA, songB],
      queueIndex: 1, // Last track
      currentSong: songB,
      currentTrackId: songB.id,
      repeat: 'OFF',
      isPlaying: true,
      playbackState: 'PLAYING',
      revision: 10,
      updatedAt: now,
    };

    // Dispatch SKIP_NEXT past the end of the queue
    const result = await server.handleIncomingCommand({
      commandId: 'cmd_skip_exhaust',
      senderDeviceId: 'dev_ctrl',
      targetDeviceId: 'dev_local',
      action: 'SKIP_NEXT',
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);

    const session = server.getSession();
    // Playback must be PAUSED, NOT wrapped back to index 0!
    expect(session.isPlaying).toBe(false);
    expect(session.playbackState).toBe('PAUSED');
    expect(session.currentTrackId).toBe('song_boundary_2'); // Remains on last song or paused boundary
  });

  it('2. ConnectServerEngine: Wraps to 0 ONLY when repeat mode is ALL', async () => {
    const server = ConnectServerEngine.getInstance();
    const now = Date.now();

    server['currentSession'] = {
      ...server['currentSession'],
      queue: [songA, songB],
      queueIndex: 1, // Last track
      currentSong: songB,
      currentTrackId: songB.id,
      repeat: 'ALL',
      isPlaying: true,
      playbackState: 'PLAYING',
      revision: 20,
      updatedAt: now,
    };

    await server.handleIncomingCommand({
      commandId: 'cmd_skip_repeat_all',
      senderDeviceId: 'dev_ctrl',
      targetDeviceId: 'dev_local',
      action: 'SKIP_NEXT',
      timestamp: Date.now(),
    });

    const session = server.getSession();
    expect(session.isPlaying).toBe(true);
    expect(session.queueIndex).toBe(0);
    expect(session.currentTrackId).toBe('song_boundary_1');
  });

  it('3. ConnectCoordinatorServer (Protocol Hub): Halts playback on queue exhaustion', async () => {
    const coordinator = new ConnectCoordinatorServer();
    const userId = 'usr_boundary_test';
    const mockSocket = {
      readyState: 1,
      send: () => {},
      close: () => {},
    };

    coordinator.handleConnection(mockSocket, userId, 'dev_sink');

    // Register queue with 2 tracks and repeat OFF
    await coordinator.handleCommand(
      userId,
      JSON.stringify({
        type: 'COMMAND',
        commandId: 'cmd_init_q',
        clientTimestampMs: Date.now(),
        originDeviceId: 'dev_sink',
        action: 'TRANSFER_PLAYBACK',
        payload: {
          targetDeviceId: 'dev_sink',
          track: {
            uri: 'https://cdn.example.com/2.mp3',
            title: 'Track 2',
            artist: 'Artist 2',
            album: 'Album 2',
            artworkUrl: 'https://cdn.example.com/2.png',
            durationMs: 200000,
            bitrateBps: 320000,
          },
          queue: [
            {
              uri: 'https://cdn.example.com/1.mp3',
              title: 'Track 1',
              artist: 'Artist 1',
              album: 'Album 1',
              artworkUrl: 'https://cdn.example.com/1.png',
              durationMs: 180000,
              bitrateBps: 320000,
            },
            {
              uri: 'https://cdn.example.com/2.mp3',
              title: 'Track 2',
              artist: 'Artist 2',
              album: 'Album 2',
              artworkUrl: 'https://cdn.example.com/2.png',
              durationMs: 200000,
              bitrateBps: 320000,
            },
          ],
          seekPositionMs: 0,
          autoPlay: true,
        },
      })
    );

    // First skip: from index 0 to index 1 (Track 2)
    await coordinator.handleCommand(
      userId,
      JSON.stringify({
        type: 'COMMAND',
        commandId: 'cmd_skip_1_hub',
        clientTimestampMs: Date.now(),
        originDeviceId: 'dev_sink',
        action: 'SKIP_NEXT',
        payload: {},
      })
    );

    const session1 = coordinator.getSession(userId);
    expect(session1?.queueIndex).toBe(1);
    expect(session1?.playbackState).toBe('PLAYING');

    // Second skip: past end of queue -> Exhaustion!
    await coordinator.handleCommand(
      userId,
      JSON.stringify({
        type: 'COMMAND',
        commandId: 'cmd_skip_exhaust_hub',
        clientTimestampMs: Date.now(),
        originDeviceId: 'dev_sink',
        action: 'SKIP_NEXT',
        payload: {},
      })
    );

    const session2 = coordinator.getSession(userId);
    expect(session2).not.toBeNull();
    expect(session2!.playbackState).toBe('PAUSED');
  });
});
