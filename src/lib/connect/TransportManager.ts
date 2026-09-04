import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DeviceIdentityManager } from './DeviceIdentityManager';
import { DiscoveryEngine } from './DiscoveryEngine';

export type TransportType = 'LAN' | 'CLOUD' | 'NONE';

export class TransportManager {
  private static instance: TransportManager;
  private cloudChannel: RealtimeChannel | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private activeTransport: TransportType = 'NONE';
  private connectionId: string | null = null;
  private targetDeviceId: string | null = null;
  private hasSetRemoteAnswer: boolean = false;

  private messageHandlers: Set<(event: string, payload: any) => void> = new Set();
  private transportChangeHandlers: Set<(t: TransportType) => void> = new Set();

  private constructor() {
    DiscoveryEngine.getInstance().setDirectMessageCallback(async (event, data) => {
      if (event === 'WEBRTC_SIGNAL') {
        await this.handleWebRtcSignal(data?.signal || data);
      } else {
        this.emitMessage(event, data);
      }
    });
  }

  public emitIncomingMessage(event: string, data: any): void {
    this.emitMessage(event, data);
  }

  public static getInstance(): TransportManager {
    if (!TransportManager.instance) {
      TransportManager.instance = new TransportManager();
    }
    return TransportManager.instance;
  }

  public async establishTransport(
    connectionId: string,
    targetDeviceId: string,
    isInitiator: boolean
  ): Promise<TransportType> {
    this.connectionId = connectionId;
    this.targetDeviceId = targetDeviceId;
    this.hasSetRemoteAnswer = false;

    // 1. Establish Cloud Relay as immediate, guaranteed signaling & control transport
    this.setupCloudRelay(connectionId);

    // 2. Attempt Direct WebRTC Local LAN DataChannel negotiation in background
    try {
      await this.setupWebRtcDataChannel(connectionId, targetDeviceId, isInitiator);
    } catch {
      // Direct WebRTC blocked by router firewall or NAT -> gracefully stay on Cloud Relay
    }

    return this.activeTransport;
  }

  private setupCloudRelay(connectionId: string): void {
    if (this.cloudChannel) {
      try { supabase.removeChannel(this.cloudChannel); } catch {}
      this.cloudChannel = null;
    }

    const self = DeviceIdentityManager.getInstance().getDevice();
    const topic = `raaga_relay_${connectionId}`;
    try {
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}` || c.topic === topic);
      if (existing) supabase.removeChannel(existing);
    } catch {}

    this.cloudChannel = supabase.channel(topic);
    this.cloudChannel
      .on('broadcast', { event: 'CONNECT_MSG' }, ({ payload }) => {
        if (payload.senderDeviceId !== self.deviceId) {
          this.emitMessage(payload.event, payload.data);
        }
      })
      .on('broadcast', { event: 'WEBRTC_SIGNAL' }, async ({ payload }) => {
        if (payload.targetDeviceId === self.deviceId && payload.senderDeviceId !== self.deviceId) {
          await this.handleWebRtcSignal(payload.signal);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && this.activeTransport === 'NONE') {
          this.setActiveTransport('CLOUD');
        }
      });
  }

  private async setupWebRtcDataChannel(
    connectionId: string,
    targetDeviceId: string,
    isInitiator: boolean
  ): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;

    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const self = DeviceIdentityManager.getInstance().getDevice();
          const signalPayload = {
            targetDeviceId,
            senderDeviceId: self.deviceId,
            signal: { candidate: event.candidate },
          };
          DiscoveryEngine.getInstance().sendDirectMessage(targetDeviceId, 'WEBRTC_SIGNAL', signalPayload);
          if (this.isChannelJoined(this.cloudChannel)) {
            this.cloudChannel!.send({
              type: 'broadcast',
              event: 'WEBRTC_SIGNAL',
              payload: signalPayload,
            });
          }
        }
      };

      if (isInitiator) {
        this.dataChannel = this.peerConnection.createDataChannel('raaga_lan_data');
        this.bindDataChannel(this.dataChannel);

        const offer = await this.peerConnection.createOffer();
        if (this.peerConnection.signalingState === 'stable') {
          await this.peerConnection.setLocalDescription(offer);

          const self = DeviceIdentityManager.getInstance().getDevice();
          const signalPayload = {
            targetDeviceId,
            senderDeviceId: self.deviceId,
            signal: { sdp: offer },
          };
          DiscoveryEngine.getInstance().sendDirectMessage(targetDeviceId, 'WEBRTC_SIGNAL', signalPayload);
          if (this.isChannelJoined(this.cloudChannel)) {
            this.cloudChannel!.send({
              type: 'broadcast',
              event: 'WEBRTC_SIGNAL',
              payload: signalPayload,
            });
          }
        }
      } else {
        this.peerConnection.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.bindDataChannel(this.dataChannel);
        };
      }
    } catch (err) {
      console.warn('[Connect] WebRTC setup error, remaining on Cloud Relay:', err);
    }
  }

  private isChannelJoined(channel: RealtimeChannel | null): boolean {
    return !!channel && (channel as any).state === 'joined';
  }

  private async handleWebRtcSignal(signal: any): Promise<void> {
    if (!this.peerConnection || !signal) return;

    try {
      if (signal.sdp) {
        if (signal.sdp.type === 'offer') {
          if (this.peerConnection.signalingState === 'closed') return;

          // If we are currently in an offer state (glare), rollback to handle remote offer
          if (this.peerConnection.signalingState !== 'stable') {
            try {
              await this.peerConnection.setLocalDescription({ type: 'rollback' });
            } catch {}
          }

          if (this.peerConnection.signalingState !== 'stable') return;

          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Only call createAnswer & setLocalDescription if signalingState is have-remote-offer
          if ((this.peerConnection.signalingState as RTCSignalingState) === 'have-remote-offer') {
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            const self = DeviceIdentityManager.getInstance().getDevice();
            const signalPayload = {
              targetDeviceId: this.targetDeviceId,
              senderDeviceId: self.deviceId,
              signal: { sdp: answer },
            };
            if (this.targetDeviceId) {
              DiscoveryEngine.getInstance().sendDirectMessage(this.targetDeviceId, 'WEBRTC_SIGNAL', signalPayload);
            }
            if (this.isChannelJoined(this.cloudChannel)) {
              this.cloudChannel!.send({
                type: 'broadcast',
                event: 'WEBRTC_SIGNAL',
                payload: signalPayload,
              });
            }
          }
        } else if (signal.sdp.type === 'answer') {
          // Prevent concurrency race conditions and duplicate signals arriving over LAN + Cloud simultaneously
          if (this.hasSetRemoteAnswer || this.peerConnection.signalingState !== 'have-local-offer') {
            return;
          }
          this.hasSetRemoteAnswer = true;
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.candidate) {
        if (this.peerConnection.signalingState !== 'closed') {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === 'InvalidStateError' && this.peerConnection?.signalingState === 'stable') {
        return;
      }
      console.warn('[Connect] WebRTC signal exchange recovered to Cloud Relay:', err);
      if (this.cloudChannel && this.activeTransport === 'NONE') {
        this.setActiveTransport('CLOUD');
      }
    }
  }

  private bindDataChannel(dc: RTCDataChannel): void {
    dc.onopen = () => {
      // Local LAN DataChannel connected successfully! Upgrade to LAN
      this.setActiveTransport('LAN');
    };

    dc.onclose = () => {
      // If LAN drops, seamlessly fall back to Cloud Relay
      if (this.cloudChannel) {
        this.setActiveTransport('CLOUD');
      } else {
        this.setActiveTransport('NONE');
      }
    };

    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.emitMessage(parsed.event, parsed.data);
      } catch {}
    };
  }

  public setTargetDeviceId(deviceId: string): void {
    this.targetDeviceId = deviceId;
  }

  public sendMessage(event: string, data: any, targetOverride?: string): void {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const effectiveTarget = targetOverride || this.targetDeviceId || '*';

    // Priority 1: Direct WebRTC DataChannel (if open)
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ event, data }));
        return;
      } catch {}
    }

    // Priority 2: Relay Channel (if mounted and joined)
    if (this.isChannelJoined(this.cloudChannel)) {
      try {
        this.cloudChannel!.send({
          type: 'broadcast',
          event: 'CONNECT_MSG',
          payload: {
            event,
            data,
            senderDeviceId: self.deviceId,
            targetDeviceId: effectiveTarget,
            timestamp: Date.now(),
          },
        });
        return; // Dedicated session relay channel delivered the message. Avoid multi-casting over discovery channels.
      } catch {}
    }

    // Priority 3: Discovery Mesh Broadcast (fallback when no dedicated transport is established)
    if (effectiveTarget) {
      DiscoveryEngine.getInstance().sendDirectMessage(effectiveTarget, event, data);
    }
  }

  public onMessage(handler: (event: string, payload: any) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public onTransportChange(handler: (t: TransportType) => void): () => void {
    this.transportChangeHandlers.add(handler);
    return () => {
      this.transportChangeHandlers.delete(handler);
    };
  }

  public getActiveTransport(): TransportType {
    return this.activeTransport;
  }

  private setActiveTransport(t: TransportType): void {
    if (this.activeTransport !== t) {
      this.activeTransport = t;
      this.transportChangeHandlers.forEach((cb) => cb(t));
    }
  }

  private emitMessage(event: string, payload: any): void {
    this.messageHandlers.forEach((cb) => cb(event, payload));
  }

  public teardown(): void {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    if (this.cloudChannel) {
      try { supabase.removeChannel(this.cloudChannel); } catch {}
      this.cloudChannel = null;
    }
    this.setActiveTransport('NONE');
    this.connectionId = null;
    this.targetDeviceId = null;
  }
}
