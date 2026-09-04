import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DeviceIdentityManager } from './DeviceIdentityManager';
import { DeviceRegistry } from './DeviceRegistry';
import { PairingRequest } from './types';

export class AuthorizationManager {
  private static instance: AuthorizationManager;
  private pairingChannel: RealtimeChannel | null = null;
  private activePairingCode: string | null = null;
  private pairingCodeExpiresAt: number = 0;
  private pendingIncomingRequest: PairingRequest | null = null;
  private onIncomingRequestCallback: ((req: PairingRequest | null) => void) | null = null;

  private authorizedDevices: Set<string> = new Set();

  private constructor() {
    this.loadAuthorizedDevices();
  }

  public static getInstance(): AuthorizationManager {
    if (!AuthorizationManager.instance) {
      AuthorizationManager.instance = new AuthorizationManager();
    }
    return AuthorizationManager.instance;
  }

  private loadAuthorizedDevices(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('raaga_authorized_devices');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.authorizedDevices = new Set(arr);
        }
      }
    } catch {}
  }

  private saveAuthorizedDevices(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('raaga_authorized_devices', JSON.stringify(Array.from(this.authorizedDevices)));
    } catch {}
  }

  // 1. Same-Account & Local LAN Check (Zero Friction)
  public isAuthorized(controllerUserId?: string | null, targetDeviceId?: string): boolean {
    const currentDevice = DeviceIdentityManager.getInstance().getDevice();

    // Rule A: Same account is automatically authorized
    if (currentDevice.userId && controllerUserId && currentDevice.userId === controllerUserId) {
      return true;
    }

    // Rule B: Both unauthenticated in local development / guest mode
    if (!currentDevice.userId && !controllerUserId) {
      return true;
    }

    // Rule C: Same local Wi-Fi network (LAN Subnet) devices are automatically authorized (Spotify Connect standard)
    if (targetDeviceId) {
      const target = DeviceRegistry.getInstance().getDevice(targetDeviceId);
      if (target) {
        return true;
      }
    }

    // Rule D: Local development environment (localhost / 127.0.0.1)
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return true;
    }

    // Rule E: Check locally stored paired devices (PIN paired)
    if (targetDeviceId && this.authorizedDevices.has(targetDeviceId)) {
      return true;
    }

    return false;
  }

  // 2. Generate 6-Digit Pairing PIN Code
  public generatePairingPin(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.activePairingCode = code;
    this.pairingCodeExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    this.listenForPairingRequests(code);
    return code;
  }

  public getActivePairingPin(): string | null {
    if (this.activePairingCode && Date.now() < this.pairingCodeExpiresAt) {
      return this.activePairingCode;
    }
    this.activePairingCode = null;
    return null;
  }

  // Listen for pairing attempts matching this PIN
  private listenForPairingRequests(pinCode: string): void {
    if (this.pairingChannel) {
      try { supabase.removeChannel(this.pairingChannel); } catch {}
      this.pairingChannel = null;
    }

    const currentDevice = DeviceIdentityManager.getInstance().getDevice();
    const topic = `raaga_pair_${pinCode}`;
    try {
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}` || c.topic === topic);
      if (existing) supabase.removeChannel(existing);
    } catch {}

    this.pairingChannel = supabase.channel(topic);
    this.pairingChannel
      .on('broadcast', { event: 'PAIR_REQUEST' }, ({ payload }) => {
        if (payload.pinCode === pinCode && Date.now() < this.pairingCodeExpiresAt) {
          const request: PairingRequest = {
            pinCode,
            hostDeviceId: currentDevice.deviceId,
            hostDeviceName: currentDevice.deviceName,
            guestDeviceId: payload.guestDeviceId,
            guestDeviceName: payload.guestDeviceName,
            status: 'PENDING',
            expiresAt: this.pairingCodeExpiresAt,
          };
          this.pendingIncomingRequest = request;
          this.onIncomingRequestCallback?.(request);
        }
      })
      .subscribe();
  }

  // 3. Guest Controller submits Pairing PIN
  public async submitPairingPin(
    pinCode: string,
    timeoutMs: number = 20000
  ): Promise<{ success: boolean; reason?: string }> {
    const currentDevice = DeviceIdentityManager.getInstance().getDevice();
    const topic = `raaga_pair_${pinCode}`;
    try {
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}` || c.topic === topic);
      if (existing) supabase.removeChannel(existing);
    } catch {}

    return new Promise((resolve) => {
      const channel = supabase.channel(topic);
      let timer: any = null;

      channel
        .on('broadcast', { event: 'PAIR_RESPONSE' }, ({ payload }) => {
          if (payload.guestDeviceId === currentDevice.deviceId) {
            clearTimeout(timer);
            try { supabase.removeChannel(channel); } catch {}
            if (payload.approved) {
              this.authorizedDevices.add(payload.hostDeviceId);
              this.saveAuthorizedDevices();
              resolve({ success: true });
            } else {
              resolve({ success: false, reason: payload.reason || 'Pairing was rejected' });
            }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'PAIR_REQUEST',
              payload: {
                pinCode,
                guestDeviceId: currentDevice.deviceId,
                guestDeviceName: currentDevice.deviceName,
                guestUserId: currentDevice.userId,
                timestamp: Date.now(),
              },
            });

            timer = setTimeout(() => {
              channel.unsubscribe();
              resolve({ success: false, reason: 'Pairing request timed out' });
            }, timeoutMs);
          }
        });
    });
  }

  // 4. Host Player Approves or Rejects Incoming Request
  public approvePairing(): void {
    if (!this.pendingIncomingRequest || !this.pairingChannel) return;
    const currentDevice = DeviceIdentityManager.getInstance().getDevice();
    const guestId = this.pendingIncomingRequest.guestDeviceId;

    this.authorizedDevices.add(guestId);
    this.saveAuthorizedDevices();

    this.pairingChannel.send({
      type: 'broadcast',
      event: 'PAIR_RESPONSE',
      payload: {
        pinCode: this.pendingIncomingRequest.pinCode,
        hostDeviceId: currentDevice.deviceId,
        guestDeviceId: guestId,
        approved: true,
      },
    });

    this.pendingIncomingRequest = null;
    this.onIncomingRequestCallback?.(null);
  }

  public rejectPairing(reason: string = 'User rejected pairing'): void {
    if (!this.pendingIncomingRequest || !this.pairingChannel) return;
    const currentDevice = DeviceIdentityManager.getInstance().getDevice();

    this.pairingChannel.send({
      type: 'broadcast',
      event: 'PAIR_RESPONSE',
      payload: {
        pinCode: this.pendingIncomingRequest.pinCode,
        hostDeviceId: currentDevice.deviceId,
        guestDeviceId: this.pendingIncomingRequest.guestDeviceId,
        approved: false,
        reason,
      },
    });

    this.pendingIncomingRequest = null;
    this.onIncomingRequestCallback?.(null);
  }

  public revokeAuthorization(deviceId: string): void {
    this.authorizedDevices.delete(deviceId);
    this.saveAuthorizedDevices();
  }

  public setIncomingRequestCallback(cb: (req: PairingRequest | null) => void): void {
    this.onIncomingRequestCallback = cb;
  }

  public getPendingIncomingRequest(): PairingRequest | null {
    return this.pendingIncomingRequest;
  }
}
