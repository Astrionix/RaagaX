import { Transport, TransportKind, AuthorizedPeer, ControlMessage, TransportHealth } from '../types';
import { getSyncWebSocketUrl } from '@/lib/config/apiConfig';
import { DeviceKeyManager } from '../auth/DeviceKeyManager';

/**
 * CloudControlTransport (Fallback Tier 4)
 *
 * Wraps the existing RaagaX WebSocket Coordinator connection.
 * Carries control-plane JSON messages ONLY. NEVER audio bytes.
 */
export class CloudControlTransport implements Transport {
  public readonly kind: TransportKind = 'CLOUD_CONTROL';
  private ws: WebSocket | null = null;
  private messageCallbacks: ((msg: ControlMessage) => void)[] = [];
  private peer: AuthorizedPeer | null = null;
  private pendingPings = new Map<string, (rtt: number) => void>();
  private lastMeasuredLatencyMs = 65; // Sensible default for cloud roundtrip
  private connected = false;

  constructor(private customWsUrl?: string) {}

  public isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public async connect(peer: AuthorizedPeer): Promise<void> {
    this.peer = peer;

    if (this.isConnected()) {
      return;
    }

    const wsUrl = this.customWsUrl || getSyncWebSocketUrl();

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(wsUrl);
        let opened = false;

        const timeoutId = setTimeout(() => {
          if (!opened) {
            try { socket.close(); } catch {}
            reject(new Error(`[CloudControlTransport] Connection timeout to ${wsUrl}`));
          }
        }, 4000);

        socket.onopen = () => {
          opened = true;
          clearTimeout(timeoutId);
          this.ws = socket;
          this.connected = true;

          // Register LOCAL device session on coordinator
          const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
          socket.send(JSON.stringify({
            type: 'REGISTER_DEVICE',
            device: {
              deviceId: myDeviceId,
              role: 'controller',
              lastSeenAt: Date.now(),
            }
          }));

          resolve();
        };

        socket.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (!data) return;

            // Handle ping/pong for healthCheck
            if (data.type === 'PONG' && data.payload?.pingId) {
              const cb = this.pendingPings.get(data.payload.pingId);
              if (cb) {
                const rtt = Math.max(1, Date.now() - (data.payload.sentAt || Date.now()));
                this.lastMeasuredLatencyMs = rtt;
                cb(rtt);
                this.pendingPings.delete(data.payload.pingId);
              }
              return;
            }

            // Normal control message
            if (data.type === 'CONNECT_COMMAND' && data.payload) {
              const controlMsg = data.payload as ControlMessage;
              for (const cb of this.messageCallbacks) {
                cb(controlMsg);
              }
            } else if (data.commandId && data.sessionId && data.type) {
              // Direct control message payload
              for (const cb of this.messageCallbacks) {
                cb(data as ControlMessage);
              }
            }
          } catch (e) {
            console.warn('[CloudControlTransport] Failed to parse frame:', e);
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
        reject(err);
      }
    });
  }

  public async send(msg: ControlMessage): Promise<void> {
    if (!this.isConnected() || !this.ws) {
      throw new Error('[CloudControlTransport] Socket is not connected');
    }

    const payload = JSON.stringify({
      type: 'CONNECT_COMMAND',
      targetDeviceId: this.peer?.peer?.deviceId,
      command: msg,
    });

    this.ws.send(payload);
  }

  public onMessage(cb: (msg: ControlMessage) => void): void {
    this.messageCallbacks.push(cb);
  }

  public async healthCheck(): Promise<TransportHealth> {
    if (!this.isConnected() || !this.ws) {
      return { latencyMs: 9999, ok: false };
    }

    const pingId = 'png_' + Math.random().toString(36).slice(2, 9);
    const sentAt = Date.now();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingPings.delete(pingId);
        // Socket is still connected and ready, keep connection alive with sensible latency
        resolve({ latencyMs: this.lastMeasuredLatencyMs, ok: this.isConnected() });
      }, 2500);

      this.pendingPings.set(pingId, (rtt) => {
        clearTimeout(timer);
        resolve({ latencyMs: rtt, ok: true });
      });

      try {
        this.ws?.send(JSON.stringify({
          type: 'PING',
          payload: { pingId, sentAt },
        }));
      } catch {
        clearTimeout(timer);
        resolve({ latencyMs: 9999, ok: false });
      }
    });
  }

  public async close(): Promise<void> {
    this.connected = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.pendingPings.clear();
  }
}
