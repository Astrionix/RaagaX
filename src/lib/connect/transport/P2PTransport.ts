/**
 * P2PTransport (WebRTC DataChannel Tier 2)
 *
 * Implements Architecture Spec §2, §5:
 * - Peer-to-peer WebRTC RTCDataChannel (ordered, reliable).
 * - Zero cloud egress for control messages once connected.
 * - Signaling via DeviceDiscoveryEngine (idles once data channel is open).
 * - Automatic bidirectional listener for incoming peer connections on local Wi-Fi.
 */

import { Transport, TransportKind, AuthorizedPeer, ControlMessage, TransportHealth, SignalMessage, SignalingChannel } from '../types';
import { DeviceKeyManager } from '../auth/DeviceKeyManager';

export class P2PTransport implements Transport {
  public readonly kind: TransportKind = 'P2P';
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private messageCallbacks: ((msg: ControlMessage) => void)[] = [];
  private peer: AuthorizedPeer | null = null;
  private signalingUnsub: (() => void) | null = null;
  private pendingPings = new Map<string, (rtt: number) => void>();
  private connected = false;
  private lastLatencyMs = 25;

  // Active incoming peer connections on the receiver side
  private static activeIncomingPcs = new Map<string, RTCPeerConnection>();
  private static incomingReceiverInitialized = false;

  constructor(
    private signalingChannel?: SignalingChannel,
    private rtcConfig?: RTCConfiguration
  ) {
    if (signalingChannel) {
      P2PTransport.initIncomingReceiver(signalingChannel, rtcConfig);
    }
  }

  /**
   * Initializes global receiver for incoming WebRTC P2P connections on local Wi-Fi
   */
  public static initIncomingReceiver(signaling: SignalingChannel, rtcConfig?: RTCConfiguration) {
    if (P2PTransport.incomingReceiverInitialized) return;
    if (typeof RTCPeerConnection === 'undefined') return;
    P2PTransport.incomingReceiverInitialized = true;

    const config: RTCConfiguration = rtcConfig || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    signaling.onSignal(async (sig) => {
      const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
      if (sig.toDeviceId && sig.toDeviceId !== myDeviceId) return;

      try {
        if (sig.type === 'offer') {
          // Accept incoming P2P connection from remote controller
          const existingPc = P2PTransport.activeIncomingPcs.get(sig.fromDeviceId);
          if (existingPc) {
            try { existingPc.close(); } catch {}
          }

          const pc = new RTCPeerConnection(config);
          P2PTransport.activeIncomingPcs.set(sig.fromDeviceId, pc);

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              signaling.sendSignal({
                sessionId: sig.sessionId,
                fromDeviceId: myDeviceId,
                toDeviceId: sig.fromDeviceId,
                type: 'ice_candidate',
                payload: JSON.stringify(event.candidate),
                seq: Date.now(),
              }).catch(() => {});
            }
          };

          pc.ondatachannel = (event) => {
            const dc = event.channel;
            dc.onopen = () => {
              console.log(`[P2PTransport] Direct Wi-Fi DataChannel active with controller: ${sig.fromDeviceId}`);
              import('@/lib/connect/session/ConnectSessionManager').then(({ ConnectSessionManager }) => {
                ConnectSessionManager.getInstance().registerDirectChannel(sig.fromDeviceId, dc);
              }).catch(() => {});
            };

            dc.onmessage = (ev) => {
              try {
                const msg: ControlMessage = JSON.parse(ev.data);
                if (msg.type === 'PING' && (msg.payload as any)?.pingId) {
                  dc.send(JSON.stringify({
                    type: 'PONG',
                    payload: msg.payload,
                  }));
                  return;
                }
                import('@/lib/connect/session/ConnectSessionManager').then(({ ConnectSessionManager }) => {
                  ConnectSessionManager.getInstance().handleIncomingControlMessage(msg);
                }).catch(() => {});
              } catch (e) {
                console.warn('[P2PTransport] Incoming frame parse error:', e);
              }
            };
          };

          const offerDesc = JSON.parse(sig.payload);
          await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await signaling.sendSignal({
            sessionId: sig.sessionId,
            fromDeviceId: myDeviceId,
            toDeviceId: sig.fromDeviceId,
            type: 'answer',
            payload: JSON.stringify(answer),
            seq: Date.now(),
          });

        } else if (sig.type === 'ice_candidate') {
          const pc = P2PTransport.activeIncomingPcs.get(sig.fromDeviceId);
          if (pc && pc.remoteDescription) {
            const cand = JSON.parse(sig.payload);
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } catch (err) {
        console.warn('[P2PTransport] Error handling incoming receiver signal:', err);
      }
    });
  }

  public isConnected(): boolean {
    return this.connected && this.dataChannel !== null && this.dataChannel.readyState === 'open';
  }

  public async connect(peer: AuthorizedPeer): Promise<void> {
    this.peer = peer;

    if (this.isConnected()) return;

    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('[P2PTransport] RTCPeerConnection not supported in this environment');
    }

    const signaling = this.signalingChannel;
    if (!signaling) {
      throw new Error('[P2PTransport] No signaling channel provided for P2P negotiation');
    }

    const config: RTCConfiguration = this.rtcConfig || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const targetDeviceId = peer.peer.deviceId;

    return new Promise((resolve, reject) => {
      try {
        const pc = new RTCPeerConnection(config);
        this.pc = pc;

        let resolved = false;
        const connectTimeout = setTimeout(() => {
          if (!resolved) {
            this.cleanup();
            reject(new Error('[P2PTransport] WebRTC connection timed out'));
          }
        }, 3500);

        const dc = pc.createDataChannel('raagax-control', {
          ordered: true,
        });
        this.dataChannel = dc;

        dc.onopen = () => {
          this.connected = true;
          if (!resolved) {
            resolved = true;
            clearTimeout(connectTimeout);
            resolve();
          }
        };

        dc.onmessage = (event) => {
          try {
            const msg: ControlMessage = JSON.parse(event.data);
            if (msg.type === 'PONG' && (msg.payload as any)?.pingId) {
              const cb = this.pendingPings.get((msg.payload as any).pingId);
              if (cb) {
                const rtt = Math.max(1, Date.now() - ((msg.payload as any).sentAt || Date.now()));
                this.lastLatencyMs = rtt;
                cb(rtt);
                this.pendingPings.delete((msg.payload as any).pingId);
              }
              return;
            }

            for (const cb of this.messageCallbacks) {
              cb(msg);
            }
          } catch (err) {
            console.warn('[P2PTransport] Invalid frame received over data channel:', err);
          }
        };

        dc.onclose = () => {
          this.connected = false;
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.sendSignal({
              sessionId: 'sess_' + targetDeviceId,
              fromDeviceId: myDeviceId,
              toDeviceId: targetDeviceId,
              type: 'ice_candidate',
              payload: JSON.stringify(event.candidate),
              seq: Date.now(),
            }).catch(() => {});
          }
        };

        // Listen for remote answer and remote ICE candidates
        this.signalingUnsub = signaling.onSignal(async (sig) => {
          if (!this.pc) return;
          if (sig.fromDeviceId !== targetDeviceId) return;

          try {
            if (sig.type === 'answer') {
              const answerDesc = JSON.parse(sig.payload);
              await this.pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
            } else if (sig.type === 'ice_candidate') {
              const candidate = JSON.parse(sig.payload);
              await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          } catch (err) {
            console.warn('[P2PTransport] Error handling remote signal:', err);
          }
        });

        // Create and dispatch SDP Offer
        pc.createOffer().then((offer) => {
          return pc.setLocalDescription(offer).then(() => {
            signaling.sendSignal({
              sessionId: 'sess_' + targetDeviceId,
              fromDeviceId: myDeviceId,
              toDeviceId: targetDeviceId,
              type: 'offer',
              payload: JSON.stringify(offer),
              seq: Date.now(),
            }).catch(() => {});
          });
        }).catch(reject);

      } catch (err) {
        reject(err);
      }
    });
  }

  public async send(msg: ControlMessage): Promise<void> {
    if (!this.isConnected() || !this.dataChannel) {
      throw new Error('[P2PTransport] DataChannel is not open');
    }
    this.dataChannel.send(JSON.stringify(msg));
  }

  public onMessage(cb: (msg: ControlMessage) => void): void {
    this.messageCallbacks.push(cb);
  }

  public async healthCheck(): Promise<TransportHealth> {
    if (!this.isConnected() || !this.dataChannel) {
      return { latencyMs: 9999, ok: false };
    }

    const pingId = 'p2p_' + Math.random().toString(36).slice(2, 9);
    const sentAt = Date.now();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingPings.delete(pingId);
        resolve({ latencyMs: 150, ok: false });
      }, 1500);

      this.pendingPings.set(pingId, (rtt) => {
        clearTimeout(timer);
        resolve({ latencyMs: rtt, ok: true });
      });

      try {
        const pingMsg: ControlMessage = {
          commandId: crypto.randomUUID ? crypto.randomUUID() : 'cmd_' + Date.now(),
          sessionId: 'sess_health',
          sequenceNumber: 0,
          timestamp: sentAt,
          type: 'PING',
          payload: { pingId, sentAt },
          senderDeviceId: 'local',
        };
        this.dataChannel?.send(JSON.stringify(pingMsg));
      } catch {
        clearTimeout(timer);
        resolve({ latencyMs: 9999, ok: false });
      }
    });
  }

  private cleanup(): void {
    this.connected = false;
    if (this.signalingUnsub) {
      this.signalingUnsub();
      this.signalingUnsub = null;
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    this.pendingPings.clear();
  }

  public async close(): Promise<void> {
    this.cleanup();
  }
}
