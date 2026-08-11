import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface DeviceRecord {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tv' | 'tablet';
  platform: string;
  isOnline: boolean;
  lastSeen: string;
  capabilities?: Record<string, any>;
}

export class DeviceRegistry {
  private static instance: DeviceRegistry;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private presenceChannel: RealtimeChannel | null = null;

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
      instanceId = localStorage.getItem('raagax_device_instance_id') ||
        'inst_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('raagax_device_instance_id', instanceId);
      localStorage.setItem('raagax_device_instance_id', instanceId);
    }
    return instanceId;
  }

  public getFriendlyDeviceName(): { name: string; type: 'mobile' | 'desktop' | 'tv' | 'tablet'; platform: string } {
    if (typeof window === 'undefined') return { name: 'RaagaX Server', type: 'desktop', platform: 'server' };

    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
    const isTablet = /Tablet|iPad/i.test(ua);
    const isTV = /TV|SmartTV|GoogleTV|AppleTV/i.test(ua);

    let type: 'mobile' | 'desktop' | 'tv' | 'tablet' = 'desktop';
    if (isTV) type = 'tv';
    else if (isTablet) type = 'tablet';
    else if (isMobile) type = 'mobile';

    let platform = 'Web';
    if (/Windows/i.test(ua)) platform = 'Windows';
    else if (/Macintosh|Mac OS/i.test(ua)) platform = 'macOS';
    else if (/Android/i.test(ua)) platform = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
    else if (/Linux/i.test(ua)) platform = 'Linux';

    let name = `${platform} ${type === 'mobile' ? 'Phone' : type === 'desktop' ? 'PC' : 'Device'}`;
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) name = `${platform} (Chrome)`;
    else if (/Edg/i.test(ua)) name = `${platform} (Edge)`;
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) name = `${platform} (Safari)`;
    else if (/Firefox/i.test(ua)) name = `${platform} (Firefox)`;

    return { name, type, platform };
  }

  public async createOrJoinSession(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_playback_session', {
        p_user_id: userId
      });

      if (error) throw error;
      return data as string;
    } catch (e) {
      console.warn('[DeviceRegistry] Fallback session creation:', e);
      const fallback = localStorage.getItem('raagax_fallback_session') ||
        'local_sess_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('raagax_fallback_session', fallback);
      return fallback;
    }
  }

  public async registerDevice(customName?: string): Promise<void> {
    const store = usePlayerStore.getState();
    const deviceId = store.deviceId;
    const instanceId = this.getOrCreateDeviceInstanceId();
    
    const authRes = await supabase.auth.getSession();
    const session = authRes?.data?.session;
    if (!session?.user) return;

    const friendly = this.getFriendlyDeviceName();
    const name = customName || friendly.name;

    try {
      await supabase.from('devices').upsert({
        user_id: session.user.id,
        device_id: deviceId,
        instance_id: instanceId,
        device_name: name,
        device_type: friendly.type,
        platform: friendly.platform,
        is_online: true,
        capabilities: {
          audio: true,
          video: friendly.type === 'desktop' || friendly.type === 'tv',
          seek: true,
          volume: true,
          remoteControl: true,
          backgroundPlayback: friendly.type === 'mobile'
        },
        last_seen: new Date().toISOString()
      }, { onConflict: 'device_id' });
      
      this.startAdaptiveHeartbeat();
      await this.fetchAndPublishOnlineDevices(session.user.id);
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to register device:', e);
    }
  }

  /**
   * Subscribes to Supabase Realtime changes on public:devices for the current user.
   */
  public async subscribeToUserDevices(userId: string): Promise<void> {
    if (this.presenceChannel) return;

    console.log(`[DeviceRegistry] Subscribing to device presence for user ${userId}`);

    this.presenceChannel = supabase.channel(`user-devices:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'devices',
        filter: `user_id=eq.${userId}`
      }, () => {
        console.log('[DeviceRegistry] Device presence change detected via Realtime');
        this.fetchAndPublishOnlineDevices(userId);
      })
      .subscribe();

    await this.fetchAndPublishOnlineDevices(userId);
  }

  /**
   * Queries devices for user and filters out stale devices (> 30s last_seen).
   * Updates Zustand store onlineDevices state.
   */
  public async fetchAndPublishOnlineDevices(userId: string): Promise<DeviceRecord[]> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_online', true);

      if (error || !data) return [];

      const now = Date.now();
      const STALE_THRESHOLD_MS = 30000;

      const activeDevices: DeviceRecord[] = data
        .filter((d: any) => {
          const lastSeenMs = new Date(d.last_seen).getTime();
          return now - lastSeenMs < STALE_THRESHOLD_MS;
        })
        .map((d: any) => ({
          id: d.device_id,
          name: d.device_name || d.device_id,
          type: d.device_type || 'desktop',
          platform: d.platform || 'Web',
          isOnline: true,
          lastSeen: d.last_seen,
          capabilities: d.capabilities
        }));

      // Update Zustand store so modal automatically rerenders online devices
      usePlayerStore.getState().setOnlineDevices(activeDevices.map(d => ({ id: d.id, name: d.name })));

      return activeDevices;
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to fetch online devices:', e);
      return [];
    }
  }

  private startAdaptiveHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    // Send heartbeat every 15 seconds to maintain accurate online status
    this.heartbeatInterval = setInterval(async () => {
      const store = usePlayerStore.getState();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        await supabase.from('devices')
          .update({ last_seen: new Date().toISOString(), is_online: true })
          .match({ user_id: session.user.id, device_id: store.deviceId });

        await this.fetchAndPublishOnlineDevices(session.user.id);
      } catch (e) {
        console.warn('[DeviceRegistry] Heartbeat failed:', e);
      }
    }, 15000);
  }
}
