/**
 * RaagaX Connect — Local LAN Discovery & SSE Real-Time Stream
 *
 * Discovers devices on the local network (mDNS / UDP / BroadcastChannel / HTTP Beacon)
 * and maintains a persistent SSE real-time push stream for sub-50ms RPC execution.
 */

import { ConnectDevice } from '@/types/connect';
import { DeviceIdentity } from '../identity/DeviceIdentity';
import { DeviceRegistry } from '../identity/DeviceRegistry';

export class LocalLanDiscovery {
  private static instance: LocalLanDiscovery;
  private heartbeatTimer: any = null;
  private scanTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private sseEventSource: EventSource | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupBroadcastChannel();
      this.connectStream();
    }
  }

  public static getInstance(): LocalLanDiscovery {
    if (!LocalLanDiscovery.instance) {
      LocalLanDiscovery.instance = new LocalLanDiscovery();
    }
    return LocalLanDiscovery.instance;
  }

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('raaga_connect_discovery_lan');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'LAN_BEACON' && event.data.device) {
          const remoteDevice = event.data.device as ConnectDevice;
          const localId = DeviceIdentity.getInstance().getDeviceId();
          if (remoteDevice.deviceId !== localId) {
            DeviceRegistry.getInstance().registerOrUpdateDevice({
              ...remoteDevice,
              isCurrentDevice: false,
              transport: 'LOCAL_LAN',
            });
          }
        }
      };
    } catch {}
  }

  public connectStream(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (this.sseEventSource) return;

    const localId = DeviceIdentity.getInstance().getDeviceId();
    try {
      this.sseEventSource = new EventSource(`/api/connect/stream?deviceId=${encodeURIComponent(localId)}`);

      this.sseEventSource.addEventListener('COMMAND', (e: MessageEvent) => {
        try {
          const cmd = JSON.parse(e.data);
          if (cmd) {
            import('@/lib/connect/ConnectServerEngine').then(({ ConnectServerEngine }) => {
              ConnectServerEngine.getInstance().handleIncomingCommand(cmd);
            });
          }
        } catch {}
      });

      this.sseEventSource.addEventListener('SESSION_UPDATE', (e: MessageEvent) => {
        try {
          const session = JSON.parse(e.data);
          if (session) {
            import('@/lib/connect/ConnectClientManager').then(({ ConnectClientManager }) => {
              ConnectClientManager.getInstance().handleIncomingSession(session);
            });
          }
        } catch {}
      });

      this.sseEventSource.addEventListener('DEVICE_LIST_UPDATED', (e: MessageEvent) => {
        try {
          const devices = JSON.parse(e.data);
          if (Array.isArray(devices)) {
            import('@/lib/connect/ConnectDiscoveryEngine').then(({ ConnectDiscoveryEngine }) => {
              ConnectDiscoveryEngine.getInstance().handleIncomingDeviceList(devices);
            });
          }
        } catch {}
      });

      this.sseEventSource.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch {}
  }

  public start(): void {
    if (this.heartbeatTimer) return;

    this.sendBeacon();
    this.scan();
    this.connectStream();

    this.heartbeatTimer = setInterval(() => {
      this.sendBeacon();
    }, 3000);

    this.scanTimer = setInterval(() => {
      this.scan();
    }, 3000);
  }

  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }
  }

  public sendBeacon(): void {
    const localDevice = DeviceIdentity.getInstance().toConnectDevice();
    console.log(`[CONNECT_DISCOVERY]\ndeviceId=${localDevice.deviceId}\ndeviceName=${localDevice.deviceName}\ntransport=LOCAL_LAN`);

    // 1. BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'LAN_BEACON',
          device: localDevice,
        });
      } catch {}
    }

    // 2. HTTP Server Beacon
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/connect/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: localDevice }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.pendingCommands) && data.pendingCommands.length > 0) {
            import('@/lib/connect/ConnectServerEngine').then(({ ConnectServerEngine }) => {
              data.pendingCommands.forEach((cmd: any) => {
                ConnectServerEngine.getInstance().handleIncomingCommand(cmd);
              });
            });
          }
        })
        .catch(() => {});
    }
  }

  public async scan(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    const localId = DeviceIdentity.getInstance().getDeviceId();

    try {
      const res = await fetch(`/api/connect/devices?excludeId=${encodeURIComponent(localId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.devices)) {
        data.devices.forEach((dev: ConnectDevice) => {
          DeviceRegistry.getInstance().registerOrUpdateDevice({
            ...dev,
            isCurrentDevice: false,
            transport: 'LOCAL_LAN',
          });
        });
      }
    } catch {}
  }
}
