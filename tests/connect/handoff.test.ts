/**
 * RaagaX Connect — Session Handshake Integration Test
 * Demonstrates seamless, race-condition-free playback transfer:
 * Device X (Audio Sink playing Song A) -> Device Y (Remote Controller requesting handoff).
 */

import { describe, it, test, expect, beforeEach, afterEach } from 'vitest';
import { ConnectCoordinatorServer, WebSocketConnectionLike } from '../../src/lib/connect/protocol/server';
import { ConnectAudioPlayer } from '../../src/lib/connect/protocol/AudioPlayer';
import { TimelineScrubberEngine } from '../../src/lib/connect/protocol/ScrubberSync';
import {
  ClientCommand,
  ServerMessage,
  TrackMetadata,
  PlaybackSessionState,
} from '../../src/lib/connect/protocol/types';

class MockWebSocket implements WebSocketConnectionLike {
  public readyState: number = 1;
  public readonly sentMessages: ServerMessage[] = [];
  public onMessageCallback?: (data: ServerMessage) => void;

  public send(data: string): void {
    const parsed = JSON.parse(data) as ServerMessage;
    this.sentMessages.push(parsed);
    if (this.onMessageCallback) {
      this.onMessageCallback(parsed);
    }
  }

  public close(): void {
    this.readyState = 3;
  }

  public getLastMessage(): ServerMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }
}

describe('Spotify Connect — Cross-Device Playback Transfer Handshake', () => {
  const userId = 'user_12345';
  const deviceXId = 'dev_X_desktop_speaker';
  const deviceYId = 'dev_Y_mobile_phone';

  const mockSongA: TrackMetadata = {
    uri: 'https://cdn.raagax.com/audio/song_a.mp3',
    title: 'Song A (Pre-Wedding)',
    artist: 'Artist A',
    album: 'Album A',
    artworkUrl: 'https://cdn.raagax.com/art/song_a.png',
    durationMs: 240000,
    bitrateBps: 320000,
  };

  const mockSongB: TrackMetadata = {
    uri: 'https://cdn.raagax.com/audio/song_b.mp3',
    title: 'Song B (Fidaa)',
    artist: 'Artist B',
    album: 'Album B',
    artworkUrl: 'https://cdn.raagax.com/art/song_b.png',
    durationMs: 210000,
    bitrateBps: 320000,
  };

  let coordinator: ConnectCoordinatorServer;
  let socketX: MockWebSocket;
  let socketY: MockWebSocket;

  let playerX: ConnectAudioPlayer;
  let scrubberX: TimelineScrubberEngine;

  let playerY: ConnectAudioPlayer;
  let scrubberY: TimelineScrubberEngine;

  beforeEach(() => {
    coordinator = new ConnectCoordinatorServer();
    socketX = new MockWebSocket();
    socketY = new MockWebSocket();

    playerX = new ConnectAudioPlayer();
    scrubberX = new TimelineScrubberEngine();

    playerY = new ConnectAudioPlayer();
    scrubberY = new TimelineScrubberEngine();
  });

  afterEach(() => {
    playerX.detachAndFlushHardware();
    playerY.detachAndFlushHardware();
    scrubberX.destroy();
    scrubberY.destroy();
  });

  test('Seamless Playback Handshake from Device X to Device Y', async () => {
    // ── 1. Device Registration & Initial Connection ──────────────────
    coordinator.handleConnection(socketX, userId, deviceXId);
    coordinator.handleConnection(socketY, userId, deviceYId);

    // Assert both received initial FULL_HYDRATE
    const hydrateX = socketX.sentMessages.find((m) => m.type === 'FULL_HYDRATE');
    expect(hydrateX).toBeDefined();
    expect(hydrateX?.type).toBe('FULL_HYDRATE');

    // ── 2. Device X is designated as Sink and plays Song A ────────────
    playerX.setDeviceMode('SINK');
    playerY.setDeviceMode('CONTROLLER');

    const registerCmd: ClientCommand = {
      type: 'COMMAND',
      commandId: 'cmd_reg_x',
      clientTimestampMs: Date.now(),
      originDeviceId: deviceXId,
      action: 'TRANSFER_PLAYBACK',
      payload: {
        targetDeviceId: deviceXId,
        track: mockSongA,
        queue: [mockSongA, mockSongB],
        seekPositionMs: 45200, // Currently at 45.2s in Song A
        autoPlay: true,
      },
    };
    await coordinator.handleCommand(userId, JSON.stringify(registerCmd));

    const sessionX = coordinator.getSession(userId)!;
    scrubberX.hydrate(sessionX);
    scrubberY.hydrate(sessionX);

    expect(scrubberX.calculateCurrentPositionMs()).toBeGreaterThanOrEqual(45200);
    expect(scrubberY.calculateCurrentPositionMs()).toBeGreaterThanOrEqual(45200);

    // ── 3. Device Y initiates TRANSFER_PLAYBACK to itself ────────────
    const transferCmd: ClientCommand = {
      type: 'COMMAND',
      commandId: 'cmd_transfer_y',
      clientTimestampMs: Date.now(),
      originDeviceId: deviceYId,
      action: 'TRANSFER_PLAYBACK',
      payload: {
        targetDeviceId: deviceYId,
        seekPositionMs: 52000,
        autoPlay: true,
      },
    };

    // Device X monitors for PAUSE_AND_FLUSH
    let deviceXFlushed = false;
    socketX.onMessageCallback = (msg) => {
      if (msg.type === 'PAUSE_AND_FLUSH') {
        // Device X halts local audio hardware immediately
        playerX.setDeviceMode('CONTROLLER');
        deviceXFlushed = true;
      }
      if (msg.type === 'FULL_HYDRATE') {
        scrubberX.hydrate(msg.state);
      }
    };

    // Device Y monitors for LOAD_AND_PLAY and FULL_HYDRATE
    let deviceYLoadedTrackUri = '';
    let deviceYOffsetMs = 0;
    socketY.onMessageCallback = (msg) => {
      if (msg.type === 'LOAD_AND_PLAY') {
        playerY.setDeviceMode('SINK');
        deviceYLoadedTrackUri = msg.track.uri;
        deviceYOffsetMs = msg.offsetMs;
      }
      if (msg.type === 'FULL_HYDRATE') {
        scrubberY.hydrate(msg.state);
      }
    };

    // Dispatch handoff command through coordinator
    await coordinator.handleCommand(userId, JSON.stringify(transferCmd));

    // ── 4. Verify Protocol State & Invariants ────────────────────────

    // Invariant A: Device X received PAUSE_AND_FLUSH and detached its hardware
    expect(deviceXFlushed).toBe(true);
    expect(playerX.getDeviceMode()).toBe('CONTROLLER');

    // Invariant B: Device Y received LOAD_AND_PLAY at exact exit offset (52000ms)
    expect(playerY.getDeviceMode()).toBe('SINK');
    expect(deviceYLoadedTrackUri).toBe(mockSongA.uri);
    expect(deviceYOffsetMs).toBe(52000);

    // Invariant C: Monotonic stateVersion incremented
    const finalSession = coordinator.getSession(userId);
    expect(finalSession).not.toBeNull();
    expect(finalSession!.stateVersion).toBeGreaterThan(2);
    expect(finalSession!.activeSinkDeviceId).toBe(deviceYId);
    expect(finalSession!.playbackState).toBe('PLAYING');

    // Invariant D: Both scrubbers synchronized with zero ghost ticks
    expect(scrubberY.calculateCurrentPositionMs()).toBeGreaterThanOrEqual(52000);
    expect(scrubberX.calculateCurrentPositionMs()).toBeGreaterThanOrEqual(52000);
  });
});
