import { VerifiedDevice, DeviceReachabilityState, DiscoverySource, DeviceDiscoveryEvent } from './types';
import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceRegistry } from '../DeviceRegistry';
import { DeviceCapabilities } from '../types';

export class DeviceDiscoveryEngine {
  private static instance: DeviceDiscoveryEngine;
  private verifiedDevices = new Map<string, VerifiedDevice>();
  private listeners = new Set<(devices: VerifiedDevice[]) => void>();
  private activeDiscovery = false;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastNetworkState: 'online' | 'offline' = 'online';

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initLifecycleListeners();
    }
  }

  public static getInstance(): DeviceDiscoveryEngine {
    if (!DeviceDiscoveryEngine.instance) {
      DeviceDiscoveryEngine.instance = new DeviceDiscoveryEngine();
    }
    return DeviceDiscoveryEngine.instance;
  }

  /**
   * Initializes network and visibility listeners to optimize discovery and battery
   */
  private initLifecycleListeners() {
    window.addEventListener('online', () => this.handleNetworkChange('online'));
    window.addEventListener('offline', () => this.handleNetworkChange('offline'));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.refreshDiscovery();
      }
    });
  }

  public startDiscovery() {
    if (this.activeDiscovery) return;
    this.activeDiscovery = true;

    console.log('[DeviceDiscoveryEngine] Starting Multi-Layer Discovery Engine...');
    try {
      this.runDiscoveryCycle();
    } catch (err) {
      console.warn('[DeviceDiscoveryEngine] Discovery initial cycle error:', err);
    }

    this.discoveryInterval = setInterval(() => {
      try {
        this.runDiscoveryCycle();
      } catch (err) {
        console.warn('[DeviceDiscoveryEngine] Discovery interval cycle error:', err);
      }
    }, 4000);

    // Heartbeat monitor for stale device cleanup
    this.heartbeatInterval = setInterval(() => {
      try {
        this.pruneStaleDevices();
      } catch (err) {
        console.warn('[DeviceDiscoveryEngine] Prune error:', err);
      }
    }, 5000);
  }

  public stopDiscovery() {
    this.activeDiscovery = false;
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public refreshDiscovery() {
    try {
      this.runDiscoveryCycle();
    } catch (err) {
      console.warn('[DeviceDiscoveryEngine] Refresh discovery error:', err);
    }
  }

  public subscribe(listener: (devices: VerifiedDevice[]) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getRankedDevices());
    } catch (err) {
      console.warn('[DeviceDiscoveryEngine] Initial subscriber notify error:', err);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Multi-Source Discovery Cycle
   */
  public async runDiscoveryCycle() {
    try {
      const store = usePlayerStore.getState();
      const localDeviceId = store.deviceId || DeviceRegistry.getInstance().getOrCreateDeviceId();

      // 1. Ingest Trusted & Local Devices
      this.ingestLocalDevice(localDeviceId);

      // 2. Ingest Cloud Presence from Supabase
      await this.ingestCloudPresence(localDeviceId);

      // 3. Ingest Local LAN mDNS / WebRTC Candidate Layer
      await this.ingestLocalLANDevices(localDeviceId);

      // 4. Ingest Connected Audio Outputs (Bluetooth / System)
      await this.ingestAudioOutputs();

      // 5. Rank and broadcast verified devices
      this.notifyListeners();
    } catch (err) {
      console.warn('[DeviceDiscoveryEngine] Run discovery cycle failed gracefully:', err);
    }
  }

  private ingestLocalDevice(localDeviceId: string) {
    try {
      const store = usePlayerStore.getState();
      const friendly = DeviceRegistry.getInstance().getFriendlyDeviceName();
      const isPlayingLocally = store.isActiveDevice && store.isPlaying;

      const localDevice: VerifiedDevice = {
        deviceId: localDeviceId,
        installationId: DeviceRegistry.getInstance().getOrCreateDeviceInstanceId(),
        name: `${friendly.name || 'My Device'} (This Device)`,
        type: friendly.type || 'desktop',
        platform: (friendly.platform || 'Web') as any,
        appVersion: '2.5.0',
        protocolVersion: 2,
        capabilities: {
          audio: true,
          video: false,
          seek: true,
          volume: true,
          backgroundPlayback: true,
          remoteControl: true,
          offline: true,
          connect: true,
          queue: true,
          transfer: true,
        },
        reachabilityState: isPlayingLocally ? 'CURRENTLY_PLAYING' : 'PLAYBACK_READY',
        discoverySources: new Set(['TRUSTED', 'LAN']),
        isTrusted: true,
        isNearby: true,
        isAudioOutput: false,
        isSameAccount: true,
        accountRelationship: 'SAME_ACCOUNT',
        activePlaybackSong: store.currentSong?.title,
        activePlaybackPositionMs: (store.currentTime || 0) * 1000,
        lastSeenTimestamp: Date.now(),
        verifiedAtTimestamp: Date.now(),
        rankingScore: 1000,
      };

      this.verifiedDevices.set(localDeviceId, localDevice);
    } catch (err) {
      console.warn('[DeviceDiscoveryEngine] ingestLocalDevice error:', err);
    }
  }

  private async ingestCloudPresence(localDeviceId: string) {
    try {
      const store = usePlayerStore.getState();
      const onlineList = store.onlineDevices || [];

      for (const record of onlineList) {
        if (!record || record.id === localDeviceId) continue;

        const existing = this.verifiedDevices.get(record.id);
        const isOnline = record.isOnline !== false;
        const isRemoteActive = store.activeDeviceId === record.id;

        let state: DeviceReachabilityState = 'OFFLINE';
        if (isRemoteActive && store.isPlaying) {
          state = 'CURRENTLY_PLAYING';
        } else if (isOnline) {
          state = 'PLAYBACK_READY';
        } else {
          state = 'STALE';
        }

        const sources = (existing?.discoverySources instanceof Set)
          ? existing.discoverySources
          : new Set<DiscoverySource>();
        sources.add('CLOUD');

        const isUserAccountDevice = DeviceRegistry.getInstance().isKnownUserDevice(record.id);

        const devRecord = record as any;
        const updated: VerifiedDevice = {
          deviceId: record.id,
          installationId: existing?.installationId || 'inst_' + record.id,
          name: record.name || 'RaagaX Player',
          type: devRecord.type || 'desktop',
          platform: (record.platform as any) || 'Windows',
          appVersion: '2.5.0',
          protocolVersion: 2,
          capabilities: devRecord.capabilities || {
            audio: true,
            video: false,
            seek: true,
            volume: true,
            backgroundPlayback: true,
            remoteControl: true,
            offline: false,
            connect: true,
            queue: true,
            transfer: true,
          },
          reachabilityState: state,
          discoverySources: sources,
          isTrusted: true,
          isNearby: sources.has('LAN'),
          isAudioOutput: false,
          isSameAccount: isUserAccountDevice,
          accountRelationship: isUserAccountDevice ? 'SAME_ACCOUNT' : 'OTHER_ACCOUNT',
          activePlaybackSong: isRemoteActive ? store.currentSong?.title : undefined,
          activePlaybackPositionMs: isRemoteActive ? (store.currentTime || 0) * 1000 : undefined,
          lastSeenTimestamp: isOnline ? Date.now() : existing?.lastSeenTimestamp || Date.now() - 300000,
          verifiedAtTimestamp: Date.now(),
          rankingScore: isRemoteActive ? 900 : isOnline ? 500 : 100,
        };

        this.verifiedDevices.set(record.id, updated);
      }
    } catch (err) {
      console.warn('[DeviceDiscoveryEngine] ingestCloudPresence error:', err);
    }
  }

  private async ingestLocalLANDevices(localDeviceId: string) {
    // Ingest all local peer discovery / mDNS LAN devices without filtering out other accounts
    try {
      this.verifiedDevices.forEach((device) => {
        if (device && device.deviceId !== localDeviceId && device.reachabilityState !== 'OFFLINE') {
          if (device.discoverySources instanceof Set) {
            device.discoverySources.add('LAN');
          } else {
            device.discoverySources = new Set(['LAN']);
          }
          device.isNearby = true;
          // Dynamically resolve account relationship for LAN peers
          const isOwn = DeviceRegistry.getInstance().isKnownUserDevice(device.deviceId);
          device.isSameAccount = isOwn;
          device.accountRelationship = isOwn ? 'SAME_ACCOUNT' : 'OTHER_ACCOUNT';
        }
      });
    } catch {}
  }

  private async ingestAudioOutputs() {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (!Array.isArray(devices)) return;
      const audioOutputs = (devices as MediaDeviceInfo[]).filter((d) => d && d.kind === 'audiooutput');

      for (const output of audioOutputs) {
        if (!output || !output.deviceId || output.deviceId === 'default') continue;
        const name = output.label || 'Bluetooth / External Speaker';
        const isHeadphones = /headphone|buds|airpod|ear/i.test(name);
        const isSpeaker = /speaker|soundbar|tv|hdmi/i.test(name);

        const id = `output_${String(output.deviceId).substring(0, 12)}`;
        const outputDevice: VerifiedDevice = {
          deviceId: id,
          installationId: `hw_${id}`,
          name,
          type: 'audio_output',
          platform: 'Bluetooth',
          appVersion: 'Hardware',
          protocolVersion: 1,
          capabilities: {
            audio: true,
            video: false,
            seek: false,
            volume: true,
            backgroundPlayback: true,
            remoteControl: false,
            offline: true,
            connect: false,
            queue: false,
            transfer: false,
          },
          reachabilityState: 'AUDIO_OUTPUT_CONNECTED',
          discoverySources: new Set(['AUDIO_OUTPUT']),
          isTrusted: true,
          isNearby: true,
          isAudioOutput: true,
          lastSeenTimestamp: Date.now(),
          verifiedAtTimestamp: Date.now(),
          rankingScore: 800,
        };

        this.verifiedDevices.set(id, outputDevice);
      }
    } catch {}
  }

  private pruneStaleDevices() {
    const now = Date.now();
    let hasChanged = false;

    this.verifiedDevices.forEach((device, id) => {
      // If a non-local device hasn't responded in > 15 seconds, degrade to OFFLINE
      if (!device.isAudioOutput && id !== usePlayerStore.getState().deviceId) {
        if (now - device.lastSeenTimestamp > 15000 && device.reachabilityState !== 'OFFLINE') {
          device.reachabilityState = 'OFFLINE';
          device.rankingScore = 50;
          hasChanged = true;
        }
      }
    });

    if (hasChanged) {
      this.notifyListeners();
    }
  }

  private handleNetworkChange(state: 'online' | 'offline') {
    this.lastNetworkState = state;
    console.log(`[DeviceDiscoveryEngine] Network state changed to: ${state}`);
    if (state === 'online') {
      this.refreshDiscovery();
    } else {
      this.verifiedDevices.forEach((d) => {
        if (d.deviceId !== usePlayerStore.getState().deviceId && !d.isAudioOutput) {
          d.reachabilityState = 'OFFLINE';
        }
      });
      this.notifyListeners();
    }
  }

  public getRankedDevices(): VerifiedDevice[] {
    const list = Array.from(this.verifiedDevices.values());
    // Ranking Algorithm:
    // 1. Currently Playing Active Device (score >= 900)
    // 2. Audio Outputs (score = 800)
    // 3. Trusted & LAN Nearby Devices (score = 600)
    // 4. Online Cloud Devices (score = 500)
    // 5. Stale / Offline Devices (score < 200)
    return list.sort((a, b) => b.rankingScore - a.rankingScore);
  }

  private notifyListeners() {
    const ranked = this.getRankedDevices();
    this.listeners.forEach((fn) => fn(ranked));
  }
}
