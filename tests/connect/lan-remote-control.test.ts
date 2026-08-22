import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

const mockSong: Song = {
  id: 'song_test_1',
  title: 'Test Song',
  artist: 'Test Artist',
  artistId: 'art_test_1',
  album: 'Test Album',
  albumId: 'alb_test_1',
  coverUrl: '/test.png',
  duration: 240,
  audioUrl: 'https://audio.raagax.test/song.mp3',
  genre: 'Pop',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 100,
  likes: 50,
};

describe('RaagaX Connect V2: Single Owner Authority & Remote Control', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_desktop_1',
      activeDeviceId: 'dev_desktop_1',
      isActiveDevice: true,
      currentSong: mockSong,
      queue: [mockSong],
      queueIndex: 0,
      isPlaying: false,
      currentTime: 120,
      duration: 240,
      volume: 0.8,
      isMuted: false,
      shuffleMode: 'OFF',
      repeatMode: 'OFF',
    });

    PlaybackOwnerEngine.getInstance().setOwner('dev_desktop_1', true);
  });

  it('verifies Desktop acts as authoritative owner and executes remote commands', async () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();
    expect(ownerEngine.isOwner()).toBe(true);

    // Mock authorized session from mobile controller
    vi.spyOn(ConnectAuthManager.getInstance(), 'canControl').mockReturnValue(true);

    // Receive CMD_PLAY from controller
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_1',
      type: 'CMD_PLAY',
      sourceDeviceId: 'dev_mobile_1',
      targetDeviceId: 'dev_desktop_1',
      commandId: 'c_1',
      timestamp: Date.now(),
    });

    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Receive CMD_SEEK to 180s
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_2',
      type: 'CMD_SEEK',
      sourceDeviceId: 'dev_mobile_1',
      targetDeviceId: 'dev_desktop_1',
      commandId: 'c_2',
      payload: { positionMs: 180000 },
      timestamp: Date.now(),
    });

    expect(usePlayerStore.getState().currentTime).toBe(180);
  });

  it('rejects commands sent from other accounts without control permissions', async () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();

    // Mock unverified / other account
    vi.spyOn(ConnectAuthManager.getInstance(), 'canControl').mockReturnValue(false);

    const initialPlaying = usePlayerStore.getState().isPlaying;

    await ownerEngine.handleRemoteCommand({
      id: 'cmd_hack',
      type: 'CMD_PAUSE',
      sourceDeviceId: 'dev_stranger',
      targetDeviceId: 'dev_desktop_1',
      commandId: 'c_hack',
      timestamp: Date.now(),
    });

    // State must not change
    expect(usePlayerStore.getState().isPlaying).toBe(initialPlaying);
  });

  it('extrapolates position accurately on controller without network flooding', () => {
    const client = RemoteControlClient.getInstance();

    // Simulate controller mode
    PlaybackOwnerEngine.getInstance().setOwner('dev_desktop_1', false);

    const baseTimestamp = Date.now() - 5000; // 5 seconds ago

    client.handlePlaybackStateUpdate({
      id: 'st_1',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_desktop_1',
      targetDeviceId: 'dev_mobile_1',
      payload: {
        ownerDeviceId: 'dev_desktop_1',
        songId: mockSong.id,
        song: mockSong,
        queue: [mockSong],
        queueIndex: 0,
        positionMs: 60000, // 60s at 5s ago
        durationMs: 240000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 10,
        timestamp: baseTimestamp,
      },
      timestamp: Date.now(),
    });

    const estMs = client.getEstimatedPositionMs();
    // 60,000 + ~5000 = ~65,000ms (65s)
    expect(estMs).toBeGreaterThanOrEqual(64900);
    expect(estMs).toBeLessThanOrEqual(66000);
  });
});
