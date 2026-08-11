import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';

export class DeviceRegistry {
  private static instance: DeviceRegistry;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): DeviceRegistry {
    if (!DeviceRegistry.instance) {
      DeviceRegistry.instance = new DeviceRegistry();
    }
    return DeviceRegistry.instance;
  }

  public async registerDevice(deviceName: string, type: string, platform: string, capabilities: any): Promise<void> {
    const store = usePlayerStore.getState();
    const deviceId = store.deviceId;
    
    // Check if logged in (user_id is needed by RLS)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      await supabase.from('devices').upsert({
        user_id: session.user.id,
        device_id: deviceId,
        name: deviceName,
        type,
        platform,
        capabilities,
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id, device_id' });
      
      this.startAdaptiveHeartbeat();
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to register device:', e);
    }
  }

  private startAdaptiveHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    // Adaptive heartbeat: check active renderer vs controller status periodically
    this.heartbeatInterval = setInterval(async () => {
      const store = usePlayerStore.getState();
      const isActive = store.isActiveDevice;
      
      // If active renderer, heartbeat every 30s. If controller, every 120s. 
      // We skip if we just shouldn't heartbeat. (For simple interval logic, we just do it every 60s for now)
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        await supabase.from('devices')
          .update({ last_seen: new Date().toISOString() })
          .match({ user_id: session.user.id, device_id: store.deviceId });
      } catch (e) {
        console.warn('[DeviceRegistry] Heartbeat failed:', e);
      }
    }, 60000); // 60 seconds
  }
}
