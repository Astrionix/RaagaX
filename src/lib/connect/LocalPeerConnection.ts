import { ConnectCommand } from './types';
import { ConnectManager } from './ConnectManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackStateSync } from './PlaybackStateSync';
import { TransportRouter } from './TransportRouter';
import { TransportScorer } from './TransportScorer';
import { TransportHealthMonitor } from './TransportHealthMonitor';
import { DeviceRegistry } from './DeviceRegistry';

export type LocalPeerCleanupReason =
  | 'MANUAL_DISCONNECT'
  | 'LOCAL_CONNECTION_FAILED'
  | 'CHANNEL_CLOSED'
  | 'HEARTBEAT_TIMEOUT'
  | 'RECONNECT_RESET';

export class LocalPeerConnection {
  private static instance: LocalPeerConnection;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private activeGenerations = new Map<string, number>();
  
  // Handshake and Heartbeat state
  private pendingHandshakes = new Map<string, { resolve: (val: boolean) => void; timeout: NodeJS.Timeout; generation: number }>();
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
  public connectToDevice(targetId: string, generation?: number): Promise<boolean> {
    const gen = generation !== undefined ? generation : ConnectManager.getInstance().getConnectionGeneration();
    console.log(`[LocalPeer][gen=${gen}] Manually connecting to target: ${targetId}`);
    
    // Clear any existing connection for this target device without triggering cloud fallback
    this.cleanup(targetId, gen, 'RECONNECT_RESET');
    this.activeGenerations.set(targetId, gen);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const currentGen = ConnectManager.getInstance().getConnectionGeneration();
        if (gen !== currentGen) {
          console.log(`[LocalPeer][gen=${gen}] Ignoring stale handshake timeout; current generation = ${currentGen}`);
          return;
        }

        console.warn(`[LocalPeer][gen=${gen}] Connection handshake timed out for device ${targetId}`);
        this.pendingHandshakes.delete(targetId);
        this.cleanup(targetId, gen, 'LOCAL_CONNECTION_FAILED');
        resolve(false);
      }, 6000);

      this.pendingHandshakes.set(targetId, { resolve, timeout, generation: gen });
      this.initiateConnection(targetId, gen).catch((err) => {
        const currentGen = ConnectManager.getInstance().getConnectionGeneration();
        if (gen !== currentGen) {
          console.log(`[LocalPeer][gen=${gen}] Ignoring stale initiation error; current generation = ${currentGen}`);
          return;
        }

        console.error(`[LocalPeer][gen=${gen}] Initiate connection failed for ${targetId}:`, err);
        clearTimeout(timeout);
        this.pendingHandshakes.delete(targetId);
        this.cleanup(targetId, gen, 'LOCAL_CONNECTION_FAILED');
        resolve(false);
      });
    });
  }

  private async initiateConnection(targetId: string, generation: number) {
    const currentGen = ConnectManager.getInstance().getConnectionGeneration();
    if (generation !== currentGen) {
      console.log(`[LocalPeer][gen=${generation}] Aborting stale initiateConnection; current generation = ${currentGen}`);
      return;
    }

    console.log(`[LocalPeer][gen=${generation}] Initiating direct WebRTC connection to ${targetId}`);
    
    const configuration: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    
    const pc = new RTCPeerConnection(configuration);
    this.peerConnections.set(targetId, pc);

    const dc = pc.createDataChannel('raagax-control');
    this.setupDataChannel(targetId, dc, true, generation);

    pc.onicecandidate = (event) => {
      const liveGen = ConnectManager.getInstance().getConnectionGeneration();
      if (generation !== liveGen) return;

      if (event.candidate) {
        this.sendSignal(targetId, {
          type: 'candidate',
          candidate: event.candidate
        }, generation);
      }
    };

    try {
      const offer = await pc.createOffer();
      const liveGen = ConnectManager.getInstance().getConnectionGeneration();
      if (generation !== liveGen) {
        try { pc.close(); } catch {}
        return;
      }

      await pc.setLocalDescription(offer);
      
      this.sendSignal(targetId, {
        type: 'offer',
        sdp: offer
      }, generation);
    } catch (e) {
      console.error(`[LocalPeer][gen=${generation}] Failed to create offer to ${targetId}:`, e);
      this.cleanup(targetId, generation, 'LOCAL_CONNECTION_FAILED');
      throw e;
    }
  }

  private setupDataChannel(targetId: string, dc: RTCDataChannel, isInitiator: boolean, generation: number) {
    this.dataChannels.set(targetId, dc);

    dc.onopen = () => {
      const currentGen = ConnectManager.getInstance().getConnectionGeneration();
      if (generation !== currentGen) {
        console.log(`[LocalPeer][gen=${generation}] Ignoring stale data channel onopen; current generation = ${currentGen}`);
        try { dc.close(); } catch {}
        return;
      }

      console.log(`[LocalPeer][gen=${generation}] Data channel opened with ${targetId}. Initiator: ${isInitiator}`);
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
            deviceName: localStorage.getItem('raagax_device_name') || 'RaagaX Controller',
            generation
          }
        };
        try {
          dc.send(JSON.stringify(requestCmd));
        } catch (err) {
          console.error(`[LocalPeer][gen=${generation}] Failed to send CONNECT_REQUEST to ${targetId}:`, err);
        }
      }
    };

    dc.onclose = () => {
      const currentGen = ConnectManager.getInstance().getConnectionGeneration();
      if (generation !== currentGen) {
        console.log(`[LocalPeer][gen=${generation}] Ignoring stale data channel onclose; current generation = ${currentGen}`);
        return;
      }

      console.log(`[LocalPeer][gen=${generation}] Direct LAN channel closed with device: ${targetId}`);
      this.cleanup(targetId, generation, 'CHANNEL_CLOSED');
    };

    dc.onmessage = (event) => {
      const currentGen = ConnectManager.getInstance().getConnectionGeneration();
      if (generation !== currentGen) {
        console.log(`[LocalPeer][gen=${generation}] Ignoring stale data channel onmessage; current generation = ${currentGen}`);
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'CONNECT_REQUEST': {
            console.log(`[LocalPeer][gen=${generation}] Received CONNECT_REQUEST from ${targetId}`);
            // Verify that incoming connection belongs to the same authorized user account
            DeviceRegistry.getInstance().isDeviceAuthorizedForUser(targetId).then((isAuthorized) => {
              const store = usePlayerStore.getState();
              if (!isAuthorized) {
                console.warn(`[LocalPeer][gen=${generation}] Rejecting CONNECT_REQUEST from device on different account: ${targetId}`);
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

              // ── Build a RemotePlaybackState-compatible snapshot for the connecting device ─────────
              // getPlaybackSnapshot() is designed for local session use and may lack epoch/activeDeviceId.
              // We build a full RemotePlaybackState object here so adoptRemoteState() works correctly.
              const deviceName = typeof window !== 'undefined'
                ? (localStorage.getItem('raagax_device_name') || 'RaagaX Player')
                : 'RaagaX Player';
              const fullSnapshot = {
                activeDeviceId: store.deviceId,           // THIS device is the renderer
                activeDeviceName: deviceName,
                songId: store.currentSong?.id || null,
                songData: store.currentSong ? { ...store.currentSong } : null,
                isPlaying: store.isPlaying,
                isBuffering: false,
                positionMs: Math.round(store.currentTime * 1000),
                durationMs: Math.round(store.duration * 1000),
                volume: store.volume,
                isMuted: store.isMuted,
                queue: store.queue || [],
                queueIndex: store.queueIndex || 0,
                shuffleMode: store.shuffleMode,
                repeatMode: store.repeatMode,
                serverTimestamp: Date.now(),
                epoch: 1,
                revision: store.localPlaybackRevision || 1,
              };

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
                  snapshot: fullSnapshot,
                  capabilities: {
                    audio: true,
                    seek: true,
                    volume: true
                  },
                  generation
                }
              };
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify(responseCmd));
                console.log(`[LocalPeer][gen=${generation}] Sent CONNECT_RESPONSE to ${targetId} — snapshot: trackId=${fullSnapshot.songId} isPlaying=${fullSnapshot.isPlaying} pos=${fullSnapshot.positionMs}ms`);
              }
              
              // Mark direct peer available for routing via TransportRouter
              TransportRouter.getInstance().onLanChannelAvailable(targetId);

              // Broadcast live STATE_UPDATE immediately (primary delivery)
              if (store.isActiveDevice) {
                PlaybackStateSync.getInstance().broadcastState(true);
              }

              // Broadcast again after a short delay as a reliability safety net
              // (covers the window where the connecting device hasn't finished registering its channel yet)
              setTimeout(() => {
                const currentStore = usePlayerStore.getState();
                if (currentStore.isActiveDevice) {
                  PlaybackStateSync.getInstance().broadcastState(true);
                }
              }, 150);
            }).catch(() => {});
            break;
          }


          case 'CONNECT_REJECT': {
            console.warn(`[LocalPeer][gen=${generation}] Connection rejected by ${targetId}: ${msg.reason || 'Unauthorized'}`);
            const handshake = this.pendingHandshakes.get(targetId);
            if (handshake && handshake.generation === generation) {
              clearTimeout(handshake.timeout);
              this.pendingHandshakes.delete(targetId);
              handshake.resolve(false);
            }
            break;
          }

          case 'CONNECT_RESPONSE': {
            console.log(`[LocalPeer][gen=${generation}] Received CONNECT_RESPONSE from ${targetId}`);
            const handshake = this.pendingHandshakes.get(targetId);
            if (handshake && handshake.generation === generation) {
              clearTimeout(handshake.timeout);
              this.pendingHandshakes.delete(targetId);

              // Adopt remote state snapshot immediately.
              // The store already has isActiveDevice=false (set before the LAN attempt),
              // so adoptRemoteState will apply the state without dropping it.
              if (msg.payload && msg.payload.snapshot) {
                const snap = msg.payload.snapshot;
                console.log(`[LocalPeer][gen=${generation}] Adopting CONNECT_RESPONSE snapshot: trackId=${snap.songId || snap.currentTrackId} isPlaying=${snap.isPlaying} pos=${snap.positionMs}ms`);
                PlaybackStateSync.getInstance().adoptRemoteState(snap);
              }

              TransportRouter.getInstance().onLanChannelAvailable(targetId);
              this.startHeartbeatLoop(targetId, generation);
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
            console.log(`[LocalPeer][gen=${generation}] Received direct state update`);
            PlaybackStateSync.getInstance().handleRemoteStateUpdate(msg.payload);
            break;
          }

          default: {
            console.log(`[LocalPeer][gen=${generation}] Received direct command: ${msg.type}`);
            import('./CommandBus').then(({ CommandBus }) => {
              CommandBus.getInstance().handleIncomingCommand(msg);
            });
            break;
          }
        }
      } catch (e) {
        console.error(`[LocalPeer][gen=${generation}] Failed to process message:`, e);
      }
    };
  }

  private startHeartbeatLoop(targetId: string, generation?: number) {
    const boundGen = generation !== undefined ? generation : ConnectManager.getInstance().getConnectionGeneration();
    this.stopHeartbeatLoop(targetId);
    this.missedHeartbeats.set(targetId, 0);

    const timer = setInterval(() => {
      const currentGen = ConnectManager.getInstance().getConnectionGeneration();
      if (boundGen !== undefined && boundGen < currentGen) {
        this.stopHeartbeatLoop(targetId);
        return;
      }

      const dc = this.dataChannels.get(targetId);
      if (!dc || dc.readyState !== 'open') {
        this.handleHeartbeatTimeout(targetId, boundGen);
        return;
      }

      // Check missed heartbeat count
      const missed = this.missedHeartbeats.get(targetId) || 0;
      if (missed >= 2) {
        console.warn(`[LocalPeer][gen=${boundGen}] Heartbeat timeout for device: ${targetId}`);
        this.handleHeartbeatTimeout(targetId, boundGen);
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
        this.handleHeartbeatTimeout(targetId, boundGen);
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

  private handleHeartbeatTimeout(targetId: string, generation: number) {
    const currentGen = ConnectManager.getInstance().getConnectionGeneration();
    if (generation !== currentGen) return;

    console.warn(`[LocalPeer][gen=${generation}] Lost established LAN channel due to heartbeat timeout with device: ${targetId}`);
    // Record miss in scorer before cleanup
    TransportScorer.getInstance().recordMiss('LOCAL_DIRECT');
    this.cleanup(targetId, generation, 'HEARTBEAT_TIMEOUT');
  }

  public async handleIncomingSignal(command: ConnectCommand) {
    if (ConnectManager.getInstance().isManualDisconnectRequested()) {
      return;
    }

    const currentGen = ConnectManager.getInstance().getConnectionGeneration();
    const senderId = command.sourceDeviceId;
    const signal = command.payload as any;

    let pc = this.peerConnections.get(senderId);

    if (signal.type === 'offer') {
      console.log(`[LocalPeer][gen=${currentGen}] Received offer from ${senderId}`);
      if (pc) this.cleanup(senderId, currentGen, 'RECONNECT_RESET');

      const configuration: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      pc = new RTCPeerConnection(configuration);
      this.peerConnections.set(senderId, pc);
      this.activeGenerations.set(senderId, currentGen);

      pc.ondatachannel = (event) => {
        this.setupDataChannel(senderId, event.channel, false, currentGen);
      };

      pc.onicecandidate = (event) => {
        const liveGen = ConnectManager.getInstance().getConnectionGeneration();
        if (currentGen !== liveGen) return;

        if (event.candidate) {
          this.sendSignal(senderId, {
            type: 'candidate',
            candidate: event.candidate
          }, currentGen);
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        
        const liveGen = ConnectManager.getInstance().getConnectionGeneration();
        if (currentGen !== liveGen) {
          try { pc.close(); } catch {}
          return;
        }

        await pc.setLocalDescription(answer);

        this.sendSignal(senderId, {
          type: 'answer',
          sdp: answer
        }, currentGen);
      } catch (err) {
        console.warn(`[LocalPeer][gen=${currentGen}] Error creating answer for ${senderId}:`, err);
      }

    } else if (signal.type === 'answer') {
      console.log(`[LocalPeer][gen=${currentGen}] Received answer from ${senderId}`);
      if (pc) {
        try {
          if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } else if (pc.signalingState === 'stable') {
            console.debug(`[LocalPeer][gen=${currentGen}] Ignoring redundant answer SDP for ${senderId} - connection is already stable.`);
          } else {
            console.warn(`[LocalPeer][gen=${currentGen}] Skipping setRemoteDescription in state: ${pc.signalingState}`);
          }
        } catch (err) {
          console.warn(`[LocalPeer][gen=${currentGen}] Error applying remote answer SDP from ${senderId}:`, err);
        }
      }
    } else if (signal.type === 'candidate') {
      if (pc && signal.candidate) {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } catch (err) {
          console.debug(`[LocalPeer][gen=${currentGen}] ICE candidate ignored for ${senderId}:`, err);
        }
      }
    }
  }

  private sendSignal(targetId: string, payload: any, generation?: number) {
    const gen = generation !== undefined ? generation : ConnectManager.getInstance().getConnectionGeneration();
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
      payload: {
        ...payload,
        generation: gen
      }
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

  /**
   * Idempotent cleanup of local peer connection resources.
   * Only active established channels that drop unexpectedly report channel lost.
   * Manual disconnect, initiation failure, and reconnect resets do NOT trigger false fallbacks.
   */
  public cleanup(
    deviceId: string, 
    generation?: number, 
    reason: LocalPeerCleanupReason = 'MANUAL_DISCONNECT'
  ) {
    const boundGen = this.activeGenerations.get(deviceId);
    if (generation !== undefined && boundGen !== undefined && generation < boundGen) {
      console.log(`[LocalPeer][gen=${generation}] Ignoring stale cleanup for device ${deviceId}; active generation is ${boundGen}`);
      return;
    }

    this.stopHeartbeatLoop(deviceId);

    const handshake = this.pendingHandshakes.get(deviceId);
    if (handshake) {
      if (generation === undefined || handshake.generation === generation) {
        clearTimeout(handshake.timeout);
        this.pendingHandshakes.delete(deviceId);
        handshake.resolve(false);
      }
    }

    const hadOpenChannel = this.dataChannels.get(deviceId)?.readyState === 'open';

    const pc = this.peerConnections.get(deviceId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(deviceId);
    }
    this.dataChannels.delete(deviceId);
    this.activeGenerations.delete(deviceId);

    // Only notify TransportRouter of channel loss if an established channel dropped unexpectedly
    if (reason === 'HEARTBEAT_TIMEOUT' && hadOpenChannel) {
      TransportRouter.getInstance().onLanChannelLost(deviceId);
    }
  }
}
