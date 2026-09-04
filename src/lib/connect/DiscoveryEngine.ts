import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DeviceIdentityManager } from './DeviceIdentityManager';
import { DeviceRegistry } from './DeviceRegistry';
import { DeviceInfo } from './types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { getApiBaseUrl } from '@/lib/config/apiConfig';

function getCleanChannel(topic: string, config?: any): RealtimeChannel {
  const fullTopic = topic.startsWith('realtime:') ? topic : `realtime:${topic}`;
  try {
    const existing = supabase.getChannels().find(
      (c) => c.topic === fullTopic || c.topic === topic
    );
    if (existing) {
      supabase.removeChannel(existing);
    }
  } catch {}
  return supabase.channel(topic, config);
}

export class DiscoveryEngine {
  private static instance: DiscoveryEngine;
  private lanChannel: RealtimeChannel | null = null;
  private cloudChannel: RealtimeChannel | null = null;
  private currentWifiHash: string | null = null;
  private isRunning = false;
  private currentUserId: string | null = null;
  private boundVisibilityHandler: (() => void) | null = null;
  private boundOnlineHandler: (() => void) | null = null;
  private boundUnloadHandler: (() => void) | null = null;
  private beaconRetryTimer: any = null;
  private presenceHeartbeatTimer: any = null;
  private pendingLeaveTimers: Map<string, any> = new Map();

  private onInviteReceivedCallback: ((connId: string, controllerDeviceId: string) => void) | null = null;
  private onInviteAcceptedCallback: ((connId: string, playerDeviceId: string) => void) | null = null;
  private onDisconnectReceivedCallback: (() => void) | null = null;
  private onDirectMessageCallback: ((event: string, data: any) => void) | null = null;

  private constructor() {}

  public static getInstance(): DiscoveryEngine {
    if (!DiscoveryEngine.instance) {
      DiscoveryEngine.instance = new DiscoveryEngine();
    }
    return DiscoveryEngine.instance;
  }

  public setConnectionCallbacks(
    onInvite: (connId: string, controllerDeviceId: string) => void,
    onDisconnect: () => void,
    onInviteAccepted?: (connId: string, playerDeviceId: string) => void
  ): void {
    this.onInviteReceivedCallback = onInvite;
    this.onDisconnectReceivedCallback = onDisconnect;
    if (onInviteAccepted) {
      this.onInviteAcceptedCallback = onInviteAccepted;
    }
  }

  public setInviteAcceptedCallback(cb: (connId: string, playerDeviceId: string) => void): void {
    this.onInviteAcceptedCallback = cb;
  }

  public setDirectMessageCallback(cb: (event: string, data: any) => void): void {
    this.onDirectMessageCallback = cb;
  }

  private safeBroadcast(channel: RealtimeChannel | null, event: string, payload: any): void {
    if (channel && (channel as any).state === 'joined') {
      try {
        channel.send({ type: 'broadcast', event, payload });
      } catch {}
    }
  }

  public sendDirectMessage(targetDeviceId: string, event: string, data: any): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const payload = {
      event,
      data,
      senderDeviceId: self.deviceId,
      targetDeviceId,
      timestamp: Date.now(),
    };
    this.safeBroadcast(this.lanChannel, 'CONNECT_MSG', payload);
    this.safeBroadcast(this.cloudChannel, 'CONNECT_MSG', payload);
  }

  public broadcastInvite(connectionId: string, targetDeviceId: string): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const payload = {
      connectionId,
      targetDeviceId,
      senderDeviceId: self.deviceId,
      timestamp: Date.now(),
    };
    // Send immediate packet + burst retries for resilience over cellular / packet jitter
    this.safeBroadcast(this.lanChannel, 'DEVICE_CONNECT_INVITE', payload);
    this.safeBroadcast(this.cloudChannel, 'DEVICE_CONNECT_INVITE', payload);

    setTimeout(() => {
      this.safeBroadcast(this.lanChannel, 'DEVICE_CONNECT_INVITE', payload);
      this.safeBroadcast(this.cloudChannel, 'DEVICE_CONNECT_INVITE', payload);
    }, 450);

    setTimeout(() => {
      this.safeBroadcast(this.lanChannel, 'DEVICE_CONNECT_INVITE', payload);
      this.safeBroadcast(this.cloudChannel, 'DEVICE_CONNECT_INVITE', payload);
    }, 1100);
  }

  public broadcastInviteAccepted(connectionId: string, controllerDeviceId: string): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const payload = {
      connectionId,
      targetDeviceId: controllerDeviceId,
      senderDeviceId: self.deviceId,
      timestamp: Date.now(),
    };
    this.safeBroadcast(this.lanChannel, 'DEVICE_INVITE_ACCEPTED', payload);
    this.safeBroadcast(this.cloudChannel, 'DEVICE_INVITE_ACCEPTED', payload);
  }

  public broadcastDisconnect(connectionId: string, targetDeviceId: string): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const payload = {
      connectionId,
      targetDeviceId,
      senderDeviceId: self.deviceId,
      timestamp: Date.now(),
    };
    this.safeBroadcast(this.lanChannel, 'DEVICE_DISCONNECT_NOTICE', payload);
    this.safeBroadcast(this.cloudChannel, 'DEVICE_DISCONNECT_NOTICE', payload);
  }

  private getCachedWifiHash(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sim') === 'diff_wifi' || urlParams.get('diff_wifi') === '1') {
        let simHash = sessionStorage.getItem('raaga_sim_wifi_hash');
        if (!simHash) {
          simHash = 'sim_net_' + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem('raaga_sim_wifi_hash', simHash);
        }
        return simHash;
      }
      return sessionStorage.getItem('raaga_wifi_hash') || localStorage.getItem('raaga_wifi_hash');
    } catch {
      return null;
    }
  }

  private setCachedWifiHash(hash: string): void {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sim') === 'diff_wifi' || urlParams.get('diff_wifi') === '1') {
        return;
      }
      sessionStorage.setItem('raaga_wifi_hash', hash);
      localStorage.setItem('raaga_wifi_hash', hash);
    } catch {}
  }

  public async startDiscovery(userId?: string | null): Promise<void> {
    const targetUserId = userId || DeviceIdentityManager.getInstance().getDevice().userId || null;
    if (this.isRunning && this.currentUserId === targetUserId) {
      return;
    }

    this.stopDiscovery();
    this.isRunning = true;
    this.currentUserId = targetUserId;

    const identityMgr = DeviceIdentityManager.getInstance();
    identityMgr.setUserId(targetUserId);
    const self = identityMgr.getDevice();

    // ── Track A: Local LAN Subnet Discovery ──
    const initialHash = this.getCachedWifiHash() || 'local_subnet_mesh';
    this.currentWifiHash = initialHash;
    this.mountLanChannel(initialHash, self);
    this.fetchWifiBeaconNonBlocking(self);

    // ── Track B: Cloud Account Presence Discovery ──
    if (targetUserId) {
      const topic = `raaga_account_${targetUserId}`;
      this.cloudChannel = getCleanChannel(topic, {
        config: { presence: { key: self.deviceId } },
      });

      this.cloudChannel
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync(this.cloudChannel, 'CLOUD', self.deviceId);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          (newPresences || []).forEach((dev: any) => {
            if (dev && dev.deviceId && dev.deviceId !== self.deviceId) {
              if (this.pendingLeaveTimers.has(dev.deviceId)) {
                clearTimeout(this.pendingLeaveTimers.get(dev.deviceId));
                this.pendingLeaveTimers.delete(dev.deviceId);
              }
              DeviceRegistry.getInstance().upsertDevice(dev, 'CLOUD');
            }
          });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          this.handlePresenceLeave(leftPresences);
        })
        .on('broadcast', { event: 'DEVICE_CONNECT_INVITE' }, ({ payload }) => {
          if (payload?.targetDeviceId === self.deviceId && payload?.senderDeviceId !== self.deviceId) {
            this.onInviteReceivedCallback?.(payload.connectionId, payload.senderDeviceId);
          }
        })
        .on('broadcast', { event: 'DEVICE_INVITE_ACCEPTED' }, ({ payload }) => {
          if (payload?.targetDeviceId === self.deviceId && payload?.senderDeviceId !== self.deviceId) {
            this.onInviteAcceptedCallback?.(payload.connectionId, payload.senderDeviceId);
          }
        })
        .on('broadcast', { event: 'DEVICE_DISCONNECT_NOTICE' }, ({ payload }) => {
          if (payload?.targetDeviceId === self.deviceId && payload?.senderDeviceId !== self.deviceId) {
            this.onDisconnectReceivedCallback?.();
          }
        })
        .on('broadcast', { event: 'CONNECT_MSG' }, ({ payload }) => {
          if (
            (payload?.targetDeviceId === '*' ||
             payload?.targetDeviceId === self.deviceId ||
             payload?.data?.playerDeviceId === self.deviceId ||
             payload?.data?.targetDeviceId === self.deviceId) &&
            payload?.senderDeviceId !== self.deviceId
          ) {
            this.onDirectMessageCallback?.(payload.event, payload.data);
          }
        })
        .on('broadcast', { event: 'DEVICE_INFO_UPDATED' }, ({ payload }) => {
          if (payload?.deviceId && payload?.deviceName && payload.deviceId !== self.deviceId) {
            const registry = DeviceRegistry.getInstance();
            const dev = registry.getDevice(payload.deviceId);
            if (dev) {
              registry.upsertDevice({ ...dev, deviceName: payload.deviceName }, 'CLOUD');
            }
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && this.cloudChannel) {
            await this.cloudChannel.track(self);
          }
        });
    }

    // ── Track C: Device Lifecycle Wakeup & Reconnection ──
    this.setupLifecycleListeners();

    // ── Track D: Periodic Cloud Presence Heartbeat (keeps devices online on Account) ──
    if (this.presenceHeartbeatTimer) clearInterval(this.presenceHeartbeatTimer);
    this.presenceHeartbeatTimer = setInterval(() => {
      if (this.isRunning) {
        this.retrackPresence();
      }
    }, 20000);
  }

  private mountLanChannel(wifiHash: string, self: DeviceInfo): void {
    if (this.lanChannel) {
      try { supabase.removeChannel(this.lanChannel); } catch {}
      this.lanChannel = null;
    }

    const topic = `raaga_lan_${wifiHash}`;
    this.lanChannel = getCleanChannel(topic, {
      config: { presence: { key: self.deviceId } },
    });

    this.lanChannel
      .on('presence', { event: 'sync' }, () => {
        this.handlePresenceSync(this.lanChannel, 'LAN', self.deviceId);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        (newPresences || []).forEach((dev: any) => {
          if (dev && dev.deviceId && dev.deviceId !== self.deviceId) {
            if (this.pendingLeaveTimers.has(dev.deviceId)) {
              clearTimeout(this.pendingLeaveTimers.get(dev.deviceId));
              this.pendingLeaveTimers.delete(dev.deviceId);
            }
            DeviceRegistry.getInstance().upsertDevice(dev, 'LAN');
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        this.handlePresenceLeave(leftPresences);
      })
      .on('broadcast', { event: 'DEVICE_CONNECT_INVITE' }, ({ payload }) => {
        if (payload?.targetDeviceId === self.deviceId && payload?.senderDeviceId !== self.deviceId) {
          this.onInviteReceivedCallback?.(payload.connectionId, payload.senderDeviceId);
        }
      })
      .on('broadcast', { event: 'DEVICE_INVITE_ACCEPTED' }, ({ payload }) => {
        if (payload?.targetDeviceId === self.deviceId && payload?.senderDeviceId !== self.deviceId) {
          this.onInviteAcceptedCallback?.(payload.connectionId, payload.senderDeviceId);
        }
      })
      .on('broadcast', { event: 'DEVICE_DISCONNECT_NOTICE' }, ({ payload }) => {
        if (payload?.targetDeviceId === self.deviceId && payload?.senderDeviceId !== self.deviceId) {
          this.onDisconnectReceivedCallback?.();
        }
      })
      .on('broadcast', { event: 'DEVICE_INFO_UPDATED' }, ({ payload }) => {
        if (payload?.deviceId && payload?.deviceName && payload.deviceId !== self.deviceId) {
          const registry = DeviceRegistry.getInstance();
          const dev = registry.getDevice(payload.deviceId);
          if (dev) {
            registry.upsertDevice({ ...dev, deviceName: payload.deviceName }, 'LAN');
          }
        }
      })
      .on('broadcast', { event: 'CONNECT_MSG' }, ({ payload }) => {
        if (
          (payload?.targetDeviceId === '*' ||
           payload?.targetDeviceId === self.deviceId ||
           payload?.data?.playerDeviceId === self.deviceId ||
           payload?.data?.targetDeviceId === self.deviceId) &&
          payload?.senderDeviceId !== self.deviceId
        ) {
          this.onDirectMessageCallback?.(payload.event, payload.data);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && this.lanChannel) {
          await this.lanChannel.track(self);
        }
      });
  }

  private async fetchWifiBeaconNonBlocking(self: DeviceInfo, retriesLeft = 2): Promise<void> {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sim') === 'diff_wifi' || urlParams.get('diff_wifi') === '1') {
        return;
      }
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const beaconUrl = `${getApiBaseUrl()}/api/connect/wifi-beacon`;
      const res = await fetch(beaconUrl, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.wifiHash && data.wifiHash !== this.currentWifiHash) {
          this.currentWifiHash = data.wifiHash;
          this.setCachedWifiHash(data.wifiHash);
          if (this.isRunning) {
            this.mountLanChannel(data.wifiHash, self);
          }
        } else if (data?.wifiHash) {
          this.setCachedWifiHash(data.wifiHash);
        }
      }
    } catch {
      // If Render free tier is waking up from cold boot, retry in background after 10s
      if (retriesLeft > 0 && this.isRunning) {
        if (this.beaconRetryTimer) clearTimeout(this.beaconRetryTimer);
        this.beaconRetryTimer = setTimeout(() => {
          this.fetchWifiBeaconNonBlocking(self, retriesLeft - 1);
        }, 10000);
      }
    }
  }

  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    // Wake up from screen lock / tab switch
    this.boundVisibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isRunning) {
        this.retrackPresence();
      }
    };
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);

    // Reconnected to Wi-Fi / cellular
    this.boundOnlineHandler = () => {
      if (this.isRunning) {
        const self = DeviceIdentityManager.getInstance().getDevice();
        this.fetchWifiBeaconNonBlocking(self, 1);
        this.retrackPresence();
      }
    };
    window.addEventListener('online', this.boundOnlineHandler);

    // Instant presence untrack on tab close / browser exit
    this.boundUnloadHandler = () => {
      try {
        if (this.lanChannel) this.lanChannel.untrack();
        if (this.cloudChannel) this.cloudChannel.untrack();
      } catch {}
    };
    window.addEventListener('pagehide', this.boundUnloadHandler);
    window.addEventListener('beforeunload', this.boundUnloadHandler);
  }

  public async retrackPresence(): Promise<void> {
    const self = DeviceIdentityManager.getInstance().getDevice();
    try {
      if (this.lanChannel) {
        await this.lanChannel.track(self);
      }
      if (this.cloudChannel) {
        await this.cloudChannel.track(self);
      }
    } catch {}
  }

  public async broadcastDeviceRename(newName: string): Promise<void> {
    const self = DeviceIdentityManager.getInstance().getDevice();
    self.deviceName = newName;
    await this.retrackPresence();
    const payload = { deviceId: self.deviceId, deviceName: newName };
    this.safeBroadcast(this.lanChannel, 'DEVICE_INFO_UPDATED', payload);
    this.safeBroadcast(this.cloudChannel, 'DEVICE_INFO_UPDATED', payload);
  }

  public ensureChannelsConnected(): void {
    if (!this.isRunning) return;
    const self = DeviceIdentityManager.getInstance().getDevice();
    const isLanJoined = this.lanChannel && (this.lanChannel as any).state === 'joined';
    if (!isLanJoined) {
      const initialHash = this.currentWifiHash || this.getCachedWifiHash() || 'local_subnet_mesh';
      this.mountLanChannel(initialHash, self);
    }
  }

  private handlePresenceSync(channel: RealtimeChannel | null, source: 'LAN' | 'CLOUD', selfId: string): void {
    if (!channel) return;
    const state = (channel.presenceState() || {}) as Record<string, any[]>;
    const registry = DeviceRegistry.getInstance();

    Object.keys(state).forEach((key) => {
      if (key !== selfId) {
        const payload = state[key]?.[0] as DeviceInfo | undefined;
        if (payload && payload.deviceId) {
          if (this.pendingLeaveTimers.has(payload.deviceId)) {
            clearTimeout(this.pendingLeaveTimers.get(payload.deviceId));
            this.pendingLeaveTimers.delete(payload.deviceId);
          }
          registry.upsertDevice(payload, source);
        }
      }
    });
  }

  private handlePresenceLeave(leftPresences: any[]): void {
    const store = usePlayerStore.getState();
    const self = DeviceIdentityManager.getInstance().getDevice();

    (leftPresences || []).forEach((p) => {
      if (!p || !p.deviceId || p.deviceId === self.deviceId) return;
      const deviceId = p.deviceId;

      // Clear any existing timer for this device
      if (this.pendingLeaveTimers.has(deviceId)) {
        clearTimeout(this.pendingLeaveTimers.get(deviceId));
      }

      // 8-second grace period for cellular network switches & screen lock/unlock blips
      const timer = setTimeout(() => {
        this.pendingLeaveTimers.delete(deviceId);
        const registry = DeviceRegistry.getInstance();
        registry.removeDevice(deviceId);

        const isCurrentSpeaker = deviceId === store.activePlaybackDeviceId;
        const remainingOtherDevices = registry.getAllDevices(self.deviceId);

        if (isCurrentSpeaker || remainingOtherDevices.length === 0) {
          if (!store.isLocalPlayback || store.activePlaybackDeviceId !== self.deviceId) {
            console.log(`[DiscoveryEngine] Remote speaker ${deviceId} confirmed offline after 8s grace period. Auto-restoring local playback.`);
            usePlayerStore.getState().setActivePlaybackDeviceId(self.deviceId);
            usePlayerStore.setState({
              isLocalPlayback: true,
              activePlaybackDeviceId: self.deviceId,
            });
            try {
              localStorage.setItem('raagax_active_playback_device_id', self.deviceId);
            } catch {}
            import('@/lib/connect/ConnectEngine').then(({ connectEngine }) => {
              connectEngine.handleRemoteDisconnect();
            }).catch(() => {});
          }
        }
      }, 8000);

      this.pendingLeaveTimers.set(deviceId, timer);
    });
  }

  public stopDiscovery(): void {
    this.isRunning = false;
    this.currentUserId = null;

    if (this.presenceHeartbeatTimer) {
      clearInterval(this.presenceHeartbeatTimer);
      this.presenceHeartbeatTimer = null;
    }

    for (const timer of this.pendingLeaveTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingLeaveTimers.clear();

    if (this.beaconRetryTimer) {
      clearTimeout(this.beaconRetryTimer);
      this.beaconRetryTimer = null;
    }

    if (typeof window !== 'undefined') {
      if (this.boundVisibilityHandler) {
        document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        this.boundVisibilityHandler = null;
      }
      if (this.boundOnlineHandler) {
        window.removeEventListener('online', this.boundOnlineHandler);
        this.boundOnlineHandler = null;
      }
      if (this.boundUnloadHandler) {
        window.removeEventListener('pagehide', this.boundUnloadHandler);
        window.removeEventListener('beforeunload', this.boundUnloadHandler);
        this.boundUnloadHandler = null;
      }
    }

    if (this.lanChannel) {
      try { supabase.removeChannel(this.lanChannel); } catch {}
      this.lanChannel = null;
    }
    if (this.cloudChannel) {
      try { supabase.removeChannel(this.cloudChannel); } catch {}
      this.cloudChannel = null;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentWifiHash(): string | null {
    return this.currentWifiHash;
  }
}
