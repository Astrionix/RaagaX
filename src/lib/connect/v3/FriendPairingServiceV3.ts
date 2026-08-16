'use client';

import { FriendPairingSessionV3 } from './types';

export class FriendPairingServiceV3 {
  private static instance: FriendPairingServiceV3;
  private activeSessions = new Map<string, FriendPairingSessionV3>();
  private listeners = new Set<(session: FriendPairingSessionV3) => void>();

  private constructor() {}

  public static getInstance(): FriendPairingServiceV3 {
    if (!FriendPairingServiceV3.instance) {
      FriendPairingServiceV3.instance = new FriendPairingServiceV3();
    }
    return FriendPairingServiceV3.instance;
  }

  /**
   * Generates a 6-digit verification code pairing session (Phase 10)
   */
  public createPairingRequest(
    sourceDeviceId: string,
    sourceDeviceName: string,
    targetDeviceId: string,
    sourceAccountId?: string
  ): FriendPairingSessionV3 {
    const rawNum = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCode = `${rawNum.substring(0, 3)} ${rawNum.substring(3, 6)}`;

    const session: FriendPairingSessionV3 = {
      pairingId: 'pair_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      sourceDeviceId,
      sourceDeviceName,
      sourceAccountId,
      targetDeviceId,
      verificationCode,
      status: 'PENDING',
      permittedCapabilities: ['PLAYBACK_CONTROL', 'QUEUE_CONTROL', 'PLAYBACK_TRANSFER'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000, // 60s expiration
    };

    this.activeSessions.set(session.pairingId, session);
    this.notify(session);
    return session;
  }

  public acceptPairing(pairingId: string): boolean {
    const session = this.activeSessions.get(pairingId);
    if (!session || Date.now() > session.expiresAt) return false;

    session.status = 'ACCEPTED';
    this.notify(session);
    return true;
  }

  public declinePairing(pairingId: string): boolean {
    const session = this.activeSessions.get(pairingId);
    if (!session) return false;

    session.status = 'DECLINED';
    this.notify(session);
    this.activeSessions.delete(pairingId);
    return true;
  }

  public subscribe(listener: (session: FriendPairingSessionV3) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(session: FriendPairingSessionV3) {
    this.listeners.forEach(fn => {
      try { fn(session); } catch {}
    });
  }
}
