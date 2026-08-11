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

  public getOrCreateDeviceInstanceId(): string {
    if (typeof window === 'undefined') return 'server_instance';
    let instanceId = sessionStorage.getItem('raagax_device_instance_id');
    if (!instanceId) {
      instanceId = 'inst_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('raagax_device_instance_id', instanceId);
      localStorage.setItem('raagax_device_instance_id', instanceId);
    }
    return instanceId;
  }

  /**
   * Gets the canonical playback session for a user, creating one if it doesn't exist.
   * This is the single source of truth for session bootstrap.
   */
  public async createOrJoinSession(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_playback_session', {
        p_user_id: userId
      });

      if (error) throw error;
      return data as string;
    } catch (e) {
      console.error('[DeviceRegistry] Failed to create/join session:', e);
      // Fallback: use a local session ID so offline/guest mode still works
      const fallback = localStorage.getItem('raagax_fallback_session') ||
        'local_sess_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('raagax_fallback_session', fallback);
      return fallback;
    }
  }

  public async registerDevice(deviceName: string, type: string, platform: string, capabilities: any): Promise<void> {
    const store = usePlayerStore.getState();
    const deviceId = store.deviceId;
    
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
    
    this.heartbeatInterval = setInterval(async () => {
      const store = usePlayerStore.getState();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        await supabase.from('devices')
          .update({ last_seen: new Date().toISOString() })
          .match({ user_id: session.user.id, device_id: store.deviceId });
      } catch (e) {
        console.warn('[DeviceRegistry] Heartbeat failed:', e);
      }
    }, 60000);
  }
}
