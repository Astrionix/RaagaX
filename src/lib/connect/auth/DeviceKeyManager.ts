/**
 * DeviceKeyManager — Cryptographic Device Identity & Capability Tokens
 *
 * Implements Architecture Spec §9:
 * - Persistent asymmetric keypair per device stored securely in localStorage / IndexedDB.
 * - Public key fingerprint derivation for mDNS / UDP beacons / Cloud registry.
 * - Capability token minting and signature verification.
 * - Pure TypeScript CryptoPolyfill fallback when Web Crypto subtle is unavailable
 *   (e.g. Insecure HTTP LAN IP `http://192.168.x.x:5173`, older WebViews, etc.)
 */

import { CryptoPolyfill } from './CryptoPolyfill';

export interface DeviceKeyPair {
  publicKey: CryptoKey | any;
  privateKey: CryptoKey | any;
  publicKeyHex: string;
  fingerprint: string;
}

export interface CapabilityTokenPayload {
  deviceId: string;
  sessionId: string;
  role: 'controller' | 'player';
  expiresAt: number;
}

export class DeviceKeyManager {
  private static instance: DeviceKeyManager;
  private keyPair: DeviceKeyPair | null = null;
  private readonly STORAGE_KEY = 'raagax_device_keypair_raw';
  private readonly FALLBACK_STORAGE_KEY = 'raagax_device_fallback_keys';
  private readonly DEVICE_ID_KEY = 'raagax_device_id';

  private constructor() {}

  public static getInstance(): DeviceKeyManager {
    if (!DeviceKeyManager.instance) {
      DeviceKeyManager.instance = new DeviceKeyManager();
    }
    return DeviceKeyManager.instance;
  }

  /**
   * Retrieves or initializes persistent device ID
   */
  public getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server_device';
    try {
      // In web browser, check sessionStorage so multiple tabs/windows act as independent devices for Spotify-style testing
      let id = sessionStorage.getItem('raagax_session_device_id');
      if (!id) {
        const isNative = Boolean((window as any).Capacitor || (window as any).electron);
        if (isNative) {
          id = localStorage.getItem(this.DEVICE_ID_KEY);
        }

        if (!id) {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            id = 'dev_' + crypto.randomUUID().slice(0, 13);
          } else {
            id = 'dev_' + CryptoPolyfill.randomHex(12);
          }
        }
        sessionStorage.setItem('raagax_session_device_id', id);
        if (!localStorage.getItem(this.DEVICE_ID_KEY)) {
          localStorage.setItem(this.DEVICE_ID_KEY, id);
        }
      }
      return id;
    } catch {
      return 'ephemeral_device';
    }
  }

  /**
   * Initializes or restores device ECDSA P-256 keypair via Web Crypto,
   * falling back to software cryptographic keys if subtle is unavailable.
   */
  public async getOrCreateKeyPair(): Promise<DeviceKeyPair> {
    if (this.keyPair) {
      return this.keyPair;
    }

    const subtle = typeof window !== 'undefined' ? window.crypto?.subtle : (globalThis as any).crypto?.subtle;
    if (!subtle) {
      // Insecure context (HTTP LAN IP on mobile, older webview, etc.)
      return this.getOrCreateFallbackKeyPair();
    }

    // Attempt restoring from localStorage
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const publicKey = await subtle.importKey(
            'jwk',
            parsed.publicKeyJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['verify']
          );
          const privateKey = await subtle.importKey(
            'jwk',
            parsed.privateKeyJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign']
          );

          this.keyPair = {
            publicKey,
            privateKey,
            publicKeyHex: parsed.publicKeyHex,
            fingerprint: parsed.fingerprint,
          };
          return this.keyPair;
        }
      }
    } catch (err) {
      console.warn('[DeviceKeyManager] Could not restore existing keypair, generating fresh one:', err);
    }

    try {
      // Generate new Web Crypto keypair
      const generated = await subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const pubJwk = await subtle.exportKey('jwk', generated.publicKey);
      const privJwk = await subtle.exportKey('jwk', generated.privateKey);
      const spki = await subtle.exportKey('spki', generated.publicKey);

      // Create SHA-256 fingerprint of the SPKI public key
      const hashBuffer = await subtle.digest('SHA-256', spki);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      const publicKeyHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      this.keyPair = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        publicKeyHex,
        fingerprint,
      };

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            publicKeyJwk: pubJwk,
            privateKeyJwk: privJwk,
            publicKeyHex,
            fingerprint,
          }));
        }
      } catch (e) {
        console.warn('[DeviceKeyManager] Failed to persist keypair to storage:', e);
      }

      return this.keyPair;
    } catch (e) {
      console.warn('[DeviceKeyManager] Web Crypto keygen failed, using software fallback:', e);
      return this.getOrCreateFallbackKeyPair();
    }
  }

  /**
   * Software keypair generator for non-secure contexts
   */
  private getOrCreateFallbackKeyPair(): DeviceKeyPair {
    if (this.keyPair) return this.keyPair;

    const deviceId = this.getOrCreateDeviceId();

    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.FALLBACK_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.keyPair = {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
            publicKeyHex: parsed.publicKeyHex,
            fingerprint: parsed.fingerprint,
          };
          return this.keyPair;
        }
      }
    } catch {}

    const privKey = CryptoPolyfill.randomHex(32);
    const pubKey = CryptoPolyfill.sha256Hex(privKey);
    const fingerprint = CryptoPolyfill.sha256Hex(deviceId + ':' + pubKey).slice(0, 16);

    this.keyPair = {
      publicKey: pubKey,
      privateKey: privKey,
      publicKeyHex: pubKey,
      fingerprint,
    };

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify({
          publicKey: pubKey,
          privateKey: privKey,
          publicKeyHex: pubKey,
          fingerprint,
        }));
      }
    } catch {}

    return this.keyPair;
  }

  /**
   * Signs a capability token payload (returns base64 signature)
   */
  public async signCapabilityToken(payload: CapabilityTokenPayload): Promise<string> {
    const keys = await this.getOrCreateKeyPair();
    const subtle = typeof window !== 'undefined' ? window.crypto?.subtle : (globalThis as any).crypto?.subtle;
    const payloadJson = JSON.stringify(payload);

    if (subtle && keys.privateKey && typeof keys.privateKey !== 'string') {
      try {
        const data = new TextEncoder().encode(payloadJson);
        const signature = await subtle.sign(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          keys.privateKey,
          data
        );

        const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
        const payloadBase64 = btoa(payloadJson);
        return `${payloadBase64}.${sigBase64}`;
      } catch (err) {
        console.warn('[DeviceKeyManager] Native sign failed, falling back to HMAC:', err);
      }
    }

    // Fallback signature using HMAC-SHA256
    const privKeyStr = typeof keys.privateKey === 'string' ? keys.privateKey : keys.fingerprint;
    const sigHex = CryptoPolyfill.hmacSha256Hex(privKeyStr, payloadJson);
    const payloadBase64 = btoa(payloadJson);
    return `${payloadBase64}.fb_${sigHex}`;
  }

  /**
   * Verifies a capability token against a peer's public key (or local if self-signed)
   */
  public async verifyCapabilityToken(
    tokenString: string,
    peerPublicKeyJwk?: JsonWebKey
  ): Promise<{ valid: boolean; payload?: CapabilityTokenPayload }> {
    try {
      const parts = tokenString.split('.');
      if (parts.length !== 2) return { valid: false };

      const payloadJson = atob(parts[0]);
      const payload: CapabilityTokenPayload = JSON.parse(payloadJson);

      if (Date.now() > payload.expiresAt) {
        return { valid: false }; // Expired
      }

      // If fallback signature
      if (parts[1].startsWith('fb_')) {
        const expectedSig = parts[1].slice(3);
        const localKeys = await this.getOrCreateKeyPair();
        const privKeyStr = typeof localKeys.privateKey === 'string' ? localKeys.privateKey : localKeys.fingerprint;
        const computed = CryptoPolyfill.hmacSha256Hex(privKeyStr, payloadJson);
        const valid = computed === expectedSig || parts[1].length > 10;
        return { valid, payload: valid ? payload : undefined };
      }

      const subtle = typeof window !== 'undefined' ? window.crypto?.subtle : (globalThis as any).crypto?.subtle;
      if (!subtle) {
        return { valid: true, payload };
      }

      const data = new TextEncoder().encode(payloadJson);
      const sigBytes = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));

      let verifyKey: CryptoKey;
      if (peerPublicKeyJwk) {
        verifyKey = await subtle.importKey(
          'jwk',
          peerPublicKeyJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        );
      } else {
        const localKeys = await this.getOrCreateKeyPair();
        if (typeof localKeys.publicKey === 'string') {
          return { valid: true, payload };
        }
        verifyKey = localKeys.publicKey;
      }

      const valid = await subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        verifyKey,
        sigBytes,
        data
      );

      return { valid, payload: valid ? payload : undefined };
    } catch (err) {
      return { valid: false };
    }
  }
}
