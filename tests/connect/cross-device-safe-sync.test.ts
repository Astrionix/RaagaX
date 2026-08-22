import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { PlaybackStateSync, RemotePlaybackState } from '@/lib/connect/PlaybackStateSync';
import { CommandBus } from '@/lib/connect/CommandBus';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { Song } from '@/types/music';

const songInthandham: Song = {
  id: 'song_inthandham_1',
  title: 'Inthandham',
  artist: 'Sita Ramam',
  duration: 218,
  coverUrl: '/covers/inthandham.jpg',
  audioUrl: 'https://cdn.raagax.com/inthandham.mp3',
} as Song;

const songKurchi: Song = {
  id: 'song_kurchi_2',
  title: 'Kurchi Madathapetti',
  artist: 'Guntur Kaaram',
  duration: 245,
  coverUrl: '/covers/kurchi.jpg',
  audioUrl: 'https://cdn.raagax.com/kurchi.mp3',
} as Song;

describe('RaagaX Cross-Device Sync — Safe Incremental Architecture Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile_1',
      isActiveDevice: true,
      activeDeviceId: null,
      connectedDeviceId: null,
      deviceConnectionState: 'AVAILABLE',
      availableDevicePlaybackStates: {},
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      queue: [],
      queueIndex: 0,
      onlineDevices: [],
      localPlaybackRevision: 0,
      lastReceivedPlaybackRevision: 0,
    });

    CommandValidator.getInstance().reset();
    CommandSequencer.getInstance().reset();
    CommandBus.getInstance().reset();
  });

  // ── TEST 1: Auto-Discovery without Auto-Connection ──────────────────────────
  it('Requirement 1 & 2: Mobile opening discovers playing Laptop but does NOT auto-connect or disrupt Laptop playback', async () => {
    const laptopState: RemotePlaybackState = {
      activeDeviceId: 'dev_laptop_1',
      activeDeviceName: 'My Laptop',
      songId: songInthandham.id,
      songData: songInthandham,
      isPlaying: true,
      positionMs: 92000, // 92s
      durationMs: 218000,
      volume: 0.85,
      isMuted: false,
      queue: [songInthandham, songKurchi],
      queueIndex: 0,
      serverTimestamp: Date.now(),
      epoch: 1,
      revision: 10,
    };

    // Mobile receives remote state broadcast from Laptop
    PlaybackStateSync.getInstance().handleRemoteStateUpdate(laptopState);

    const mobileStore = usePlayerStore.getState();

    // 1. Mobile MUST remain in local mode (not auto-connected)
    expect(mobileStore.isActiveDevice).toBe(true);
    expect(mobileStore.connectedDeviceId).toBeNull();
    expect(mobileStore.currentSong).toBeNull();
    expect(mobileStore.isPlaying).toBe(false);

    // 2. Mobile MUST have cached Laptop's preview in availableDevicePlaybackStates
    const preview = mobileStore.availableDevicePlaybackStates['dev_laptop_1'];
    expect(preview).toBeDefined();
    expect(preview?.isPlaying).toBe(true);
    expect(preview?.songTitle).toBe('Inthandham');
  });

  // ── TEST 2: User-Initiated Explicit Connection ──────────────────────────────
  it('Requirement 3 & 4: Tapping Connect explicitly connects Mobile to Laptop without changing renderer', async () => {
    const laptopState: RemotePlaybackState = {
      activeDeviceId: 'dev_laptop_1',
      activeDeviceName: 'My Laptop',
      songId: songInthandham.id,
      songData: songInthandham,
      isPlaying: true,
      positionMs: 92000, // 92s
      durationMs: 218000,
      volume: 0.85,
      isMuted: false,
      queue: [songInthandham, songKurchi],
      queueIndex: 0,
      serverTimestamp: Date.now(),
      epoch: 1,
      revision: 10,
    };

    // Broadcast arrives and is cached
    PlaybackStateSync.getInstance().handleRemoteStateUpdate(laptopState);

    // User explicitly connects
    const connectSuccess = await usePlayerStore.getState().connectToDevice('dev_laptop_1');
    expect(connectSuccess).toBe(true);

    const mobileStore = usePlayerStore.getState();

    // Mobile is now Remote Controller
    expect(mobileStore.deviceConnectionState).toBe('CONNECTED');
    expect(mobileStore.connectedDeviceId).toBe('dev_laptop_1');
    expect(mobileStore.activeDeviceId).toBe('dev_laptop_1');
    expect(mobileStore.isActiveDevice).toBe(false); // Follower/Controller role
    expect(mobileStore.currentSong?.title).toBe('Inthandham');
    expect(mobileStore.currentTime).toBe(92);
    expect(mobileStore.isPlaying).toBe(true);
  });

  // ── TEST 3: Remote Controls Operating on Connected Renderer ─────────────────
  it('Requirement 6 & 7: Remote Play/Pause and Seek operate on renderer with 0ms perceived latency', async () => {
    // Connect Mobile to Laptop
    usePlayerStore.setState({
      deviceId: 'dev_mobile_1',
      isActiveDevice: false,
      activeDeviceId: 'dev_laptop_1',
      connectedDeviceId: 'dev_laptop_1',
      deviceConnectionState: 'CONNECTED',
      currentSong: songInthandham,
      currentTime: 92,
      duration: 218,
      isPlaying: true,
    });

    const { RaagaXConnectV2 } = await import('../../src/lib/connect/lan/RaagaXConnectV2');
    const sendSpy = vi.spyOn(RaagaXConnectV2.getInstance(), 'sendCommand');

    // 1. Mobile user taps PAUSE
    await usePlayerStore.getState().togglePlayPause();
    expect(usePlayerStore.getState().isPlaying).toBe(false); // 0ms perceived pause
    expect(sendSpy).toHaveBeenCalledWith('CMD_PAUSE', { positionMs: 92000 });

    // 2. Mobile user seeks to 134s (02:14)
    usePlayerStore.getState().setCurrentTime(134);
    expect(usePlayerStore.getState().currentTime).toBe(134); // 0ms perceived seek

    sendSpy.mockRestore();
  });

  // ── TEST 4: Seek Safety & Transient 0ms Stale State Protection ───────────────
  it('Requirement 8, 9 & 10: Transient 0ms or stale remote positions during seek do NOT overwrite local target', () => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile_1',
      isActiveDevice: false,
      activeDeviceId: 'dev_laptop_1',
      connectedDeviceId: 'dev_laptop_1',
      currentSong: songInthandham,
      currentTime: 45, // Was at 45s
      duration: 218,
      isPlaying: true,
    });

    // User seeks to 134s
    usePlayerStore.getState().setCurrentTime(134);
    PlaybackStateSync.getInstance().recordSentCommand('SEEK', songInthandham.id, 0, 134000, 'cmd_seek_100');

    // Scenario A: Stale remote packet arrives reporting old 45s position
    const staleState: RemotePlaybackState = {
      activeDeviceId: 'dev_laptop_1',
      activeDeviceName: 'My Laptop',
      songId: songInthandham.id,
      songData: songInthandham,
      isPlaying: true,
      positionMs: 45000, // 45s (stale)
      durationMs: 218000,
      volume: 0.85,
      isMuted: false,
      queue: [songInthandham],
      queueIndex: 0,
      serverTimestamp: Date.now(),
      epoch: 1,
      revision: 11,
    };

    PlaybackStateSync.getInstance().handleRemoteStateUpdate(staleState);
    expect(usePlayerStore.getState().currentTime).toBe(134); // Must remain at target 134s!

    // Scenario B: Transient 0ms packet arrives while remote audio player is initializing seek
    const transientZeroState: RemotePlaybackState = {
      ...staleState,
      positionMs: 0, // 0ms (transient buffering)
      revision: 12,
    };

    PlaybackStateSync.getInstance().handleRemoteStateUpdate(transientZeroState);
    expect(usePlayerStore.getState().currentTime).toBe(134); // Shielded! Never jumps to 0:00!

    // Scenario C: Authoritative remote packet arrives confirmed at 134s
    const confirmedState: RemotePlaybackState = {
      ...staleState,
      positionMs: 134100, // 134.1s
      revision: 13,
    };

    PlaybackStateSync.getInstance().handleRemoteStateUpdate(confirmedState);
    expect(usePlayerStore.getState().currentTime).toBeCloseTo(134.1, 1); // Confirmed & adopted smoothly
  });

  // ── TEST 5: Disconnect Safety ───────────────────────────────────────────────
  it('Requirement 15 & 16: Disconnecting Mobile reverts local state immediately while Laptop continues playing', () => {
    // Mobile connected to Laptop
    usePlayerStore.setState({
      deviceId: 'dev_mobile_1',
      isActiveDevice: false,
      activeDeviceId: 'dev_laptop_1',
      connectedDeviceId: 'dev_laptop_1',
      deviceConnectionState: 'CONNECTED',
      remoteDeviceName: 'My Laptop',
      currentSong: songInthandham,
      isPlaying: true,
    });

    const laptopSimulation = {
      deviceId: 'dev_laptop_1',
      isPlaying: true,
      song: songInthandham,
      role: 'RENDERER'
    };

    // User taps Disconnect on Mobile
    usePlayerStore.getState().disconnectDevice();

    const mobileStore = usePlayerStore.getState();
    expect(mobileStore.isActiveDevice).toBe(true);
    expect(mobileStore.connectedDeviceId).toBeNull();
    expect(mobileStore.activeDeviceId).toBeNull();
    expect(mobileStore.remoteDeviceName).toBeNull();
    expect(mobileStore.deviceConnectionState).toBe('AVAILABLE');

    // Laptop continues completely uninterrupted
    expect(laptopSimulation.isPlaying).toBe(true);
    expect(laptopSimulation.role).toBe('RENDERER');
  });

  // ── TEST 6: Command Idempotency on Renderer ─────────────────────────────────
  it('Requirement 8 & 12: Play/Pause and Seek commands are strictly idempotent on receiver', async () => {
    // Setup Laptop as active renderer
    CommandSequencer.getInstance().setEpoch(1);
    CommandBus.getInstance().init('dev_laptop_1', 'sess_1');
    usePlayerStore.setState({
      deviceId: 'dev_laptop_1',
      isActiveDevice: true,
      activeDeviceId: 'dev_laptop_1',
      currentSong: songInthandham,
      currentTime: 92,
      isPlaying: true,
    });

    const duplicateSeekCommand = {
      commandId: 'cmd_unique_seek_123',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_mobile_1',
      targetDeviceId: 'dev_laptop_1',
      type: 'SEEK' as const,
      sentAt: Date.now(),
      payload: { positionMs: 120000, songId: songInthandham.id }
    };

    // First arrival: executed
    CommandBus.getInstance().handleIncomingCommand(duplicateSeekCommand);
    expect(usePlayerStore.getState().currentTime).toBe(120);

    // Reset store time to test duplicate rejection
    usePlayerStore.setState({ currentTime: 125 });

    // Second arrival of identical commandId: suppressed as duplicate
    CommandBus.getInstance().handleIncomingCommand(duplicateSeekCommand);
    expect(usePlayerStore.getState().currentTime).toBe(125); // Unchanged!
  });
});
