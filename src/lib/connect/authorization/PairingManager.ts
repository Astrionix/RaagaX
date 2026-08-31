/**
 * RaagaX Connect — Pairing Manager
 *
 * Manages device pairing requests, pairing codes, and approval workflows
 * for guest devices on the same Wi-Fi network.
 */

export interface PairingRequest {
  requestId: string;
  controllerDeviceId: string;
  controllerDeviceName: string;
  targetDeviceId: string;
  pairingCode?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  createdAt: number;
}

export class PairingManager {
  private static instance: PairingManager;
  private pairedPairs: Set<string> = new Set(); // Key: `${controllerId}:${targetId}`
  private pendingRequests: Map<string, PairingRequest> = new Map();

  private constructor() {}

  public static getInstance(): PairingManager {
    if (!PairingManager.instance) {
      PairingManager.instance = new PairingManager();
    }
    return PairingManager.instance;
  }

  private makeKey(controllerId: string, targetId: string): string {
    return `${controllerId}:${targetId}`;
  }

  public requestPairing(controllerId: string, controllerName: string, targetId: string, code?: string): PairingRequest {
    const requestId = `pair_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const req: PairingRequest = {
      requestId,
      controllerDeviceId: controllerId,
      controllerDeviceName: controllerName,
      targetDeviceId: targetId,
      pairingCode: code,
      status: 'PENDING',
      createdAt: Date.now(),
    };
    this.pendingRequests.set(requestId, req);
    return req;
  }

  public approvePairing(controllerId: string, targetId: string): void {
    this.pairedPairs.add(this.makeKey(controllerId, targetId));
    // Clean up pending requests
    for (const [id, req] of this.pendingRequests.entries()) {
      if (req.controllerDeviceId === controllerId && req.targetDeviceId === targetId) {
        req.status = 'APPROVED';
        this.pendingRequests.delete(id);
      }
    }
  }

  public denyPairing(controllerId: string, targetId: string): void {
    this.pairedPairs.delete(this.makeKey(controllerId, targetId));
    for (const [id, req] of this.pendingRequests.entries()) {
      if (req.controllerDeviceId === controllerId && req.targetDeviceId === targetId) {
        req.status = 'DENIED';
        this.pendingRequests.delete(id);
      }
    }
  }

  public isPaired(controllerId: string, targetId: string): boolean {
    return this.pairedPairs.has(this.makeKey(controllerId, targetId));
  }

  public unpair(controllerId: string, targetId: string): void {
    this.pairedPairs.delete(this.makeKey(controllerId, targetId));
  }

  public getPendingRequestsForTarget(targetId: string): PairingRequest[] {
    const list: PairingRequest[] = [];
    const now = Date.now();
    for (const [id, req] of this.pendingRequests.entries()) {
      if (now - req.createdAt > 60000) {
        this.pendingRequests.delete(id);
        continue;
      }
      if (req.targetDeviceId === targetId && req.status === 'PENDING') {
        list.push(req);
      }
    }
    return list;
  }
}
