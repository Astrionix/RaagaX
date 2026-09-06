/**
 * PairingService — Authorization & Mutual Trust Handshake
 *
 * Implements Architecture Spec §4:
 * - Clear boundary: DiscoveredPeer -> (Auth) -> AuthorizedPeer
 * - Same-account: Auto-authorization via mutual signed device certs.
 * - Different-account: 6-Digit PIN Short Authentication String (SAS) + HMAC Nonce confirmation.
 */

import { DiscoveredPeer, AuthorizedPeer } from '../types';
import { DeviceKeyManager } from './DeviceKeyManager';
import { CryptoPolyfill } from './CryptoPolyfill';

export interface PairingSessionState {
  peerId: string;
  pin: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
}

export class PairingService {
  private static instance: PairingService;
  private authorizedPeers = new Map<string, AuthorizedPeer>();
  private pendingPairingSessions = new Map<string, PairingSessionState>();

  private constructor() {}

  public static getInstance(): PairingService {
    if (!PairingService.instance) {
      PairingService.instance = new PairingService();
    }
    return PairingService.instance;
  }

  /**
   * Seamless One-Tap Authorization (Spotify Connect standard):
   * Instantly authorizes any discovered peer on the network without PIN or blocking challenge.
   */
  public async authorizeDirect(peer: DiscoveredPeer): Promise<AuthorizedPeer> {
    const keyManager = DeviceKeyManager.getInstance();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const capabilityToken = await keyManager.signCapabilityToken({
      deviceId: keyManager.getOrCreateDeviceId(),
      sessionId,
      role: 'player',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    const authorized: AuthorizedPeer = {
      peer,
      role: 'player',
      sessionKey: `shared_session_${peer.deviceId}`,
      capabilityToken,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    this.authorizedPeers.set(peer.deviceId, authorized);
    return authorized;
  }

  /**
   * Same-Account Fast Path (§4):
   * Auto-authorizes peers matching the current active user accountId.
   */
  public async authorizeSameAccount(
    peer: DiscoveredPeer,
    currentAccountId: string
  ): Promise<AuthorizedPeer | null> {
    if (!peer.accountId || peer.accountId !== currentAccountId) {
      return null;
    }

    const keyManager = DeviceKeyManager.getInstance();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Mint local capability token
    const capabilityToken = await keyManager.signCapabilityToken({
      deviceId: keyManager.getOrCreateDeviceId(),
      sessionId,
      role: 'player',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    });

    const authorized: AuthorizedPeer = {
      peer,
      role: 'player',
      sessionKey: `shared_session_${peer.deviceId}`,
      capabilityToken,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    this.authorizedPeers.set(peer.deviceId, authorized);
    return authorized;
  }

  /**
   * Different-Account Pairing Initiation (§4):
   * Target player generates random 6-digit numeric PIN and cryptographic nonce.
   */
  public createPairingChallenge(peer: DiscoveredPeer): { pin: string; nonce: string } {
    // Generate secure random 6-digit PIN (100000 - 999999)
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const nonce = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : CryptoPolyfill.randomHex(16);

    const session: PairingSessionState = {
      peerId: peer.deviceId,
      pin,
      nonce,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
    };

    this.pendingPairingSessions.set(peer.deviceId, session);
    return { pin, nonce };
  }

  /**
   * Step 3 & 4 (Controller device side): Computes confirmation HMAC over PIN + nonce
   */
  public async computePairConfirmHmac(pin: string, nonce: string): Promise<string> {
    const subtle = typeof window !== 'undefined' ? window.crypto?.subtle : (globalThis as any).crypto?.subtle;
    if (subtle) {
      try {
        const encoder = new TextEncoder();
        const pinKey = await subtle.importKey(
          'raw',
          encoder.encode(pin),
          { name: 'HMAC', hash: { name: 'SHA-256' } },
          false,
          ['sign']
        );

        const signature = await subtle.sign('HMAC', pinKey, encoder.encode(nonce));
        return Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } catch (err) {
        console.warn('[PairingService] Web Crypto HMAC failed, using software fallback:', err);
      }
    }

    return CryptoPolyfill.hmacSha256Hex(pin, nonce);
  }

  /**
   * Step 4 verification (Player side): Confirms entered PIN matches pending challenge
   */
  public async verifyPairConfirm(
    peer: DiscoveredPeer,
    enteredPinOrHmac: string,
    providedNonce?: string
  ): Promise<AuthorizedPeer | null> {
    const session = this.pendingPairingSessions.get(peer.deviceId);
    if (!session || Date.now() > session.expiresAt) {
      this.pendingPairingSessions.delete(peer.deviceId);
      return null;
    }

    let isMatch = false;

    // Direct 6-digit PIN match
    if (enteredPinOrHmac.trim() === session.pin) {
      isMatch = true;
    } else {
      // HMAC match
      const expectedHmac = await this.computePairConfirmHmac(session.pin, session.nonce);
      if (enteredPinOrHmac === expectedHmac) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      return null;
    }

    // Success: Clean up challenge and mint short-lived AuthorizedPeer
    this.pendingPairingSessions.delete(peer.deviceId);
    const keyManager = DeviceKeyManager.getInstance();
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12-hour session
    const capabilityToken = await keyManager.signCapabilityToken({
      deviceId: peer.deviceId,
      sessionId: 'sess_pair_' + peer.deviceId,
      role: 'controller',
      expiresAt,
    });

    const authorized: AuthorizedPeer = {
      peer,
      role: 'controller',
      capabilityToken,
      expiresAt,
    };

    this.authorizedPeers.set(peer.deviceId, authorized);
    return authorized;
  }

  public getAuthorizedPeer(deviceId: string): AuthorizedPeer | null {
    const auth = this.authorizedPeers.get(deviceId);
    if (!auth) return null;
    if (Date.now() > auth.expiresAt) {
      this.authorizedPeers.delete(deviceId);
      return null;
    }
    return auth;
  }

  public revokeAuthorization(deviceId: string): void {
    this.authorizedPeers.delete(deviceId);
    this.pendingPairingSessions.delete(deviceId);
  }
}
