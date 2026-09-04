/**
 * JamSessionManager
 *
 * Real-time collaborative group listening sessions for RaagaX.
 * Connects directly to the dedicated WebSocket coordinator on Render
 * (wss://raaga-sync-server.onrender.com).
 *
 * Features:
 * 1. Start Jam (Host): Creates room, shares playback state & queue in real-time.
 * 2. Join Jam (Participant): Joins room via 6-digit PIN or link, syncs queue & playback.
 * 3. Shared Queue: Any participant can queue tracks collaboratively.
 */

import { getSyncWebSocketUrl } from '@/lib/config/apiConfig';
import { DeviceIdentityManager } from '@/lib/connect/DeviceIdentityManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { Song } from '@/types/music';
import { DriftCorrectionEngine } from './DriftCorrectionEngine';

export interface JamState {
  isInJam: boolean;
  isHost: boolean;
  roomId: string | null;
  roomPin: string | null;
  participantCount: number;
  hostDeviceId: string | null;
  syncLatencyMs: number;
  allowGuestControl: boolean;
}

export class JamSessionManager {
  private static instance: JamSessionManager;
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private driftBeaconTimer: any = null;
  private subscribers: Set<(state: JamState) => void> = new Set();

  private currentState: JamState = {
    isInJam: false,
    isHost: false,
    roomId: null,
    roomPin: null,
    participantCount: 1,
    hostDeviceId: null,
    syncLatencyMs: 0,
    allowGuestControl: true,
  };

  private isHandlingRemoteUpdate = false;

  private constructor() {
    // Listen for window unload to gracefully leave room
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.leaveJam();
      });

      usePlayerStore.subscribe((state, prevState) => {
        if (!this.currentState.isInJam) return;
        if (this.isHandlingRemoteUpdate) return; // Prevent echo loop

        const isSongChanged = state.currentSong?.id !== prevState.currentSong?.id;
        const isPlayStateChanged = state.isPlaying !== prevState.isPlaying;
        const isQueueChanged = state.queueIndex !== prevState.queueIndex;
        const isSeeked = Math.abs((state.currentTime || 0) - (prevState.currentTime || 0)) > 2.5;

        // If Guest and Host has restricted playback control to Host-Only:
        if (!this.currentState.isHost && !this.currentState.allowGuestControl) {
          if (isSongChanged || isPlayStateChanged || isSeeked) {
            usePlayerStore.getState().setToastMessage('Only the host can control playback in this Jam 🔒');
            return;
          }
        }

        if (isSongChanged || isPlayStateChanged || isQueueChanged || isSeeked) {
          this.broadcastCurrentPlaybackState();
        }
      });
    }
  }

  public static getInstance(): JamSessionManager {
    if (!JamSessionManager.instance) {
      JamSessionManager.instance = new JamSessionManager();
    }
    return JamSessionManager.instance;
  }

  public getState(): JamState {
    return { ...this.currentState };
  }

  public subscribe(cb: (state: JamState) => void): () => void {
    this.subscribers.add(cb);
    cb(this.currentState);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify(): void {
    const copy = this.getState();
    this.subscribers.forEach((cb) => cb(copy));
  }

  // ── 1. Start a New Jam Session (Host) ──────────────────────────────────────
  public async startJam(): Promise<{ roomId: string; roomPin: string; inviteUrl: string }> {
    // Mutual Exclusion: Cannot run Jam while connected to a remote Connect speaker
    try {
      const { connectEngine } = await import('@/lib/connect/ConnectEngine');
      if (!connectEngine.isLocalSpeaker() || connectEngine.getActiveControllerDeviceId() !== null) {
        const self = DeviceIdentityManager.getInstance().getDevice();
        await connectEngine.switchPlaybackTo(self.deviceId);
        usePlayerStore.getState().setToastMessage('Switched playback to This Device for Jam 🎧');
      }
    } catch {}

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const roomId = `jam_${pin}`;
    const self = DeviceIdentityManager.getInstance().getDevice();

    this.currentState = {
      isInJam: true,
      isHost: true,
      roomId,
      roomPin: pin,
      participantCount: 1,
      hostDeviceId: self.deviceId,
      syncLatencyMs: 0,
      allowGuestControl: true,
    };
    this.notify();

    await this.connectWebSocket(roomId, true);

    // Broadcast current song and queue to room
    this.broadcastCurrentPlaybackState();
    this.startDriftSyncBeacon();

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://raaga.me';
    const inviteUrl = `${origin}?jam=${pin}`;
    return { roomId, roomPin: pin, inviteUrl };
  }

  // ── 2. Join an Existing Jam Session (Guest) ────────────────────────────────
  public async joinJam(pinOrRoomId: string): Promise<boolean> {
    // Mutual Exclusion: Cannot run Jam while connected to a remote Connect speaker
    try {
      const { connectEngine } = await import('@/lib/connect/ConnectEngine');
      if (!connectEngine.isLocalSpeaker() || connectEngine.getActiveControllerDeviceId() !== null) {
        const self = DeviceIdentityManager.getInstance().getDevice();
        await connectEngine.switchPlaybackTo(self.deviceId);
        usePlayerStore.getState().setToastMessage('Switched playback to This Device for Jam 🎧');
      }
    } catch {}

    const clean = pinOrRoomId.trim().replace(/^jam_/i, '');
    const roomId = `jam_${clean}`;

    this.currentState = {
      isInJam: true,
      isHost: false,
      roomId,
      roomPin: clean,
      participantCount: 2,
      hostDeviceId: null,
      syncLatencyMs: 0,
      allowGuestControl: true,
    };
    this.notify();

    return this.connectWebSocket(roomId, false);
  }

  // ── 3. Leave Current Jam ───────────────────────────────────────────────────
  public leaveJam(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentState.roomId) {
      try {
        const self = DeviceIdentityManager.getInstance().getDevice();
        this.ws.send(JSON.stringify({
          type: 'LEAVE_ROOM',
          roomId: this.currentState.roomId,
          deviceId: self.deviceId,
        }));
      } catch {}
    }

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.driftBeaconTimer) {
      clearInterval(this.driftBeaconTimer);
      this.driftBeaconTimer = null;
    }

    DriftCorrectionEngine.getInstance().stop();

    this.currentState = {
      isInJam: false,
      isHost: false,
      roomId: null,
      roomPin: null,
      participantCount: 1,
      hostDeviceId: null,
      syncLatencyMs: 0,
      allowGuestControl: true,
    };
    this.notify();
  }

  // ── 4. Broadcast Host Playback Changes to Room ─────────────────────────────
  public broadcastCurrentPlaybackState(): void {
    if (!this.currentState.isInJam || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const store = usePlayerStore.getState();
    const playback = PlaybackService.getInstance();
    let posSec = store.currentTime || 0;
    try {
      const active = playback.getActiveAudio();
      if (active && !isNaN(active.currentTime) && active.currentTime >= 0) {
        posSec = active.currentTime;
      }
    } catch {}

    const payload = {
      track: store.currentSong,
      isPlaying: store.isPlaying,
      positionMs: Math.round(posSec * 1000),
      queue: store.queue || [],
      queueIndex: store.queueIndex || 0,
      allowGuestControl: this.currentState.allowGuestControl,
      timestamp: Date.now(),
    };

    try {
      this.ws.send(JSON.stringify({
        type: 'BROADCAST_STATE',
        roomId: this.currentState.roomId,
        payload,
      }));
    } catch (err) {
      console.warn('[Jam] Error broadcasting state to room:', err);
    }
  }

  // ── 5. Add Track to Shared Jam Queue ───────────────────────────────────────
  public async addTrackToJam(track: Song): Promise<void> {
    const store = usePlayerStore.getState();
    const currentQueue = store.queue || [];
    const updatedQueue = [...currentQueue, track];

    store.addToQueue(track);
    this.broadcastQueueChange(updatedQueue, store.queueIndex, track);
  }

  // ── 6. Broadcast Queue Changes to Jam Room ─────────────────────────────────
  public broadcastQueueChange(queue: Song[], queueIndex: number, addedTrack?: Song): void {
    if (!this.currentState.isInJam || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'ROOM_BROADCAST',
        roomId: this.currentState.roomId,
        payload: {
          queue,
          queueIndex,
          addedTrack,
        },
      }));
    } catch (err) {
      console.warn('[Jam] Error broadcasting queue change:', err);
    }
  }

  // ── 7. Toggle Host vs Guest Playback Control Permission ────────────────────
  public setAllowGuestControl(allow: boolean): void {
    if (!this.currentState.isHost) return;
    this.currentState.allowGuestControl = allow;
    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentState.roomId) {
      try {
        this.ws.send(JSON.stringify({
          type: 'ROOM_BROADCAST',
          roomId: this.currentState.roomId,
          payload: {
            type: 'JAM_SETTINGS_UPDATE',
            allowGuestControl: allow,
          },
        }));
      } catch (err) {
        console.warn('[Jam] Error broadcasting control setting:', err);
      }
    }
  }

  // ── Internal WebSocket Connection ──────────────────────────────────────────
  private async connectWebSocket(roomId: string, isHost: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const wsUrl = getSyncWebSocketUrl() || 'wss://raaga-sync-server.onrender.com';
      const self = DeviceIdentityManager.getInstance().getDevice();

      try {
        if (this.ws) {
          try { this.ws.close(); } catch {}
        }

        console.log(`[Jam] Connecting to WebSocket relay: ${wsUrl} for room ${roomId}`);
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
          console.log(`[Jam] Connected. Joining room: ${roomId}`);
          ws.send(JSON.stringify({
            type: 'JOIN_ROOM',
            roomId,
            deviceId: self.deviceId,
            isHost,
          }));

          // Start ping heartbeat
          this.startHeartbeat();
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncomingMessage(data);
          } catch {}
        };

        ws.onerror = (err) => {
          console.warn('[Jam] WebSocket error:', err);
          resolve(false);
        };

        ws.onclose = () => {
          console.log('[Jam] WebSocket closed');
        };

        // Safety timeout
        setTimeout(() => resolve(true), 2500);
      } catch (err) {
        console.warn('[Jam] Connection exception:', err);
        resolve(false);
      }
    });
  }

  private handleIncomingMessage(msg: any): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'PARTICIPANT_JOINED':
        if (typeof msg.count === 'number') {
          const prev = this.currentState.participantCount;
          this.currentState.participantCount = msg.count;
          this.notify();
          if (msg.count > prev && this.currentState.isHost) {
            usePlayerStore.getState().setToastMessage('A friend joined your Jam! 🎧');
          }
        }
        // Host immediately synchronizes authoritative state with the new listener
        if (this.currentState.isHost) {
          this.broadcastCurrentPlaybackState();
        }
        break;

      case 'PARTICIPANT_LEFT':
        if (typeof msg.count === 'number') {
          this.currentState.participantCount = msg.count;
          this.notify();
          usePlayerStore.getState().setToastMessage('A participant left the Jam session.');
        }
        break;

      case 'STATE_UPDATED':
        if (msg.payload?.type === 'JAM_SETTINGS_UPDATE') {
          this.currentState.allowGuestControl = Boolean(msg.payload.allowGuestControl);
          this.notify();
          usePlayerStore.getState().setToastMessage(
            this.currentState.allowGuestControl
              ? 'Host enabled group playback control! 👥'
              : 'Host locked playback control (Host-Only) 🔒'
          );
          return;
        }

        if (msg.payload?.addedTrack?.title) {
          usePlayerStore.getState().setToastMessage(`"${msg.payload.addedTrack.title}" added to Jam Queue! 🎶`);
        }
        this.handleRoomStateUpdate(msg.payload);
        break;
    }
  }

  private async handleRoomStateUpdate(payload: any): Promise<void> {
    if (!payload) return;
    const store = usePlayerStore.getState();

    this.isHandlingRemoteUpdate = true;
    try {
      // 1. Shared Queue Sync: If incoming payload includes updated queue, update store
      if (payload.queue && Array.isArray(payload.queue) && payload.queue.length > 0) {
        usePlayerStore.setState({
          queue: payload.queue,
          queueIndex: typeof payload.queueIndex === 'number' ? payload.queueIndex : store.queueIndex,
        });
      }

      // Update guest control setting if provided by host
      if (payload.allowGuestControl !== undefined && !this.currentState.isHost) {
        if (this.currentState.allowGuestControl !== Boolean(payload.allowGuestControl)) {
          this.currentState.allowGuestControl = Boolean(payload.allowGuestControl);
          this.notify();
        }
      }

      // 2. Synchronize playback state across Jam participants
      if (payload.track) {
        // Record host timestamp in DriftCorrectionEngine for sub-10ms (0ms) phase alignment
        if (payload.positionMs !== undefined && payload.timestamp) {
          DriftCorrectionEngine.getInstance().recordHostBeacon(payload.positionMs, payload.timestamp);
        }

        const isDifferentTrack = !store.currentSong || store.currentSong.id !== payload.track.id;
        const targetPosSec = (payload.positionMs || 0) / 1000;

        if (isDifferentTrack) {
          usePlayerStore.setState({
            currentSong: payload.track,
            isPlaying: Boolean(payload.isPlaying),
            currentTime: targetPosSec,
          });
          if (payload.isPlaying) {
            await PlaybackService.getInstance().playTrack(payload.track, true, targetPosSec);
          }
        } else {
          // Same track: align playing/paused state
          if (store.isPlaying !== Boolean(payload.isPlaying)) {
            if (payload.isPlaying) {
              PlaybackService.getInstance().resume();
            } else {
              PlaybackService.getInstance().pause();
            }
          }
        }
      }
    } finally {
      setTimeout(() => {
        this.isHandlingRemoteUpdate = false;
      }, 350);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 25000);
  }

  private startDriftSyncBeacon(): void {
    if (this.driftBeaconTimer) clearInterval(this.driftBeaconTimer);
    this.driftBeaconTimer = setInterval(() => {
      if (this.currentState.isInJam && this.currentState.isHost && this.ws?.readyState === WebSocket.OPEN) {
        const store = usePlayerStore.getState();
        if (store.isPlaying && store.currentSong) {
          this.broadcastCurrentPlaybackState();
        }
      }
    }, 1500);
  }
}
