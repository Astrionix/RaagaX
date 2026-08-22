import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

const songX: Song = {
  id: 'song_x',
  title: 'Track X',
  artist: 'Artist X',
  artistId: 'art_x',
  album: 'Album X',
  albumId: 'alb_x',
  coverUrl: 'https://images.raagax.test/cover_x.jpg',
  duration: 200,
  audioUrl: 'https://audio.raagax.test/x.mp3',
  genre: 'Pop',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 10,
  likes: 5,
};

const songY: Song = {
  id: 'song_y',
  title: 'Track Y',
  artist: 'Artist Y',
  artistId: 'art_y',
  album: 'Album Y',
  albumId: 'alb_y',
  coverUrl: 'https://images.raagax.test/cover_y.jpg',
  duration: 240,
  audioUrl: 'https://audio.raagax.test/y.mp3',
  genre: 'Electronic',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 20,
  likes: 15,
};

const songZ: Song = {
  id: 'song_z',
  title: 'Track Z',
  artist: 'Artist Z',
  artistId: 'art_z',
  album: 'Album Z',
  albumId: 'alb_z',
  coverUrl: 'https://images.raagax.test/cover_z.jpg',
  duration: 180,
  audioUrl: 'https://audio.raagax.test/z.mp3',
  genre: 'Rock',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 30,
  likes: 25,
};

describe('RaagaX Connect V2: Authoritative Track Transitions & Symmetric UI Sync Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    ConnectAuthManager.getInstance().setPolicies('ANYONE_ON_WIFI', 'ASK_EVERY_TIME');
  });

  // TEST 1: Mobile (Controller) -> Desktop (Owner) NEXT transition
  it('1. Mobile sends NEXT -> Desktop Owner changes track -> Mobile atomically updates title, artwork, position & duration', async () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();
    const remoteClient = RemoteControlClient.getInstance();
    const transport = DirectLANTransport.getInstance();

    // Configure Desktop as Authoritative Owner playing Song X at 02:00
    ownerEngine.setOwner('dev_desktop', true);
    usePlayerStore.setState({
      deviceId: 'dev_desktop',
      activeDeviceId: 'dev_desktop',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: songX,
      queue: [songX, songY, songZ],
      queueIndex: 0,
      currentTime: 120, // 02:00
      duration: 200,
      isPlaying: true,
    });

    let broadcastedState: any = null;
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg: any) => {
      if (msg.type === 'PLAYBACK_STATE') {
        broadcastedState = msg;
      }
      return true;
    });

    // Desktop executes CMD_NEXT received from Mobile
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_next_1',
      type: 'CMD_NEXT',
      sourceDeviceId: 'dev_mobile',
      targetDeviceId: 'dev_desktop',
      commandId: 'c_next_100',
      sequence: 1,
      timestamp: Date.now(),
    });

    // Desktop state should now be Track Y
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_y');
    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(broadcastedState).not.toBeNull();
    expect(broadcastedState.payload.song.id).toBe('song_y');
    expect(broadcastedState.payload.song.coverUrl).toBe(songY.coverUrl);
    expect(broadcastedState.payload.song.title).toBe('Track Y');

    // Now simulate Mobile receiving the broadcast state
    ownerEngine.setOwner('dev_desktop', false); // Switch context to Mobile (Controller)
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_desktop',
      connectedDeviceId: 'dev_desktop',
      isActiveDevice: false,
      currentSong: songX, // Old track
      currentTime: 120,
    });

    remoteClient.handlePlaybackStateUpdate(broadcastedState);

    // ATOMIC VERIFICATION ON MOBILE CONTROLLER:
    const mobileStore = usePlayerStore.getState();
    expect(mobileStore.currentSong?.id).toBe('song_y');
    expect(mobileStore.currentSong?.title).toBe('Track Y');
    expect(mobileStore.currentSong?.artist).toBe('Artist Y');
    expect(mobileStore.currentSong?.coverUrl).toBe('https://images.raagax.test/cover_y.jpg');
    expect(mobileStore.currentTime).toBe(0); // Reset to start of Track Y
    expect(mobileStore.duration).toBe(240);
    expect(mobileStore.queueIndex).toBe(1);
    expect(mobileStore.isPlaying).toBe(true);
  });

  // TEST 2: Symmetric Reverse (Desktop Controller -> Mobile Owner)
  it('2. Symmetric Reverse: Desktop sends NEXT -> Mobile Owner changes track -> Desktop atomically updates', async () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();
    const remoteClient = RemoteControlClient.getInstance();
    const transport = DirectLANTransport.getInstance();

    // Mobile is Owner playing Song Y
    ownerEngine.setOwner('dev_mobile', true);
    usePlayerStore.setState({
      deviceId: 'dev_mobile',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: songY,
      queue: [songX, songY, songZ],
      queueIndex: 1,
      currentTime: 60,
      duration: 240,
      isPlaying: true,
    });

    let broadcastedState: any = null;
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg: any) => {
      if (msg.type === 'PLAYBACK_STATE') {
        broadcastedState = msg;
      }
      return true;
    });

    // Mobile executes CMD_NEXT received from Desktop
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_next_2',
      type: 'CMD_NEXT',
      sourceDeviceId: 'dev_desktop',
      targetDeviceId: 'dev_mobile',
      commandId: 'c_next_101',
      sequence: 2,
      timestamp: Date.now(),
    });

    // Mobile transitioned to Song Z
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_z');

    // Simulate Desktop receiving broadcast state
    ownerEngine.setOwner('dev_mobile', false); // Switch context to Desktop
    usePlayerStore.setState({
      deviceId: 'dev_desktop',
      activeDeviceId: 'dev_mobile',
      connectedDeviceId: 'dev_mobile',
      isActiveDevice: false,
      currentSong: songY,
    });

    remoteClient.handlePlaybackStateUpdate(broadcastedState);

    const desktopStore = usePlayerStore.getState();
    expect(desktopStore.currentSong?.id).toBe('song_z');
    expect(desktopStore.currentSong?.title).toBe('Track Z');
    expect(desktopStore.currentSong?.coverUrl).toBe('https://images.raagax.test/cover_z.jpg');
    expect(desktopStore.currentTime).toBe(0);
    expect(desktopStore.duration).toBe(180);
    expect(desktopStore.queueIndex).toBe(2);
  });

  // TEST 3: Stale Packet Discard Protection
  it('3. Discards stale stateVersion packets to prevent overwriting new track with old track', () => {
    const remoteClient = RemoteControlClient.getInstance();

    // Current state is Version 183 (Track Y)
    remoteClient.handlePlaybackStateUpdate({
      id: 'st_183',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_owner',
      targetDeviceId: 'dev_controller',
      payload: {
        ownerDeviceId: 'dev_owner',
        songId: 'song_y',
        song: songY,
        queue: [songX, songY, songZ],
        queueIndex: 1,
        positionMs: 0,
        durationMs: 240000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 183,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    expect(usePlayerStore.getState().currentSong?.id).toBe('song_y');

    // Late arriving stale packet Version 182 (Track X)
    remoteClient.handlePlaybackStateUpdate({
      id: 'st_182',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_owner',
      targetDeviceId: 'dev_controller',
      payload: {
        ownerDeviceId: 'dev_owner',
        songId: 'song_x',
        song: songX,
        queue: [songX, songY, songZ],
        queueIndex: 0,
        positionMs: 120000,
        durationMs: 200000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 182, // STALE! (182 < 183)
        timestamp: Date.now() - 5000,
      },
      timestamp: Date.now() - 5000,
    });

    // Should STILL be Track Y (stale packet 182 was discarded)
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_y');
    expect(usePlayerStore.getState().currentSong?.title).toBe('Track Y');
  });
});
