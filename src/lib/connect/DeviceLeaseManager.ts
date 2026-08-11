import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandSequencer } from './CommandSequencer';

export class DeviceLeaseManager {
  private static instance: DeviceLeaseManager;
  private leaseInterval: NodeJS.Timeout | null = null;
  private currentLeaseToken: string | null = null;

  private constructor() {}

  public static getInstance(): DeviceLeaseManager {
    if (!DeviceLeaseManager.instance) {
      DeviceLeaseManager.instance = new DeviceLeaseManager();
    }
    return DeviceLeaseManager.instance;
  }

  public async acquireLease(sessionId: string, currentEpoch: number): Promise<boolean> {
    const store = usePlayerStore.getState();
    const deviceId = store.deviceId;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const leaseToken = crypto.randomUUID();
    const newEpoch = currentEpoch + 1; // Increment epoch on transfer
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60s lease

    try {
      const { error } = await supabase.from('device_leases').upsert({
        user_id: session.user.id,
        session_id: sessionId,
        device_id: deviceId,
        lease_token: leaseToken,
        lease_epoch: newEpoch,
        expires_at: expiresAt
      }, { onConflict: 'session_id' });

      if (error) throw error;

      this.currentLeaseToken = leaseToken;
      CommandSequencer.getInstance().setEpoch(newEpoch);
      
      this.startLeaseRenewal(sessionId);
      console.log(`[DeviceLeaseManager] Acquired lease! Epoch ${newEpoch}`);
      return true;
    } catch (e) {
      console.error('[DeviceLeaseManager] Failed to acquire lease:', e);
      return false;
    }
  }

  public async checkLeaseValid(sessionId: string): Promise<boolean> {
    if (!this.currentLeaseToken) return false;
    
    // In a full implementation, you'd verify against DB if critical. 
    // For most operations, relying on CommandValidator epoch rejection is enough.
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

      const store = usePlayerStore.getState();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const expiresAt = new Date(Date.now() + 60000).toISOString();

      try {
        const { error } = await supabase.from('device_leases')
          .update({ expires_at: expiresAt })
          .match({ 
            user_id: session.user.id, 
            session_id: sessionId,
            lease_token: this.currentLeaseToken 
          });
          
        if (error) throw error;
      } catch (e) {
        console.warn('[DeviceLeaseManager] Lease renewal failed, losing ownership.', e);
        this.currentLeaseToken = null;
        clearInterval(this.leaseInterval!);
        // Transition device to non-owner state
        usePlayerStore.setState({ isActiveDevice: false });
      }
    }, 30000);
  }
}
