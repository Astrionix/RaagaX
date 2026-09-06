/**
 * Raaga Jam — JamSessionManager
 *
 * Real-time Collaborative Listening Room Engine
 * Uses Zero Audio Egress Architecture (Metadata & State-Syncing via Supabase Realtime & Broadcast Channels).
 */

import { Song } from '@/types/music';
import { JamSessionState, JamMember, JamQueueItem, JamSignalEvent, JamEventType, JamControlAction } from './JamTypes';
import { DeviceKeyManager } from '../auth/DeviceKeyManager';
import { DeviceNameResolver } from '../auth/DeviceNameResolver';
import { usePlayerStore } from '@/context/usePlayerStore';
import { haptics } from '@/lib/haptics/HapticEngine';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type JamStateListener = (state: JamSessionState | null) => void;

export class JamSessionManager {
  private static instance: JamSessionManager;

  private activeState: JamSessionState | null = null;
  private channel: BroadcastChannel | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private stateListeners: Set<JamStateListener> = new Set();
  private hostStateBroadcastTimer: NodeJS.Timeout | null = null;
  private isReconciling = false;

  public static getInstance(): JamSessionManager {
    if (!JamSessionManager.instance) {
      JamSessionManager.instance = new JamSessionManager();
    }
    return JamSessionManager.instance;
  }

  private constructor() {
    // Listen to local store playback changes to auto-broadcast if Host
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'raagax_jam_sync_event' && e.newValue) {
          try {
            const event: JamSignalEvent = JSON.parse(e.newValue);
            this.handleIncomingSignal(event);
          } catch {}
        }
      });
    }
  }

  public getActiveState(): JamSessionState | null {
    return this.activeState;
  }

  public isHost(): boolean {
    if (!this.activeState) return false;
    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    return this.activeState.hostDeviceId === myDeviceId;
  }

  public onStateChanged(listener: JamStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.activeState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.stateListeners.forEach((fn) => fn(this.activeState));
  }

  /**
   * Generates a simple 4-character alphanumeric room code like "8K4P"
   */
  private generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Host starts a new Jam Room
   */
  public async createJamRoom(): Promise<string> {
    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();
    const roomCode = this.generateRoomCode();

    const hostMember: JamMember = {
      deviceId: myDeviceId,
      displayName: myName,
      isHost: true,
      joinedAt: Date.now(),
    };

    const store = usePlayerStore.getState();
    const initialSong = store.currentSong;

    this.activeState = {
      roomCode,
      hostDeviceId: myDeviceId,
      hostName: myName,
      isGuestControlAllowed: true,
      members: [hostMember],
      queue: [],
      currentSong: initialSong,
      positionMs: Math.round((store.currentTime || 0) * 1000),
      isPlaying: store.isPlaying,
      updatedAt: Date.now(),
    };

    this.initCommunicationChannel(roomCode);
    this.startHostSyncTimer();

    store.setIsInJam(true);
    store.setActiveJamRoomCode(roomCode);
    store.setToastMessage(`🎉 Raaga Jam Created: ${roomCode}`);
    haptics.mediumImpact();

    this.notifyListeners();
    return roomCode;
  }

  /**
   * Guest joins an existing Jam Room via code
   */
  public async joinJamRoom(rawCode: string): Promise<boolean> {
    const formattedCode = rawCode.trim().toUpperCase().replace(/^JAM-/, '');

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();

    const guestMember: JamMember = {
      deviceId: myDeviceId,
      displayName: myName,
      isHost: false,
      joinedAt: Date.now(),
    };

    this.activeState = {
      roomCode: formattedCode,
      hostDeviceId: '',
      hostName: 'Jam Host',
      isGuestControlAllowed: true,
      members: [guestMember],
      queue: [],
      currentSong: null,
      positionMs: 0,
      isPlaying: false,
      updatedAt: Date.now(),
    };

    this.initCommunicationChannel(formattedCode);

    const store = usePlayerStore.getState();
    store.setIsInJam(true);
    store.setActiveJamRoomCode(formattedCode);
    store.setToastMessage(`🚀 Joined Jam Room: ${formattedCode}`);
    haptics.mediumImpact();

    this.notifyListeners();
    return true;
  }

  /**
   * Leave current Jam Session
   */
  public leaveJamRoom(): void {
    if (!this.activeState) return;

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();

    this.sendSignal({
      eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
      roomCode: this.activeState.roomCode,
      type: 'LEAVE_ROOM',
      senderDeviceId: myDeviceId,
      senderName: myName,
      timestamp: Date.now(),
      payload: { deviceId: myDeviceId },
    });

    if (this.hostStateBroadcastTimer) {
      clearInterval(this.hostStateBroadcastTimer);
      this.hostStateBroadcastTimer = null;
    }

    if (this.channel) {
      try { this.channel.close(); } catch {}
      this.channel = null;
    }

    if (this.realtimeChannel) {
      try { supabase.removeChannel(this.realtimeChannel); } catch {}
      this.realtimeChannel = null;
    }

    this.activeState = null;
    const store = usePlayerStore.getState();
    store.setIsInJam(false);
    store.setActiveJamRoomCode(null);
    store.setToastMessage(`Left Raaga Jam Session`);
    haptics.lightImpact();

    this.notifyListeners();
  }

  /**
   * Add a song to the live collaborative Jam Queue
   */
  public addToJamQueue(song: Song): void {
    if (!this.activeState) return;

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();

    const queueItem: JamQueueItem = {
      id: 'q_' + Math.random().toString(36).substring(2, 9),
      song,
      addedByDeviceId: myDeviceId,
      addedByMemberName: myName,
      addedAt: Date.now(),
      upvotes: [myDeviceId],
    };

    if (this.isHost()) {
      this.activeState.queue.push(queueItem);
      this.broadcastHostState();
    } else {
      this.sendSignal({
        eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
        roomCode: this.activeState.roomCode,
        type: 'ADD_TO_QUEUE',
        senderDeviceId: myDeviceId,
        senderName: myName,
        timestamp: Date.now(),
        payload: { item: queueItem },
      });
    }

    usePlayerStore.getState().setToastMessage(`🎵 Added "${song.title}" to Jam Queue`);
    haptics.mediumImpact();
    this.notifyListeners();
  }

  /**
   * Add multiple songs (e.g. an entire album, playlist, or liked songs batch) to the live Jam Queue
   */
  public addMultipleToJamQueue(songs: Song[], collectionName?: string): void {
    if (!this.activeState || !songs || songs.length === 0) return;

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();

    const items: JamQueueItem[] = songs.filter(Boolean).map((song) => ({
      id: 'q_' + Math.random().toString(36).substring(2, 9) + '_' + Math.random().toString(36).substring(2, 5),
      song,
      addedByDeviceId: myDeviceId,
      addedByMemberName: myName,
      addedAt: Date.now(),
      upvotes: [myDeviceId],
    }));

    if (this.isHost()) {
      this.activeState.queue.push(...items);
      if (!this.activeState.currentSong) {
        this.playNextInJam();
      } else {
        this.broadcastHostState();
      }
    } else {
      items.forEach((item) => {
        this.sendSignal({
          eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
          roomCode: this.activeState!.roomCode,
          type: 'ADD_TO_QUEUE',
          senderDeviceId: myDeviceId,
          senderName: myName,
          timestamp: Date.now(),
          payload: { item },
        });
      });
    }

    const label = collectionName ? `"${collectionName}"` : `${items.length} songs`;
    usePlayerStore.getState().setToastMessage(`🎵 Added ${label} to Jam Queue (${items.length} tracks)`);
    haptics.mediumImpact();
    this.notifyListeners();
  }

  /**
   * Vote (Upvote or Downvote) a song in the Jam queue
   */
  public voteSongInQueue(queueItemId: string, voteType: 'upvote' | 'downvote' = 'upvote'): void {
    if (!this.activeState) return;

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const item = this.activeState.queue.find((q) => q.id === queueItemId);
    if (!item) return;

    item.upvotes = item.upvotes || [];
    item.downvotes = item.downvotes || [];

    if (voteType === 'upvote') {
      if (item.upvotes.includes(myDeviceId)) {
        item.upvotes = item.upvotes.filter((id) => id !== myDeviceId);
      } else {
        item.upvotes.push(myDeviceId);
        item.downvotes = item.downvotes.filter((id) => id !== myDeviceId);
      }
    } else if (voteType === 'downvote') {
      if (item.downvotes.includes(myDeviceId)) {
        item.downvotes = item.downvotes.filter((id) => id !== myDeviceId);
      } else {
        item.downvotes.push(myDeviceId);
        item.upvotes = item.upvotes.filter((id) => id !== myDeviceId);
      }
    }

    // Re-sort queue by net score (upvotes - downvotes) descending
    const getScore = (q: JamQueueItem) => (q.upvotes?.length || 0) - (q.downvotes?.length || 0);
    this.activeState.queue.sort((a, b) => getScore(b) - getScore(a));

    if (this.isHost()) {
      this.broadcastHostState();
    } else {
      this.sendSignal({
        eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
        roomCode: this.activeState.roomCode,
        type: 'VOTE_SONG',
        senderDeviceId: myDeviceId,
        senderName: DeviceNameResolver.getInstance().getLocalDeviceDisplayName(),
        timestamp: Date.now(),
        payload: { queueItemId, upvotes: item.upvotes, downvotes: item.downvotes },
      });
    }
    this.notifyListeners();
  }

  /**
   * Send playback control command (Play, Pause, Skip, Seek)
   */
  public sendControlCommand(action: JamControlAction, data?: any): void {
    if (!this.activeState) return;

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();

    if (this.isHost()) {
      this.executeControlAction(action, data);
    } else {
      if (!this.activeState.isGuestControlAllowed) {
        usePlayerStore.getState().setToastMessage('🔒 Host has locked room controls');
        return;
      }
      this.sendSignal({
        eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
        roomCode: this.activeState.roomCode,
        type: 'CONTROL_COMMAND',
        senderDeviceId: myDeviceId,
        senderName: myName,
        timestamp: Date.now(),
        payload: { action, data },
      });
    }
  }

  public executeControlAction(action: JamControlAction, data?: any): void {
    const store = usePlayerStore.getState();
    switch (action) {
      case 'PLAY':
        store.setIsPlaying(true);
        break;
      case 'PAUSE':
        store.setIsPlaying(false);
        break;
      case 'NEXT':
        this.playNextInJam();
        break;
      case 'PREV':
        store.playPrev();
        break;
      case 'SEEK':
        if (typeof data?.position === 'number') {
          store.seek(data.position);
        }
        break;
      case 'PLAY_SONG':
        if (data?.song) {
          store.playSong(data.song);
        }
        break;
    }
    if (this.isHost()) {
      this.broadcastHostState();
    }
  }

  public playNextInJam(): void {
    if (!this.activeState) return;

    if (this.activeState.queue.length > 0) {
      const nextItem = this.activeState.queue.shift();
      if (nextItem) {
        usePlayerStore.getState().playSong(nextItem.song);
        usePlayerStore.getState().setToastMessage(`▶️ Now Playing from Jam Queue: ${nextItem.song.title}`);
        if (this.isHost()) {
          this.broadcastHostState();
        }
        this.notifyListeners();
        return;
      }
    }
    usePlayerStore.getState().playNext();
  }

  /**
   * Host toggles guest controls
   */
  public setGuestControlAllowed(allowed: boolean): void {
    if (!this.activeState || !this.isHost()) return;
    this.activeState.isGuestControlAllowed = allowed;
    this.broadcastHostState();
    this.notifyListeners();
  }

  /**
   * Setup BroadcastChannel and Supabase Realtime channel for cross-device signal delivery
   */
  private initCommunicationChannel(roomCode: string): void {
    if (this.channel) {
      try { this.channel.close(); } catch {}
    }
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(`raagax_jam_${roomCode}`);
        this.channel.onmessage = (e) => {
          if (e.data) this.handleIncomingSignal(e.data);
        };
      } catch {}
    }

    const topicName = `jam_${roomCode}`;
    if (this.realtimeChannel) {
      try { supabase.removeChannel(this.realtimeChannel); } catch {}
    }

    try {
      this.realtimeChannel = supabase.channel(topicName, {
        config: { broadcast: { self: false } },
      });

      this.realtimeChannel
        .on('broadcast', { event: 'JAM_SIGNAL' }, (payload) => {
          if (payload && payload.payload) {
            this.handleIncomingSignal(payload.payload);
          }
        })
        .subscribe((status) => {
          console.log(`[JamSessionManager] Supabase Realtime channel ${topicName} status:`, status);
          if (status === 'SUBSCRIBED') {
            if (!this.isHost() && this.activeState) {
              const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
              const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();
              this.sendSignal({
                eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
                roomCode,
                type: 'JOIN_ROOM',
                senderDeviceId: myDeviceId,
                senderName: myName,
                timestamp: Date.now(),
                payload: { member: { deviceId: myDeviceId, displayName: myName, isHost: false, joinedAt: Date.now() } },
              });
            } else if (this.isHost()) {
              this.broadcastHostState();
            }
          }
        });
    } catch (e) {
      console.warn('[JamSessionManager] Failed to init Supabase Realtime channel:', e);
    }
  }

  private sendSignal(event: JamSignalEvent): void {
    if (this.channel) {
      try { this.channel.postMessage(event); } catch {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('raagax_jam_sync_event', JSON.stringify(event));
      } catch {}
    }
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'JAM_SIGNAL',
          payload: event,
        }).catch((err) => {
          console.warn('[JamSessionManager] Realtime broadcast error:', err);
        });
      } catch {}
    }
  }

  private startHostSyncTimer(): void {
    if (this.hostStateBroadcastTimer) clearInterval(this.hostStateBroadcastTimer);
    this.hostStateBroadcastTimer = setInterval(() => {
      if (this.isHost()) {
        this.broadcastHostState();
      }
    }, 1500);
  }

  public broadcastHostState(): void {
    if (!this.activeState || !this.isHost()) return;

    const store = usePlayerStore.getState();
    this.activeState.currentSong = store.currentSong;
    this.activeState.positionMs = Math.round((store.currentTime || 0) * 1000);
    this.activeState.isPlaying = store.isPlaying;
    this.activeState.updatedAt = Date.now();

    this.sendSignal({
      eventId: 'evt_' + Math.random().toString(36).substring(2, 9),
      roomCode: this.activeState.roomCode,
      type: 'STATE_SYNC',
      senderDeviceId: this.activeState.hostDeviceId,
      senderName: this.activeState.hostName,
      timestamp: Date.now(),
      payload: { state: this.activeState },
    });
  }

  private handleIncomingSignal(event: JamSignalEvent): void {
    if (!this.activeState || event.roomCode !== this.activeState.roomCode) return;
    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();

    // Ignore self-emitted events
    if (event.senderDeviceId === myDeviceId) return;

    switch (event.type) {
      case 'JOIN_ROOM': {
        const newMember: JamMember = event.payload.member;
        if (newMember) {
          const exists = this.activeState.members.some((m) => m.deviceId === newMember.deviceId);
          if (!exists) {
            this.activeState.members.push(newMember);
            usePlayerStore.getState().setToastMessage(`👋 ${newMember.displayName} joined the Jam!`);
            haptics.lightImpact();
          }
          if (this.isHost()) {
            this.broadcastHostState();
          }
          this.notifyListeners();
        }
        break;
      }

      case 'LEAVE_ROOM': {
        const leftId = event.payload.deviceId;
        if (leftId === this.activeState.hostDeviceId) {
          usePlayerStore.getState().setToastMessage(`📢 The Host ended the Jam Room.`);
          this.leaveJamRoom();
        } else {
          const leftMember = this.activeState.members.find((m) => m.deviceId === leftId);
          this.activeState.members = this.activeState.members.filter((m) => m.deviceId !== leftId);
          if (leftMember) {
            usePlayerStore.getState().setToastMessage(`👋 ${leftMember.displayName} left the Jam`);
          }
          this.notifyListeners();
        }
        break;
      }

      case 'ADD_TO_QUEUE': {
        const item: JamQueueItem = event.payload.item;
        if (item && !this.activeState.queue.some((q) => q.id === item.id)) {
          this.activeState.queue.push(item);
          usePlayerStore.getState().setToastMessage(`🎵 ${event.senderName} added "${item.song.title}" to Jam Queue`);
          haptics.mediumImpact();
          if (this.isHost()) {
            this.broadcastHostState();
          }
          this.notifyListeners();
        }
        break;
      }

      case 'VOTE_SONG': {
        const { queueItemId, upvotes, downvotes } = event.payload;
        const target = this.activeState.queue.find((q) => q.id === queueItemId);
        if (target) {
          target.upvotes = upvotes || [];
          target.downvotes = downvotes || [];
          const getScore = (q: JamQueueItem) => (q.upvotes?.length || 0) - (q.downvotes?.length || 0);
          this.activeState.queue.sort((a, b) => getScore(b) - getScore(a));
          if (this.isHost()) {
            this.broadcastHostState();
          }
          this.notifyListeners();
        }
        break;
      }

      case 'CONTROL_COMMAND': {
        if (this.isHost()) {
          const { action, data } = event.payload || {};
          if (action) {
            usePlayerStore.getState().setToastMessage(`🎮 ${event.senderName}: ${action}`);
            this.executeControlAction(action, data);
          }
        }
        break;
      }

      case 'STATE_SYNC': {
        if (!this.isHost()) {
          const hostState: JamSessionState = event.payload.state;
          if (hostState) {
            this.activeState = {
              ...hostState,
              members: hostState.members || this.activeState.members,
            };

            this.reconcileGuestPlayback(hostState);
            this.notifyListeners();
          }
        }
        break;
      }
    }
  }

  /**
   * Guest device reconciles its local player with Host's broadcasted metadata
   */
  private async reconcileGuestPlayback(hostState: JamSessionState): Promise<void> {
    if (this.isReconciling) return;
    this.isReconciling = true;

    try {
      const store = usePlayerStore.getState();
      const hostSong = hostState.currentSong;
      const hostPosSec = (hostState.positionMs || 0) / 1000;

      if (hostSong) {
        if (store.currentSong?.id !== hostSong.id) {
          await store.switchTrack(hostSong, 0, hostState.isPlaying, hostPosSec);
          if (hostState.isPlaying && !store.isPlaying) {
            await store.setIsPlaying(true);
          }
        } else {
          if (store.isPlaying !== hostState.isPlaying) {
            await store.setIsPlaying(hostState.isPlaying);
          }

          const currentPosSec = store.currentTime || 0;
          if (Math.abs(currentPosSec - hostPosSec) > 1.8 && hostPosSec > 0) {
            store.seek(hostPosSec);
          }
        }
      } else {
        if (store.isPlaying) {
          store.setIsPlaying(false);
        }
      }
    } catch (e) {
      console.warn('[JamSessionManager] Guest playback reconciliation error:', e);
    } finally {
      this.isReconciling = false;
    }
  }
}

