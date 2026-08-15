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

  public getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server-001';
    let deviceId = localStorage.getItem('raagax_device_id');
    if (!deviceId) {
      const friendly = this.getFriendlyDeviceName();
      const capNative = typeof (window as any).Capacitor?.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform();
      const prefix = capNative ? 'android-apk' : `${friendly.platform.toLowerCase()}-${friendly.type}`;
      const rand = Math.floor(100 + Math.random() * 900);
      deviceId = `${prefix}-${rand}`;
      localStorage.setItem('raagax_device_id', deviceId);
    }
    return deviceId;
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
    if (typeof window === 'undefined') return { name: 'My Device', type: 'desktop', platform: 'server' };

    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
    const isTablet = /Tablet|iPad/i.test(ua);
    const isTV = /TV|SmartTV|GoogleTV|AppleTV/i.test(ua);
    const capNative = typeof (window as any).Capacitor?.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform();

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

    const customName = localStorage.getItem('raagax_custom_device_name') || localStorage.getItem('raagax_device_name');
    if (customName && customName.trim()) {
      return { name: customName.trim(), type, platform };
    }

    // Stable friendly device naming per user requirement (Requirement 13, 14, 15)
    let friendlyName = 'My Laptop';
    if (isTV) {
      friendlyName = 'Living Room TV';
    } else if (isTablet) {
      friendlyName = platform === 'iOS' ? 'iPad' : 'Android Tablet';
    } else if (isMobile || capNative) {
      friendlyName = platform === 'iOS' ? 'iPhone' : 'Android Phone';
    } else if (platform === 'macOS') {
      friendlyName = 'MacBook';
    } else if (platform === 'Windows') {
      friendlyName = 'My Laptop';
    }

    // Persist friendly name once generated
    localStorage.setItem('raagax_device_name', friendlyName);

    return { name: friendlyName, type, platform };
  }

  public async setCustomDeviceName(name: string): Promise<void> {
    if (typeof window === 'undefined' || !name.trim()) return;
    const cleanName = name.trim();
    localStorage.setItem('raagax_custom_device_name', cleanName);
    localStorage.setItem('raagax_device_name', cleanName);

    const store = usePlayerStore.getState();
    const deviceId = store.deviceId;

    // Update in-memory online devices
    const currentOnline = store.onlineDevices || [];
    const updated = currentOnline.map((d: any) => (d.id === deviceId ? { ...d, name: cleanName } : d));
    if (!updated.some((d: any) => d.id === deviceId)) {
      updated.push({ id: deviceId, name: cleanName, platform: 'Web', isOnline: true });
    }
    usePlayerStore.getState().setOnlineDevices(updated);

    // Sync to Supabase devices table if logged in
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from('devices')
          .update({ device_name: cleanName, last_seen: new Date().toISOString() })
          .match({ user_id: session.user.id, device_id: deviceId });
      }
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to sync custom device name to Supabase:', e);
    }
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  public async createOrJoinSession(userId: string): Promise<string | null> {
    if (!userId || !this.isUUID(userId)) {
      const fallback = localStorage.getItem('raagax_fallback_session') ||
        'local_sess_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('raagax_fallback_session', fallback);
      return fallback;
    }

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
    let userId = session?.user?.id;
    if (!userId) {
      userId = typeof window !== 'undefined' ? (localStorage.getItem('raagax_session_id') || 'guest_default') : 'guest_default';
    }

    let targetUserId = userId;
    if (!this.isUUID(userId)) {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash |= 0;
      }
      const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);
      targetUserId = `00000000-0000-4000-8000-${hex}`;
    }

    const friendly = this.getFriendlyDeviceName();
    const name = customName || friendly.name;

    const deviceRecord: DeviceRecord = {
      id: deviceId,
      name,
      type: friendly.type,
      platform: friendly.platform,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      capabilities: {
        audio: true,
        video: friendly.type === 'desktop' || friendly.type === 'tv',
        seek: true,
        volume: true,
        remoteControl: true,
        backgroundPlayback: friendly.type === 'mobile'
      }
    };

    if (session?.user?.id) {
      try {
        const { error } = await supabase.from('devices').upsert({
          user_id: session.user.id,
          device_id: deviceId,
          instance_id: instanceId,
          device_name: name,
          device_type: friendly.type,
          platform: friendly.platform,
          is_online: true,
          capabilities: deviceRecord.capabilities,
          last_seen: deviceRecord.lastSeen
        }, { onConflict: 'device_id' });
        if (error) {
          console.debug('[DeviceRegistry] Devices table upsert skipped:', error.message);
        }
      } catch (e) {
        // Suppress 401/403 network errors
      }
    }

    // Always populate local store device list
    const currentOnline = store.onlineDevices || [];
    if (!currentOnline.some((d: any) => d.id === deviceId)) {
      usePlayerStore.getState().setOnlineDevices([
        ...currentOnline,
        { id: deviceId, name }
      ]);
    }

    this.startAdaptiveHeartbeat();
    await this.fetchAndPublishOnlineDevices(userId);
  }

  /**
   * Subscribes to Supabase Realtime changes on public:devices for the current user.
   */
  public async subscribeToUserDevices(userId: string): Promise<void> {
    if (this.presenceChannel) {
      // Channel is already subscribed and listening for this user
      await this.fetchAndPublishOnlineDevices(userId);
      return;
    }

    const channelName = `user-devices:${userId}`;
    const rawChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
    const channels = Array.isArray(rawChannels) ? rawChannels : [];
    const existing = channels.find((c: any) => c.topic === `realtime:${channelName}` || c.topic === channelName);
    if (existing) {
      try {
        await supabase.removeChannel(existing);
      } catch (e) {}
    }

    let presenceTimeout: NodeJS.Timeout | null = null;
    let lastEventProcessedAt = 0;

    this.presenceChannel = supabase.channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'devices',
        filter: `user_id=eq.${userId}`
      }, (payload: any) => {
        // Distinguish pure heartbeat updates (only last_seen changed) from meaningful presence state changes
        const now = Date.now();
        if (payload?.eventType === 'UPDATE' && payload.new && payload.old) {
          const isOnlyHeartbeat = payload.new.is_online === payload.old.is_online &&
                                  payload.new.device_name === payload.old.device_name &&
                                  payload.new.device_type === payload.old.device_type;
          if (isOnlyHeartbeat && (now - lastEventProcessedAt < 10000)) {
            // Heartbeat update without meaningful change - suppress excessive re-fetch
            return;
          }
        }

        lastEventProcessedAt = now;
        if (presenceTimeout) clearTimeout(presenceTimeout);
        presenceTimeout = setTimeout(() => {
          this.fetchAndPublishOnlineDevices(userId);
        }, 1200);
      })
      .subscribe();

    await this.fetchAndPublishOnlineDevices(userId);
  }

  /**
   * Queries devices for user and filters out stale devices (> 30s last_seen).
   * Updates Zustand store onlineDevices state.
   */
  public async fetchAndPublishOnlineDevices(userId: string): Promise<DeviceRecord[]> {
    if (!userId) return [];
    
    // Ensure userId is valid UUID format for DB query; map non-UUID guest IDs to stable room UUID
    let targetUserId = userId;
    if (!this.isUUID(userId)) {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash |= 0;
      }
      const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);
      targetUserId = `00000000-0000-4000-8000-${hex}`;
    }

    const authRes = await supabase.auth.getSession();
    const session = authRes?.data?.session;
    if (!session?.user) {
      // For unauthenticated guest users, return existing in-memory store devices to avoid 401 REST errors
      const storeDevices = usePlayerStore.getState().onlineDevices || [];
      return storeDevices.map(d => ({
        id: d.id,
        name: d.name,
        type: 'desktop',
        platform: 'Web',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        capabilities: { audio: true, video: false, seek: true, volume: true, remoteControl: true, backgroundPlayback: false }
      }));
    }

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_online', true);

      if (error || !data) {
        const storeDevices = usePlayerStore.getState().onlineDevices || [];
        return storeDevices.map(d => ({
          id: d.id,
          name: d.name,
          type: 'desktop',
          platform: 'Web',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          capabilities: { audio: true, video: false, seek: true, volume: true, remoteControl: true, backgroundPlayback: false }
        }));
      }

      const now = Date.now();
      const STALE_THRESHOLD_MS = 45000; // 45s grace period to avoid flicker

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

      // Update Zustand store only if device list meaningfully changed
      const currentList = usePlayerStore.getState().onlineDevices || [];
      const isListIdentical = currentList.length === activeDevices.length &&
        activeDevices.every((ad, idx) => currentList[idx]?.id === ad.id && currentList[idx]?.name === ad.name);

      if (!isListIdentical) {
        usePlayerStore.getState().setOnlineDevices(activeDevices.map(d => ({ 
          id: d.id, 
          name: d.name,
          platform: d.platform,
          isOnline: d.isOnline 
        })));
      }

      return activeDevices;
    } catch (e) {
      console.warn('[DeviceRegistry] Failed to fetch online devices:', e);
      return [];
    }
  }

  private startAdaptiveHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    // Lightweight heartbeat every 30 seconds to maintain online presence
    this.heartbeatInterval = setInterval(async () => {
      const store = usePlayerStore.getState();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        await supabase.from('devices')
          .update({ last_seen: new Date().toISOString(), is_online: true })
          .match({ user_id: session.user.id, device_id: store.deviceId });
      } catch (e) {
        // Non-critical background heartbeat
      }
    }, 30000);
  }
}
