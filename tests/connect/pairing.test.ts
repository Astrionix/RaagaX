import { describe, it, expect, beforeEach } from 'vitest';
import { PairingService } from '@/lib/connect/auth/PairingService';
import { DiscoveredPeer } from '@/lib/connect/types';

describe('RaagaX Connect — PairingService & Authorization Suite', () => {
  let pairingService: PairingService;

  beforeEach(() => {
    pairingService = PairingService.getInstance();
  });

  it('1. Same-Account Auto Authorization: Automatically issues AuthorizedPeer for matching accountId', async () => {
    const discovered: DiscoveredPeer = {
      deviceId: 'peer_phone_123',
      deviceName: 'My Galaxy S24',
      pubKeyFingerprint: 'fa81bc32',
      protoVersion: 1,
      capabilities: ['player', 'controller'],
      transport: 'cloud_presence',
      accountId: 'acc_user_456',
      lastSeen: Date.now(),
    };

    // Attempt auth with same accountId
    const authorized = await pairingService.authorizeSameAccount(discovered, 'acc_user_456');
    expect(authorized).not.toBeNull();
    expect(authorized?.role).toBe('player');
    expect(authorized?.capabilityToken).toBeDefined();

    // Mismatched accountId fails auto-auth
    const rejected = await pairingService.authorizeSameAccount(discovered, 'acc_different_user');
    expect(rejected).toBeNull();
  });

  it('2. Cross-Account 6-Digit PIN Challenge & Verification', async () => {
    const peer: DiscoveredPeer = {
      deviceId: 'peer_tv_living_room',
      deviceName: 'Living Room TV',
      pubKeyFingerprint: '9988aabb',
      protoVersion: 1,
      capabilities: ['player'],
      transport: 'mdns',
      accountId: null, // Different household / guest
      lastSeen: Date.now(),
    };

    // 1. Target player creates 6-digit challenge
    const challenge = pairingService.createPairingChallenge(peer);
    expect(challenge.pin).toMatch(/^\d{6}$/);
    expect(challenge.nonce).toBeDefined();

    // 2. Controller enters correct PIN
    const authorized = await pairingService.verifyPairConfirm(peer, challenge.pin);
    expect(authorized).not.toBeNull();
    expect(authorized?.role).toBe('controller');
    expect(authorized?.capabilityToken).toBeDefined();

    // 3. Challenge is consumed: second verification with same PIN should fail
    const replay = await pairingService.verifyPairConfirm(peer, challenge.pin);
    expect(replay).toBeNull();
  });

  it('3. Incorrect PIN rejection', async () => {
    const peer: DiscoveredPeer = {
      deviceId: 'peer_speaker_guest',
      pubKeyFingerprint: '11223344',
      protoVersion: 1,
      capabilities: ['player'],
      transport: 'udp_beacon',
      lastSeen: Date.now(),
    };

    pairingService.createPairingChallenge(peer);

    // Wrong PIN
    const rejected = await pairingService.verifyPairConfirm(peer, '000000');
    expect(rejected).toBeNull();
  });

  it('4. Zero-PIN One-Tap Direct Authorization (Spotify-style connect)', async () => {
    const peer: DiscoveredPeer = {
      deviceId: 'peer_kitchen_speaker',
      deviceName: 'Kitchen Echo',
      pubKeyFingerprint: 'ab12cd34',
      protoVersion: 1,
      capabilities: ['player'],
      transport: 'cloud_presence',
      lastSeen: Date.now(),
    };

    const authorized = await pairingService.authorizeDirect(peer);
    expect(authorized).not.toBeNull();
    expect(authorized.peer.deviceId).toBe('peer_kitchen_speaker');
    expect(authorized.role).toBe('player');
    expect(authorized.capabilityToken).toBeDefined();
    expect(authorized.expiresAt).toBeGreaterThan(0);
  });
});
