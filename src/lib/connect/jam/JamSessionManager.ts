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
  private joinRetryTimer: NodeJS.Timeout | null = null;
  private backgroundLeaveTimer: NodeJS.Timeout | null = null;
  private hostHeartbeatWatchdogTimer: NodeJS.Timeout | null = null;
  private isReconciling = false;
  private lastSeekTime = 0;
  private isGuestLocallyPaused = false;
  private processedEventIds = new Set<string>();
  private processedEventIdLru: string[] = [];
  private readonly MAX_EVENT_LRU_SIZE = 200;

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

      // Auto leave room ONLY when app is explicitly closed / terminated / swiped away
      const handleAppTeardown = () => {
        if (this.activeState) {
          console.log('[JamSessionManager] App terminating/unloading, leaving Jam room');
          this.leaveJamRoom();
        }
      };

      window.addEventListener('beforeunload', handleAppTeardown);
      window.addEventListener('pagehide', handleAppTeardown);
      window.addEventListener('unload', handleAppTeardown);

      // Case 1: Auto-reconnect when device comes back online (Wi-Fi ↔ 5G / Tunnel)
      window.addEventListener('online', () => {
        if (this.activeState) {
          usePlayerStore.getState().setToastMessage('📶 Connection restored! Syncing Jam Room...');
          this.handleNetworkReconnect();
        }
      });

      window.addEventListener('offline', () => {
        if (this.activeState) {
          usePlayerStore.getState().setToastMessage('⚠️ Connection lost. Waiting for network...');
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

  public setGuestLocallyPaused(paused: boolean): void {
    this.isGuestLocallyPaused = paused;
    if (!paused && this.activeState && !this.isHost()) {
      this.reconcileGuestPlayback(this.activeState);
    }
  }

  public isGuestPausedLocally(): boolean {
    return this.isGuestLocallyPaused;
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

    this.stopHostHeartbeatWatchdog();
    this.initCommunicationChannel(roomCode);
    this.startHostSyncTimer();
    this.isGuestLocallyPaused = false;

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

    this.isGuestLocallyPaused = false;

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
    this.sendJoinRoomSignal(formattedCode);
    this.startJoinRetryTimer(formattedCode);
    this.startHostHeartbeatWatchdog();

    const store = usePlayerStore.getState();
    store.setIsInJam(true);
    store.setActiveJamRoomCode(formattedCode);
    store.setToastMessage(`🚀 Joined Jam Room: ${formattedCode}`);
    haptics.mediumImpact();

    this.notifyListeners();
    return true;
  }

  private startJoinRetryTimer(roomCode: string): void {
    if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
    let attempts = 0;
    this.joinRetryTimer = setInterval(() => {
      attempts++;
      if (this.isHost() || !this.activeState) {
        if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
        this.joinRetryTimer = null;
        return;
      }
      const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
      const isAcknowledgedByHost = Boolean(
        this.activeState.hostDeviceId &&
        this.activeState.members.some((m) => m.deviceId === myDeviceId)
      );

      if (isAcknowledgedByHost || attempts > 25) {
        if (this.joinRetryTimer) clearInterval(this.joinRetryTimer);
        this.joinRetryTimer = null;
        return;
      }
      this.sendJoinRoomSignal(roomCode);
    }, 1200);
  }

  private sendJoinRoomSignal(roomCode: string): void {
    if (this.isHost() || !this.activeState) return;
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

    if (this.joinRetryTimer) {
      clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }

    if (this.backgroundLeaveTimer) {
      clearTimeout(this.backgroundLeaveTimer);
      this.backgroundLeaveTimer = null;
    }

    this.stopHostHeartbeatWatchdog();

    if (this.channel) {
      try { this.channel.close(); } catch {}
      this.channel = null;
    }

    if (this.realtimeChannel) {
      try { supabase.removeChannel(this.realtimeChannel); } catch {}
      this.realtimeChannel = null;
    }

    this.activeState = null;
    this.isGuestLocallyPaused = false;
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
              this.sendJoinRoomSignal(roomCode);
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
    if (this.realtimeChannel && typeof (this.realtimeChannel as any).send === 'function') {
      try {
        const res = (this.realtimeChannel as any).send({
          type: 'broadcast',
          event: 'JAM_SIGNAL',
          payload: event,
        });
        if (res && typeof res.catch === 'function') {
          res.catch((err: any) => {
            console.warn('[JamSessionManager] Realtime broadcast error:', err);
          });
        }
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

  public broadcastHostState(forcePositionMs?: number, forceIsPlaying?: boolean): void {
    if (!this.activeState || !this.isHost()) return;

    const store = usePlayerStore.getState();
    this.activeState.currentSong = store.currentSong;
    this.activeState.positionMs = typeof forcePositionMs === 'number' && !isNaN(forcePositionMs)
      ? Math.round(forcePositionMs)
      : Math.round((store.currentTime || 0) * 1000);
    this.activeState.isPlaying = typeof forceIsPlaying === 'boolean'
      ? forceIsPlaying
      : store.isPlaying;
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

  /**
   * Case 5: Deduplicate members by deviceId while preserving original joinedAt timestamp
   */
  private deduplicateMembers(members: JamMember[]): JamMember[] {
    const map = new Map<string, JamMember>();
    for (const m of members) {
      if (!m || !m.deviceId) continue;
      const existing = map.get(m.deviceId);
      if (!existing) {
        map.set(m.deviceId, { ...m });
      } else {
        map.set(m.deviceId, {
          ...m,
          joinedAt: Math.min(existing.joinedAt || Infinity, m.joinedAt || Infinity),
          isHost: existing.isHost || m.isHost,
        });
      }
    }
    return Array.from(map.values());
  }

  /**
   * Case 1: Handle network restoration (Wi-Fi ↔ 5G switch, tunnel exit)
   */
  private handleNetworkReconnect(): void {
    if (!this.activeState) return;
    this.initCommunicationChannel(this.activeState.roomCode);
    if (this.isHost()) {
      this.broadcastHostState();
    } else {
      this.sendJoinRoomSignal(this.activeState.roomCode);
      this.startHostHeartbeatWatchdog();
    }
  }

  /**
   * Case 3: Watchdog timer for sudden Host crash / battery death / unexpected disconnection
   */
  private startHostHeartbeatWatchdog(): void {
    if (this.hostHeartbeatWatchdogTimer) clearInterval(this.hostHeartbeatWatchdogTimer);
    this.hostHeartbeatWatchdogTimer = setInterval(() => {
      if (this.isHost() || !this.activeState) {
        this.stopHostHeartbeatWatchdog();
        return;
      }

      const now = Date.now();
      const lastHostBeat = this.activeState.updatedAt || 0;
      // If 12 seconds have elapsed with zero heartbeat/state sync from Host:
      if (lastHostBeat > 0 && now - lastHostBeat > 12000) {
        this.handleHostCrashOrShutdown();
      }
    }, 3500);
  }

  private stopHostHeartbeatWatchdog(): void {
    if (this.hostHeartbeatWatchdogTimer) {
      clearInterval(this.hostHeartbeatWatchdogTimer);
      this.hostHeartbeatWatchdogTimer = null;
    }
  }

  private handleHostCrashOrShutdown(): void {
    if (!this.activeState || this.isHost()) return;

    const deadHostId = this.activeState.hostDeviceId;
    console.warn(`[JamSessionManager] Host ${deadHostId} heartbeat timed out. Initiating automatic host handover...`);

    const remainingMembers = this.activeState.members.filter((m) => m.deviceId !== deadHostId);
    if (remainingMembers.length === 0) {
      usePlayerStore.getState().setToastMessage(`📢 Jam Room host disconnected.`);
      this.leaveJamRoom();
      return;
    }

    // Sort by joinedAt ascending -> The 2nd joined member becomes the new Host!
    remainingMembers.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    const newHost = remainingMembers[0];
    newHost.isHost = true;

    this.activeState.hostDeviceId = newHost.deviceId;
    this.activeState.hostName = newHost.displayName;
    this.activeState.members = this.deduplicateMembers(remainingMembers);
    this.activeState.updatedAt = Date.now();

    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    if (newHost.deviceId === myDeviceId) {
      this.stopHostHeartbeatWatchdog();
      this.startHostSyncTimer();
      this.broadcastHostState();
      usePlayerStore.getState().setToastMessage(`👑 Host disconnected. You are now the new Jam Host!`);
      haptics.mediumImpact();
    } else {
      usePlayerStore.getState().setToastMessage(`👑 ${newHost.displayName} is now the Jam Host.`);
    }

    this.notifyListeners();
  }

  private handleIncomingSignal(event: JamSignalEvent): void {
    if (!this.activeState || event.roomCode !== this.activeState.roomCode) return;
    const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();

    // Ignore self-emitted events
    if (event.senderDeviceId === myDeviceId) return;

    // Deduplicate duplicate signals (BroadcastChannel + Supabase Realtime + LocalStorage)
    if (event.eventId) {
      if (this.processedEventIds.has(event.eventId)) return;
      this.processedEventIds.add(event.eventId);
      this.processedEventIdLru.push(event.eventId);
      if (this.processedEventIdLru.length > this.MAX_EVENT_LRU_SIZE) {
        const oldest = this.processedEventIdLru.shift();
        if (oldest) this.processedEventIds.delete(oldest);
      }
    }

    switch (event.type) {
      case 'JOIN_ROOM': {
        const newMember: JamMember = event.payload.member;
        if (newMember) {
          const exists = this.activeState.members.some((m) => m.deviceId === newMember.deviceId);
          if (!exists) {
            this.activeState.members.push(newMember);
            this.activeState.members = this.deduplicateMembers(this.activeState.members);
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
          const remainingMembers = this.activeState.members.filter((m) => m.deviceId !== leftId);
          if (remainingMembers.length > 0) {
            // Sort by joinedAt timestamp so the member who joined second becomes the new Host!
            remainingMembers.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
            const newHost = remainingMembers[0];
            newHost.isHost = true;
            this.activeState.hostDeviceId = newHost.deviceId;
            this.activeState.hostName = newHost.displayName;
            this.activeState.members = this.deduplicateMembers(remainingMembers);

            const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
            if (newHost.deviceId === myDeviceId) {
              this.stopHostHeartbeatWatchdog();
              this.startHostSyncTimer();
              this.broadcastHostState();
              usePlayerStore.getState().setToastMessage(`👑 You are now the new Host of the Jam Room!`);
              haptics.mediumImpact();
            } else {
              usePlayerStore.getState().setToastMessage(`👑 ${newHost.displayName} is now the Jam Host.`);
            }
            this.notifyListeners();
          } else {
            usePlayerStore.getState().setToastMessage(`📢 Jam Room closed.`);
            this.leaveJamRoom();
          }
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
            const myName = DeviceNameResolver.getInstance().getLocalDeviceDisplayName();
            const myMember: JamMember = {
              deviceId: myDeviceId,
              displayName: myName,
              isHost: false,
              joinedAt: Date.now(),
            };

            const hostMembers = hostState.members || [];
            const hasMeInHostMembers = hostMembers.some((m) => m.deviceId === myDeviceId);
            const rawMerged = hasMeInHostMembers ? hostMembers : [...hostMembers, myMember];
            const mergedMembers = this.deduplicateMembers(rawMerged);

            this.activeState = {
              ...hostState,
              members: mergedMembers,
              updatedAt: Date.now(),
            };

            this.startHostHeartbeatWatchdog();

            if (!hasMeInHostMembers) {
              this.sendJoinRoomSignal(this.activeState.roomCode);
            }

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
   * Includes latency transit compensation and debounced soft-seek drift sync.
   */
  private async reconcileGuestPlayback(hostState: JamSessionState): Promise<void> {
    if (this.isReconciling) return;
    this.isReconciling = true;

    try {
      const store = usePlayerStore.getState();

      // Notification Shade / Local Pause Guard:
      // If guest has paused locally (e.g. phone call, quiet, personal pause),
      // keep local playback paused and prevent Host sync from forcibly unpausing it.
      if (this.isGuestLocallyPaused) {
        if (store.isPlaying) {
          await store.setIsPlaying(false, true);
        }
        return;
      }

      const hostSong = hostState.currentSong;
      const rawHostPosSec = (hostState.positionMs || 0) / 1000;
      const now = Date.now();

      // Case 2 & 6: Latency transit compensation (compensates for broadcast delivery delay)
      const transitLatencySec = Math.max(0, Math.min(2.0, (now - (hostState.updatedAt || now)) / 1000));
      const effectiveHostPosSec = hostState.isPlaying ? rawHostPosSec + transitLatencySec : rawHostPosSec;

      if (hostSong) {
        // Sync Android native lock screen & notification shade metadata in Jam session
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
          import('@/lib/playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
            RaagaXNativePlayer.setRemotePlayback(true, `Jam Room: ${hostState.roomCode}`).catch(() => {});
            RaagaXNativePlayer.updateRemotePlayback({
              trackId: hostSong.id,
              title: hostSong.title,
              artist: hostSong.artist || 'Jam Room',
              artworkUrl: hostSong.coverUrl || '',
              isPlaying: hostState.isPlaying,
              deviceName: `Jam (${hostState.members?.length || 1} listening)`,
              durationMs: Math.round((hostSong.duration || 0) * 1000),
              positionMs: Math.round(effectiveHostPosSec * 1000),
            }).catch(() => {});
          });
        }

        const isSameSong = Boolean(
          store.currentSong &&
          (store.currentSong.id === hostSong.id ||
            (store.currentSong.title && hostSong.title &&
              store.currentSong.title.trim().toLowerCase() === hostSong.title.trim().toLowerCase() &&
              (store.currentSong.artist || '').trim().toLowerCase() === (hostSong.artist || '').trim().toLowerCase()))
        );

        if (!isSameSong) {
          await store.switchTrack(hostSong, 0, hostState.isPlaying, effectiveHostPosSec);
          if (hostState.isPlaying && !store.isPlaying) {
            await store.setIsPlaying(true);
          }
        } else {
          if (store.isPlaying !== hostState.isPlaying) {
            await store.setIsPlaying(hostState.isPlaying);
          }

          const currentPosSec = store.currentTime || 0;
          const drift = Math.abs(currentPosSec - effectiveHostPosSec);

          if (hostState.isPlaying) {
            // Case 2: Smooth buffer drift handling:
            // Under 0.8s: Natural network jitter - do NOT seek to preserve silky smooth playback
            // Between 0.8s - 2.5s: Soft seek debounced by 2.5s (lets player buffer settle)
            // Over 2.5s: Severe drift / resumed from buffer stall, snap to host
            if ((drift > 2.5 || (drift > 0.8 && now - this.lastSeekTime > 2500)) && effectiveHostPosSec > 0) {
              this.lastSeekTime = now;
              store.seek(effectiveHostPosSec);
            }
          } else {
            // Paused: Snap immediately if drift > 0.4s
            if (drift > 0.4 && now - this.lastSeekTime > 1500) {
              this.lastSeekTime = now;
              store.seek(effectiveHostPosSec);
            }
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

