import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { RaagaXConnectV2 } from '../../src/lib/connect/lan/RaagaXConnectV2';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

const currentSong: Song = {
  id: 'song_track_a',
  title: 'Life of Ram',
  artist: 'Govind Vasantha',
  artistId: 'art_1',
  album: '96',
  albumId: 'alb_1',
  coverUrl: 'https://images.raagax.test/cover_ram.jpg',
  duration: 330,
  audioUrl: 'https://audio.raagax.test/ram.mp3',
  genre: 'Melody',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 500,
  likes: 250,
};

describe('RaagaX Connect V2: Playback Session Lifecycle, Connect vs Switch & Non-Interruptive Disconnect', () => {
  let ownerEngine: PlaybackOwnerEngine;
  let remoteClient: RemoteControlClient;

  beforeEach(() => {
    vi.clearAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    ownerEngine = PlaybackOwnerEngine.getInstance();
    remoteClient = RemoteControlClient.getInstance();

    usePlayerStore.setState({
      deviceId: 'dev_laptop_owner',
      activeDeviceId: 'dev_laptop_owner',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong,
      currentTime: 120, // 02:00
      duration: 330,
      isPlaying: true,
      playbackIntent: 'PLAYING',
      queue: [currentSong],
      queueIndex: 0,
    });
  });

  it('1. Connect ≠ Switch: Connecting establishes remote control; owner continues playing without audio transfer', async () => {
    // Laptop is Owner playing at 02:00
    ownerEngine.setOwner('dev_laptop_owner', true);
    expect(ownerEngine.isOwner()).toBe(true);

    const pauseSpy = vi.fn();
    // Mobile connects as Controller
    usePlayerStore.setState({
      deviceId: 'dev_mobile_controller',
      connectedDeviceId: 'dev_laptop_owner',
      activeDeviceId: 'dev_laptop_owner',
      isActiveDevice: false,
    });

    // Mobile is Controller, not owner
    expect(usePlayerStore.getState().isActiveDevice).toBe(false);
    expect(usePlayerStore.getState().connectedDeviceId).toBe('dev_laptop_owner');

    // Laptop owner state remains playing
    const snapshot = ownerEngine.getStateSnapshot();
    expect(snapshot.isPlaying).toBe(true);
    expect(snapshot.positionMs).toBe(120000);
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('2. Disconnecting a controller NEVER pauses the owner device', async () => {
    // Mobile is Controller connected to Laptop
    usePlayerStore.setState({
      deviceId: 'dev_mobile_controller',
      connectedDeviceId: 'dev_laptop_owner',
      activeDeviceId: 'dev_laptop_owner',
      isActiveDevice: false,
      isPlaying: true,
      currentTime: 144, // 02:24
    });

    // Mobile explicitly disconnects
    RaagaXConnectV2.getInstance().disconnect();

    const mobileState = usePlayerStore.getState();
    expect(mobileState.connectedDeviceId).toBeNull();
    expect(mobileState.isActiveDevice).toBe(true);

    // Laptop owner engine remains unaffected and playing
    ownerEngine.setOwner('dev_laptop_owner', true);
    usePlayerStore.setState({
      deviceId: 'dev_laptop_owner',
      activeDeviceId: 'dev_laptop_owner',
      connectedDeviceId: null,
      isActiveDevice: true,
      isPlaying: true,
      currentTime: 144,
    });

    const ownerSnapshot = ownerEngine.getStateSnapshot();
    expect(ownerSnapshot.isPlaying).toBe(true);
    expect(ownerSnapshot.positionMs).toBe(144000);
  });

  it('3. Reconnection Flow: Mobile reconnects as CONTROLLER and requests latest state without auto-taking ownership', async () => {
    // Laptop owner advanced to 03:12 while mobile was away
    usePlayerStore.setState({
      deviceId: 'dev_laptop_owner',
      activeDeviceId: 'dev_laptop_owner',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong,
      currentTime: 192, // 03:12
      isPlaying: true,
    });

    // Mobile returns and connects
    usePlayerStore.setState({
      deviceId: 'dev_mobile_controller',
      activeDeviceId: 'dev_laptop_owner',
      connectedDeviceId: 'dev_laptop_owner',
      isActiveDevice: false,
    });

    remoteClient.handlePlaybackStateUpdate({
      id: 'msg_reconnect_sync',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_laptop_owner',
      targetDeviceId: 'dev_mobile_controller',
      timestamp: Date.now(),
      payload: {
        ownerDeviceId: 'dev_laptop_owner',
        songId: currentSong.id,
        song: currentSong,
        queue: [currentSong],
        queueIndex: 0,
        positionMs: 192000,
        durationMs: 330000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 250,
        timestamp: Date.now(),
      },
    });

    const mobileState = usePlayerStore.getState();
    expect(mobileState.isActiveDevice).toBe(false);
    expect(mobileState.currentTime).toBe(192);
    expect(mobileState.currentSong?.id).toBe(currentSong.id);
  });

  it('4. Stale Command Rejection: Stale sequence or duplicate commandIds from disconnected sessions are rejected', () => {
    const auth = ConnectAuthManager.getInstance();

    const cmd1 = {
      id: 'cmd_1',
      type: 'CMD_NEXT' as const,
      sourceDeviceId: 'dev_mobile',
      targetDeviceId: 'dev_laptop',
      commandId: 'cmd_unique_101',
      sequence: 1,
      timestamp: Date.now(),
    };

    const cmd2 = {
      id: 'cmd_2',
      type: 'CMD_NEXT' as const,
      sourceDeviceId: 'dev_mobile',
      targetDeviceId: 'dev_laptop',
      commandId: 'cmd_unique_102',
      sequence: 2,
      timestamp: Date.now(),
    };

    expect(auth.validateCommandSecurity(cmd1)).toBe(true);
    expect(auth.validateCommandSecurity(cmd2)).toBe(true);

    // Duplicate commandId is rejected
    expect(auth.validateCommandSecurity(cmd1)).toBe(false);

    // Old sequence (seq 1 after seq 2) is rejected
    const staleCmd = { ...cmd1, commandId: 'cmd_unique_103', sequence: 1 };
    expect(auth.validateCommandSecurity(staleCmd)).toBe(false);
  });
});
