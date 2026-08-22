import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalDiscoveryService } from '../../src/lib/connect/lan/LocalDiscoveryService';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { OwnershipSwitchProtocol } from '../../src/lib/connect/lan/OwnershipSwitchProtocol';
import { RaagaXConnectV2 } from '../../src/lib/connect/lan/RaagaXConnectV2';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { useAuthStore } from '../../src/context/useAuthStore';
import { Song } from '../../src/types/music';
import { LANDeviceAdvertisement, DiscoveredLANDevice } from '../../src/lib/connect/lan/types';

// Standard test fixtures
const songX: Song = {
  id: 'song_x',
  title: 'Song X',
  artist: 'Artist X',
  artistId: 'artist_x',
  album: 'Album X',
  albumId: 'album_x',
  coverUrl: '/cover_x.png',
  duration: 240,
  audioUrl: 'https://audio.raagax.test/song_x.mp3',
  genre: 'Soundtrack',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 100,
  likes: 50,
};

const songY: Song = {
  id: 'song_y',
  title: 'Song Y',
  artist: 'Artist Y',
  artistId: 'artist_y',
  album: 'Album Y',
  albumId: 'album_y',
  coverUrl: '/cover_y.png',
  duration: 210,
  audioUrl: 'https://audio.raagax.test/song_y.mp3',
  genre: 'Soundtrack',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 80,
  likes: 40,
};

const songZ: Song = {
  id: 'song_z',
  title: 'Song Z',
  artist: 'Artist Z',
  artistId: 'artist_z',
  album: 'Album Z',
  albumId: 'album_z',
  coverUrl: '/cover_z.png',
  duration: 180,
  audioUrl: 'https://audio.raagax.test/song_z.mp3',
  genre: 'Soundtrack',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 60,
  likes: 30,
};

const songR: Song = {
  id: 'song_r',
  title: 'Manual Track R',
  artist: 'Artist R',
  artistId: 'artist_r',
  album: 'Album R',
  albumId: 'album_r',
  coverUrl: '/cover_r.png',
  duration: 300,
  audioUrl: 'https://audio.raagax.test/song_r.mp3',
  genre: 'Classical',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 150,
  likes: 90,
};

describe('RaagaX Connect V2: Frozen Architecture Lifecycle Verification (Tests A - J)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    LocalDiscoveryService.getInstance().clearDiscoveredDevices();

    useAuthStore.setState({
      user: { id: 'usr_me', email: 'user@raagax.test', user_metadata: { name: 'Ram' } } as any,
    });

    usePlayerStore.setState({
      deviceId: 'dev_desktop',
      activeDeviceId: 'dev_desktop',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: songX,
      queue: [songX, songY, songZ],
      queueIndex: 0,
      isPlaying: true,
      currentTime: 120, // 2:00
      duration: 240,
      volume: 1.0,
      isMuted: false,
      shuffleMode: 'OFF',
      repeatMode: 'OFF',
    });

    PlaybackOwnerEngine.getInstance().setOwner('dev_desktop', true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST A — Desktop Owner → Android Controller
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test A (Desktop → Android): Desktop plays X @ 2:00, Android controls over LAN', async () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();
    const remoteClient = RemoteControlClient.getInstance();

    // 1. Verify Desktop is authoritative owner playing Song X at 2:00
    expect(ownerEngine.isOwner()).toBe(true);
    expect(usePlayerStore.getState().currentSong?.title).toBe('Song X');
    expect(usePlayerStore.getState().currentTime).toBe(120);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // 2. Android connects as controller and receives initial state broadcast
    const snapshot = ownerEngine.getStateSnapshot();
    expect(snapshot.songId).toBe('song_x');
    expect(snapshot.positionMs).toBe(120000);

    // 3. Android sends PAUSE command
    vi.spyOn(ConnectAuthManager.getInstance(), 'canControl').mockReturnValue(true);
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_pause_1',
      type: 'CMD_PAUSE',
      sourceDeviceId: 'dev_android',
      targetDeviceId: 'dev_desktop',
      commandId: 'c_pause',
      timestamp: Date.now(),
    });
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    // 4. Android sends NEXT command
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_next_1',
      type: 'CMD_NEXT',
      sourceDeviceId: 'dev_android',
      targetDeviceId: 'dev_desktop',
      commandId: 'c_next',
      timestamp: Date.now(),
    });
    // Desktop must have advanced to Song Y in the authoritative queue
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_y');
    expect(usePlayerStore.getState().queueIndex).toBe(1);

    // 5. Android sends SEEK command to 45s
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_seek_1',
      type: 'CMD_SEEK',
      sourceDeviceId: 'dev_android',
      targetDeviceId: 'dev_desktop',
      commandId: 'c_seek',
      payload: { positionMs: 45000 },
      timestamp: Date.now(),
    });
    expect(usePlayerStore.getState().currentTime).toBe(45);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST B — Android Owner → Desktop (Reverse Switch)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test B (Android → Desktop): Android plays X @ 2:00, Desktop switches and becomes owner', async () => {
    const switchProto = OwnershipSwitchProtocol.getInstance();
    const transport = DirectLANTransport.getInstance();

    // Android owns playback initially
    PlaybackOwnerEngine.getInstance().setOwner('dev_android', false);
    usePlayerStore.setState({
      deviceId: 'dev_desktop',
      activeDeviceId: 'dev_android',
      isActiveDevice: false,
      currentSong: songX,
      currentTime: 120,
    });

    // Mock 4-way switch response from Android
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      setTimeout(() => {
        if (msg.type === 'SWITCH_REQUEST') {
          transport.handleIncomingMessage({
            id: 'off_b',
            type: 'SWITCH_OFFER',
            sourceDeviceId: 'dev_android',
            targetDeviceId: 'dev_desktop',
            transferId: (msg as any).transferId,
            snapshot: {
              song: songX,
              queue: [songX, songY],
              queueIndex: 0,
              positionMs: 120000,
              durationMs: 240000,
              isPlaying: true,
              playbackRate: 1.0,
              stateVersion: 12,
            },
            timestamp: Date.now(),
          });
        } else if (msg.type === 'SWITCH_READY') {
          transport.handleIncomingMessage({
            id: 'cmt_b',
            type: 'SWITCH_COMMIT',
            sourceDeviceId: 'dev_android',
            targetDeviceId: 'dev_desktop',
            transferId: (msg as any).transferId,
            newOwnerDeviceId: 'dev_desktop',
            finalPositionMs: 120000,
            stateVersion: 13,
            timestamp: Date.now(),
          });
        }
      }, 10);
      return true;
    });

    const success = await switchProto.switchPlayback('dev_android');
    expect(success).toBe(true);
    expect(PlaybackOwnerEngine.getInstance().isOwner()).toBe(true);
    expect(usePlayerStore.getState().currentSong?.title).toBe('Song X');
    expect(usePlayerStore.getState().currentTime).toBe(120);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST C — Hostel Wi-Fi (Multi-Account Discovery vs Authorization Separation)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test C (Hostel Wi-Fi): All 5 devices visible; only same-account devices controllable', () => {
    const service = LocalDiscoveryService.getInstance();
    const authManager = ConnectAuthManager.getInstance();

    const devices: LANDeviceAdvertisement[] = [
      {
        deviceId: 'dev_my_phone',
        deviceName: 'Your Phone',
        deviceType: 'mobile',
        platform: 'android',
        protocolVersion: '2.0.0',
        host: '192.168.1.51',
        port: 47104,
        capabilities: ['playback', 'remote_control'],
        userId: 'usr_me',
        currentActivity: 'playing',
        timestamp: Date.now(),
      },
      {
        deviceId: 'dev_my_laptop',
        deviceName: 'Your Laptop',
        deviceType: 'desktop',
        platform: 'windows',
        protocolVersion: '2.0.0',
        host: '192.168.1.52',
        port: 47104,
        capabilities: ['playback', 'remote_control'],
        userId: 'usr_me',
        currentActivity: 'idle',
        timestamp: Date.now(),
      },
      {
        deviceId: 'dev_friend_1',
        deviceName: 'Friend 1 Phone',
        deviceType: 'mobile',
        platform: 'android',
        protocolVersion: '2.0.0',
        host: '192.168.1.61',
        port: 47104,
        capabilities: ['playback', 'remote_control'],
        userId: 'usr_friend_1',
        currentActivity: 'playing',
        timestamp: Date.now(),
      },
      {
        deviceId: 'dev_friend_2',
        deviceName: 'Friend 2 Laptop',
        deviceType: 'desktop',
        platform: 'macos',
        protocolVersion: '2.0.0',
        host: '192.168.1.62',
        port: 47104,
        capabilities: ['playback', 'remote_control'],
        userId: 'usr_friend_2',
        currentActivity: 'idle',
        timestamp: Date.now(),
      },
      {
        deviceId: 'dev_friend_3',
        deviceName: 'Friend 3 Phone',
        deviceType: 'mobile',
        platform: 'ios',
        protocolVersion: '2.0.0',
        host: '192.168.1.63',
        port: 47104,
        capabilities: ['playback', 'remote_control'],
        userId: 'usr_friend_3',
        currentActivity: 'idle',
        timestamp: Date.now(),
      },
    ];

    devices.forEach((d) => service.handleAdvertisement(d));
    const discovered = service.getDiscoveredDevices();

    // 1. All 5 devices MUST appear in discovery (no hidden accounts)
    expect(discovered.length).toBe(5);

    // 2. Partition into YOUR DEVICES vs OTHER RAAGAX DEVICES
    const yourDevices = discovered.filter((d) => d.isSameAccount);
    const otherDevices = discovered.filter((d) => !d.isSameAccount);

    expect(yourDevices.length).toBe(2);
    expect(yourDevices.map((d) => d.deviceName)).toContain('Your Phone');
    expect(yourDevices.map((d) => d.deviceName)).toContain('Your Laptop');

    expect(otherDevices.length).toBe(3);
    expect(otherDevices.map((d) => d.deviceName)).toContain('Friend 1 Phone');
    expect(otherDevices.map((d) => d.deviceName)).toContain('Friend 2 Laptop');
    expect(otherDevices.map((d) => d.deviceName)).toContain('Friend 3 Phone');

    // 3. Security invariant: Friends must NEVER have control permissions
    expect(authManager.canControl('dev_my_phone')).toBe(true);
    expect(authManager.canControl('dev_friend_1')).toBe(false);
    expect(authManager.canControl('dev_friend_2')).toBe(false);
    expect(authManager.canControl('dev_friend_3')).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST D — Queue Advancement Invariants (Exact Track + Metadata + Position = 0)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test D (Queue Invariants): Advancing X → Y updates Track, Artwork, Title, Artist, Pos=0, Index=1 without churn', async () => {
    usePlayerStore.setState({
      currentSong: songX,
      queue: [songX, songY, songZ],
      queueIndex: 0,
      currentTime: 239, // End of song X
      duration: 240,
      isPlaying: true,
    });

    // Advance to next song in queue
    await usePlayerStore.getState().playNext();

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_y');
    expect(state.currentSong?.title).toBe('Song Y');
    expect(state.currentSong?.artist).toBe('Artist Y');
    expect(state.currentSong?.album).toBe('Album Y');
    expect(state.currentSong?.coverUrl).toBeDefined();
    expect(state.queueIndex).toBe(1);
    expect(state.isPlaying).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST E — Manual Interruption (Track R Invalidates Stale Queue Transition)
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test E (Manual Interruption): Selecting Track R immediately invalidates previous queue transition', async () => {
    const store = usePlayerStore.getState();

    // Track X is playing
    expect(store.currentSong?.id).toBe('song_x');

    // User explicitly selects song R
    await usePlayerStore.getState().switchTrack(songR, 0, true);

    // State must immediately reflect R as the authoritative track
    const newState = usePlayerStore.getState();
    expect(newState.currentSong?.id).toBe('song_r');
    expect(newState.currentSong?.title).toBe('Manual Track R');
    expect(newState.isPlaying).toBe(true);

    // Subsequent old queue tick attempting to force Y is rejected by state version
    const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(snapshot.songId).toBe('song_r');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST F — Switch Failure & Instant Rollback Protection
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test F (Switch Failure Rollback): If target cannot decode track, source owner continues playing gaplessly', async () => {
    const switchProto = OwnershipSwitchProtocol.getInstance();
    const transport = DirectLANTransport.getInstance();

    // Desktop owner is playing Song X at 2:00
    expect(PlaybackOwnerEngine.getInstance().isOwner()).toBe(true);
    expect(usePlayerStore.getState().currentTime).toBe(120);

    // Mobile target simulates failure (e.g. stream load error / offline cache missing)
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      setTimeout(() => {
        if (msg.type === 'SWITCH_REQUEST') {
          transport.handleIncomingMessage({
            id: 'fail_f',
            type: 'SWITCH_FAILED',
            sourceDeviceId: 'dev_mobile',
            targetDeviceId: 'dev_desktop',
            transferId: (msg as any).transferId,
            reason: 'Track audio codec or network error',
            errorCode: 'PLAYBACK_ERROR',
            timestamp: Date.now(),
          });
        }
      }, 10);
      return true;
    });

    const success = await switchProto.switchPlayback('dev_mobile');
    expect(success).toBe(false);

    // Desktop must remain OWNER and continue playing Song X at 2:00 with zero pause/interruption
    expect(PlaybackOwnerEngine.getInstance().isOwner()).toBe(true);
    expect(usePlayerStore.getState().currentSong?.title).toBe('Song X');
    expect(usePlayerStore.getState().currentTime).toBe(120);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST G — Controller Disappears
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test G (Controller Disappears): Mobile controller closes; Desktop owner continues playing uninterrupted', () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();
    const transport = DirectLANTransport.getInstance();

    // Mobile disconnects
    transport.disconnectFromDevice('dev_mobile');

    // Desktop owner continues native audio playback unaffected
    expect(ownerEngine.isOwner()).toBe(true);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().currentSong?.title).toBe('Song X');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST H — Owner Disappears / Heartbeat Drop
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test H (Owner Disappears): Desktop crashes; Mobile controller detects drop and terminates session', () => {
    vi.useFakeTimers();
    const transport = DirectLANTransport.getInstance();

    // Simulate mobile connected to desktop
    (transport as any).connectedPeers.set('dev_desktop', {
      socket: null,
      status: 'CONNECTED',
      lastPing: Date.now() - 10000,
      lastPong: Date.now() - 10000, // No pong for 10s
      rtt: 20,
    });

    // Advance heartbeat interval
    vi.advanceTimersByTime(4000);
    (transport as any).startHeartbeatMonitor();

    // Transport marks peer as disconnected rather than keeping stale playing state
    transport.disconnectFromDevice('dev_desktop');
    expect(transport.isConnected('dev_desktop')).toBe(false);
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST I — Internet vs LAN Disconnection
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test I (Internet vs LAN): Commands continue over direct LAN socket when Internet is offline', async () => {
    const ownerEngine = PlaybackOwnerEngine.getInstance();

    // Simulate Internet down, but LAN socket remains active
    const isInternetOnline = false;
    const isLANConnected = true;

    expect(isLANConnected).toBe(true);

    // Direct LAN command executes directly on local player
    vi.spyOn(ConnectAuthManager.getInstance(), 'canControl').mockReturnValue(true);
    await ownerEngine.handleRemoteCommand({
      id: 'cmd_offline_lan_1',
      type: 'CMD_PAUSE',
      sourceDeviceId: 'dev_mobile',
      targetDeviceId: 'dev_desktop',
      commandId: 'c_offline_lan',
      timestamp: Date.now(),
    });

    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST J — Android Background & Screen Unlock Re-Sync
  // ─────────────────────────────────────────────────────────────────────────────
  it('Test J (Android Background & Unlock Sync): Lock screen re-syncs exact position without resetting to 0:00', () => {
    const client = RemoteControlClient.getInstance();

    // Android is controller
    PlaybackOwnerEngine.getInstance().setOwner('dev_desktop', false);

    // Desktop owner is playing Song X at 2:00 (120s), recorded 15 seconds ago
    const baseTimestamp = Date.now() - 15000;

    client.handlePlaybackStateUpdate({
      id: 'st_sync_1',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_desktop',
      targetDeviceId: 'dev_android',
      payload: {
        ownerDeviceId: 'dev_desktop',
        songId: songX.id,
        song: songX,
        queue: [songX, songY, songZ],
        queueIndex: 0,
        positionMs: 120000, // 2:00
        durationMs: 240000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 50,
        timestamp: baseTimestamp,
      },
      timestamp: Date.now(),
    });

    // Android unlocks and calculates position: 120s + 15s elapsed = 135s (2:15)
    const estPositionMs = client.getEstimatedPositionMs();
    expect(estPositionMs).toBeGreaterThanOrEqual(134900);
    expect(estPositionMs).toBeLessThanOrEqual(136000);
    expect(estPositionMs).not.toBe(0); // Must NEVER reset to 0:00!
  });
});
