import { ConnectCommand } from './types';
import { ConnectManager } from './ConnectManager';
import { ConnectivityRouter } from './ConnectivityRouter';
import { usePlayerStore } from '@/context/usePlayerStore';

export class LocalPeerConnection {
  private static instance: LocalPeerConnection;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastDevicesKey: string = '';

  private constructor() {
    if (typeof window !== 'undefined') {
      this.startDiscoveryLoop();
      import('./CommandBus').then(({ CommandBus }) => {
        CommandBus.getInstance().subscribeToSignals((command) => {
          this.handleIncomingSignal(command);
        });
      });

      // Instant WebRTC connection pre-establishment on online devices change
      usePlayerStore.subscribe((state) => {
        if (state.onlineDevices) {
          this.reconcilePeerConnections(state.onlineDevices);
        }
      });
    }
  }

  public static getInstance(): LocalPeerConnection {
    if (!LocalPeerConnection.instance) {
      LocalPeerConnection.instance = new LocalPeerConnection();
    }
    return LocalPeerConnection.instance;
  }

  private reconcilePeerConnections(onlineDevices: any[]) {
    const store = usePlayerStore.getState();
    const localId = store.deviceId;
    if (!localId || !store.playbackSession) return;

    // Filter out our own device
    const peerDevices = onlineDevices.filter(d => d.id !== localId);
    
    // Create a unique key of current online device IDs to detect changes
    const devicesKey = peerDevices.map(d => d.id).sort().join(',');
    if (devicesKey === this.lastDevicesKey) return;
    this.lastDevicesKey = devicesKey;

    console.log(`[LocalPeer] Reconciling peer connections instantly for devices: [${devicesKey}]`);

    peerDevices.forEach((device) => {
      // Lexicographical tie-breaker: smaller device ID initiates WebRTC offer
      if (localId < device.id) {
        if (!this.peerConnections.has(device.id)) {
          this.initiateConnection(device.id).catch(() => {});
        }
      }
    });
  }

  private startDiscoveryLoop() {
    this.checkInterval = setInterval(() => {
      const store = usePlayerStore.getState();
      const localId = store.deviceId;
      if (!localId || !store.playbackSession) return;

      store.onlineDevices.forEach((device) => {
        if (device.id === localId) return;

        // Lexicographical tie-breaker: smaller device ID initiates WebRTC offer
        if (localId < device.id) {
          if (!this.peerConnections.has(device.id)) {
            this.initiateConnection(device.id);
          }
        }
      });
    }, 10000);
  }

  private async initiateConnection(targetId: string) {
    console.log(`[LocalPeer] Initiating direct WebRTC connection to ${targetId}`);
    
    const configuration: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    
    const pc = new RTCPeerConnection(configuration);
    this.peerConnections.set(targetId, pc);

    const dc = pc.createDataChannel('raagax-control');
    this.setupDataChannel(targetId, dc);

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
    }
  }

  private setupDataChannel(targetId: string, dc: RTCDataChannel) {
    this.dataChannels.set(targetId, dc);

    dc.onopen = () => {
      console.log(`[LocalPeer] Direct LAN channel opened with device: ${targetId}`);
      ConnectivityRouter.getInstance().setLocalPeerAvailable(true);
    };

    dc.onclose = () => {
      console.log(`[LocalPeer] Direct LAN channel closed with device: ${targetId}`);
      this.cleanup(targetId);
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && (msg.event === 'STATE_UPDATE' || msg.type === 'STATE_UPDATE')) {
          console.log(`[LocalPeer] Received direct state update`);
          import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
            PlaybackStateSync.getInstance().handleRemoteStateUpdate(msg.payload);
          });
        } else {
          console.log(`[LocalPeer] Received direct command: ${msg.type}`);
          import('./CommandBus').then(({ CommandBus }) => {
            CommandBus.getInstance().handleIncomingCommand(msg);
          });
        }
      } catch (e) {
        console.error('[LocalPeer] Failed to process message:', e);
      }
    };
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
        this.setupDataChannel(senderId, event.channel);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal(senderId, {
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendSignal(senderId, {
        type: 'answer',
        sdp: answer
      });

    } else if (signal.type === 'answer') {
      console.log(`[LocalPeer] Received answer from ${senderId}`);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      }
    } else if (signal.type === 'candidate') {
      if (pc && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
    this.dataChannels.forEach((dc, targetId) => {
      if (dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(command));
          sentCount++;
        } catch {}
      }
    });
    return sentCount > 0;
  }

  private cleanup(deviceId: string) {
    const pc = this.peerConnections.get(deviceId);
    if (pc) {
      try { pc.close(); } catch {}
      this.peerConnections.delete(deviceId);
    }
    this.dataChannels.delete(deviceId);

    // If no more open direct connections remain, mark local transport unavailable
    let anyOpen = false;
    this.dataChannels.forEach((dc) => {
      if (dc.readyState === 'open') anyOpen = true;
    });
    
    if (!anyOpen) {
      ConnectivityRouter.getInstance().setLocalPeerAvailable(false);
    }
  }
}
