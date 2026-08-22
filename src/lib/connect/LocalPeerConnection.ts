import { ConnectCommand } from './types';
import { ConnectManager } from './ConnectManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackStateSync } from './PlaybackStateSync';
import { TransportRouter } from './TransportRouter';
import { TransportScorer } from './TransportScorer';
import { TransportHealthMonitor } from './TransportHealthMonitor';
import { DeviceRegistry } from './DeviceRegistry';

export class LocalPeerConnection {
  private static instance: LocalPeerConnection;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  
  // Handshake and Heartbeat state
  private pendingHandshakes = new Map<string, { resolve: (val: boolean) => void; timeout: NodeJS.Timeout }>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private missedHeartbeats = new Map<string, number>();
  // Tracks the sentAt timestamp of the last HEARTBEAT sent to each peer for RTT measurement
  private lastHeartbeatSentAt = new Map<string, number>();

  private constructor() {
    if (typeof window !== 'undefined') {
      import('./CommandBus').then(({ CommandBus }) => {
        CommandBus.getInstance().subscribeToSignals((command) => {
          this.handleIncomingSignal(command);
        });
      });
    }
  }

  public static getInstance(): LocalPeerConnection {
    if (!LocalPeerConnection.instance) {
      LocalPeerConnection.instance = new LocalPeerConnection();
    }
    return LocalPeerConnection.instance;
  }

  /**
   * Manually initiates a LAN WebRTC direct connection to a target device.
   * Returns a promise that resolves when the local handshake completes successfully.
   */
  public connectToDevice(targetId: string): Promise<boolean> {
    console.log(`[LocalPeer] Manually connecting to target: ${targetId}`);
    
    // Clear any existing connection to this device first
    this.cleanup(targetId);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`[LocalPeer] Connection handshake timed out for device ${targetId}`);
        this.pendingHandshakes.delete(targetId);
        this.cleanup(targetId);
        resolve(false);
      }, 6000);

      this.pendingHandshakes.set(targetId, { resolve, timeout });
      this.initiateConnection(targetId).catch((err) => {
        console.error(`[LocalPeer] Initiate connection failed for ${targetId}:`, err);
        clearTimeout(timeout);
        this.pendingHandshakes.delete(targetId);
        this.cleanup(targetId);
        resolve(false);
      });
    });
  }

  private async initiateConnection(targetId: string) {
    console.log(`[LocalPeer] Initiating direct WebRTC connection to ${targetId}`);
    
    const configuration: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    
    const pc = new RTCPeerConnection(configuration);
    this.peerConnections.set(targetId, pc);

    const dc = pc.createDataChannel('raagax-control');
    this.setupDataChannel(targetId, dc, true);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetId, {
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.sendSignal(targetId, {
        type: 'offer',
        sdp: offer
      });
    } catch (e) {
      console.error(`[LocalPeer] Failed to create offer to ${targetId}:`, e);
      this.cleanup(targetId);
      throw e;
    }
  }

  private setupDataChannel(targetId: string, dc: RTCDataChannel, isInitiator: boolean) {
    this.dataChannels.set(targetId, dc);

    dc.onopen = () => {
      console.log(`[LocalPeer] Data channel opened with ${targetId}. Initiator: ${isInitiator}`);
      if (isInitiator) {
        // Send connect handshake request
        const store = usePlayerStore.getState();
        const requestCmd = {
          commandId: crypto.randomUUID(),
          sessionId: ConnectManager.getInstance().getSessionId() || 'global',
          epoch: 0,
          sequence: 0,
          sourceDeviceId: store.deviceId,
          targetDeviceId: targetId,
          type: 'CONNECT_REQUEST',
          sentAt: Date.now(),
          payload: {
            deviceId: store.deviceId,
            deviceName: localStorage.getItem('raagax_device_name') || 'RaagaX Controller'
          }
        };
        try {
          dc.send(JSON.stringify(requestCmd));
        } catch (err) {
          console.error(`[LocalPeer] Failed to send CONNECT_REQUEST to ${targetId}:`, err);
        }
      }
    };

    dc.onclose = () => {
      console.log(`[LocalPeer] Direct LAN channel closed with device: ${targetId}`);
      this.cleanup(targetId);
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'CONNECT_REQUEST': {
            console.log(`[LocalPeer] Received CONNECT_REQUEST from ${targetId}`);
            // Verify that incoming connection belongs to the same authorized user account
            DeviceRegistry.getInstance().isDeviceAuthorizedForUser(targetId).then((isAuthorized) => {
              const store = usePlayerStore.getState();
              if (!isAuthorized) {
                console.warn(`[LocalPeer] Rejecting CONNECT_REQUEST from device on different account: ${targetId}`);
                const rejectCmd = {
                  commandId: crypto.randomUUID(),
                  sessionId: ConnectManager.getInstance().getSessionId() || 'global',
                  sourceDeviceId: store.deviceId,
                  targetDeviceId: targetId,
                  type: 'CONNECT_REJECT',
                  sentAt: Date.now(),
                  reason: 'ACCOUNT_MISMATCH_UNAUTHORIZED'
                };
                if (dc.readyState === 'open') {
                  dc.send(JSON.stringify(rejectCmd));
                }
                return;
              }

              // Authorized: respond with current snapshot and capabilities
              const responseCmd = {
                commandId: crypto.randomUUID(),
                sessionId: ConnectManager.getInstance().getSessionId() || 'global',
                epoch: 0,
                sequence: 0,
                sourceDeviceId: store.deviceId,
                targetDeviceId: targetId,
                type: 'CONNECT_RESPONSE',
                sentAt: Date.now(),
                payload: {
                  snapshot: store.getPlaybackSnapshot(),
                  capabilities: {
                    audio: true,
                    seek: true,
                    volume: true
                  }
                }
              };
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify(responseCmd));
              }
              
              // Mark direct peer available for routing via TransportRouter
              TransportRouter.getInstance().onLanChannelAvailable(targetId);
            }).catch(() => {});
            break;
          }

          case 'CONNECT_REJECT': {
            console.warn(`[LocalPeer] Connection rejected by ${targetId}: ${msg.reason || 'Unauthorized'}`);
            const handshake = this.pendingHandshakes.get(targetId);
            if (handshake) {
              clearTimeout(handshake.timeout);
              this.pendingHandshakes.delete(targetId);
              handshake.resolve(false);
            }
            break;
          }

          case 'CONNECT_RESPONSE': {
            console.log(`[LocalPeer] Received CONNECT_RESPONSE from ${targetId}`);
            const handshake = this.pendingHandshakes.get(targetId);
            if (handshake) {
              clearTimeout(handshake.timeout);
              this.pendingHandshakes.delete(targetId);

              // Adopt remote state snapshot immediately
              if (msg.payload && msg.payload.snapshot) {
                PlaybackStateSync.getInstance().adoptRemoteState(msg.payload.snapshot);
              }

              TransportRouter.getInstance().onLanChannelAvailable(targetId);
              this.startHeartbeatLoop(targetId);
              handshake.resolve(true);
            }
            break;
          }

          case 'HEARTBEAT': {
            // Reply instantly
            const ack = {
              type: 'HEARTBEAT_ACK',
              sentAt: Date.now()
            };
            if (dc.readyState === 'open') {
              dc.send(JSON.stringify(ack));
            }
            break;
          }

          case 'HEARTBEAT_ACK': {
            // Measure RTT and feed into TransportScorer
            this.missedHeartbeats.set(targetId, 0);
            const sentAt = this.lastHeartbeatSentAt.get(targetId);
            if (sentAt) {
              const rttMs = Date.now() - sentAt;
              TransportScorer.getInstance().recordRtt('LOCAL_DIRECT', rttMs);
            }
            break;
          }

          case 'STATE_UPDATE': {
            console.log(`[LocalPeer] Received direct state update`);
            PlaybackStateSync.getInstance().handleRemoteStateUpdate(msg.payload);
            break;
          }

          default: {
            console.log(`[LocalPeer] Received direct command: ${msg.type}`);
            import('./CommandBus').then(({ CommandBus }) => {
              CommandBus.getInstance().handleIncomingCommand(msg);
            });
            break;
          }
        }
      } catch (e) {
        console.error('[LocalPeer] Failed to process message:', e);
      }
    };
  }

  private startHeartbeatLoop(targetId: string) {
    this.stopHeartbeatLoop(targetId);
    this.missedHeartbeats.set(targetId, 0);

    const timer = setInterval(() => {
      const dc = this.dataChannels.get(targetId);
      if (!dc || dc.readyState !== 'open') {
        this.handleHeartbeatTimeout(targetId);
        return;
      }

      // Check missed heartbeat count
      const missed = this.missedHeartbeats.get(targetId) || 0;
      if (missed >= 2) {
        console.warn(`[LocalPeer] Heartbeat timeout for device: ${targetId}`);
        this.handleHeartbeatTimeout(targetId);
        return;
      }

      // Send heartbeat — timestamp recorded for RTT measurement on ACK
      try {
        const heartbeatSentAt = Date.now();
        this.missedHeartbeats.set(targetId, missed + 1);
        this.lastHeartbeatSentAt.set(targetId, heartbeatSentAt);
        dc.send(JSON.stringify({ type: 'HEARTBEAT', sentAt: heartbeatSentAt }));
        // Notify TransportHealthMonitor on each cycle for predictive trend analysis
        TransportHealthMonitor.getInstance().onHeartbeatCycle(targetId);
      } catch {
        this.handleHeartbeatTimeout(targetId);
      }
    }, 3000);

    this.heartbeatIntervals.set(targetId, timer);
  }

  private stopHeartbeatLoop(targetId: string) {
    const timer = this.heartbeatIntervals.get(targetId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatIntervals.delete(targetId);
    }
    this.missedHeartbeats.delete(targetId);
    this.lastHeartbeatSentAt.delete(targetId);
  }

  private handleHeartbeatTimeout(targetId: string) {
    console.warn(`[LocalPeer] Lost LAN channel due to heartbeat timeout with device: ${targetId}`);
    // Record miss in scorer before cleanup so the score degrades before the transport fully drops
    TransportScorer.getInstance().recordMiss('LOCAL_DIRECT');
    this.cleanup(targetId);
  }

  public async handleIncomingSignal(command: ConnectCommand) {
    const senderId = command.sourceDeviceId;
    const signal = command.payload as any;

    let pc = this.peerConnections.get(senderId);

    if (signal.type === 'offer') {
      console.log(`[LocalPeer] Received offer from ${senderId}`);
      if (pc) this.cleanup(senderId);

      const configuration: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      pc = new RTCPeerConnection(configuration);
      this.peerConnections.set(senderId, pc);

      pc.ondatachannel = (event) => {
        this.setupDataChannel(senderId, event.channel, false);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal(senderId, {
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendSignal(senderId, {
          type: 'answer',
          sdp: answer
        });
      } catch (err) {
        console.warn(`[LocalPeer] Error creating answer for ${senderId}:`, err);
      }

    } else if (signal.type === 'answer') {
      console.log(`[LocalPeer] Received answer from ${senderId}`);
      if (pc) {
        try {
          if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } else if (pc.signalingState === 'stable') {
            console.debug(`[LocalPeer] Ignoring redundant answer SDP for ${senderId} - connection is already stable.`);
          } else {
            console.warn(`[LocalPeer] Skipping setRemoteDescription in state: ${pc.signalingState}`);
          }
        } catch (err) {
          console.warn(`[LocalPeer] Error applying remote answer SDP from ${senderId}:`, err);
        }
      }
    } else if (signal.type === 'candidate') {
      if (pc && signal.candidate) {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } catch (err) {
          console.debug(`[LocalPeer] ICE candidate ignored for ${senderId}:`, err);
        }
      }
    }
  }

  private sendSignal(targetId: string, payload: any) {
    const store = usePlayerStore.getState();
    const command: ConnectCommand = {
      commandId: crypto.randomUUID(),
      sessionId: ConnectManager.getInstance().getSessionId() || 'global',
      epoch: 0,
      sequence: 0,
      sourceDeviceId: store.deviceId,
      targetDeviceId: targetId,
      type: 'WEBRTC_SIGNAL',
      sentAt: Date.now(),
      payload
    };
    
    ConnectManager.getInstance().sendTargetedCommand(targetId, command);
  }

  public sendDirectCommand(targetId: string, command: ConnectCommand): boolean {
    const dc = this.dataChannels.get(targetId);
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(command));
        return true;
      } catch (e) {
        console.error(`[LocalPeer] Failed to send direct command to ${targetId}:`, e);
      }
    }
    return false;
  }

  public sendDirectBroadcast(command: ConnectCommand): boolean {
    let sentCount = 0;
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(command));
          sentCount++;
        } catch {}
      }
    });
    return sentCount > 0;
  }

  public cleanup(deviceId: string) {
    this.stopHeartbeatLoop(deviceId);

    const handshake = this.pendingHandshakes.get(deviceId);
    if (handshake) {
      clearTimeout(handshake.timeout);
      this.pendingHandshakes.delete(deviceId);
      handshake.resolve(false);
    }

    const pc = this.peerConnections.get(deviceId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(deviceId);
    }
    this.dataChannels.delete(deviceId);

    // If no more open direct connections remain, notify TransportRouter to fall back to Cloud
    let anyOpen = false;
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === 'open') anyOpen = true;
    });
    
    if (!anyOpen) {
      TransportRouter.getInstance().onLanChannelLost(deviceId);
    }
  }
}
