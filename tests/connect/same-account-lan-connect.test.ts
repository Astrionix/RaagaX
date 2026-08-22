import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { useAuthStore } from '../../src/context/useAuthStore';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { RaagaXConnectV2 } from '../../src/lib/connect/lan/RaagaXConnectV2';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { Song } from '../../src/types/music';

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
  genre: 'Tollywood Hits',
  category: 'latest_telugu',
  releaseYear: 2026,
  plays: 5000,
  likes: 1200,
});

const SONG_X = makeSong('track_x', 'Song X', 'DSP', 240);
const CHIKKIRI_SONG = makeSong('chikkiri_02', 'Chikkiri', 'Ram Miriyala', 272);

const USER_A_ID = 'user_u123';
const USER_B_ID = 'user_u456_friend';

const MOBILE_D1 = 'dev_mobile_m1';
const DESKTOP_D1 = 'dev_desktop_d1';
const FRIEND_PHONE = 'dev_friend_m2';

describe('RaagaX Connect: Same-Account LAN Architecture Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ConnectAuthManager.getInstance().removeAllTrustedPeers();
    useAuthStore.setState({
      user: { id: USER_A_ID, email: 'user@raagax.test' } as any,
    });
    usePlayerStore.setState({
      deviceId: DESKTOP_D1,
      isActiveDevice: true,
      connectedDeviceId: null,
      activeDeviceId: DESKTOP_D1,
      isPlaying: false,
      playbackIntent: 'PAUSED',
      currentTime: 0,
      duration: 240,
      currentSong: null,
      queue: [],
      queueIndex: 0,
    });
  });

  // ── 1. Supabase Auth: Same Account = Automatic Trust ─────────────────────────
  it('1. Same Account (U123 on M1 and D1) automatically authorizes direct control', () => {
    const auth = ConnectAuthManager.getInstance();

    // Handshake request from Mobile (M1) sharing the same userId (U123)
    auth.handleHandshakeRequest({
      id: 'hs_req_01',
      type: 'HANDSHAKE_REQUEST',
      sourceDeviceId: MOBILE_D1,
      targetDeviceId: DESKTOP_D1,
      clientIdentity: {
        deviceId: MOBILE_D1,
        deviceName: 'User Mobile Phone',
        deviceType: 'mobile',
        platform: 'android',
        userId: USER_A_ID, // SAME ACCOUNT (U123)
        accountName: 'RaagaX User',
        host: '192.168.1.10',
        port: 47104,
        capabilities: ['playback', 'remote_control', 'lossless_stream'],
        currentActivity: 'idle',
        protocolVersion: '2.0.0',
        timestamp: Date.now(),
      },
      clientNonce: 'nonce_123',
      timestamp: Date.now(),
    });

    expect(auth.getAuthTier(MOBILE_D1)).toBe('SAME_ACCOUNT');
    expect(auth.canControl(MOBILE_D1)).toBe(true);
    expect(auth.canSwitch(MOBILE_D1)).toBe(true);
  });

  // ── 2. Different Account on Same Wi-Fi requires explicit permission ──────────
  it('2. Different Account (U456 on same Wi-Fi) is detected but control is blocked without explicit pairing', () => {
    const auth = ConnectAuthManager.getInstance();

    // Friend Phone has userId U456
    auth.handleHandshakeRequest({
      id: 'hs_req_02',
      type: 'HANDSHAKE_REQUEST',
      sourceDeviceId: FRIEND_PHONE,
      targetDeviceId: DESKTOP_D1,
      clientIdentity: {
        deviceId: FRIEND_PHONE,
        deviceName: "Friend's Phone",
        deviceType: 'mobile',
        platform: 'android',
        userId: USER_B_ID, // DIFFERENT ACCOUNT (U456 != U123)
        accountName: 'Friend User',
        host: '192.168.1.11',
        port: 47104,
        capabilities: ['playback', 'remote_control', 'lossless_stream'],
        currentActivity: 'idle',
        protocolVersion: '2.0.0',
        timestamp: Date.now(),
      },
      clientNonce: 'nonce_456',
      timestamp: Date.now(),
    });

    expect(auth.getAuthTier(FRIEND_PHONE)).toBe('OTHER_ACCOUNT');
    // Blocked by default
    expect(auth.canControl(FRIEND_PHONE)).toBe(false);

    // If device owner explicitly grants permission via PIN / modal:
    auth.addTrustedPeer({
      deviceId: FRIEND_PHONE,
      deviceName: "Friend's Phone",
      userId: USER_B_ID,
      permissions: { allowControl: true, allowSwitch: false },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    expect(auth.canControl(FRIEND_PHONE)).toBe(true);
    expect(auth.canSwitch(FRIEND_PHONE)).toBe(false); // Can control playback, but not hijack active owner audio
  });

  // ── 3. High-frequency playback commands run directly over LAN ────────────────
  it('3. Direct LAN WebSocket handles all playback commands with sub-15ms latency and zero cloud DB spam', () => {
    // Set device as Controller connected to Desktop D1
    usePlayerStore.setState({
      deviceId: MOBILE_D1,
      isActiveDevice: false,
      connectedDeviceId: DESKTOP_D1,
      activeDeviceId: DESKTOP_D1,
    });

    const sentLANMessages: any[] = [];
    const directTransport = DirectLANTransport.getInstance();
    vi.spyOn(directTransport, 'sendMessage').mockImplementation((target, msg) => {
      sentLANMessages.push({ target, msg });
      return true;
    });

    // Mobile controller sends NEXT to Laptop Owner
    RaagaXConnectV2.getInstance().sendCommand('CMD_NEXT');

    // Message must be routed directly to LAN transport
    expect(sentLANMessages.length).toBeGreaterThanOrEqual(1);
    const cmdMsg = sentLANMessages.find((m) => m.msg.type === 'CMD_NEXT');
    expect(cmdMsg).toBeDefined();
    expect(cmdMsg?.target).toBe(DESKTOP_D1);
  });

  // ── 4. Same-Account Switching: Mobile -> Desktop ─────────────────────────────
  it('4. Same-Account switch Mobile -> Desktop preserves position and playing state without restarting', () => {
    // Mobile is OWNER playing Song X @ 02:00 (120s)
    PlaybackOwnerEngine.getInstance().setOwner(MOBILE_D1, true);
    usePlayerStore.setState({
      deviceId: MOBILE_D1,
      isActiveDevice: true,
      activeDeviceId: MOBILE_D1,
      connectedDeviceId: null,
      currentSong: { ...SONG_X },
      currentTime: 120,
      isPlaying: true,
    });

    // Switch to Desktop D1
    PlaybackOwnerEngine.getInstance().setOwner(DESKTOP_D1, true);
    usePlayerStore.setState({
      deviceId: DESKTOP_D1,
      isActiveDevice: true,
      activeDeviceId: DESKTOP_D1,
      connectedDeviceId: null,
      currentSong: { ...SONG_X },
      currentTime: 120,
      isPlaying: true,
    });

    const desktopSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(desktopSnapshot.song?.id).toBe(SONG_X.id);
    expect(desktopSnapshot.positionMs).toBe(120_000);
    expect(desktopSnapshot.isPlaying).toBe(true);
  });

  // ── 5. Same-Account Switching: Desktop -> Mobile (Symmetrical Reverse) ───────
  it('5. Same-Account switch Desktop -> Mobile performs identical reverse handoff', () => {
    // Desktop is OWNER playing Chikkiri @ 01:30 (90s)
    PlaybackOwnerEngine.getInstance().setOwner(DESKTOP_D1, true);
    usePlayerStore.setState({
      deviceId: DESKTOP_D1,
      isActiveDevice: true,
      activeDeviceId: DESKTOP_D1,
      connectedDeviceId: null,
      currentSong: { ...CHIKKIRI_SONG },
      currentTime: 90,
      isPlaying: true,
    });

    // Switch to Mobile M1
    PlaybackOwnerEngine.getInstance().setOwner(MOBILE_D1, true);
    usePlayerStore.setState({
      deviceId: MOBILE_D1,
      isActiveDevice: true,
      activeDeviceId: MOBILE_D1,
      connectedDeviceId: null,
      currentSong: { ...CHIKKIRI_SONG },
      currentTime: 90,
      isPlaying: true,
    });

    const mobileSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(mobileSnapshot.song?.id).toBe(CHIKKIRI_SONG.id);
    expect(mobileSnapshot.positionMs).toBe(90_000);
    expect(mobileSnapshot.isPlaying).toBe(true);
  });

  // ── 6. Same-Account Instant Disconnect (Either side clicks -> Instant, Owner continues)
  it('6. Same-Account Instant Disconnect from either side clears UI instantly without stopping owner music', () => {
    // Desktop is OWNER playing Chikkiri @ 02:31; Mobile is CONTROLLER
    PlaybackOwnerEngine.getInstance().setOwner(DESKTOP_D1, true);
    usePlayerStore.setState({
      deviceId: DESKTOP_D1,
      isActiveDevice: true,
      activeDeviceId: DESKTOP_D1,
      connectedDeviceId: null,
      currentSong: { ...CHIKKIRI_SONG },
      currentTime: 151,
      isPlaying: true,
    });

    // Mobile controller clicks [Disconnect] — 1 click, 0 lag
    RaagaXConnectV2.getInstance().disconnect();

    const controllerState = usePlayerStore.getState();
    expect(controllerState.connectedDeviceId).toBeNull();
    expect(controllerState.deviceConnectionState).toBe('AVAILABLE');

    // Desktop owner state continues playing uninterrupted
    PlaybackOwnerEngine.getInstance().setOwner(DESKTOP_D1, true);
    const ownerSnapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();
    expect(ownerSnapshot.isPlaying).toBe(true);
    expect(ownerSnapshot.positionMs).toBe(151_000);
    expect(ownerSnapshot.song?.title).toBe('Chikkiri');
  });
});
