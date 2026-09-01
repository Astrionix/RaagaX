/**
 * RaagaX Connect — Local LAN Transport
 *
 * Fast path transport over BroadcastChannel and local HTTP API.
 * Includes health monitoring with hysteresis to prevent transport flapping.
 */

import { ConnectCommand, ConnectPlaybackSession } from '@/types/connect';
import { getApiUrl } from '@/lib/config/apiConfig';

export type TransportHealth = 'HEALTHY' | 'DEGRADED' | 'FAILED';

export class LocalLanTransport {
  private static instance: LocalLanTransport;
  private broadcastChannel: BroadcastChannel | null = null;
  private health: TransportHealth = 'HEALTHY';
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('raaga_connect_rpc_channel');
      } catch {}
    }
  }

  public static getInstance(): LocalLanTransport {
    if (!LocalLanTransport.instance) {
      LocalLanTransport.instance = new LocalLanTransport();
    }
    return LocalLanTransport.instance;
  }

  public async sendCommand(command: ConnectCommand): Promise<boolean> {
    let sent = false;

    // 1. BroadcastChannel fast path
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'CONNECT_COMMAND',
          command,
        });
        sent = true;
      } catch {}
    }

    // 2. HTTP Server Relay
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(getApiUrl('/api/connect/command'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command),
        });
        if (res.ok) {
          this.recordSuccess();
          return true;
        } else {
          this.recordFailure();
        }
      } catch {
        this.recordFailure();
      }
    }

    return sent;
  }

  private recordSuccess(): void {
    this.consecutiveSuccesses += 1;
    this.consecutiveFailures = 0;
    if (this.consecutiveSuccesses >= 2) {
      this.health = 'HEALTHY';
    }
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    this.consecutiveSuccesses = 0;
    if (this.consecutiveFailures >= 3) {
      this.health = 'FAILED';
    } else if (this.consecutiveFailures >= 1) {
      this.health = 'DEGRADED';
    }
  }

  public getHealth(): TransportHealth {
    return this.health;
  }
}
