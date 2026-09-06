import { describe, it, expect } from 'vitest';
import { CryptoPolyfill } from '@/lib/connect/auth/CryptoPolyfill';
import { DeviceKeyManager } from '@/lib/connect/auth/DeviceKeyManager';
import { PairingService } from '@/lib/connect/auth/PairingService';
import { DiscoveredPeer } from '@/lib/connect/types';

describe('RaagaX Connect — CryptoPolyfill & Insecure Context Fallback Suite', () => {
  describe('1. Standard FIPS 180-4 SHA-256 Test Vectors', () => {
    it('matches standard hash for empty string', () => {
      const hash = CryptoPolyfill.sha256Hex('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('matches standard hash for "hello"', () => {
      const hash = CryptoPolyfill.sha256Hex('hello');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('matches standard hash for "The quick brown fox jumps over the lazy dog"', () => {
      const hash = CryptoPolyfill.sha256Hex('The quick brown fox jumps over the lazy dog');
      expect(hash).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
    });
  });

  describe('2. Standard RFC 2104 HMAC-SHA-256 Test Vectors', () => {
    it('matches standard HMAC-SHA-256 for key and test string', () => {
      const hmac = CryptoPolyfill.hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog');
      expect(hmac).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
    });
  });

  describe('3. DeviceKeyManager Insecure Context Operation (Zero subtle crypto requirement)', () => {
    it('initializes keypair and fingerprint without errors', async () => {
      const keyManager = DeviceKeyManager.getInstance();
      const keys = await keyManager.getOrCreateKeyPair();

      expect(keys.fingerprint).toBeDefined();
      expect(keys.fingerprint.length).toBeGreaterThanOrEqual(16);
      expect(keys.publicKeyHex).toBeDefined();
    });

    it('mints and verifies capability tokens seamlessly', async () => {
      const keyManager = DeviceKeyManager.getInstance();
      const token = await keyManager.signCapabilityToken({
        deviceId: 'test_dev_mobile_http',
        sessionId: 'sess_123',
        role: 'player',
        expiresAt: Date.now() + 10000,
      });

      expect(token).toBeDefined();
      expect(token.includes('.')).toBe(true);

      const verification = await keyManager.verifyCapabilityToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.payload?.deviceId).toBe('test_dev_mobile_http');
    });
  });

  describe('4. PairingService Insecure Context PIN Verification', () => {
    it('computes HMAC confirmation and verifies cross-device PIN', async () => {
      const pairing = PairingService.getInstance();
      const peer: DiscoveredPeer = {
        deviceId: 'dev_peer_http',
        deviceName: 'Mobile Phone · Jordan',
        pubKeyFingerprint: '99881122aabb',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'cloud_presence',
        lastSeen: Date.now(),
      };

      const challenge = pairing.createPairingChallenge(peer);
      expect(challenge.pin).toMatch(/^\d{6}$/);

      // Verify PIN
      const authorized = await pairing.verifyPairConfirm(peer, challenge.pin);
      expect(authorized).not.toBeNull();
      expect(authorized?.role).toBe('controller');
      expect(authorized?.capabilityToken).toBeDefined();
    });
  });
});
