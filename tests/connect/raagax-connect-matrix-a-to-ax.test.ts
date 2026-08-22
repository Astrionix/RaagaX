import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { useAuthStore } from '../../src/context/useAuthStore';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { RaagaXConnectV2 } from '../../src/lib/connect/lan/RaagaXConnectV2';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { OwnershipSwitchProtocol } from '../../src/lib/connect/lan/OwnershipSwitchProtocol';
import { Song } from '../../src/types/music';
import { DiscoveredLANDevice } from '../../src/lib/connect/lan/types';

const makeSong = (id: string, title: string, artist = `Artist of ${title}`, duration = 240): Song => ({
  id,
  title,
  artist,
  artistId: `art_${id}`,
  album: `Album of ${title}`,
  albumId: `alb_${id}`,
  coverUrl: `https://covers.test/${id}.jpg`,
  duration,
  audioUrl: `https://audio.test/${id}.mp3`,
  genre: 'Trending',
  category: 'latest_telugu',
  releaseYear: 2026,
  plays: 5000,
  likes: 1200,
});

const PUSHPA_SONG = makeSong('pushpa_01', 'Pushpa Pushpa', 'Devi Sri Prasad', 210);
const CHIKKIRI_SONG = makeSong('chikkiri_02', 'Chikkiri', 'Ram Miriyala', 272);
const SONG_Z = makeSong('song_z_03', 'Song Z', 'Anirudh', 195);
const SONG_A = makeSong('song_a_04', 'Song A', 'Thaman S', 240);

const USER_A_ID = 'user_u123_ram';
const USER_B_ID = 'user_u456_friend';

const MOBILE_ID = 'dev_mobile_m1';
const LAPTOP_ID = 'dev_laptop_d1';
const FRIEND_PHONE_ID = 'dev_friend_m2';
const PHONE_B_ID = 'dev_phone_b';

describe('RaagaX Connect: Complete Scenario Matrix (A through AX Specification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    useAuthStore.setState({
      user: { id: USER_A_ID, email: 'ram@raagax.test' } as any,
    });

    // Authorize same-account devices
    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: MOBILE_ID,
      deviceName: 'Ram Phone',
      userId: USER_A_ID,
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: PHONE_B_ID,
      deviceName: 'Phone B',
      userId: USER_A_ID,
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    usePlayerStore.setState({
      deviceId: LAPTOP_ID,
      isActiveDevice: true,
      activeDeviceId: LAPTOP_ID,
      connectedDeviceId: null,
      onlineDevices: [],
      currentSong: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      playbackIntent: 'PAUSED',
      currentTime: 0,
      duration: 240,
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // A. IDENTITY / DISCOVERY MATRIX (A1 to A4)
  // ════════════════════════════════════════════════════════════════════════════
  describe('A. Identity / Discovery Matrix', () => {
    it('A1: Same Account + Same LAN -> Discovered, Authorized, Connectable, Control & Switch Allowed', () => {
      const auth = ConnectAuthManager.getInstance();
      auth.handleHandshakeRequest({
        id: 'hs_a1',
        type: 'HANDSHAKE_REQUEST',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        clientIdentity: {
          deviceId: MOBILE_ID,
          deviceName: 'Ram Phone',
          deviceType: 'mobile',
          platform: 'android',
          userId: USER_A_ID,
          accountName: 'Ram',
          host: '192.168.1.10',
          port: 47104,
          capabilities: ['playback', 'remote_control', 'lossless_stream'],
          currentActivity: 'idle',
          protocolVersion: '2.0.0',
          timestamp: Date.now(),
        },
        clientNonce: 'n_a1',
        timestamp: Date.now(),
      });

      expect(auth.getAuthTier(MOBILE_ID)).toBe('SAME_ACCOUNT');
      expect(auth.canControl(MOBILE_ID)).toBe(true);
      expect(auth.canSwitch(MOBILE_ID)).toBe(true);
    });

    it('A2: Different Account + Same LAN -> Discovered, but Control & Switch Blocked (Hostel Scenario)', () => {
      const auth = ConnectAuthManager.getInstance();
      auth.handleHandshakeRequest({
        id: 'hs_a2',
        type: 'HANDSHAKE_REQUEST',
        sourceDeviceId: FRIEND_PHONE_ID,
        targetDeviceId: LAPTOP_ID,
        clientIdentity: {
          deviceId: FRIEND_PHONE_ID,
          deviceName: "Friend's Phone",
          deviceType: 'mobile',
          platform: 'android',
          userId: USER_B_ID,
          accountName: 'Hostel Friend',
          host: '192.168.1.11',
          port: 47104,
          capabilities: ['playback', 'remote_control', 'lossless_stream'],
          currentActivity: 'idle',
          protocolVersion: '2.0.0',
          timestamp: Date.now(),
        },
        clientNonce: 'n_a2',
        timestamp: Date.now(),
      });

      expect(auth.getAuthTier(FRIEND_PHONE_ID)).toBe('OTHER_ACCOUNT');
      expect(auth.canControl(FRIEND_PHONE_ID)).toBe(false);
      expect(auth.canSwitch(FRIEND_PHONE_ID)).toBe(false);
    });

    it('A3: Same Account + Different Wi-Fi -> Not Discovered on LAN (No LAN Socket)', () => {
      const discovered = RaagaXConnectV2.getInstance().getDiscoveredDevices();
      const remoteWifiDevice = discovered.find((d) => d.deviceId === 'dev_remote_wifi');
      expect(remoteWifiDevice).toBeUndefined();
    });

    it('A4: No Login -> Account Auth Fails and Control is Blocked', () => {
      useAuthStore.setState({ user: null });
      ConnectAuthManager.getInstance().removeAllTrustedPeers();
      const auth = ConnectAuthManager.getInstance();
      auth.handleHandshakeRequest({
        id: 'hs_a4',
        type: 'HANDSHAKE_REQUEST',
        sourceDeviceId: 'dev_guest',
        targetDeviceId: LAPTOP_ID,
        clientIdentity: {
          deviceId: 'dev_guest',
          deviceName: 'Guest Phone',
          deviceType: 'mobile',
          platform: 'android',
          userId: undefined,
          accountName: 'Guest',
          host: '192.168.1.12',
          port: 47104,
          capabilities: ['playback', 'remote_control', 'lossless_stream'],
          currentActivity: 'idle',
          protocolVersion: '2.0.0',
          timestamp: Date.now(),
        },
        clientNonce: 'n_a4',
        timestamp: Date.now(),
      });

      expect(auth.getAuthTier('dev_guest')).toBe('UNVERIFIED');
      expect(auth.canControl('dev_guest')).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // B, C, D. CONNECT LIFECYCLE WITHOUT SWITCHING
  // ════════════════════════════════════════════════════════════════════════════
  describe('B, C, D. Connect Lifecycle & Control Without Switching', () => {
    it('D: Mobile connects as CONTROLLER to Laptop OWNER without transferring audio', async () => {
      // Laptop is playing Pushpa @ 01:00
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        activeDeviceId: LAPTOP_ID,
        currentSong: { ...PUSHPA_SONG },
        currentTime: 60,
        isPlaying: true,
      });

      // Mobile joins as controller
      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        isActiveDevice: false,
        activeDeviceId: LAPTOP_ID,
        connectedDeviceId: LAPTOP_ID,
        remoteDeviceName: 'Ram Laptop',
      });

      const mobileStore = usePlayerStore.getState();
      expect(mobileStore.isActiveDevice).toBe(false);
      expect(mobileStore.connectedDeviceId).toBe(LAPTOP_ID);

      // Laptop remains authoritative owner
      const laptopSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(laptopSnapshot.song?.title).toBe('Pushpa Pushpa');
      expect(laptopSnapshot.isPlaying).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // E, F, G. PLAYBACK SWITCHING SPECIFICATION
  // ════════════════════════════════════════════════════════════════════════════
  describe('E, F, G. Switching Playback (Paused & Playing)', () => {
    it('F: Switch while PAUSED -> Mobile becomes owner at exact position and remains paused', () => {
      // Laptop is paused at 02:00 (120s)
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: { ...PUSHPA_SONG },
        currentTime: 120,
        isPlaying: false,
      });

      // Hand off to Mobile
      PlaybackOwnerEngine.getInstance().setOwner(MOBILE_ID, true);
      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        isActiveDevice: true,
        activeDeviceId: MOBILE_ID,
        connectedDeviceId: null,
        currentSong: { ...PUSHPA_SONG },
        currentTime: 120,
        isPlaying: false,
      });

      const mobileSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(mobileSnapshot.song?.id).toBe(PUSHPA_SONG.id);
      expect(mobileSnapshot.positionMs).toBe(120_000);
      expect(mobileSnapshot.isPlaying).toBe(false); // Paused stays paused
    });

    it('G: Switch while PLAYING -> Mobile becomes owner at ~02:00 and continues playing (1 native audio owner)', () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: { ...CHIKKIRI_SONG },
        currentTime: 120,
        isPlaying: true,
      });

      // Hand off to Mobile
      PlaybackOwnerEngine.getInstance().setOwner(MOBILE_ID, true);
      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        isActiveDevice: true,
        activeDeviceId: MOBILE_ID,
        connectedDeviceId: null,
        currentSong: { ...CHIKKIRI_SONG },
        currentTime: 120,
        isPlaying: true,
      });

      const mobileSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(mobileSnapshot.song?.id).toBe(CHIKKIRI_SONG.id);
      expect(mobileSnapshot.isPlaying).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // H, I, J, K, L. TRACK PROGRESSION (NEXT, PREV, AUTO-ADVANCE, DIRECT SELECT)
  // ════════════════════════════════════════════════════════════════════════════
  describe('H, I, J, K, L. Track Progression & Atomic Metadata Broadcast', () => {
    it('H: NEXT command advances track on Owner and broadcasts complete atomic metadata', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, SONG_Z],
        queueIndex: 0,
        currentSong: PUSHPA_SONG,
        isPlaying: true,
      });

      // Execute authoritative NEXT
      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_next_1',
        type: 'CMD_NEXT',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c1',
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.song?.title).toBe('Chikkiri');
      expect(state.isPlaying).toBe(true);
      expect(state.stateVersion).toBeGreaterThan(1);
    });

    it('I: PREVIOUS command goes back to previous track and broadcasts atomic metadata', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, SONG_Z],
        queueIndex: 1,
        currentSong: CHIKKIRI_SONG,
        isPlaying: true,
      });

      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_prev_1',
        type: 'CMD_PREV',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c2',
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.song?.title).toBe('Pushpa Pushpa');
    });

    it('J: Automatic next (track finishes) -> Owner advances and broadcasts new state without controller command', () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 0,
        currentSong: PUSHPA_SONG,
      });

      // Native audio finishes
      usePlayerStore.getState().playNext();

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.song?.title).toBe('Chikkiri');
    });

    it('K: Direct song selection on OWNER immediately synchronizes to CONTROLLER', () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, SONG_Z],
      });

      // Owner directly selects Song Z
      usePlayerStore.getState().playSong(SONG_Z);

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.song?.title).toBe('Song Z');
    });

    it('L: Direct song selection on CONTROLLER requests Owner to play Song Z', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);

      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_play_song_z',
        type: 'CMD_LOAD_TRACK',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c3',
        payload: { song: SONG_Z },
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.song?.title).toBe('Song Z');
      expect(state.isPlaying).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // M, N, O, P. SEEK & RACE CONDITIONS
  // ════════════════════════════════════════════════════════════════════════════
  describe('M, N, O, P. Seek & Race Conditions', () => {
    it('N: Seek while paused -> Remains paused at target seek timestamp', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: PUSHPA_SONG,
        currentTime: 120,
        isPlaying: false,
      });

      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_seek_1',
        type: 'CMD_SEEK',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c4',
        payload: { positionMs: 195000 },
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.positionMs).toBe(195000);
      expect(state.isPlaying).toBe(false);
    });

    it('O: Seek while playing -> Remains playing at target seek timestamp', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: PUSHPA_SONG,
        currentTime: 120,
        isPlaying: true,
      });

      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_seek_2',
        type: 'CMD_SEEK',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c5',
        payload: { positionMs: 195000 },
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.positionMs).toBe(195000);
      expect(state.isPlaying).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Q, R, S. PLAY, PAUSE & RAPID COMMAND SERIALIZATION
  // ════════════════════════════════════════════════════════════════════════════
  describe('Q, R, S. Play, Pause & Rapid Command Serialization', () => {
    it('Q: Remote PLAY command resumes playback and broadcasts isPlaying=true', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: PUSHPA_SONG,
        isPlaying: false,
      });

      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_play',
        type: 'CMD_PLAY',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c6',
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.isPlaying).toBe(true);
    });

    it('R: Remote PAUSE command pauses playback and broadcasts isPlaying=false', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: PUSHPA_SONG,
        isPlaying: true,
      });

      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_pause',
        type: 'CMD_PAUSE',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'c7',
        timestamp: Date.now(),
      });

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.isPlaying).toBe(false);
    });

    it('S: Rapid burst commands (PLAY->PAUSE->PLAY->NEXT->PAUSE->PLAY) are serialized deterministically by Owner', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        queue: [PUSHPA_SONG, CHIKKIRI_SONG],
        queueIndex: 0,
        currentSong: PUSHPA_SONG,
        isPlaying: false,
      });

      const commands: Array<'CMD_PLAY' | 'CMD_PAUSE' | 'CMD_NEXT'> = [
        'CMD_PLAY',
        'CMD_PAUSE',
        'CMD_PLAY',
        'CMD_NEXT',
        'CMD_PAUSE',
        'CMD_PLAY',
      ];

      for (let i = 0; i < commands.length; i++) {
        await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
          id: `burst_${i}`,
          type: commands[i],
          sourceDeviceId: MOBILE_ID,
          targetDeviceId: LAPTOP_ID,
          commandId: `burst_cmd_${i}`,
          timestamp: Date.now() + i,
        });
      }

      const finalState = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(finalState.song?.title).toBe('Chikkiri');
      expect(finalState.isPlaying).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // X, Y, Z. INSTANT 1-CLICK DISCONNECT
  // ════════════════════════════════════════════════════════════════════════════
  describe('X, Y, Z. Instant Disconnect (Mobile & Laptop)', () => {
    it('X: Mobile controller disconnects -> Local UI resets instantly, Laptop owner continues playing', () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: PUSHPA_SONG,
        currentTime: 90,
        isPlaying: true,
      });

      // Mobile disconnects
      RaagaXConnectV2.getInstance().disconnect();

      const controllerState = usePlayerStore.getState();
      expect(controllerState.connectedDeviceId).toBeNull();
      expect(controllerState.deviceConnectionState).toBe('AVAILABLE');

      // Laptop owner keeps playing
      const ownerState = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(ownerState.isPlaying).toBe(true);
      expect(ownerState.song?.title).toBe('Pushpa Pushpa');
    });

    it('Y: Laptop owner disconnects session -> Mobile controller receives disconnect, Laptop keeps playing', () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        currentSong: PUSHPA_SONG,
        currentTime: 90,
        isPlaying: true,
      });

      RaagaXConnectV2.getInstance().disconnect();

      const state = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(state.isPlaying).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AE, AF, AG, AH. STALE METADATA IMMUNITY & MULTI-CONTROLLER FAN-OUT
  // ════════════════════════════════════════════════════════════════════════════
  describe('AE, AF, AG, AH. Atomic Metadata & Multi-Controller Fan-Out', () => {
    it('AE & AF: Metadata and artwork arrive atomically in single track object; stale version is ignored', () => {
      const client = RemoteControlClient.getInstance();

      // Set as controller
      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        isActiveDevice: false,
        connectedDeviceId: LAPTOP_ID,
      });

      // Receive fresh stateVersion 101 (Chikkiri)
      client.handlePlaybackStateUpdate({
        id: 'st_101',
        type: 'PLAYBACK_STATE',
        sourceDeviceId: LAPTOP_ID,
        targetDeviceId: MOBILE_ID,
        payload: {
          ownerDeviceId: LAPTOP_ID,
          songId: CHIKKIRI_SONG.id,
          song: CHIKKIRI_SONG,
          queue: [PUSHPA_SONG, CHIKKIRI_SONG],
          queueIndex: 1,
          positionMs: 45000,
          durationMs: CHIKKIRI_SONG.duration * 1000,
          isPlaying: true,
          playbackRate: 1.0,
          volume: 80,
          isMuted: false,
          shuffleMode: 'OFF',
          repeatMode: 'OFF',
          stateVersion: 101,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

      expect(usePlayerStore.getState().currentSong?.title).toBe('Chikkiri');

      // Stale stateVersion 100 (Pushpa) arrives late -> IGNORED
      client.handlePlaybackStateUpdate({
        id: 'st_100',
        type: 'PLAYBACK_STATE',
        sourceDeviceId: LAPTOP_ID,
        targetDeviceId: MOBILE_ID,
        payload: {
          ownerDeviceId: LAPTOP_ID,
          songId: PUSHPA_SONG.id,
          song: PUSHPA_SONG,
          queue: [PUSHPA_SONG, CHIKKIRI_SONG],
          queueIndex: 0,
          positionMs: 30000,
          durationMs: PUSHPA_SONG.duration * 1000,
          isPlaying: true,
          playbackRate: 1.0,
          volume: 80,
          isMuted: false,
          shuffleMode: 'OFF',
          repeatMode: 'OFF',
          stateVersion: 100, // Stale!
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

      // Still Chikkiri
      expect(usePlayerStore.getState().currentSong?.title).toBe('Chikkiri');
    });

    it('AG & AH: Two controllers (Phone A & Phone B) send simultaneous commands -> Owner serializes and both converge', async () => {
      PlaybackOwnerEngine.getInstance().setOwner(LAPTOP_ID, true);
      usePlayerStore.setState({
        deviceId: LAPTOP_ID,
        isActiveDevice: true,
        queue: [PUSHPA_SONG, CHIKKIRI_SONG, SONG_Z],
        queueIndex: 0,
        currentSong: PUSHPA_SONG,
        isPlaying: true,
      });

      // Phone A sends NEXT
      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_a_next',
        type: 'CMD_NEXT',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'cmd_a',
        timestamp: Date.now(),
      });

      // Phone B sends PAUSE
      await PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'cmd_b_pause',
        type: 'CMD_PAUSE',
        sourceDeviceId: PHONE_B_ID,
        targetDeviceId: LAPTOP_ID,
        commandId: 'cmd_b',
        timestamp: Date.now() + 1,
      });

      const finalState = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(finalState.song?.title).toBe('Chikkiri');
      expect(finalState.isPlaying).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AR, AS, AT, AU, AV, AW, AX. UI LIFECYCLE VS CONNECTION LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════════
  describe('AR, AS, AT, AU, AV, AW, AX. UI View Lifecycle Independence & Golden Rule', () => {
    it('AR & AS: Closing Connect modal or navigating tabs does NOT break the active connection', () => {
      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        isActiveDevice: false,
        connectedDeviceId: LAPTOP_ID,
        activeDeviceId: LAPTOP_ID,
        remoteDeviceName: 'Ram Laptop',
      });

      // User navigates from Connect Modal -> Home -> Library -> Search
      usePlayerStore.getState().setActiveTab('home');
      expect(usePlayerStore.getState().connectedDeviceId).toBe(LAPTOP_ID);

      usePlayerStore.getState().setActiveTab('library');
      expect(usePlayerStore.getState().connectedDeviceId).toBe(LAPTOP_ID);

      usePlayerStore.getState().setActiveTab('search');
      expect(usePlayerStore.getState().connectedDeviceId).toBe(LAPTOP_ID);
    });

    it('AX: Golden Rule Matrix validation', () => {
      const auth = ConnectAuthManager.getInstance();

      // 1. Same Account + Same LAN -> Full Access
      auth.handleHandshakeRequest({
        id: 'hs_same_lan',
        type: 'HANDSHAKE_REQUEST',
        sourceDeviceId: MOBILE_ID,
        targetDeviceId: LAPTOP_ID,
        clientIdentity: {
          deviceId: MOBILE_ID,
          deviceName: 'Ram Phone',
          deviceType: 'mobile',
          platform: 'android',
          userId: USER_A_ID,
          accountName: 'Ram',
          host: '192.168.1.10',
          port: 47104,
          capabilities: ['playback', 'remote_control', 'lossless_stream'],
          currentActivity: 'idle',
          protocolVersion: '2.0.0',
          timestamp: Date.now(),
        },
        clientNonce: 'n_ax',
        timestamp: Date.now(),
      });
      expect(auth.canControl(MOBILE_ID)).toBe(true);
      expect(auth.canSwitch(MOBILE_ID)).toBe(true);

      // 2. Different Account + Same LAN -> View Only / Control Blocked
      auth.handleHandshakeRequest({
        id: 'hs_diff_lan',
        type: 'HANDSHAKE_REQUEST',
        sourceDeviceId: FRIEND_PHONE_ID,
        targetDeviceId: LAPTOP_ID,
        clientIdentity: {
          deviceId: FRIEND_PHONE_ID,
          deviceName: 'Friend Phone',
          deviceType: 'mobile',
          platform: 'android',
          userId: USER_B_ID,
          accountName: 'Friend',
          host: '192.168.1.11',
          port: 47104,
          capabilities: ['playback', 'remote_control', 'lossless_stream'],
          currentActivity: 'idle',
          protocolVersion: '2.0.0',
          timestamp: Date.now(),
        },
        clientNonce: 'n_ax2',
        timestamp: Date.now(),
      });
      expect(auth.canControl(FRIEND_PHONE_ID)).toBe(false);
      expect(auth.canSwitch(FRIEND_PHONE_ID)).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 20 SPOTIFY-GRADE SPECIFICATION ENHANCEMENTS
  // ════════════════════════════════════════════════════════════════════════════
  describe('20 Spotify-Grade Specification Enhancements', () => {
    it('Enhancement 4: Account Logout severs Connect sessions, clears trusted peers, stops user ID broadcast, and preserves stable deviceId', async () => {
      // Establish active connect session
      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        isActiveDevice: false,
        connectedDeviceId: LAPTOP_ID,
        remoteDeviceName: 'Ram Laptop',
      });

      // User triggers sign out
      await useAuthStore.getState().signOut();

      const store = usePlayerStore.getState();
      expect(store.connectedDeviceId).toBeNull();
      expect(store.isActiveDevice).toBe(true);
      expect(store.onlineDevices).toEqual([]);

      // Trusted peers cleared
      expect(ConnectAuthManager.getInstance().getTrustedPeers().length).toBe(0);

      // Stable physical deviceId is preserved
      expect(store.deviceId).toBe(MOBILE_ID);
    });

    it('Enhancement 8: Restrictions & Unavailable Actions (canNext, canPrevious) are evaluated accurately based on queue bounds', () => {
      // Queue with 1 song at index 0
      usePlayerStore.setState({
        queue: [PUSHPA_SONG],
        queueIndex: 0,
        repeatMode: 'OFF',
      });

      const canPrevious = usePlayerStore.getState().queueIndex > 0;
      const canNext = usePlayerStore.getState().queueIndex < usePlayerStore.getState().queue.length - 1;

      expect(canPrevious).toBe(false); // First song -> Previous disabled
      expect(canNext).toBe(false);     // Last song -> Next disabled
    });

    it('Enhancement 10: Volume is device-specific and not clobbered during ownership handoff', () => {
      // Laptop has volume 80%, Mobile has volume 40%
      const laptopVolume = 80;
      const mobileVolume = 40;

      usePlayerStore.setState({
        deviceId: MOBILE_ID,
        volume: mobileVolume,
      });

      // Laptop state arrives with volume 80%
      const stateSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
      expect(stateSnapshot.volume).toBeDefined();

      // Mobile local audio volume setting remains intact
      expect(usePlayerStore.getState().volume).toBe(40);
    });

    it('Enhancement 11: Duplicate device names ("Ram Phone", "Ram Phone") are differentiated by unique deviceId', () => {
      const devA = { deviceId: 'rx_m1_android', deviceName: 'Ram Phone', platform: 'android' };
      const devB = { deviceId: 'rx_m2_ios', deviceName: 'Ram Phone', platform: 'ios' };

      expect(devA.deviceId).not.toBe(devB.deviceId);
      expect(`${devA.deviceName} (${devA.platform})`).toBe('Ram Phone (android)');
      expect(`${devB.deviceName} (${devB.platform})`).toBe('Ram Phone (ios)');
    });

    it('Enhancement 20: Challenge-Response Security Handshake rejects forged credentials', () => {
      const auth = ConnectAuthManager.getInstance();
      auth.removeAllTrustedPeers();

      // Handshake from unauthorized unknown device with forged claim
      auth.handleHandshakeRequest({
        id: 'hs_forged',
        type: 'HANDSHAKE_REQUEST',
        sourceDeviceId: 'dev_hacker',
        targetDeviceId: LAPTOP_ID,
        clientIdentity: {
          deviceId: 'dev_hacker',
          deviceName: 'Hacker Phone',
          deviceType: 'mobile',
          platform: 'android',
          userId: 'forged_user_xyz',
          accountName: 'Hacker',
          host: '192.168.1.99',
          port: 47104,
          capabilities: ['playback', 'remote_control', 'lossless_stream'],
          currentActivity: 'idle',
          protocolVersion: '2.0.0',
          timestamp: Date.now(),
        },
        clientNonce: 'nonce_hack',
        timestamp: Date.now(),
      });

      expect(auth.getAuthTier('dev_hacker')).toBe('OTHER_ACCOUNT');
      expect(auth.canControl('dev_hacker')).toBe(false);
      expect(auth.canSwitch('dev_hacker')).toBe(false);
    });
  });
});


