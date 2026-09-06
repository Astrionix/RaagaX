/**
 * LocalTransport (LAN Tier 1 — Best, Lowest Latency)
 *
 * Implements Architecture Spec §2, §3:
 * - Same-machine instant IPC via BroadcastChannel ('raagax_connect_bus') with 0-1ms RTT.
 * - Direct subnet communication (mDNS/UDP beacon discovered IP:Port).
 * - Fast 250ms failover to Tier 2 P2P when peer is on a different Wi-Fi device.
 * - Zero cloud egress.
 */

import { Transport, TransportKind, AuthorizedPeer, ControlMessage, TransportHealth } from '../types';
import { DeviceKeyManager } from '../auth/DeviceKeyManager';

export class LocalTransport implements Transport {
  public readonly kind: TransportKind = 'LOCAL_LAN';
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private useBroadcastChannel = false;
  private messageCallbacks: ((msg: ControlMessage) => void)[] = [];
  private peer: AuthorizedPeer | null = null;
  private pendingPings = new Map<string, (rtt: number) => void>();
  private connected = false;
  private lastLatencyMs = 1;

  public isConnected(): boolean {
    if (this.useBroadcastChannel) return this.connected;
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public async connect(peer: AuthorizedPeer): Promise<void> {
    this.peer = peer;

    if (this.isConnected()) return;

    const address = peer.peer.address;
    const port = peer.peer.port || 8089;

    // Fast-Path 1: Same machine local bus (BroadcastChannel)
    if (!address || peer.peer.transport === 'mdns') {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        return new Promise<void>((resolve, reject) => {
          const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
          const targetDeviceId = peer.peer.deviceId;
          const bc = new BroadcastChannel('raagax_connect_bus');
          this.bc = bc;

          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              bc.close();
              this.bc = null;
              reject(new Error('[LocalTransport] Local bus handshake timeout (peer is on remote device)'));
            }
          }, 250);

          bc.onmessage = (event) => {
            try {
              const data = event.data;
              if (!data) return;

              if (data.type === 'LAN_HANDSHAKE_ACK' && data.fromDeviceId === targetDeviceId) {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  this.useBroadcastChannel = true;
                  this.connected = true;
                  resolve();
                }
                return;
              }

              if (data.type === 'CONNECT_COMMAND') {
                const cmd = data.command || data.payload;
                if (cmd && (data.targetDeviceId === myDeviceId || !data.targetDeviceId)) {
                  this.messageCallbacks.forEach(cb => cb(cmd));
                }
                return;
              }

              if (data.type === 'PONG' && data.payload?.pingId) {
                const cb = this.pendingPings.get(data.payload.pingId);
                if (cb) {
                  const rtt = Math.max(1, Date.now() - (data.payload.sentAt || Date.now()));
                  this.lastLatencyMs = rtt;
                  cb(rtt);
                  this.pendingPings.delete(data.payload.pingId);
                }
              }
            } catch (err) {
              console.warn('[LocalTransport] BroadcastChannel parse error:', err);
            }
          };

          // Send handshake ping
          bc.postMessage({
            type: 'LAN_HANDSHAKE_REQUEST',
            targetDeviceId,
            fromDeviceId: myDeviceId,
          });
        });
      }

      throw new Error('[LocalTransport] No local IP address available for peer');
    }

    // Path 2: Direct WebSocket to LAN IP
    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    const localUrl = `${protocol}//${address}:${port}/connect`;

    return new Promise((resolve, reject) => {
      let opened = false;
      const timeoutId = setTimeout(() => {
        if (!opened) {
          try { this.ws?.close(); } catch {}
          reject(new Error(`[LocalTransport] LAN connection timeout to ${localUrl}`));
        }
      }, 500);

      try {
        const socket = new WebSocket(localUrl);

        socket.onopen = () => {
          opened = true;
          clearTimeout(timeoutId);
          this.ws = socket;
          this.connected = true;

          socket.send(JSON.stringify({
            type: 'LAN_HANDSHAKE',
            token: peer.capabilityToken,
            senderDeviceId: peer.peer.deviceId,
          }));

          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data) return;

            if (data.type === 'PONG' && data.payload?.pingId) {
              const cb = this.pendingPings.get(data.payload.pingId);
              if (cb) {
                const rtt = Math.max(1, Date.now() - (data.payload.sentAt || Date.now()));
                this.lastLatencyMs = rtt;
                cb(rtt);
                this.pendingPings.delete(data.payload.pingId);
              }
              return;
            }

            for (const cb of this.messageCallbacks) {
              cb(data as ControlMessage);
            }
          } catch (err) {
            console.warn('[LocalTransport] Frame parsing error:', err);
          }
        };

        socket.onerror = (err) => {
          if (!opened) {
            clearTimeout(timeoutId);
            reject(err);
          }
        };

        socket.onclose = () => {
          this.connected = false;
          this.ws = null;
        };

      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  public async send(msg: ControlMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('[LocalTransport] Not connected');
    }

    if (this.useBroadcastChannel && this.bc) {
      this.bc.postMessage({
        type: 'CONNECT_COMMAND',
        targetDeviceId: this.peer?.peer?.deviceId,
        command: msg,
      });
      return;
    }

    if (this.ws) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public onMessage(cb: (msg: ControlMessage) => void): void {
    this.messageCallbacks.push(cb);
  }

  public async healthCheck(): Promise<TransportHealth> {
    if (!this.isConnected()) {
      return { latencyMs: 9999, ok: false };
    }

    const pingId = 'lan_' + Math.random().toString(36).slice(2, 9);
    const sentAt = Date.now();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingPings.delete(pingId);
        resolve({ latencyMs: 100, ok: false });
      }, 500);

      this.pendingPings.set(pingId, (rtt) => {
        clearTimeout(timer);
        resolve({ latencyMs: rtt, ok: true });
      });

      try {
        if (this.useBroadcastChannel && this.bc) {
          this.bc.postMessage({
            type: 'PING',
            payload: { pingId, sentAt },
          });
        } else {
          this.ws?.send(JSON.stringify({
            type: 'PING',
            payload: { pingId, sentAt },
          }));
        }
      } catch {
        clearTimeout(timer);
        resolve({ latencyMs: 9999, ok: false });
      }
    });
  }

  public async close(): Promise<void> {
    this.connected = false;
    if (this.bc) {
      try { this.bc.close(); } catch {}
      this.bc = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.pendingPings.clear();
  }
}
