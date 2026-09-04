import { DiagnosticReport } from './types';
import { DeviceIdentityManager } from './DeviceIdentityManager';
import { TransportManager } from './TransportManager';
import { DiscoveryEngine } from './DiscoveryEngine';

export class ConnectDiagnostics {
  private static instance: ConnectDiagnostics;
  private report: DiagnosticReport;
  private subscribers: Set<(report: DiagnosticReport) => void> = new Set();

  private constructor() {
    const self = DeviceIdentityManager.getInstance().getDevice();
    this.report = {
      deviceId: self.deviceId,
      userId: self.userId || null,
      lanDiscovery: false,
      cloudPresence: false,
      reachability: false,
      authorization: true,
      lanTransport: false,
      cloudTransport: false,
      handshake: false,
      playbackControl: false,
      stateSync: false,
      handoff: true,
      roundTripLatencyMs: 0,
      lastCheck: Date.now(),
    };
  }

  public static getInstance(): ConnectDiagnostics {
    if (!ConnectDiagnostics.instance) {
      ConnectDiagnostics.instance = new ConnectDiagnostics();
    }
    return ConnectDiagnostics.instance;
  }

  public updateDiagnostics(partial: Partial<DiagnosticReport>): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const transport = TransportManager.getInstance().getActiveTransport();
    const discovery = DiscoveryEngine.getInstance();

    this.report = {
      ...this.report,
      ...partial,
      deviceId: self.deviceId,
      userId: self.userId || null,
      lanDiscovery: Boolean(discovery.getCurrentWifiHash()),
      cloudPresence: discovery.getIsRunning(),
      lanTransport: transport === 'LAN',
      cloudTransport: transport === 'CLOUD',
      lastCheck: Date.now(),
    };

    this.notify();
  }

  public measurePing(targetDeviceId: string): void {
    const start = Date.now();
    TransportManager.getInstance().sendMessage('PING', { targetDeviceId, timestamp: start });
  }

  public recordPong(originTimestamp: number): void {
    const latency = Date.now() - originTimestamp;
    this.updateDiagnostics({
      reachability: true,
      roundTripLatencyMs: Math.max(1, latency),
    });
  }

  public getReport(): DiagnosticReport {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const transport = TransportManager.getInstance().getActiveTransport();
    const discovery = DiscoveryEngine.getInstance();

    const hasLan = Boolean(discovery.getCurrentWifiHash() && discovery.getIsRunning());
    const isRunning = discovery.getIsRunning();

    return {
      ...this.report,
      deviceId: self.deviceId,
      userId: self.userId || null,
      lanDiscovery: hasLan,
      cloudPresence: isRunning,
      lanTransport: transport === 'LAN',
      cloudTransport: transport === 'CLOUD',
      lastCheck: Date.now(),
    };
  }

  public subscribe(callback: (report: DiagnosticReport) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getReport());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    const r = this.getReport();
    this.subscribers.forEach((cb) => cb(r));
  }
}
