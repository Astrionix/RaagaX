import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { ConnectServerEngine } from '@/lib/connect/ConnectServerEngine';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { ConnectDevice } from '@/types/connect';

const mockTrackA: Song = {
  id: 'song_conn_a',
  title: 'Connect Track Alpha',
  artist: 'RaagaX Artist',
  artistId: 'art_1',
  album: 'Connect Album',
  albumId: 'alb_1',
  duration: 200,
  coverUrl: 'https://cdn.test/conn_a.jpg',
  audioUrl: 'https://cdn.test/conn_a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 20,
};

const mockTrackB: Song = {
  id: 'song_conn_b',
  title: 'Connect Track Bravo',
  artist: 'RaagaX Artist 2',
  artistId: 'art_2',
  album: 'Connect Album 2',
  albumId: 'alb_2',
  duration: 180,
  coverUrl: 'https://cdn.test/conn_b.jpg',
  audioUrl: 'https://cdn.test/conn_b.mp3',
  genre: 'Rock',
  category: 'mass',
  releaseYear: 2024,
  plays: 200,
  likes: 40,
};

describe('RaagaX Connect — Standalone Authoritative Playback & Controller Suite', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      currentSong: mockTrackA,
      queue: [mockTrackA, mockTrackB],
      queueIndex: 0,
      currentTime: 84.527, // 84,527 ms
      duration: 200,
      isPlaying: true,
      volume: 0.8,
    });
  });

  it('1. ConnectDiscoveryEngine: advertises local device and scans nearby devices', () => {
    const discovery = ConnectDiscoveryEngine.getInstance();
    const localDev = discovery.getLocalDevice();

    expect(localDev.deviceId).toBeDefined();
    expect(localDev.isCurrentDevice).toBe(true);
    expect(localDev.capabilities?.canPlayAudio).toBe(true);

    discovery.setLocalDeviceName("Ram's Studio Laptop");
    const updated = discovery.getLocalDevice();
    expect(updated.deviceName).toBe("Ram's Studio Laptop");

    const devices = discovery.getAvailableDevices();
    expect(devices.length).toBeGreaterThanOrEqual(1);
    expect(devices[0].deviceId).toBe(localDev.deviceId);
  });

  it('2. ConnectServerEngine: handles TRANSFER_PLAYBACK preserving exact millisecond position (no 0:00 reset)', async () => {
    const server = ConnectServerEngine.getInstance();

    const result = await server.handleIncomingCommand({
      commandId: 'cmd_transfer_1',
      senderDeviceId: 'dev_phone_remote',
      targetDeviceId: 'dev_laptop_target',
      action: 'TRANSFER_PLAYBACK',
      payload: {
        song: mockTrackA,
        queue: [mockTrackA, mockTrackB],
        queueIndex: 0,
        positionMs: 84527, // Phone @ 01:24.527
        isPlaying: true,
        volume: 0.9,
      },
      timestamp: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(result.session.currentSong?.id).toBe('song_conn_a');
    expect(result.session.positionMs).toBe(84527); // Exactly preserved
    expect(result.session.isPlaying).toBe(true);
    expect(result.session.volume).toBe(0.9);

    const store = usePlayerStore.getState();
    expect(store.currentSong?.id).toBe('song_conn_a');
    expect(store.currentTime).toBe(84.527);
    expect(store.isPlaying).toBe(true);
  });

  it('3. ConnectServerEngine: PAUSE captures exact actual player position (84,527ms)', async () => {
    const server = ConnectServerEngine.getInstance();

    // Player is at 84.527s
    usePlayerStore.setState({ currentTime: 84.527, isPlaying: true });

    await server.handleIncomingCommand({
      commandId: 'cmd_pause_1',
      senderDeviceId: 'dev_phone_remote',
      targetDeviceId: 'dev_laptop_target',
      action: 'PAUSE',
      timestamp: Date.now(),
    });

    const session = server.getSession();
    expect(session.isPlaying).toBe(false);
    expect(session.positionMs).toBe(84527); // Exact position captured
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it('4. ConnectServerEngine: RESUME uses exact paused position without resetting to 0', async () => {
    const server = ConnectServerEngine.getInstance();

    // Paused at 84,527ms
    await server.handleIncomingCommand({
      commandId: 'cmd_resume_1',
      senderDeviceId: 'dev_phone_remote',
      targetDeviceId: 'dev_laptop_target',
      action: 'RESUME',
      timestamp: Date.now(),
    });

    const session = server.getSession();
    expect(session.isPlaying).toBe(true);
    expect(session.positionMs).toBe(84527); // Resumed from exact ms
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('5. ConnectServerEngine: Single committed SEEK (130,000ms)', async () => {
    const server = ConnectServerEngine.getInstance();

    await server.handleIncomingCommand({
      commandId: 'cmd_seek_1',
      senderDeviceId: 'dev_phone_remote',
      targetDeviceId: 'dev_laptop_target',
      action: 'SEEK',
      payload: { positionMs: 130000 },
      timestamp: Date.now(),
    });

    const session = server.getSession();
    expect(session.positionMs).toBe(130000);
    expect(usePlayerStore.getState().currentTime).toBe(130);
  });

  it('6. ConnectClientManager: calculates smooth display position from anchor', async () => {
    const client = ConnectClientManager.getInstance();

    const remoteTarget: ConnectDevice = {
      deviceId: 'dev_living_room_tv',
      deviceName: 'Living Room TV',
      deviceType: 'tv',
      isOnline: true,
      state: 'PLAYING',
      lastSeenAt: Date.now(),
      transport: 'LOCAL_LAN',
    };

    await client.transferPlaybackTo(remoteTarget);
    expect(client.isRemoteMode()).toBe(true);

    // Initial position at 84.527s
    const displayPos = client.getInterpolatedPosition();
    expect(displayPos).toBeGreaterThanOrEqual(84.5);
  });

  it('7. Stale revision protection: rejects older commands and snapshots', async () => {
    const server = ConnectServerEngine.getInstance();
    const currentRev = server.getSession().revision;

    // Send a stale command with revision < currentRev
    const result = await server.handleIncomingCommand({
      commandId: 'cmd_stale',
      senderDeviceId: 'dev_phone_remote',
      targetDeviceId: 'dev_laptop_target',
      action: 'PAUSE',
      expectedRevision: currentRev - 1, // Stale!
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
  });

  it('8. Track change resets progress and eliminates stuck timeline (e.g. 4:26 / -0:00 bug)', () => {
    const client = ConnectClientManager.getInstance();
    const now = Date.now();

    // Controller connected to remote speaker (dev_living_room_tv)
    useConnectStore.setState({
      isRemoteMode: true,
      activePlaybackDevice: {
        deviceId: 'dev_living_room_tv',
        deviceName: 'Living Room TV',
        deviceType: 'tv',
        isOnline: true,
        state: 'PLAYING',
        lastSeenAt: now,
        transport: 'LOCAL_LAN',
      },
    });

    // Prior state: track Alpha at end-position (266 seconds = 4:26)
    usePlayerStore.setState({
      currentSong: mockTrackA,
      currentTime: 266, // 4:26
      duration: 266,
      isPlaying: false,
    });

    expect(usePlayerStore.getState().currentTime).toBe(266);

    // Incoming broadcast from remote speaker: Firestorm (mockTrackB) starts at 0ms
    client.handleIncomingSession({
      sessionId: 'sess_new_track',
      playbackDeviceId: 'dev_living_room_tv',
      playbackDeviceName: 'Living Room TV',
      controllerIds: [],
      currentTrackId: mockTrackB.id,
      currentQueueItemId: 'q_b',
      currentSong: mockTrackB,
      metadata: null,
      queue: [mockTrackB],
      queueIndex: 0,
      history: [mockTrackA],
      isPlaying: true,
      playbackState: 'PLAYING',
      positionMs: 0, // Reset to 0
      durationMs: 180000,
      volume: 0.8,
      shuffle: false,
      repeat: 'OFF',
      revision: 99,
      generation: 1,
      timelineId: 'TL_new',
      anchorPositionMs: 0,
      anchorTimeMs: now,
      updatedAt: now,
    });

    const updatedStore = usePlayerStore.getState();
    // Verify track metadata updated
    expect(updatedStore.currentSong?.id).toBe(mockTrackB.id);
    // Verify currentTime was reset from 266 down to 0, NOT stuck at 4:26
    expect(updatedStore.currentTime).toBe(0);
    expect(updatedStore.duration).toBe(180);
  });
});
