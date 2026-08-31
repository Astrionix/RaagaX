import { JamCommand, JamCommandResponse, JamEvent } from '@/types/jam';
import {
  JamTransport,
  JamTransportType,
  JamAuthCredentials,
  JamEventListener,
  TransportHealth,
} from './JamTransport';
import { CloudRealtimeTransport } from './CloudRealtimeTransport';
import { LocalLanTransport } from './LocalLanTransport';
import { BluetoothDiscoveryTransport } from './BluetoothDiscoveryTransport';

export interface TransportRouterStatus {
  activeTransport: JamTransportType;
  bluetoothHealth: TransportHealth;
  lanHealth: TransportHealth;
  cloudHealth: TransportHealth;
  failoverCount: number;
  lastFailoverAt: number | null;
  lastFailoverReason: string | null;
}

export class TransportRouter {
  private static instance: TransportRouter;

  private cloudTransport: CloudRealtimeTransport;
  private lanTransport: LocalLanTransport;
  private bluetoothTransport: BluetoothDiscoveryTransport;

  private activeTransportType: JamTransportType = 'CLOUD_REALTIME';
  private listeners: Set<JamEventListener> = new Set();
  private unsubscribers: Array<() => void> = [];

  // Hysteresis & Anti-Flapping State (Section 10)
  private lanConsecutiveHealthyCount = 0;
  private static readonly LAN_RECOVERY_THRESHOLD = 3; // 3 consecutive healthy checks to switch back to LAN
  private static readonly LAN_FAILURE_THRESHOLD = 2; // 2 consecutive failures to switch to Cloud

  private failoverCount = 0;
  private lastFailoverAt: number | null = null;
  private lastFailoverReason: string | null = null;

  // Deduplication cache for incoming realtime events across multi-transport
  private processedEvents: Map<string, number> = new Map();
  private routerCheckTimer: any = null;

  private constructor() {
    this.cloudTransport = new CloudRealtimeTransport();
    this.lanTransport = new LocalLanTransport();
    this.bluetoothTransport = new BluetoothDiscoveryTransport();
  }

  public static getInstance(): TransportRouter {
    if (!TransportRouter.instance) {
      TransportRouter.instance = new TransportRouter();
    }
    return TransportRouter.instance;
  }

  public get activeTransport(): JamTransport {
    if (this.activeTransportType === 'BLUETOOTH_PEER_SYNC') {
      return this.bluetoothTransport;
    }
    return this.activeTransportType === 'LOCAL_LAN' ? this.lanTransport : this.cloudTransport;
  }

  public getActiveTransportType(): JamTransportType {
    return this.activeTransportType;
  }

  public async initialize(
    jamId: string,
    auth: JamAuthCredentials,
    lanEndpoint?: string,
    enableBluetooth = true
  ): Promise<boolean> {
    this.cleanup();

    // 1. Connect to Cloud Realtime Transport (authoritative cloud backbone)
    const cloudOk = await this.cloudTransport.connect(jamId, auth);

    // 2. Connect to Local LAN Transport if local endpoint is present
    let lanOk = false;
    if (lanEndpoint) {
      lanOk = await this.lanTransport.connect(jamId, auth, lanEndpoint);
    }

    // 3. Connect Bluetooth Peer Sync channel if enabled
    let btOk = false;
    if (enableBluetooth) {
      btOk = await this.bluetoothTransport.connect(jamId, auth);
    }

    // 4. Transport Selection Hierarchy: Bluetooth Peer Sync (when active peer connected) -> Local LAN -> Cloud Realtime
    if (btOk && this.bluetoothTransport.hasActivePeers() && this.bluetoothTransport.isHealthy()) {
      this.activeTransportType = 'BLUETOOTH_PEER_SYNC';
      console.log(`[TRANSPORT_SELECTED] transport=BLUETOOTH_PEER_SYNC rttMs=${this.bluetoothTransport.getHealth().rttMs}ms (Direct Radio preferred)`);
    } else if (lanOk && this.lanTransport.isHealthy()) {
      this.activeTransportType = 'LOCAL_LAN';
      this.lanConsecutiveHealthyCount = TransportRouter.LAN_RECOVERY_THRESHOLD;
      console.log(`[TRANSPORT_SELECTED] transport=LOCAL_LAN rttMs=${this.lanTransport.getHealth().rttMs}ms (Local Wi-Fi preferred)`);
    } else {
      this.activeTransportType = 'CLOUD_REALTIME';
      console.log(`[TRANSPORT_SELECTED] transport=CLOUD_REALTIME rttMs=${this.cloudTransport.getHealth().rttMs}ms (Cloud Realtime default)`);
    }

    // 5. Wire up unified event listeners from all transports
    this.unsubscribers.push(
      this.cloudTransport.subscribe((event) => this.routeIncomingEvent(event, 'CLOUD_REALTIME'))
    );
    this.unsubscribers.push(
      this.lanTransport.subscribe((event) => this.routeIncomingEvent(event, 'LOCAL_LAN'))
    );
    this.unsubscribers.push(
      this.bluetoothTransport.subscribe((event) => this.routeIncomingEvent(event, 'BLUETOOTH_PEER_SYNC'))
    );

    // 6. Start periodic health monitoring and hysteresis evaluation (every 1s)
    this.startHealthMonitor();

    return cloudOk || lanOk || btOk;
  }

  /**
   * Dispatches a Jam command through the currently preferred healthy transport.
   * If the active transport fails, seamlessly attempts immediate failover retry (Section 23 & 24).
   */
  public async sendCommand(command: JamCommand): Promise<JamCommandResponse> {
    const primaryTransport = this.activeTransport;
    const initialTransportType = this.activeTransportType;

    // Attach request timestamp if missing
    if (!command.timestamp) {
      command.timestamp = Date.now();
    }

    try {
      const response = await primaryTransport.sendCommand(command);
      if (response && response.success) {
        return response;
      }

      // If Bluetooth fails, fail over to LAN or Cloud
      if (initialTransportType === 'BLUETOOTH_PEER_SYNC') {
        const nextTransport = (this.lanTransport.isConnected && this.lanTransport.isHealthy()) ? 'LOCAL_LAN' : 'CLOUD_REALTIME';
        this.executeFailover(nextTransport, `Command failed on Bluetooth: ${response?.error || 'Unknown error'}`);
        return await (nextTransport === 'LOCAL_LAN' ? this.lanTransport : this.cloudTransport).sendCommand(command);
      }

      // If LAN transport failed, execute seamless fallback to Cloud Realtime
      if (initialTransportType === 'LOCAL_LAN' && !response.success) {
        console.warn(`[TRANSPORT_FAILOVER] from=LOCAL_LAN to=CLOUD_REALTIME reason=Command execution failed: ${response.error}`);
        this.executeFailover('CLOUD_REALTIME', `Command failed on LAN: ${response.error}`);
        return await this.cloudTransport.sendCommand(command);
      }

      return response;
    } catch (err: any) {
      if (initialTransportType === 'BLUETOOTH_PEER_SYNC') {
        const nextTransport = (this.lanTransport.isConnected && this.lanTransport.isHealthy()) ? 'LOCAL_LAN' : 'CLOUD_REALTIME';
        this.executeFailover(nextTransport, `Bluetooth network error: ${err?.message}`);
        return await (nextTransport === 'LOCAL_LAN' ? this.lanTransport : this.cloudTransport).sendCommand(command);
      }
      if (initialTransportType === 'LOCAL_LAN') {
        console.warn(`[TRANSPORT_FAILOVER] from=LOCAL_LAN to=CLOUD_REALTIME reason=LAN network error: ${err?.message}`);
        this.executeFailover('CLOUD_REALTIME', `LAN network error: ${err?.message}`);
        return await this.cloudTransport.sendCommand(command);
      }
      return { success: false, error: err?.message || 'Transport error', revision: 0 };
    }
  }

  public subscribe(listener: JamEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Routes incoming events from any transport and eliminates duplicate broadcasts.
   */
  private routeIncomingEvent(event: JamEvent, sourceTransport: JamTransportType) {
    if (!event) return;

    // Composite deduplication key across transports
    const eventKey = `${event.eventId || ''}:${event.revision || 0}:${event.transitionId || ''}:${event.type}`;
    const now = Date.now();

    if (this.processedEvents.has(eventKey)) {
      const lastSeen = this.processedEvents.get(eventKey)!;
      if (now - lastSeen < 10000) {
        // Safe duplicate dropped (Section 27)
        return;
      }
    }

    this.processedEvents.set(eventKey, now);

    // Prune stale cache entries
    if (this.processedEvents.size > 200) {
      for (const [k, t] of this.processedEvents.entries()) {
        if (now - t > 15000) this.processedEvents.delete(k);
      }
    }

    // Notify subscribers
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[TransportRouter] Listener error on ${sourceTransport}:`, err);
      }
    }
  }

  /**
   * Evaluates transport health and applies hysteresis to prevent flapping (Section 10).
   */
  private evaluateTransportHealth() {
    const btHealth = this.bluetoothTransport.getHealth();
    const lanHealth = this.lanTransport.getHealth();

    // 1. Bluetooth Peer Sync degradation handling
    if (this.activeTransportType === 'BLUETOOTH_PEER_SYNC') {
      if (!this.bluetoothTransport.isHealthy() || btHealth.failureCount > 0) {
        const nextTransport = (this.lanTransport.isConnected && this.lanTransport.isHealthy()) ? 'LOCAL_LAN' : 'CLOUD_REALTIME';
        this.executeFailover(nextTransport, `Bluetooth degraded (failures: ${btHealth.failureCount})`);
        return;
      }
    }

    // 2. If active is LOCAL_LAN but LAN is failing/degraded -> Fallback to CLOUD
    if (this.activeTransportType === 'LOCAL_LAN') {
      if (lanHealth.state === 'FAILED' || lanHealth.failureCount >= TransportRouter.LAN_FAILURE_THRESHOLD || lanHealth.rttMs > 400) {
        this.lanConsecutiveHealthyCount = 0;
        this.executeFailover('CLOUD_REALTIME', `LAN degraded (failures: ${lanHealth.failureCount}, RTT: ${lanHealth.rttMs}ms)`);
      }
    }
    // 3. If active is CLOUD_REALTIME but Bluetooth/LAN has recovered -> Consider promoting
    else if (this.activeTransportType === 'CLOUD_REALTIME') {
      if (this.bluetoothTransport.isConnected && this.bluetoothTransport.isHealthy()) {
        this.executeFailover('BLUETOOTH_PEER_SYNC', 'Bluetooth Peer Sync active and healthy');
      } else if (this.lanTransport.isConnected && lanHealth.state === 'CONNECTED' && lanHealth.rttMedianMs < 120 && lanHealth.failureCount === 0) {
        this.lanConsecutiveHealthyCount++;
        if (this.lanConsecutiveHealthyCount >= TransportRouter.LAN_RECOVERY_THRESHOLD) {
          this.executeFailover('LOCAL_LAN', `LAN sustained healthy recovery (${this.lanConsecutiveHealthyCount} samples, RTT: ${lanHealth.rttMedianMs}ms)`);
        }
      } else {
        this.lanConsecutiveHealthyCount = 0;
      }
    }
  }

  private executeFailover(targetTransport: JamTransportType, reason: string) {
    if (this.activeTransportType === targetTransport) return;

    const prev = this.activeTransportType;
    this.activeTransportType = targetTransport;
    this.failoverCount++;
    this.lastFailoverAt = Date.now();
    this.lastFailoverReason = reason;

    console.log(`[TRANSPORT_FAILOVER] from=${prev} to=${targetTransport} reason=${reason} failoverCount=${this.failoverCount}`);
  }

  private startHealthMonitor() {
    this.stopHealthMonitor();
    this.routerCheckTimer = setInterval(() => {
      this.evaluateTransportHealth();
    }, 1000);
  }

  private stopHealthMonitor() {
    if (this.routerCheckTimer) {
      clearInterval(this.routerCheckTimer);
      this.routerCheckTimer = null;
    }
  }

  public getStatus(): TransportRouterStatus {
    return {
      activeTransport: this.activeTransportType,
      bluetoothHealth: this.bluetoothTransport.getHealth(),
      lanHealth: this.lanTransport.getHealth(),
      cloudHealth: this.cloudTransport.getHealth(),
      failoverCount: this.failoverCount,
      lastFailoverAt: this.lastFailoverAt,
      lastFailoverReason: this.lastFailoverReason,
    };
  }

  public getCloudTransport(): CloudRealtimeTransport {
    return this.cloudTransport;
  }

  public getLanTransport(): LocalLanTransport {
    return this.lanTransport;
  }

  public getBluetoothTransport(): BluetoothDiscoveryTransport {
    return this.bluetoothTransport;
  }

  public cleanup() {
    this.stopHealthMonitor();
    this.unsubscribers.forEach((unsub) => {
      try { unsub(); } catch {}
    });
    this.unsubscribers = [];
    this.cloudTransport.disconnect();
    this.lanTransport.disconnect();
    this.bluetoothTransport.disconnect();
    this.processedEvents.clear();
    this.lanConsecutiveHealthyCount = 0;
  }

  public resetForTesting() {
    this.cleanup();
    this.activeTransportType = 'CLOUD_REALTIME';
    this.failoverCount = 0;
    this.lastFailoverAt = null;
    this.lastFailoverReason = null;
    this.listeners.clear();
  }
}
