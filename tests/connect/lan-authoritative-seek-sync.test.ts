import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

const testSong: Song = {
  id: 'song_seek_test',
  title: 'Epic Harmony',
  artist: 'RaagaX Master',
  artistId: 'art_1',
  album: 'Discovery 2026',
  albumId: 'alb_1',
  coverUrl: 'https://images.raagax.test/cover_seek.jpg',
  duration: 272, // 04:32 (272 seconds)
  audioUrl: 'https://audio.raagax.test/seek.mp3',
  genre: 'Classical Fusion',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 100,
  likes: 50,
};

const nextSong: Song = {
  id: 'song_next_test',
  title: 'Future Ragas',
  artist: 'RaagaX Master',
  artistId: 'art_1',
  album: 'Discovery 2026',
  albumId: 'alb_1',
  coverUrl: 'https://images.raagax.test/cover_future.jpg',
  duration: 210, // 03:30 (210 seconds)
  audioUrl: 'https://audio.raagax.test/future.mp3',
  genre: 'Electronic Raga',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 200,
  likes: 80,
};

describe('RaagaX Connect V2: Authoritative Seek & Symmetrical Precision Suite', () => {
  let remoteClient: RemoteControlClient;
  let ownerEngine: PlaybackOwnerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    remoteClient = RemoteControlClient.getInstance();
    ownerEngine = PlaybackOwnerEngine.getInstance();

    usePlayerStore.setState({
      deviceId: 'dev_mobile_controller',
      activeDeviceId: 'dev_desktop_owner',
      connectedDeviceId: 'dev_desktop_owner',
      remoteDeviceName: 'MacBook Pro',
      isActiveDevice: false,
      currentSong: testSong,
      currentTime: 45, // 00:45
      duration: 272,
      isPlaying: true,
      playbackIntent: 'PLAYING',
      queue: [testSong, nextSong],
      queueIndex: 0,
    });
  });

  it('1. Mobile Controller -> Desktop Owner: Seeks to 02:37 (157000ms) while playing; preserves isPlaying=true', async () => {
    const sendSpy = vi.spyOn(DirectLANTransport.getInstance(), 'sendMessage');

    // 1. Mobile Controller dispatches CMD_SEEK to Desktop Owner
    remoteClient.sendCommand('CMD_SEEK', { positionMs: 157000 });

    expect(sendSpy).toHaveBeenCalledWith(
      'dev_desktop_owner',
      expect.objectContaining({
        type: 'CMD_SEEK',
        targetDeviceId: 'dev_desktop_owner',
        payload: { positionMs: 157000 },
      })
    );

    // 2. Desktop Owner handles the authoritative seek
    const handleCommandSpy = vi.spyOn(usePlayerStore.getState(), 'setCurrentTime');
    ownerEngine.setOwner('dev_desktop_owner', true);
    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: 'dev_mobile_controller',
      deviceName: 'Mobile Controller',
      accountName: 'Same User',
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    await ownerEngine.handleRemoteCommand({
      id: 'cmd_seek_1',
      type: 'CMD_SEEK',
      sourceDeviceId: 'dev_mobile_controller',
      targetDeviceId: 'dev_desktop_owner',
      commandId: 'c_seek_101',
      payload: { positionMs: 157000 },
      timestamp: Date.now(),
    });

    // 3. Desktop publishes authoritative state update with positionMs=157000
    const snapshot = ownerEngine.getStateSnapshot();
    expect(snapshot.positionMs).toBe(157000);
    expect(snapshot.isPlaying).toBe(true);

    // 4. Mobile Controller receives authoritative state and mirrors 02:37
    ownerEngine.setOwner('dev_desktop_owner', false);
    usePlayerStore.setState({ isActiveDevice: false });

    remoteClient.handlePlaybackStateUpdate({
      id: 'msg_st_seek',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_desktop_owner',
      targetDeviceId: 'dev_mobile_controller',
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: 'dev_desktop_owner',
        songId: testSong.id,
        song: testSong,
        queue: [testSong, nextSong],
        queueIndex: 0,
        positionMs: 157000,
        durationMs: 272000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 185,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.currentTime).toBe(157);
    expect(mobileState.isPlaying).toBe(true);
  });

  it('2. Mobile Controller -> Desktop Owner: Seeks to 01:15 while paused; preserves isPlaying=false', async () => {
    usePlayerStore.setState({ isPlaying: false, playbackIntent: 'PAUSED' });

    ownerEngine.setOwner('dev_desktop_owner', true);
    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: 'dev_mobile_controller',
      deviceName: 'Mobile Controller',
      accountName: 'Same User',
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    await ownerEngine.handleRemoteCommand({
      id: 'cmd_seek_2',
      type: 'CMD_SEEK',
      sourceDeviceId: 'dev_mobile_controller',
      targetDeviceId: 'dev_desktop_owner',
      commandId: 'c_seek_102',
      payload: { positionMs: 75000 },
      timestamp: Date.now(),
    });

    const snapshot = ownerEngine.getStateSnapshot();
    expect(snapshot.positionMs).toBe(75000);
    expect(snapshot.isPlaying).toBe(false);
  });

  it('3. Desktop Controller -> Mobile Owner: Symmetrical seek execution and confirmation', async () => {
    // Mobile is Owner, Desktop is Controller
    ownerEngine.setOwner('dev_mobile_owner', true);
    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: 'dev_desktop_controller',
      deviceName: 'Desktop Controller',
      accountName: 'Same User',
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    await ownerEngine.handleRemoteCommand({
      id: 'cmd_seek_3',
      type: 'CMD_SEEK',
      sourceDeviceId: 'dev_desktop_controller',
      targetDeviceId: 'dev_mobile_owner',
      commandId: 'c_seek_103',
      payload: { positionMs: 200000 }, // 03:20
      timestamp: Date.now(),
    });

    const snapshot = ownerEngine.getStateSnapshot();
    expect(snapshot.positionMs).toBe(200000);
  });

  it('4. Rapid consecutive seeks: executes newest seek and rejects duplicate/stale commands', async () => {
    const authManager = ConnectAuthManager.getInstance();

    const seek1 = {
      id: 'cmd_s1',
      type: 'CMD_SEEK' as const,
      sourceDeviceId: 'dev_controller',
      targetDeviceId: 'dev_owner',
      commandId: 'c_rapid_1',
      sequence: 1,
      payload: { positionMs: 70000 }, // 01:10
      timestamp: Date.now(),
    };

    const seek2 = {
      id: 'cmd_s2',
      type: 'CMD_SEEK' as const,
      sourceDeviceId: 'dev_controller',
      targetDeviceId: 'dev_owner',
      commandId: 'c_rapid_2',
      sequence: 2,
      payload: { positionMs: 90000 }, // 01:30
      timestamp: Date.now(),
    };

    const seek3 = {
      id: 'cmd_s3',
      type: 'CMD_SEEK' as const,
      sourceDeviceId: 'dev_controller',
      targetDeviceId: 'dev_owner',
      commandId: 'c_rapid_3',
      sequence: 3,
      payload: { positionMs: 115000 }, // 01:55
      timestamp: Date.now(),
    };

    // All distinct in-order seeks are valid
    expect(authManager.validateCommandSecurity(seek1)).toBe(true);
    expect(authManager.validateCommandSecurity(seek2)).toBe(true);
    expect(authManager.validateCommandSecurity(seek3)).toBe(true);

    // Duplicate seek1 is rejected
    expect(authManager.validateCommandSecurity(seek1)).toBe(false);

    // Stale sequence (seq 1 after seq 3) is rejected
    const staleSeqSeek = { ...seek1, commandId: 'c_rapid_4', sequence: 1 };
    expect(authManager.validateCommandSecurity(staleSeqSeek)).toBe(false);
  });

  it('5. Track change (X -> Y) followed immediately by Seek in Song Y (0:00 -> 01:42)', async () => {
    ownerEngine.setOwner('dev_desktop_owner', false);
    usePlayerStore.setState({ isActiveDevice: false, currentSong: testSong, currentTime: 180 });

    // Step 1: Owner changes track to Song Y
    remoteClient.handlePlaybackStateUpdate({
      id: 'msg_st_track_change',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_desktop_owner',
      targetDeviceId: 'dev_mobile_controller',
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: 'dev_desktop_owner',
        songId: nextSong.id,
        song: nextSong,
        queue: [testSong, nextSong],
        queueIndex: 1,
        positionMs: 0,
        durationMs: 210000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 186,
        timestamp: Date.now(),
      },
    });

    let store = usePlayerStore.getState();
    expect(store.currentSong?.id).toBe(nextSong.id);
    expect(store.currentTime).toBe(0);

    // Step 2: Controller drags and seeks Song Y to 01:42 (102000ms)
    remoteClient.handlePlaybackStateUpdate({
      id: 'msg_st_seek_y',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_desktop_owner',
      targetDeviceId: 'dev_mobile_controller',
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: 'dev_desktop_owner',
        songId: nextSong.id,
        song: nextSong,
        queue: [testSong, nextSong],
        queueIndex: 1,
        positionMs: 102000,
        durationMs: 210000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 187,
        timestamp: Date.now(),
      },
    });

    store = usePlayerStore.getState();
    expect(store.currentSong?.id).toBe(nextSong.id);
    expect(store.currentTime).toBe(102);
    expect(store.isPlaying).toBe(true);
  });
});
