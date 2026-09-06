/**
 * TransportManager — Dynamic Priority Selection & Silent Migration Engine
 *
 * Implements Architecture Spec §2, §7, §8, §11:
 * - Scores candidate transports (LAN > P2P > TURN > Cloud).
 * - Priority race with timeouts on connection.
 * - Silent Migration State Machine with 2-tick hysteresis.
 * - Background upgrade prober (every 20s).
 * - Egress & transport telemetry metrics.
 */

import {
  Transport,
  TransportKind,
  AuthorizedPeer,
  ControlMessage,
  TransportScore,
  TRANSPORT_COST_WEIGHTS,
  scoreTransport,
  ConnectMetrics,
} from '../types';
import { LocalTransport } from './LocalTransport';
import { P2PTransport } from './P2PTransport';
import { CloudControlTransport } from './CloudControlTransport';
import { DeviceDiscoveryEngine } from '../discovery/DeviceDiscoveryEngine';

export type TransportEvent = 'transportChanged' | 'message' | 'metricsUpdated';

export class TransportManager {
  private static instance: TransportManager;
  private candidates: Transport[] = [];
  private active: Transport | null = null;
  private lastPeer: AuthorizedPeer | null = null;
  private scores = new Map<TransportKind, TransportScore>();
  private upgradeTimer?: ReturnType<typeof setInterval>;
  private healthTimer?: ReturnType<typeof setInterval>;
  private listeners = new Map<TransportEvent, Set<Function>>();

  private metrics: ConnectMetrics = {
    lanSessionCount: 0,
    p2pSessionCount: 0,
    turnSessionCount: 0,
    cloudRelaySessionCount: 0,
    lanBytes: 0,
    p2pBytes: 0,
    turnBytes: 0,
    cloudEgressBytes: 0,
    transportUpgrades: 0,
    transportDowngrades: 0,
    activeTransport: null,
    latencyMs: null,
  };

  private constructor() {
    this.initDefaultScores();
  }

  public static getInstance(): TransportManager {
    if (!TransportManager.instance) {
      TransportManager.instance = new TransportManager();
    }
    return TransportManager.instance;
  }

  private initDefaultScores() {
    const kinds: TransportKind[] = ['LOCAL_LAN', 'P2P', 'TURN_RELAY', 'CLOUD_CONTROL'];
    for (const kind of kinds) {
      this.scores.set(kind, {
        transport: kind,
        latencyMs: null,
        reliability: 1.0,
        costWeight: TRANSPORT_COST_WEIGHTS[kind],
        available: true,
      });
    }
  }

  public getActiveTransport(): Transport | null {
    return this.active;
  }

  public getActiveKind(): TransportKind | null {
    return this.active?.kind ?? null;
  }

  public getMetrics(): ConnectMetrics {
    return { ...this.metrics };
  }

  public on(event: TransportEvent, fn: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  private emit(event: TransportEvent, ...args: any[]) {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }

  /**
   * Establishes the best available transport to an authorized peer
   */
  public async establish(
    peer: AuthorizedPeer,
    customCandidates?: Transport[]
  ): Promise<Transport> {
    this.lastPeer = peer;
    this.stopLoops();

    if (customCandidates && customCandidates.length > 0) {
      this.candidates = customCandidates;
    } else {
      const lan = new LocalTransport();
      const p2p = new P2PTransport(DeviceDiscoveryEngine.getInstance());
      const cloud = new CloudControlTransport();
      this.candidates = [lan, p2p, cloud];
    }

    // Spec §8: Race in priority order with short timeouts (LAN -> Wi-Fi P2P -> Cloud fallback)
    const attempts = this.candidates.map(t => {
      let timeoutMs = 2000;
      if (t.kind === 'LOCAL_LAN') timeoutMs = 300; // Fast local IPC probe
      else if (t.kind === 'P2P') timeoutMs = 3500; // Local Wi-Fi WebRTC DataChannel
      else if (t.kind === 'TURN_RELAY') timeoutMs = 3000;
      else if (t.kind === 'CLOUD_CONTROL') timeoutMs = 5000;
      return { t, timeoutMs };
    });

    const winner = await this.raceWithFallback(peer, attempts);
    this.activate(winner);
    this.startUpgradeProbing(peer);
    this.startHealthLoop();

    return winner;
  }

  private async raceWithFallback(
    peer: AuthorizedPeer,
    attempts: { t: Transport; timeoutMs: number }[]
  ): Promise<Transport> {
    for (const { t, timeoutMs } of attempts) {
      try {
        await this.withTimeout(t.connect(peer), timeoutMs);
        if (t.isConnected()) {
          return t; // First success wins in priority order
        }
      } catch (err) {
        // Mark score penalty on failure
        const score = this.scores.get(t.kind);
        if (score) {
          score.reliability = Math.max(0, score.reliability - 0.2);
        }
        continue;
      }
    }

    throw new Error('[TransportManager] ALL_TRANSPORTS_FAILED');
  }

  private activate(t: Transport, isUpgrade = false) {
    const oldKind = this.active?.kind;
    if (this.active && this.active !== t) {
      this.active.close().catch(() => {});
    }

    this.active = t;
    this.metrics.activeTransport = t.kind;

    // Track metrics
    if (t.kind === 'LOCAL_LAN') this.metrics.lanSessionCount++;
    else if (t.kind === 'P2P') this.metrics.p2pSessionCount++;
    else if (t.kind === 'TURN_RELAY') this.metrics.turnSessionCount++;
    else if (t.kind === 'CLOUD_CONTROL') this.metrics.cloudRelaySessionCount++;

    if (oldKind && oldKind !== t.kind) {
      if (isUpgrade) {
        this.metrics.transportUpgrades++;
      } else {
        this.metrics.transportDowngrades++;
      }
    }

    t.onMessage(msg => {
      this.trackEgress(t.kind, JSON.stringify(msg).length);
      this.emit('message', msg);
    });

    this.emit('transportChanged', t.kind);
    this.emit('metricsUpdated', this.metrics);
  }

  private trackEgress(kind: TransportKind, byteLength: number) {
    if (kind === 'LOCAL_LAN') this.metrics.lanBytes += byteLength;
    else if (kind === 'P2P') this.metrics.p2pBytes += byteLength;
    else if (kind === 'TURN_RELAY') this.metrics.turnBytes += byteLength;
    else if (kind === 'CLOUD_CONTROL') this.metrics.cloudEgressBytes += byteLength;
  }

  private startHealthLoop() {
    this.healthTimer = setInterval(async () => {
      if (!this.active) return;
      try {
        const h = await this.active.healthCheck();
        this.metrics.latencyMs = h.latencyMs;

        const currentScore = this.scores.get(this.active.kind);
        if (currentScore) {
          currentScore.latencyMs = h.latencyMs;
          currentScore.reliability = h.ok
            ? Math.min(1.0, currentScore.reliability + 0.05)
            : Math.max(0.0, currentScore.reliability - 0.25);
        }

        if (!h.ok) {
          console.warn(`[TransportManager] Healthcheck failed on ${this.active.kind}, falling back...`);
          await this.handleFailure();
        }
      } catch (err) {
        await this.handleFailure();
      }
    }, 5000);
  }

  private async handleFailure() {
    if (!this.lastPeer || !this.active) return;
    const order: TransportKind[] = ['LOCAL_LAN', 'P2P', 'TURN_RELAY', 'CLOUD_CONTROL'];
    const currentIdx = order.indexOf(this.active.kind);

    for (const kind of order.slice(currentIdx + 1)) {
      const candidate = this.candidates.find(c => c.kind === kind);
      if (candidate) {
        try {
          await this.withTimeout(candidate.connect(this.lastPeer), 2500);
          if (candidate.isConnected()) {
            console.log(`[TransportManager] Successfully failed over to ${kind}`);
            this.activate(candidate, false);
            return;
          }
        } catch {
          continue;
        }
      }
    }
  }

  private startUpgradeProbing(peer: AuthorizedPeer) {
    this.upgradeTimer = setInterval(async () => {
      if (!this.active || this.active.kind === 'LOCAL_LAN') {
        return; // Already on best transport
      }

      // Spec §7: Upgrade path only moves toward lower cost (CLOUD -> TURN -> P2P -> LAN)
      const order: TransportKind[] = ['LOCAL_LAN', 'P2P', 'TURN_RELAY', 'CLOUD_CONTROL'];
      const currentIdx = order.indexOf(this.active.kind);
      const betterKinds = order.slice(0, currentIdx);

      for (const kind of betterKinds) {
        const candidate = this.candidates.find(c => c.kind === kind);
        if (candidate && !candidate.isConnected()) {
          try {
            await this.withTimeout(candidate.connect(peer), 1500);
            if (candidate.isConnected()) {
              // Hysteresis: Confirm N=2 consecutive successful checks
              const stable = await this.confirmStable(candidate, 2);
              if (stable) {
                console.log(`[TransportManager] Upgrading transport: ${this.active.kind} -> ${candidate.kind}`);
                this.activate(candidate, true);
                return;
              }
            }
          } catch {
            // Not viable yet
          }
        }
      }
    }, 20000); // Probe every 20 seconds
  }

  private async confirmStable(t: Transport, requiredConsecutive: number): Promise<boolean> {
    for (let i = 0; i < requiredConsecutive; i++) {
      const check = await t.healthCheck();
      if (!check.ok) return false;
      await new Promise(r => setTimeout(r, 400));
    }
    return true;
  }

  public async send(msg: ControlMessage): Promise<void> {
    if (this.active && this.active.isConnected()) {
      try {
        await this.active.send(msg);
        return;
      } catch (err) {
        console.warn(`[TransportManager] Failed sending via active transport ${this.active.kind}, falling back:`, err);
      }
    }

    // Direct Cloud Coordinator fallback
    const targetId = this.lastPeer?.peer?.deviceId || (msg.payload as any)?.targetDeviceId;
    if (targetId) {
      const ok = DeviceDiscoveryEngine.getInstance().sendCloudCommand(targetId, msg);
      if (ok) {
        this.trackEgress('CLOUD_CONTROL', JSON.stringify(msg).length);
        return;
      }
    }

    throw new Error('[TransportManager] No active or fallback transport available to send');
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`[TransportManager] Timeout after ${ms}ms`)), ms)
      ),
    ]);
  }

  public stopLoops() {
    if (this.upgradeTimer) clearInterval(this.upgradeTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
  }

  public async closeAll(): Promise<void> {
    this.stopLoops();
    for (const c of this.candidates) {
      try { await c.close(); } catch {}
    }
    this.active = null;
    this.metrics.activeTransport = null;
  }
}
