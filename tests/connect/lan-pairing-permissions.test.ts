import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectAuthManager } from '../../src/lib/connect/lan/ConnectAuthManager';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { LocalDiscoveryService } from '../../src/lib/connect/lan/LocalDiscoveryService';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { OwnershipSwitchProtocol } from '../../src/lib/connect/lan/OwnershipSwitchProtocol';
import { useAuthStore } from '../../src/context/useAuthStore';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';
import { LANDeviceAdvertisement } from '../../src/lib/connect/lan/types';

const mockSong: Song = {
  id: 'song_pair_test',
  title: 'Hostel Track',
  artist: 'Hostel Artist',
  artistId: 'art_hostel_1',
  album: 'Hostel Album',
  albumId: 'alb_hostel_1',
  coverUrl: '/cover.png',
  duration: 200,
  audioUrl: 'https://audio.raagax.test/hostel.mp3',
  genre: 'Acoustic',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 50,
  likes: 20,
};

describe('RaagaX Connect V2: Multi-User Pairing, Permissions & Security Suite', () => {
  let authManager: ConnectAuthManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    authManager = ConnectAuthManager.getInstance();
    authManager.removeAllTrustedPeers();
    authManager.setPolicies('ASK_EVERY_TIME', 'ASK_EVERY_TIME');

    useAuthStore.setState({
      user: { id: 'usr_owner', email: 'owner@raagax.test', user_metadata: { name: 'Owner' } } as any,
    });

    usePlayerStore.setState({
      deviceId: 'dev_owner',
      activeDeviceId: 'dev_owner',
      connectedDeviceId: null,
      isActiveDevice: true,
      currentSong: mockSong,
      isPlaying: true,
      currentTime: 60,
    });

    PlaybackOwnerEngine.getInstance().setOwner('dev_owner', true);
  });

  // 1. Frictionless Same Account
  it('1. Same account devices are automatically trusted without prompts', () => {
    // Add discovered device with same userId
    LocalDiscoveryService.getInstance().handleAdvertisement({
      deviceId: 'dev_my_laptop',
      deviceName: "Owner's Laptop",
      deviceType: 'desktop',
      platform: 'windows',
      protocolVersion: '2.0.0',
      host: '192.168.1.10',
      port: 47104,
      capabilities: ['playback'],
      userId: 'usr_owner',
      currentActivity: 'idle',
      timestamp: Date.now(),
    });

    expect(authManager.canControl('dev_my_laptop')).toBe(true);
    expect(authManager.canSwitch('dev_my_laptop')).toBe(true);
  });

  // 2. Different Account - Explicit Pairing Flow
  it('2. Different account requires pairing approval; grants control without switch', async () => {
    const friendDevice: LANDeviceAdvertisement = {
      deviceId: 'dev_friend_phone',
      deviceName: "Rahul's Phone",
      deviceType: 'mobile',
      platform: 'android',
      protocolVersion: '2.0.0',
      host: '192.168.1.20',
      port: 47104,
      capabilities: ['playback', 'remote_control'],
      userId: 'usr_friend_rahul',
      currentActivity: 'idle',
      timestamp: Date.now(),
    };

    LocalDiscoveryService.getInstance().handleAdvertisement(friendDevice);

    // Initial state: Not paired -> Cannot control or switch
    expect(authManager.canControl('dev_friend_phone')).toBe(false);
    expect(authManager.canSwitch('dev_friend_phone')).toBe(false);

    // Friend sends pairing request
    authManager.handlePairingRequest({
      id: 'preq_1',
      type: 'PAIRING_REQUEST',
      pairingId: 'pair_123',
      sourceDeviceId: 'dev_friend_phone',
      targetDeviceId: 'dev_owner',
      clientIdentity: friendDevice,
      requestedPermissions: { allowControl: true, allowSwitch: false },
      timestamp: Date.now(),
    });

    // Verify UI prompt is queued
    const activePrompts = authManager.getActivePairingPrompts();
    expect(activePrompts.length).toBe(1);
    expect(activePrompts[0].pairingId).toBe('pair_123');

    // Owner approves with allowControl: true, allowSwitch: false
    authManager.respondToPairingPrompt('pair_123', true, { allowControl: true, allowSwitch: false }, 'permanent');

    // Now friend is paired!
    expect(authManager.isPaired('dev_friend_phone')).toBe(true);
    expect(authManager.canControl('dev_friend_phone')).toBe(true);
    expect(authManager.canSwitch('dev_friend_phone')).toBe(false); // Switching was NOT granted
  });

  // 3. Control Policy: NOBODY
  it('3. NOBODY policy auto-declines all incoming pairing requests', async () => {
    authManager.setPolicies('NOBODY');

    const transport = DirectLANTransport.getInstance();
    let responseSent: any = null;
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      responseSent = msg;
      return true;
    });

    authManager.handlePairingRequest({
      id: 'preq_2',
      type: 'PAIRING_REQUEST',
      pairingId: 'pair_reject',
      sourceDeviceId: 'dev_stranger',
      targetDeviceId: 'dev_owner',
      clientIdentity: {
        deviceId: 'dev_stranger',
        deviceName: 'Stranger Phone',
        deviceType: 'mobile',
        platform: 'android',
        protocolVersion: '2.0.0',
        host: '192.168.1.99',
        port: 47104,
        capabilities: [],
        currentActivity: 'idle',
        timestamp: Date.now(),
      },
      requestedPermissions: { allowControl: true, allowSwitch: true },
      timestamp: Date.now(),
    });

    expect(responseSent).not.toBeNull();
    expect(responseSent.accepted).toBe(false);
    expect(authManager.canControl('dev_stranger')).toBe(false);
  });

  // 4. Control Policy: ANYONE_ON_WIFI
  it('4. ANYONE_ON_WIFI policy auto-approves pairing requests', async () => {
    authManager.setPolicies('ANYONE_ON_WIFI');

    const transport = DirectLANTransport.getInstance();
    let responseSent: any = null;
    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      responseSent = msg;
      return true;
    });

    authManager.handlePairingRequest({
      id: 'preq_3',
      type: 'PAIRING_REQUEST',
      pairingId: 'pair_auto',
      sourceDeviceId: 'dev_hostel_mate',
      targetDeviceId: 'dev_owner',
      clientIdentity: {
        deviceId: 'dev_hostel_mate',
        deviceName: 'Mate Phone',
        deviceType: 'mobile',
        platform: 'android',
        protocolVersion: '2.0.0',
        host: '192.168.1.44',
        port: 47104,
        capabilities: [],
        currentActivity: 'idle',
        timestamp: Date.now(),
      },
      requestedPermissions: { allowControl: true, allowSwitch: false },
      timestamp: Date.now(),
    });

    expect(responseSent.accepted).toBe(true);
    expect(authManager.canControl('dev_hostel_mate')).toBe(true);
  });

  // 5. Expiration of Temporary Pairing
  it('5. Temporary pairing expires after duration window', () => {
    // Pair for 15 minutes
    authManager.handlePairingRequest({
      id: 'preq_exp',
      type: 'PAIRING_REQUEST',
      pairingId: 'pair_exp',
      sourceDeviceId: 'dev_temp_friend',
      targetDeviceId: 'dev_owner',
      clientIdentity: {
        deviceId: 'dev_temp_friend',
        deviceName: 'Temp Friend',
        deviceType: 'mobile',
        platform: 'android',
        protocolVersion: '2.0.0',
        host: '192.168.1.33',
        port: 47104,
        capabilities: [],
        currentActivity: 'idle',
        timestamp: Date.now(),
      },
      requestedPermissions: { allowControl: true, allowSwitch: false },
      timestamp: Date.now(),
    });

    authManager.respondToPairingPrompt('pair_exp', true, { allowControl: true, allowSwitch: false }, '15m');
    expect(authManager.canControl('dev_temp_friend')).toBe(true);

    // Mock time forward 16 minutes
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000);

    // Should now be expired!
    expect(authManager.canControl('dev_temp_friend')).toBe(false);
  });

  // 6. Replay Attack & Timestamp Defense
  it('6. Replayed commands or stale timestamps are rejected', () => {
    const validCmd = {
      id: 'cmd_1',
      type: 'CMD_PAUSE' as const,
      sourceDeviceId: 'dev_friend_phone',
      targetDeviceId: 'dev_owner',
      commandId: 'unique_cmd_id_100',
      sequence: 1,
      timestamp: Date.now(),
    };

    // First execution: Valid
    expect(authManager.validateCommandSecurity(validCmd)).toBe(true);

    // Replay with identical commandId: REJECTED
    expect(authManager.validateCommandSecurity(validCmd)).toBe(false);

    // Stale timestamp (15s ago): REJECTED
    const staleCmd = {
      id: 'cmd_2',
      type: 'CMD_PAUSE' as const,
      sourceDeviceId: 'dev_friend_phone',
      targetDeviceId: 'dev_owner',
      commandId: 'unique_cmd_id_101',
      sequence: 2,
      timestamp: Date.now() - 15000,
    };
    expect(authManager.validateCommandSecurity(staleCmd)).toBe(false);

    // Out-of-order sequence (sequence 1 after sequence 2): REJECTED
    const outOfOrderCmd = {
      id: 'cmd_3',
      type: 'CMD_PAUSE' as const,
      sourceDeviceId: 'dev_friend_phone',
      targetDeviceId: 'dev_owner',
      commandId: 'unique_cmd_id_102',
      sequence: 1,
      timestamp: Date.now(),
    };
    expect(authManager.validateCommandSecurity(outOfOrderCmd)).toBe(false);
  });

  // 7. Kill Switch
  it('7. Kill switch (removeAllTrustedPeers) immediately revokes all paired devices', () => {
    // Add two paired peers
    authManager.handlePairingRequest({
      id: 'preq_k1',
      type: 'PAIRING_REQUEST',
      pairingId: 'pair_k1',
      sourceDeviceId: 'dev_p1',
      targetDeviceId: 'dev_owner',
      clientIdentity: { deviceId: 'dev_p1', deviceName: 'P1', deviceType: 'mobile', platform: 'android', protocolVersion: '2.0.0', host: '192.168.1.1', port: 47104, capabilities: [], currentActivity: 'idle', timestamp: Date.now() },
      requestedPermissions: { allowControl: true, allowSwitch: true },
      timestamp: Date.now(),
    });
    authManager.respondToPairingPrompt('pair_k1', true, { allowControl: true, allowSwitch: true }, 'permanent');

    expect(authManager.canControl('dev_p1')).toBe(true);

    // Trigger Kill Switch
    authManager.removeAllTrustedPeers();

    expect(authManager.getTrustedPeers().length).toBe(0);
    expect(authManager.canControl('dev_p1')).toBe(false);
    expect(authManager.canSwitch('dev_p1')).toBe(false);
  });
});
