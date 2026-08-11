import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandSequencer } from './CommandSequencer';

export class DeviceLeaseManager {
  private static instance: DeviceLeaseManager;
  private leaseInterval: NodeJS.Timeout | null = null;
  private currentLeaseToken: string | null = null;
  private currentLeaseVersion: number = 0;

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const leaseToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60s lease

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
        CommandSequencer.getInstance().setEpoch(data.epoch);
        
        this.startLeaseRenewal(sessionId);
        console.log(`[DeviceLeaseManager] Acquired lease! Epoch ${data.epoch}, Version ${this.currentLeaseVersion}`);
        
        usePlayerStore.setState({ isActiveDevice: true });
        return true;
      } else {
        console.warn(`[DeviceLeaseManager] Lease acquisition denied: ${data?.error}`);
        return false;
      }
    } catch (e) {
      console.error('[DeviceLeaseManager] Failed to acquire lease:', e);
      return false;
    }
  }

  public async checkLeaseValid(sessionId: string): Promise<boolean> {
    if (!this.currentLeaseToken) return false;
    
    // Most validation occurs on the epoch/sequence during command execution.
    // The lease interval ensures this token expires server-side if network drops.
    return true;
  }

  private startLeaseRenewal(sessionId: string) {
    if (this.leaseInterval) clearInterval(this.leaseInterval);
    
    // Renew every 30s
    this.leaseInterval = setInterval(async () => {
      if (!this.currentLeaseToken) {
        clearInterval(this.leaseInterval!);
        return;
      }

      // Essentially renewing is the same RPC but not forcing takeover.
      const store = usePlayerStore.getState();
      const expiresAt = new Date(Date.now() + 60000).toISOString();

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
        } else {
           throw new Error(data?.error || 'lease_denied');
        }
      } catch (e) {
        console.warn('[DeviceLeaseManager] Lease renewal failed, losing ownership.', e);
        this.currentLeaseToken = null;
        clearInterval(this.leaseInterval!);
        
        // Note: we DO NOT pause local playback here! We just mark ourselves as non-controller
        // so that if we reconnect later, we fetch snapshot instead of broadcasting stale commands.
        usePlayerStore.setState({ isActiveDevice: false });
      }
    }, 30000);
  }
}
