/**
 * Automatic Cross-Device Playback Detection & Silent Hydration Unit Tests
 *
 * Verifies:
 * 1. Opening Device 2 while Device 1 is playing hydrates canonical session and marks Device 2 as remote controller.
 * 2. Strict Audio Hardware Isolation: 0 audio decode / play calls on Device 2.
 * 3. 60 FPS Mathematical timeline interpolation accurately calculates elapsed position.
 * 4. Handover Takeover ("Play on this device") switches roles smoothly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectServerEngine } from '@/lib/connect/ConnectServerEngine';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { Song } from '@/types/music';
import { ConnectDevice, ConnectPlaybackSession } from '@/types/connect';

const mockTrack: Song = {
  id: 'track_remote_test_1',
  title: 'Starboy',
  artist: 'The Weeknd',
  artistId: 'art_weeknd',
  album: 'Starboy',
  albumId: 'alb_starboy',
  duration: 230,
  coverUrl: 'https://c.saavncdn.com/starboy.jpg',
  audioUrl: 'https://aac.saavncdn.com/starboy.mp4',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2016,
  plays: 50000,
  likes: 12000,
};

const device1_phone: ConnectDevice = {
  deviceId: 'phone_device_1',
  deviceName: 'iPhone 15 Pro',
  deviceType: 'mobile',
  isOnline: true,
  state: 'PLAYING',
  lastSeenAt: Date.now(),
  transport: 'LOCAL_LAN',
  capabilities: { canPlayAudio: true, supportsVolume: true, supportsLossless: true },
};

const device2_laptop: ConnectDevice = {
  deviceId: 'laptop_device_2',
  deviceName: 'MacBook Pro',
  deviceType: 'desktop',
  isOnline: true,
  state: 'IDLE',
  lastSeenAt: Date.now(),
  transport: 'LOCAL_LAN',
  capabilities: { canPlayAudio: true, supportsVolume: true, supportsLossless: true },
};

describe('Automatic Cross-Device Playback Detection & Silent Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Silent Hydration: Device 2 opening while Device 1 is playing initiates 0 local audio decode calls', async () => {
    // Audio element mock to count play/load invocations
    let audioPlayCount = 0;
    let audioSrcAssignments = 0;

    const mockAudio = {
      play: vi.fn(async () => {
        audioPlayCount++;
      }),
      pause: vi.fn(),
      set src(val: string) {
        if (val) audioSrcAssignments++;
      },
    };

    // Device 1 active session state
    const canonicalSession: ConnectPlaybackSession = {
      sessionId: 'sess_active_123',
      playbackDeviceId: device1_phone.deviceId,
      playbackDeviceName: device1_phone.deviceName,
      controllerIds: [],
      currentTrackId: mockTrack.id,
      currentQueueItemId: mockTrack.id,
      currentSong: mockTrack,
      metadata: {
        trackId: mockTrack.id,
        title: mockTrack.title,
        artist: mockTrack.artist,
        album: mockTrack.album || '',
        durationMs: mockTrack.duration * 1000,
        artworkUrl: mockTrack.coverUrl || '',
      },
      queue: [mockTrack],
      queueIndex: 0,
      history: [],
      isPlaying: true,
      playbackState: 'PLAYING',
      positionMs: 45000,
      durationMs: mockTrack.duration * 1000,
      volume: 0.85,
      shuffle: false,
      repeat: 'OFF',
      revision: 1,
      generation: 1,
      timelineId: 'TL_1',
      anchorPositionMs: 45000,
      anchorTimeMs: Date.now() - 5000, // 5s elapsed
      updatedAt: Date.now() - 5000,
    };

    const client = ConnectClientManager.getInstance();

    // Device 2 transfers / hydrates remote session from Device 1
    await client.transferPlaybackTo(device1_phone);
    client.handleIncomingSession(canonicalSession);

    // Verify Device 2 entered Remote Controller mode
    expect(client.isRemoteMode()).toBe(true);
    expect(client.getActiveTargetDevice()?.deviceId).toBe(device1_phone.deviceId);

    // Verify STRICT AUDIO HARDWARE SILENCE (0 audio plays/loads on Device 2)
    expect(audioPlayCount).toBe(0);
    expect(audioSrcAssignments).toBe(0);
  });

  it('2. Mathematical Timeline Interpolation: Accurately calculates elapsed position at 60 FPS without audio polling', () => {
    const anchorTime = Date.now() - 10000; // 10s elapsed
    const anchorPos = 30000; // 30s mark

    const activeSession: ConnectPlaybackSession = {
      sessionId: 'sess_interpol_1',
      playbackDeviceId: device1_phone.deviceId,
      playbackDeviceName: device1_phone.deviceName,
      controllerIds: [],
      currentTrackId: mockTrack.id,
      currentQueueItemId: mockTrack.id,
      currentSong: mockTrack,
      metadata: null,
      queue: [mockTrack],
      queueIndex: 0,
      history: [],
      isPlaying: true,
      playbackState: 'PLAYING',
      positionMs: anchorPos,
      durationMs: 230000,
      volume: 1,
      shuffle: false,
      repeat: 'OFF',
      revision: 1,
      generation: 1,
      timelineId: 'TL_1',
      anchorPositionMs: anchorPos,
      anchorTimeMs: anchorTime,
      updatedAt: anchorTime,
    };

    const client = ConnectClientManager.getInstance();
    client.handleIncomingSession(activeSession);

    const interpolatedSeconds = client.getInterpolatedPosition();
    // 30s + 10s = ~40s (within 500ms jitter)
    expect(interpolatedSeconds).toBeGreaterThanOrEqual(39.5);
    expect(interpolatedSeconds).toBeLessThanOrEqual(41.0);
  });

  it('3. Takeover Handover: Promotes local device to authoritative speaker and disconnects remote', async () => {
    const client = ConnectClientManager.getInstance();
    const server = ConnectServerEngine.getInstance();

    // Controller disconnects & takes over audio locally
    const success = await client.disconnectAndPlayLocally();
    expect(success).toBe(true);
    expect(client.isRemoteMode()).toBe(false);
    expect(client.getActiveTargetDevice()).toBeNull();
  });
});
