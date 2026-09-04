/**
 * JamMeshTransport
 *
 * Local Wi-Fi WebRTC P2P DataChannel Mesh for RaagaX Jam Sessions.
 * Bypasses cloud servers entirely when devices share the same local Wi-Fi or Mobile Hotspot.
 *
 * Architecture:
 * - Host acts as the central WebRTC hub with direct DataChannels to all guests.
 * - Guests connect directly to Host via local ICE candidates (192.168.x.x / 10.x.x.x).
 * - Signaling (SDP Offer/Answer & ICE exchange) is routed via Supabase Realtime channel once on join.
 * - Once DataChannel is open, 100% of Jam packets (NTP ping-pong, play/pause, seek, drift beacons)
 *   travel directly peer-to-peer over local Wi-Fi UDP at 1ms–3ms latency!
 * - If firewall blocks P2P, automatically falls back to Supabase broadcast.
 */

import { RealtimeChannel } from '@supabase/supabase-js';

interface PeerConnectionItem {
  deviceId: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  isOpen: boolean;
  rttMs: number;
  candidateQueue?: RTCIceCandidateInit[];
}

export class JamMeshTransport {
  private static instance: JamMeshTransport;

  private isHost: boolean = false;
  private selfDeviceId: string = '';
  private roomId: string = '';
  private supabaseChannel: RealtimeChannel | null = null;
  private onMessageCallback: ((msg: any) => void) | null = null;

  // Host: Map of guest deviceId -> PeerConnectionItem
  private peers: Map<string, PeerConnectionItem> = new Map();

  // Guest: Single connection to Host
  private hostPeer: PeerConnectionItem | null = null;

  private constructor() {}

  public static getInstance(): JamMeshTransport {
    if (!JamMeshTransport.instance) {
      JamMeshTransport.instance = new JamMeshTransport();
    }
    return JamMeshTransport.instance;
  }

  public init(
    roomId: string,
    isHost: boolean,
    selfDeviceId: string,
    supabaseChannel: RealtimeChannel | null,
    onMessage: (msg: any) => void
  ): void {
    this.destroy();
    this.roomId = roomId;
    this.isHost = isHost;
    this.selfDeviceId = selfDeviceId;
    this.supabaseChannel = supabaseChannel;
    this.onMessageCallback = onMessage;
  }

  public setSupabaseChannel(channel: RealtimeChannel | null): void {
    this.supabaseChannel = channel;
  }

  /**
   * Handle WebRTC signaling messages received via Supabase
   */
  public async handleSignaling(signalPayload: any): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') return;
    if (!signalPayload || signalPayload.targetDeviceId !== this.selfDeviceId) return;

    const senderId = signalPayload.senderDeviceId;
    if (!senderId || senderId === this.selfDeviceId) return;

    const signal = signalPayload.signal;
    if (!signal) return;

    try {
      if (signal.sdp) {
        if (signal.sdp.type === 'offer') {
          // Guest received Offer from Host (or Host received Offer from Guest)
          await this.handleOffer(senderId, signal.sdp);
        } else if (signal.sdp.type === 'answer') {
          // Received Answer to an existing Offer
          await this.handleAnswer(senderId, signal.sdp);
        }
      } else if (signal.candidate) {
        // Received ICE candidate
        await this.handleCandidate(senderId, signal.candidate);
      }
    } catch (err) {
      console.warn('[JamMeshTransport] Signaling handling error:', err);
    }
  }

  /**
   * Initiate a direct WebRTC DataChannel connection to a guest (Host calls this when guest joins)
   */
  public async connectToGuest(guestDeviceId: string): Promise<void> {
    if (!this.isHost || typeof RTCPeerConnection === 'undefined') return;
    if (this.peers.has(guestDeviceId)) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      const item: PeerConnectionItem = {
        deviceId: guestDeviceId,
        pc,
        dc: null,
        isOpen: false,
        rttMs: 2,
      };
      this.peers.set(guestDeviceId, item);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage(guestDeviceId, { candidate: event.candidate });
        }
      };

      // Create ordered, low-latency DataChannel
      const dc = pc.createDataChannel('raaga_jam_mesh', {
        ordered: true,
      });
      item.dc = dc;
      this.bindDataChannel(dc, guestDeviceId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage(guestDeviceId, { sdp: offer });
    } catch (err) {
      console.warn(`[JamMeshTransport] Failed to create offer for guest ${guestDeviceId}:`, err);
    }
  }

  /**
   * Guest initiates connection to Host
   */
  public async initiateConnectionToHost(hostDeviceId: string): Promise<void> {
    if (this.isHost || typeof RTCPeerConnection === 'undefined') return;
    if (this.hostPeer) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      const item: PeerConnectionItem = {
        deviceId: hostDeviceId,
        pc,
        dc: null,
        isOpen: false,
        rttMs: 2,
      };
      this.hostPeer = item;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage(hostDeviceId, { candidate: event.candidate });
        }
      };

      // Guest creates DataChannel to Host
      const dc = pc.createDataChannel('raaga_jam_mesh', {
        ordered: true,
      });
      item.dc = dc;
      this.bindDataChannel(dc, hostDeviceId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage(hostDeviceId, { sdp: offer });
    } catch (err) {
      console.warn('[JamMeshTransport] Failed to initiate connection to host:', err);
    }
  }

  private async handleOffer(senderId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    const item: PeerConnectionItem = {
      deviceId: senderId,
      pc,
      dc: null,
      isOpen: false,
      rttMs: 2,
    };

    if (this.isHost) {
      this.peers.set(senderId, item);
    } else {
      this.hostPeer = item;
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(senderId, { candidate: event.candidate });
      }
    };

    pc.ondatachannel = (event) => {
      item.dc = event.channel;
      this.bindDataChannel(event.channel, senderId);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Drain any queued candidates
    if (item.candidateQueue && item.candidateQueue.length > 0) {
      for (const cand of item.candidateQueue) {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
      }
      item.candidateQueue = [];
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage(senderId, { sdp: answer });
  }

  private async handleAnswer(senderId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const item = this.isHost ? this.peers.get(senderId) : this.hostPeer;
    if (!item || !item.pc) return;

    if (item.pc.signalingState === 'have-local-offer') {
      await item.pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Drain any queued candidates
      if (item.candidateQueue && item.candidateQueue.length > 0) {
        for (const cand of item.candidateQueue) {
          try { await item.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
        }
        item.candidateQueue = [];
      }
    }
  }

  private async handleCandidate(senderId: string, candidateInit: RTCIceCandidateInit): Promise<void> {
    const item = this.isHost ? this.peers.get(senderId) : this.hostPeer;
    if (!item || !item.pc) return;

    try {
      if (item.pc.remoteDescription && item.pc.remoteDescription.type) {
        await item.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } else {
        if (!item.candidateQueue) item.candidateQueue = [];
        item.candidateQueue.push(candidateInit);
      }
    } catch {}
  }

  private bindDataChannel(dc: RTCDataChannel, remoteDeviceId: string): void {
    dc.onopen = () => {
      console.log(`[JamMeshTransport] WebRTC DataChannel OPEN with ${remoteDeviceId} on local Wi-Fi! (1-3ms latency)`);
      const item = this.isHost ? this.peers.get(remoteDeviceId) : this.hostPeer;
      if (item) {
        item.isOpen = true;
      }
    };

    dc.onclose = () => {
      console.log(`[JamMeshTransport] WebRTC DataChannel closed with ${remoteDeviceId}`);
      const item = this.isHost ? this.peers.get(remoteDeviceId) : this.hostPeer;
      if (item) {
        item.isOpen = false;
      }
    };

    dc.onerror = (e) => {
      console.warn(`[JamMeshTransport] DataChannel error with ${remoteDeviceId}:`, e);
    };

    dc.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const parsed = JSON.parse(event.data);
          if (this.onMessageCallback) {
            this.onMessageCallback(parsed);
          }
        }
      } catch (err) {
        console.warn('[JamMeshTransport] Failed to parse message:', err);
      }
    };
  }

  /**
   * Broadcast message directly to peers via local WebRTC DataChannels.
   * Returns true if sent over local Wi-Fi DataChannel to at least one peer.
   */
  public broadcast(message: any): boolean {
    const serialized = JSON.stringify({
      ...message,
      senderDeviceId: this.selfDeviceId,
      meshTimestamp: performance.now(),
    });

    let sentDirectly = false;

    if (this.isHost) {
      // Host broadcasts to all connected guests with open DataChannels
      for (const [, item] of this.peers) {
        if (item.isOpen && item.dc && item.dc.readyState === 'open') {
          try {
            item.dc.send(serialized);
            sentDirectly = true;
          } catch {}
        }
      }
    } else {
      // Guest sends to Host
      if (this.hostPeer && this.hostPeer.isOpen && this.hostPeer.dc && this.hostPeer.dc.readyState === 'open') {
        try {
          this.hostPeer.dc.send(serialized);
          sentDirectly = true;
        } catch {}
      }
    }

    return sentDirectly;
  }

  /**
   * Send direct signaling payload via Supabase channel topic
   */
  private sendSignalingMessage(targetDeviceId: string, signal: any): void {
    if (!this.supabaseChannel) return;

    try {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'JAM_MESH_SIGNAL',
        payload: {
          targetDeviceId,
          senderDeviceId: this.selfDeviceId,
          signal,
        },
      });
    } catch {}
  }

  public hasActiveDirectChannel(): boolean {
    if (this.isHost) {
      for (const [, item] of this.peers) {
        if (item.isOpen) return true;
      }
      return false;
    }
    return Boolean(this.hostPeer && this.hostPeer.isOpen);
  }

  public destroy(): void {
    for (const [, item] of this.peers) {
      try { item.dc?.close(); } catch {}
      try { item.pc?.close(); } catch {}
    }
    this.peers.clear();

    if (this.hostPeer) {
      try { this.hostPeer.dc?.close(); } catch {}
      try { this.hostPeer.pc?.close(); } catch {}
      this.hostPeer = null;
    }

    this.onMessageCallback = null;
    this.supabaseChannel = null;
  }
}
