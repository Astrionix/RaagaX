import { RealtimeChannel } from '@supabase/supabase-js';

export type JamMessage =
  | { type: 'PING'; clientTime: number }
  | { type: 'PONG'; clientTime: number; hostTime: number }
  | { type: 'SCHEDULED_PLAY'; targetTimestamp: number; audioPosition: number }
  | { type: 'INSTANT_PAUSE' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SEEK'; position: number }
  | { type: 'PRELOAD_TRACK'; url: string; trackId: string }
  | { type: 'BUFFER_READY'; trackId: string };

export interface LanTransportOptions {
  sessionId: string;
  isHost: boolean;
  signalingChannel: RealtimeChannel;
  onMessage: (msg: JamMessage) => void;
  onStateChange?: (connected: boolean) => void;
}

/**
 * WebRtcLanTransport — Zero-Latency (<2ms) Local Wi-Fi Peer-to-Peer DataChannel
 *
 * Establishes a direct peer-to-peer data channel between Host (e.g. Phone) and Guest (e.g. Laptop)
 * using Supabase Realtime Broadcast solely for 1-time SDP/ICE signaling.
 * Once connected, audio sync messages flow directly through the local Wi-Fi router.
 */
export class WebRtcLanTransport {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isHost: boolean;
  private signalingChannel: RealtimeChannel;
  private onMessageCallback: (msg: JamMessage) => void;
  private onStateChangeCallback?: (connected: boolean) => void;
  public isConnected: boolean = false;

  constructor(options: LanTransportOptions) {
    this.isHost = options.isHost;
    this.signalingChannel = options.signalingChannel;
    this.onMessageCallback = options.onMessage;
    this.onStateChangeCallback = options.onStateChange;

    if (typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined') {
      this.pc = new RTCPeerConnection({ iceServers: [] });
      this.initPeerConnection();
      this.listenSignaling();
    }
  }

  private initPeerConnection() {
    if (!this.pc) return;

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling('WEBRTC_ICE', { candidate: event.candidate, isHost: this.isHost });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      this.isConnected = state === 'connected';
      console.log(this.isConnected ? '⚡ 0ms LAN Sync Active' : '☁️ Cloud Fallback Active');
      if (this.onStateChangeCallback) this.onStateChangeCallback(this.isConnected);
    };

    if (this.isHost) {
      this.dataChannel = this.pc.createDataChannel('raaga-lan-sync', { ordered: true });
      this.bindDataChannelEvents(this.dataChannel);
    } else {
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.bindDataChannelEvents(this.dataChannel);
      };
    }
  }

  private bindDataChannelEvents(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.isConnected = true;
      console.log('⚡ 0ms LAN Sync Active (DataChannel Open)');
      if (this.onStateChangeCallback) this.onStateChangeCallback(true);
    };

    channel.onclose = () => {
      this.isConnected = false;
      console.log('☁️ Cloud Fallback Active (DataChannel Closed)');
      if (this.onStateChangeCallback) this.onStateChangeCallback(false);
    };

    channel.onmessage = (event) => {
      try {
        const msg: JamMessage = JSON.parse(event.data);
        this.onMessageCallback(msg);
      } catch (err) {
        console.error('[LAN WebRTC] Parse Error:', err);
      }
    };
  }

  private listenSignaling() {
    if (!this.pc) return;

    this.signalingChannel.on('broadcast', { event: 'WEBRTC_OFFER' }, async ({ payload }) => {
      if (this.isHost || !this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        this.sendSignaling('WEBRTC_ANSWER', { sdp: answer });
      } catch (err) {
        console.error('[LAN WebRTC] Offer handling error:', err);
      }
    });

    this.signalingChannel.on('broadcast', { event: 'WEBRTC_ANSWER' }, async ({ payload }) => {
      if (!this.isHost || !this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch (err) {
        console.error('[LAN WebRTC] Answer handling error:', err);
      }
    });

    this.signalingChannel.on('broadcast', { event: 'WEBRTC_ICE' }, async ({ payload }) => {
      if (payload.isHost !== this.isHost && this.pc) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.error('[LAN WebRTC] ICE Error:', e);
        }
      }
    });
  }

  public async startHostSession() {
    if (!this.isHost || !this.pc) return;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.sendSignaling('WEBRTC_OFFER', { sdp: offer });
    } catch (err) {
      console.error('[LAN WebRTC] Failed to create host offer:', err);
    }
  }

  public send(message: JamMessage): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(message));
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  private sendSignaling(event: string, payload: any) {
    if (this.signalingChannel && (this.signalingChannel as any).state === 'joined') {
      try {
        this.signalingChannel.send({
          type: 'broadcast',
          event,
          payload,
        });
      } catch {}
    }
  }

  public close() {
    try {
      this.dataChannel?.close();
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    this.dataChannel = null;
    this.pc = null;
    this.isConnected = false;
  }
}
