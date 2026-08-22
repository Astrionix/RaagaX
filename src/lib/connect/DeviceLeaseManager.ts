import { supabase } from '@/lib/supabase';
import { usePlayerStore, isOfflineMode } from '@/context/usePlayerStore';
import { CommandSequencer } from './CommandSequencer';

export class DeviceLeaseManager {
  private static instance: DeviceLeaseManager;
  private leaseInterval: NodeJS.Timeout | null = null;
  private currentLeaseToken: string | null = null;
  private currentLeaseVersion: number = 0;
  private leaseExpiresAt: number = 0;

  private constructor() {}

  public static getInstance(): DeviceLeaseManager {
    if (!DeviceLeaseManager.instance) {
      DeviceLeaseManager.instance = new DeviceLeaseManager();
    }
    return DeviceLeaseManager.instance;
  }

  public async acquireLease(sessionId: string, forceTakeover: boolean = false): Promise<boolean> {
    const store = usePlayerStore.getState();
    const deviceId = store.deviceId;
    const instanceId = store.deviceInstanceId;
    const authRes = await supabase.auth.getSession();
    const session = authRes?.data?.session;
    const leaseToken = crypto.randomUUID();
    const expiresAtMs = Date.now() + 60000;
    const expiresAt = new Date(expiresAtMs).toISOString();

    if (isOfflineMode()) {
      this.currentLeaseToken = leaseToken;
      this.currentLeaseVersion = (this.currentLeaseVersion || 0) + 1;
      this.leaseExpiresAt = expiresAtMs;
      usePlayerStore.setState({ isActiveDevice: true, activeDeviceId: deviceId });
      console.log('[DeviceLeaseManager] Local lease adopted for session (OFFLINE mode)');
      return true;
    }

    if (!session?.user) {
      this.currentLeaseToken = leaseToken;
      this.currentLeaseVersion = (this.currentLeaseVersion || 0) + 1;
      this.leaseExpiresAt = expiresAtMs;
      usePlayerStore.setState({ isActiveDevice: true, activeDeviceId: deviceId });
      console.log('[DeviceLeaseManager] Local lease adopted for session (unauthenticated/guest mode)');
      return true;
    }

    try {
      const { data, error } = await supabase.rpc('claim_playback_lease', {
        p_session_id: sessionId,
        p_device_id: deviceId,
        p_instance_id: instanceId,
        p_lease_token: leaseToken,
        p_expires_at: expiresAt,
        p_force_takeover: forceTakeover
      });

      if (error) throw error;

      if (data && data.success) {
        this.currentLeaseToken = leaseToken;
        this.currentLeaseVersion = data.lease_version;
        this.leaseExpiresAt = expiresAtMs;
        CommandSequencer.getInstance().setEpoch(data.epoch);
        
        this.startLeaseRenewal(sessionId);
        console.log(`[DeviceLeaseManager] Acquired lease! Epoch ${data.epoch}, Version ${this.currentLeaseVersion}`);
        
        usePlayerStore.setState({ isActiveDevice: true, activeDeviceId: deviceId });
        return true;
      } else {
        console.warn(`[DeviceLeaseManager] Lease acquisition fallback: ${data?.error}`);
        this.currentLeaseToken = leaseToken;
        this.leaseExpiresAt = expiresAtMs;
        usePlayerStore.setState({ isActiveDevice: true, activeDeviceId: deviceId });
        return true;
      }
    } catch (e) {
      console.warn('[DeviceLeaseManager] Lease RPC fallback to local authority:', e);
      this.currentLeaseToken = leaseToken;
      this.leaseExpiresAt = expiresAtMs;
      usePlayerStore.setState({ isActiveDevice: true, activeDeviceId: deviceId });
      return true;
    }
  }

  public async checkLeaseValid(sessionId: string): Promise<boolean> {
    if (!this.currentLeaseToken) return false;
    if (Date.now() >= this.leaseExpiresAt) return false;

    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return false;

    return true;
  }

  public getLeaseToken(): string | null {
    return this.currentLeaseToken;
  }

  private startLeaseRenewal(sessionId: string) {
    if (this.leaseInterval) clearInterval(this.leaseInterval);
    
    let consecutiveFailures = 0;
 
    // Renew every 25s for 60s lease window
    this.leaseInterval = setInterval(async () => {
      if (!this.currentLeaseToken) {
        clearInterval(this.leaseInterval!);
        return;
      }

      if (isOfflineMode()) {
        this.leaseExpiresAt = Date.now() + 60000;
        consecutiveFailures = 0;
        return;
      }
 
      const store = usePlayerStore.getState();
      if (!store.isActiveDevice || store.connectedDeviceId) {
        this.currentLeaseToken = null;
        this.leaseExpiresAt = 0;
        clearInterval(this.leaseInterval!);
        this.leaseInterval = null;
        return;
      }

      const expiresAtMs = Date.now() + 60000;
      const expiresAt = new Date(expiresAtMs).toISOString();
 
      try {
        const { data, error } = await supabase.rpc('claim_playback_lease', {
          p_session_id: sessionId,
          p_device_id: store.deviceId,
          p_instance_id: store.deviceInstanceId,
          p_lease_token: this.currentLeaseToken,
          p_expires_at: expiresAt,
          p_force_takeover: false
        });
          
        if (error) throw error;
 
        if (data && data.success) {
           this.currentLeaseVersion = data.lease_version;
           this.leaseExpiresAt = expiresAtMs;
           consecutiveFailures = 0;
        } else {
           throw new Error(data?.error || 'lease_denied');
        }
      } catch (e) {
        // If we're offline when the renewal fails, don't count it against us —
        // refresh the lease locally and reset the failure counter.
        if (isOfflineMode()) {
          this.leaseExpiresAt = Date.now() + 60000;
          consecutiveFailures = 0;
          console.log('[DeviceLeaseManager] Renewal failed while OFFLINE — refreshed local lease, ownership retained.');
          return;
        }

        consecutiveFailures++;
        console.warn(`[DeviceLeaseManager] Lease renewal attempt ${consecutiveFailures} failed:`, e);
 
        // Retry once after 5s before losing lease (lease is 60s total)
        if (consecutiveFailures < 3) {
          setTimeout(async () => {
             if (!this.currentLeaseToken) return;
             // Don't lose ownership if we've gone offline during the retry window
             if (isOfflineMode()) {
               this.leaseExpiresAt = Date.now() + 60000;
               consecutiveFailures = 0;
               console.log('[DeviceLeaseManager] Retry skipped (OFFLINE) — local lease refreshed, ownership retained.');
               return;
             }
             try {
               const retryStore = usePlayerStore.getState();
               const retryExpires = new Date(Date.now() + 60000).toISOString();
               const { data } = await supabase.rpc('claim_playback_lease', {
                 p_session_id: sessionId,
                 p_device_id: retryStore.deviceId,
                 p_instance_id: retryStore.deviceInstanceId,
                 p_lease_token: this.currentLeaseToken,
                 p_expires_at: retryExpires,
                 p_force_takeover: false
               });
               if (data && data.success) {
                 this.currentLeaseVersion = data.lease_version;
                 this.leaseExpiresAt = Date.now() + 60000;
                 consecutiveFailures = 0;
               }
             } catch {}
          }, 5000);
        } else {
          // Last guard: never lose ownership if we're offline — the failures
          // are network errors, not actual lease conflicts.
          if (isOfflineMode()) {
            this.leaseExpiresAt = Date.now() + 60000;
            consecutiveFailures = 0;
            console.log('[DeviceLeaseManager] Repeated failures but OFFLINE — local lease refreshed, ownership retained.');
            return;
          }
          console.error('[DeviceLeaseManager] Lease renewal failed repeatedly, losing ownership.');
          this.currentLeaseToken = null;
          this.leaseExpiresAt = 0;
          clearInterval(this.leaseInterval!);
          usePlayerStore.setState({ isActiveDevice: false });
        }
      }
    }, 25000);
  }
 
  public async releaseLease(sessionId?: string): Promise<void> {
    if (this.leaseInterval) {
      clearInterval(this.leaseInterval);
      this.leaseInterval = null;
    }
    const token = this.currentLeaseToken;
    this.currentLeaseToken = null;
    this.currentLeaseVersion = 0;
    this.leaseExpiresAt = 0;
 
    if (!token) return;

    if (isOfflineMode()) {
      return;
    }

    try {
      const store = usePlayerStore.getState();
      const sId = sessionId || (await import('./ConnectManager')).ConnectManager.getInstance().getSessionId();
      if (sId) {
        try {
          await supabase.rpc('release_playback_lease', {
            p_session_id: sId,
            p_device_id: store.deviceId,
            p_lease_token: token
          });
        } catch {
          // Optional server RPC, safe to ignore if not defined
        }
      }
    } catch {}
  }
}
