import {
  JamSession,
  JamEvent,
  JamCommandAction,
  JamParticipantState,
  JamPermissions,
  JamQueueItem,
  DeviceCapabilities,
  JamHandoffState,
} from '@/types/jam';
import { Song } from '@/types/music';
import { ClockSyncEngine } from './ClockSyncEngine';
import { DriftCorrectionEngine } from './DriftCorrectionEngine';
import { NetworkQualityEngine } from './NetworkQualityEngine';
import { JamDiscoveryEngine } from './JamDiscoveryEngine';
import { JamPlaybackStateMachine } from './JamPlaybackStateMachine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PreloadManager } from '@/lib/playback/PreloadManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/config/apiConfig';
import { TransportRouter } from '@/lib/jam/transport/TransportRouter';
import { WebRtcLanTransport, JamMessage } from '@/lib/jam/transport/WebRtcLanTransport';
import { JamAudioSync } from './JamAudioSync';

export type JamStateListener = (session: JamSession | null, state: JamParticipantState) => void;

export class JamClientManager {
  private static instance: JamClientManager;

  private activeSession: JamSession | null = null;
  private participantState: JamParticipantState = 'READY';
  private currentUserId: string = '';
  private currentUserName: string = 'User';
  private currentUserAvatar?: string;
  private localRevision: number = 0;
  private processedEventIds: Set<string> = new Set();

  /**
   * Tracks the active transitionId so that async audio loads can detect when
   * a newer track transition has superseded them and self-cancel.
   * This prevents stale loadAudioSource() resolutions from overwriting a newer track.
   */
  private activeTransitionId: string = '';

  private eventSource: EventSource | null = null;
  private supabaseChannel: any = null;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private metricsReportTimer: any = null;
  private notFoundVerificationRetries = 0;

  private clockSync: ClockSyncEngine;
  private driftEngine: DriftCorrectionEngine;
  private networkEngine: NetworkQualityEngine;
  private stateMachine: JamPlaybackStateMachine;
  private transportRouter: TransportRouter;
  private stateListeners: Set<JamStateListener> = new Set();
  private lanTransport: WebRtcLanTransport | null = null;
  private isLanMode: boolean = false;

  private constructor() {
    this.clockSync = ClockSyncEngine.getInstance();
    this.driftEngine = DriftCorrectionEngine.getInstance();
    this.networkEngine = NetworkQualityEngine.getInstance();
    this.stateMachine = JamPlaybackStateMachine.getInstance();
    this.transportRouter = TransportRouter.getInstance();

    // Listen to network online / offline and interface change events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkRestore());
      window.addEventListener('offline', () => this.handleNetworkLoss());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.activeSession) {
          this.handleForegroundWake();
        }
      });

      this.networkEngine.onNetworkChange(async (changeType) => {
        console.log(`[JamClientManager] Network change detected (${changeType}). Triggering seamless clock re-sync & snapshot verification...`);
        if (this.activeSession) {
          try {
            await this.clockSync.synchronize(4);
            await this.resyncSnapshot(this.activeSession.jamId);
          } catch {}
        }
      });
    }
  }

  public static getInstance(): JamClientManager {
    if (!JamClientManager.instance) {
      JamClientManager.instance = new JamClientManager();
    }
    return JamClientManager.instance;
  }

  public resetForTesting() {
    this.cleanupSession();
    this.currentUserId = '';
    this.currentUserName = '';
    this.currentUserAvatar = undefined;
    this.stateListeners.clear();
  }

  public subscribe(listener: JamStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.activeSession, this.participantState);
    return () => this.stateListeners.delete(listener);
  }

  private notify() {
    for (const listener of this.stateListeners) {
      try {
        listener(this.activeSession, this.participantState);
      } catch (e) {
        console.error('[JamClientManager] Listener error:', e);
      }
    }
  }

  private setParticipantState(state: JamParticipantState) {
    this.participantState = state;
    this.notify();
  }

  public getActiveSession(): JamSession | null {
    return this.activeSession;
  }

  public getParticipantState(): JamParticipantState {
    return this.participantState;
  }

  public isHost(): boolean {
    if (!this.activeSession || !this.currentUserId) return false;
    return this.activeSession.hostId === this.currentUserId;
  }

  /**
   * Initializes user credentials
   */
  public initUser(userId: string, displayName: string, avatarUrl?: string) {
    this.currentUserId = userId;
    this.currentUserName = displayName;
    this.currentUserAvatar = avatarUrl;
  }

  /**
   * Creates a new Jam session on the server
   */
  public async createJam(params?: { jamName?: string; initialSong?: Song | null; initialQueue?: Song[]; initialQueueIndex?: number }): Promise<JamSession> {
    const store = usePlayerStore.getState();
    const currentSong = params?.initialSong ?? store.currentSong;
    const initialQueue = params?.initialQueue ?? store.queue;
    const initialQueueIndex = params?.initialQueueIndex ?? (params?.initialQueue ? undefined : store.queueIndex);

    const res = await fetch(getApiUrl('/api/jam'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: this.currentUserId || `user_${Date.now().toString(36)}`,
        hostName: this.currentUserName || 'Host',
        hostAvatar: this.currentUserAvatar,
        jamName: params?.jamName,
        initialSong: currentSong,
        initialQueue,
        initialQueueIndex,
        deviceType: this.detectDeviceType(),
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[JamClientManager] createJam error (${res.status}):`, text);
      throw new Error(`Jam server returned HTTP ${res.status}`);
    }

    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Failed to parse Jam server response');
    }

    if (!data.session) {
      throw new Error(data.error || 'Failed to create Jam session');
    }

    const session: JamSession = data.session;

    this.activeSession = session;
    this.localRevision = session.revision;
    this.setParticipantState('READY');

    // Step 1: Initial clock sync on host & start periodic sync
    await this.clockSync.synchronize(6);
    this.clockSync.startPeriodicSync(15000);
    this.driftEngine.setSession(session);

    // Step 2: Initialize state machine with created session
    await this.stateMachine.handleTransition(session, undefined, 'NEW_TRANSITION');

    // Connect multi-transport routing layer (LAN preferred, Cloud fallback)
    const hostLanEndpoint =
      (session as any).lanEndpoint ||
      (typeof window !== 'undefined' ? window.location.origin : undefined);

    await this.transportRouter.initialize(
      session.jamId,
      { userId: this.currentUserId || session.hostId, userName: this.currentUserName, userAvatar: this.currentUserAvatar },
      hostLanEndpoint
    );
    this.transportRouter.subscribe((event) => this.handleIncomingEvent(event));

    // Connect real-time fallback channels
    this.connectRealtimeTransport(session.jamId);
    this.startMetricsReporting(session.jamId);

    // Start nearby discovery beacon advertising
    JamDiscoveryEngine.getInstance().startBroadcasting(session);
    this.startReconciliationLoop(session.jamId);

    return session;
  }

  /**
   * Resolves a human-readable 5-char Join Code (e.g. 7K29P) and joins the Jam session
   */
  public async joinByCode(code: string): Promise<JamSession> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a valid Join Code');

    const res = await fetch(getApiUrl(`/api/jam/code/${cleanCode}`));
    const text = await res.text();
    if (!res.ok) {
      console.error(`[JamClientManager] joinByCode error (${res.status}):`, text);
      throw new Error(`Jam server returned HTTP ${res.status}`);
    }

    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Could not reach Jam server. Please check your network connection.');
    }

    if (!data.success || !data.jamId) {
      throw new Error(data.error || 'Invalid or expired Join Code');
    }

    return this.joinJam(data.jamId);
  }

  /**
   * Joins an existing Jam session with full synchronization flow
   * Follows explicit lifecycle: JOIN_REQUESTED -> AUTHORIZED -> SNAPSHOT_RECEIVED -> CLOCK_SYNCING -> PREPARING -> SCHEDULED -> SYNCING -> SYNCED
   */
  public async joinJam(jamId: string): Promise<JamSession> {
    this.setParticipantState('JOIN_REQUESTED');

    try {
      this.setParticipantState('AUTHORIZED');

      const res = await fetch(getApiUrl(`/api/jam/${jamId}/join`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUserId || `user_${Date.now().toString(36)}`,
          displayName: this.currentUserName || 'RaagaX Listener',
          avatarUrl: this.currentUserAvatar,
          deviceType: this.detectDeviceType(),
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        this.setParticipantState('FAILED');
        console.error(`[JamClientManager] joinJam error (${res.status}):`, text);
        throw new Error(`Jam server returned HTTP ${res.status}`);
      }

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        this.setParticipantState('FAILED');
        throw new Error('Could not parse server response');
      }

      if (!data.session) {
        this.setParticipantState('FAILED');
        throw new Error(data.error || 'Failed to join Jam');
      }

      const session: JamSession = data.session;
      this.setParticipantState('SNAPSHOT_RECEIVED');

      this.activeSession = session;
      this.localRevision = session.revision;

      if (session.currentSong) {
        usePlayerStore.setState({ currentSong: session.currentSong });
      }

      // Step 1: Synchronize clock (NTP burst)
      this.setParticipantState('CLOCK_SYNCING');
      await this.clockSync.synchronize(6);
      this.clockSync.startPeriodicSync(15000);

      // Step 2: Prepare current track on the existing timeline
      this.setParticipantState('PREPARING');
      await this.stateMachine.handleTransition(session, undefined, 'NEW_TRANSITION');

      // Step 3: Drift correction & synchronization
      this.driftEngine.setSession(session);
      this.driftEngine.start();

      // Step 4: Multi-transport initialization
      const discoveredLanEndpoint =
        (session as any).lanEndpoint ||
        JamDiscoveryEngine.getInstance().getLanEndpointForJam(session.jamId) ||
        (typeof window !== 'undefined' ? window.location.origin : undefined);

      await this.transportRouter.initialize(
        session.jamId,
        { userId: this.currentUserId, userName: this.currentUserName, userAvatar: this.currentUserAvatar },
        discoveredLanEndpoint
      );
      this.transportRouter.subscribe((event) => this.handleIncomingEvent(event));

      if (session.state === 'PLAYING') {
        const estServerNow = this.clockSync.estimatedServerNow();
        if (estServerNow < session.startAtServerTime) {
          this.setParticipantState('SCHEDULED');
        } else {
          this.setParticipantState('SYNCED');
        }
      } else {
        this.setParticipantState('SYNCED');
      }

      // Connect real-time channels
      this.connectRealtimeTransport(jamId);
      this.startMetricsReporting(jamId);
      this.startReconciliationLoop(jamId);

      return session;
    } catch (err) {
      this.setParticipantState('FAILED');
      throw err;
    }
  }

  /**
   * Leaves the active Jam session
   */
  public async leaveJam() {
    if (!this.activeSession) return;
    const jamId = this.activeSession.jamId;

    try {
      await fetch(getApiUrl(`/api/jam/${jamId}/leave`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.currentUserId }),
      });
    } catch {}

    this.cleanupSession();
  }

  private cleanupSession() {
    this.activeSession = null;
    this.localRevision = 0;
    this.participantState = 'READY';
    this.notFoundVerificationRetries = 0;
    // Invalidate any in-flight async loadAudioSource calls from the previous session
    this.activeTransitionId = `CLEANUP_${Date.now()}`;

    this.clockSync.stopPeriodicSync();
    this.driftEngine.stop();
    this.driftEngine.setSession(null);
    this.stateMachine.reset();
    this.transportRouter.cleanup();
    JamDiscoveryEngine.getInstance().stopBroadcasting();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }

    if (this.lanTransport) {
      this.lanTransport.close();
      this.lanTransport = null;
    }
    this.isLanMode = false;
    JamAudioSync.getInstance().cleanup();
    try {
      import('@/context/useJamStore').then(({ useJamStore }) => {
        useJamStore.setState({ isLanMode: false });
      }).catch(() => {});
    } catch {}

    if (this.metricsReportTimer) {
      clearInterval(this.metricsReportTimer);
      this.metricsReportTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopReconciliationLoop();

    this.notify();
  }

  private reconciliationInterval: any = null;

  private startReconciliationLoop(jamId: string) {
    this.stopReconciliationLoop();
    this.reconciliationInterval = setInterval(async () => {
      if (!this.activeSession || this.activeSession.jamId !== jamId) {
        this.stopReconciliationLoop();
        return;
      }
      // If host, local state is authoritative; for non-host participants, periodically reconcile
      if (this.isHost()) return;

      try {
        const res = await fetch(getApiUrl(`/api/jam/${jamId}`), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.session) return;

        const remote: JamSession = data.session;
        const local = this.activeSession;

        const isRevisionAhead = typeof remote.revision === 'number' && remote.revision > this.localRevision;
        const isGenerationAhead = (remote.generation ?? 0) > (local.generation ?? 0);
        const isTrackDiffering = remote.trackId !== local.trackId;
        const isStateDiffering = remote.state !== local.state;

        if (isRevisionAhead || isGenerationAhead || isTrackDiffering || isStateDiffering) {
          console.log(`[JamClientManager] Background reconciliation updated session (remote rev ${remote.revision} vs local ${this.localRevision})`);
          this.applySessionSnapshot(remote);
        }
      } catch {}
    }, 3500);
  }

  private stopReconciliationLoop() {
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
      this.reconciliationInterval = null;
    }
  }

  /**
   * Connects SSE stream + Supabase Realtime channel
   */
  private connectRealtimeTransport(jamId: string) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    // 1. Primary: Server-Sent Events (SSE) Stream
    try {
      const es = new EventSource(getApiUrl(`/api/jam/${jamId}/events`));
      this.eventSource = es;

      console.log(`\n[JAM_REALTIME_CONNECTED]\njamId=${jamId}\ntransport=SSE\ntimestamp=${Date.now()}\n`);

      es.onmessage = (e) => {
        try {
          const event: JamEvent = JSON.parse(e.data);
          this.handleIncomingEvent(event);
        } catch {}
      };

      es.onerror = () => {
        // Native EventSource auto-retries in a tight loop on 404 unless closed!
        es.close();
        if (this.eventSource === es) {
          this.eventSource = null;
        }

        console.log(`\n[JAM_REALTIME_DISCONNECTED]\njamId=${jamId}\ntransport=SSE\nreason=STREAM_ERROR\ntimestamp=${Date.now()}\n`);

        if (!this.activeSession) return;
        console.warn(`[JamClientManager] SSE stream dropped for ${jamId}, validating session...`);
        this.scheduleReconnection(jamId);
      };
    } catch (e) {
      console.warn('[JamClientManager] SSE not supported or failed:', e);
    }

    // 2. Secondary: Supabase Realtime Channel
    try {
      const channel = supabase.channel(`jam:${jamId}`);
      this.supabaseChannel = channel;

      channel
        .on('broadcast', { event: 'jam_event' }, (payload: any) => {
          if (payload?.payload) {
            const event: JamEvent = payload.payload;
            // SUPABASE DEDUPLICATION (Phase 5):
            // Supabase events may duplicate SSE events for the same action.
            // Use eventId if present. Otherwise fall back to a composite key: type_revision.
            // This prevents the same command response arriving twice from SSE + Supabase.
            if (event.eventId) {
              if (this.processedEventIds.has(event.eventId)) {
                return; // Already processed via SSE
              }
              // Don't add to processedEventIds here — handleIncomingEvent will do it
            } else if (event.type && typeof event.revision === 'number') {
              const fallbackKey = `${event.jamId}_${event.type}_${event.revision}`;
              if (this.processedEventIds.has(fallbackKey)) {
                return; // Already processed
              }
              this.processedEventIds.add(fallbackKey);
            }
            this.handleIncomingEvent(event);
          }
        })
        .subscribe();

      // 3. Hybrid WebRTC LAN Transport (<2ms) + Cloud Fallback
      if (typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined') {
        try {
          if (this.lanTransport) {
            this.lanTransport.close();
            this.lanTransport = null;
          }

          const isHost = this.isHost();
          this.lanTransport = new WebRtcLanTransport({
            sessionId: jamId,
            isHost,
            signalingChannel: channel,
            onStateChange: (connected) => {
              this.isLanMode = connected;
              console.log(connected ? '⚡ 0ms LAN Sync Active' : '☁️ Cloud Fallback Active');
              if (connected && this.lanTransport) {
                JamAudioSync.getInstance().init(this.lanTransport, this.isHost());
              }
              try {
                import('@/context/useJamStore').then(({ useJamStore }) => {
                  useJamStore.setState({ isLanMode: connected });
                }).catch(() => {});
              } catch {}
            },
            onMessage: (msg: JamMessage) => {
              this.handleJamAudioMessage(msg);
            },
          });

          if (isHost) {
            this.lanTransport.startHostSession();
          }

          channel.on('broadcast', { event: 'JAM_CLOUD_FALLBACK' }, ({ payload }: any) => {
            if (payload) {
              this.handleJamAudioMessage(payload as JamMessage);
            }
          });
        } catch (e) {
          console.warn('[JamClientManager] Hybrid LAN WebRTC init warning:', e);
        }
      }
    } catch {}
  }

  /**
   * Universal Send function (Direct LAN <2ms first, auto-fallback to Cloud)
   */
  public broadcastJamEvent(msg: JamMessage): boolean {
    const sentOverLan = this.lanTransport?.send(msg);
    if (!sentOverLan && this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'JAM_CLOUD_FALLBACK',
        payload: msg,
      });
      return false;
    }
    return true;
  }

  public isLanSyncActive(): boolean {
    return this.isLanMode;
  }

  public getCurrentUserId(): string {
    return this.currentUserId;
  }

  private handleJamAudioMessage(msg: JamMessage) {
    if (!msg) return;
    switch (msg.type) {
      case 'PING': {
        JamAudioSync.getInstance().handlePing(msg.clientTime);
        break;
      }
      case 'PONG': {
        JamAudioSync.getInstance().handlePong(msg.clientTime, msg.hostTime);
        break;
      }
      case 'SCHEDULED_PLAY': {
        JamAudioSync.getInstance().executeScheduledPlay(msg.targetTimestamp, msg.audioPosition);
        break;
      }
      case 'INSTANT_PAUSE': {
        JamAudioSync.getInstance().instantPause();
        break;
      }
      case 'SET_VOLUME': {
        usePlayerStore.getState().setVolume(msg.volume);
        break;
      }
      case 'SEEK': {
        PlaybackService.getInstance().seek(msg.position);
        break;
      }
      case 'PRELOAD_TRACK': {
        JamAudioSync.getInstance().handlePreloadTrack(msg.url, msg.trackId);
        break;
      }
      case 'BUFFER_READY': {
        console.log(`[JamAudioSync] Peer buffered track ${msg.trackId} ready for scheduled trigger`);
        JamAudioSync.getInstance().handlePeerBufferReady(msg.trackId);
        break;
      }
    }
  }

  /**
   * Handles incoming JamEvent with revision check & gap detection
   */
  public handleIncomingEvent(event: JamEvent) {
    if (event.eventId) {
      if (this.processedEventIds.has(event.eventId)) {
        return;
      }
      this.processedEventIds.add(event.eventId);
      if (this.processedEventIds.size > 500) {
        const oldest = this.processedEventIds.values().next().value;
        if (oldest) this.processedEventIds.delete(oldest);
      }
    }

    if (!this.activeSession || event.jamId !== this.activeSession.jamId) {
      if (event.type === 'SYNC' && event.payload?.session) {
        this.applySessionSnapshot(event.payload.session);
      }
      return;
    }

    // Stale event check: reject stale revisions across all event types including SYNC
    if (typeof event.revision === 'number' && event.revision <= this.localRevision) {
      if (event.type === 'SYNC' && event.payload?.session && event.payload.session.revision > this.localRevision) {
        // Accept SYNC only if inner session snapshot has a strictly newer revision
        this.applySessionSnapshot(event.payload.session);
      }
      return;
    }

    // Revision gap detection: if event.revision > localRevision + 1, we missed packets!
    if (event.revision > this.localRevision + 1 && event.type !== 'SYNC') {
      console.warn(`[JamClientManager] Revision gap detected! Expected ${this.localRevision + 1}, received ${event.revision}. Triggering full snapshot resync...`);
      this.resyncSnapshot(this.activeSession.jamId);
      return;
    }

    // Process event sequentially
    this.localRevision = event.revision;
    this.applyEventLocally(event);
  }

  /**
   * Applies an incremental event locally
   */
  private applyEventLocally(event: JamEvent) {
    if (!this.activeSession) return;
    const s = this.activeSession;
    s.revision = event.revision;
    s.updatedAt = event.serverTimestamp;

    if (event.timelineId || event.payload?.timelineId) {
      s.timelineId = event.timelineId || event.payload?.timelineId;
    }
    if (event.transitionId || event.payload?.transitionId) {
      s.transitionId = event.transitionId || event.payload?.transitionId;
    }
    if (typeof (event.generation ?? event.payload?.generation) === 'number') {
      s.generation = event.generation ?? event.payload?.generation;
    }
    if (typeof event.payload?.timelineStartServerMs === 'number') {
      s.timelineStartServerMs = event.payload.timelineStartServerMs;
    }
    if (typeof event.payload?.basePositionMs === 'number') {
      s.basePositionMs = event.payload.basePositionMs;
    }

    switch (event.type) {
      case 'PLAY': {
        s.state = 'PLAYING';
        s.positionMs = event.payload.positionMs;
        s.startAtServerTime = event.payload.startAtServerTime;
        s.trackId = event.payload.trackId;

        this.driftEngine.setSession(s);
        this.stateMachine.handleTransition(s, event, 'EVENT');
        break;
      }

      case 'PAUSE': {
        s.state = 'PAUSED';
        s.positionMs = event.payload.positionMs;
        s.serverTimestamp = event.serverTimestamp;

        this.driftEngine.setSession(s);
        this.stateMachine.handleTransition(s, event, 'EVENT');
        break;
      }

      case 'STOP': {
        s.state = 'PAUSED';
        s.positionMs = 0;
        s.basePositionMs = 0;
        this.driftEngine.setSession(s);
        this.stateMachine.handleTransition(s, event, 'EVENT');
        break;
      }

      case 'SEEK': {
        s.positionMs = event.payload.positionMs;
        s.startAtServerTime = event.payload.startAtServerTime;
        s.state = event.payload.state || s.state;

        this.driftEngine.setSession(s);
        this.stateMachine.handleTransition(s, event, 'EVENT');
        break;
      }

      case 'TRACK_CHANGED': {
        s.currentSong = event.payload.currentSong;
        if (event.payload.currentSong) {
          usePlayerStore.setState({ currentSong: event.payload.currentSong });
        }
        s.trackId = event.payload.trackId;
        s.currentQueueItemId = event.payload.currentQueueItemId;
        s.positionMs = event.payload.positionMs;
        s.startAtServerTime = event.payload.startAtServerTime;
        s.queue = event.payload.queue || s.queue;
        // Also sync history so guest prev-track state matches
        if (Array.isArray(event.payload.history)) {
          s.history = event.payload.history;
        }

        const thisTransitionId = event.transitionId || event.payload?.transitionId || `TR_${Date.now()}`;
        this.activeTransitionId = thisTransitionId;

        this.driftEngine.setSession(s);
        this.stateMachine.handleTransition(s, event, 'NEW_TRANSITION');
        break;
      }

      case 'QUEUE_ITEM_ADDED': {
        if (event.payload.queue) {
          s.queue = event.payload.queue;
        } else if (event.payload.item) {
          s.queue.push(event.payload.item);
        }
        // Bug #5 fix: Do NOT call syncPlaybackWithSession here.
        // When a song is added as the first (and becomes currentSong), the server now emits
        // TRACK_CHANGED (not QUEUE_ITEM_ADDED) as the authoritative load trigger.
        // Calling syncPlaybackWithSession from both QUEUE_ITEM_ADDED and TRACK_CHANGED
        // causes a double-load race on the audio element.
        break;
      }

      case 'QUEUE_ITEM_REMOVED': {
        if (event.payload.queue) {
          s.queue = event.payload.queue;
        } else if (event.payload.queueItemId) {
          s.queue = s.queue.filter((q) => q.queueItemId !== event.payload.queueItemId);
        }
        break;
      }

      case 'QUEUE_REORDERED': {
        if (event.payload.queue) {
          s.queue = event.payload.queue;
        }
        break;
      }

      case 'PARTICIPANT_JOINED': {
        if (event.payload.participant) {
          s.participants[event.payload.participant.userId] = event.payload.participant;
        }
        break;
      }

      case 'PARTICIPANT_LEFT': {
        if (event.payload.userId) {
          delete s.participants[event.payload.userId];
          if (event.payload.userId === this.currentUserId) {
            this.cleanupSession();
            return;
          }
        }
        break;
      }


      case 'PERMISSIONS_UPDATED': {
        if (event.payload.permissions) {
          s.permissions = { ...s.permissions, ...event.payload.permissions };
        }
        break;
      }

      case 'PARTICIPANT_STATE_CHANGED': {
        if (event.payload.participant) {
          s.participants[event.payload.participant.userId] = event.payload.participant;
        }
        break;
      }

      case 'HANDOFF_REQUESTED': {
        if (event.payload.handoff) {
          s.activeHandoff = event.payload.handoff;
          const isTarget = event.payload.handoff.targetUserId === this.currentUserId;
          if (isTarget && s.currentSong) {
            console.log(`[HANDOFF] Target received handoff request ${event.payload.handoff.handoffId}. Preparing audio...`);
            const standby = PlaybackService.getInstance().getStandbyAudio();
            PreloadManager.getInstance()
              .prepareNextTrack(s.currentSong, standby, true)
              .then((ready) => {
                if (ready) {
                  this.sendCommand('CONFIRM_HANDOFF_READY', { handoffId: event.payload.handoff.handoffId });
                } else {
                  this.sendCommand('FAIL_HANDOFF', { handoffId: event.payload.handoff.handoffId, errorMessage: 'Audio preload failed' });
                }
              })
              .catch((err) => {
                this.sendCommand('FAIL_HANDOFF', { handoffId: event.payload.handoff.handoffId, errorMessage: err?.message || 'Error' });
              });
          }
        }
        break;
      }

      case 'HANDOFF_COMMITTED': {
        if (event.payload.handoff) {
          s.activeHandoff = event.payload.handoff;
          const isSource = event.payload.handoff.sourceUserId === this.currentUserId;
          const isTarget = event.payload.handoff.targetUserId === this.currentUserId;

          if (isSource) {
            console.log('[HANDOFF] Source handoff committed. Stopping local audio to prevent double playback.');
            PlaybackService.getInstance().pause();
            usePlayerStore.setState({ isPlaying: false });
            this.sendCommand('CONFIRM_TARGET_PLAYING', { handoffId: event.payload.handoff.handoffId });
          } else if (isTarget) {
            console.log(`[HANDOFF] Target handoff committed. Resuming playback from authoritative position ${event.payload.positionMs}ms.`);
            s.state = 'PLAYING';
            s.positionMs = event.payload.positionMs;
            s.startAtServerTime = event.payload.startAtServerTime;
            this.driftEngine.setSession(s);
            usePlayerStore.setState({ isPlaying: true });
            this.driftEngine.evaluateScheduledStart(s);
          }
        }
        break;
      }

      case 'HANDOFF_FAILED': {
        if (s.activeHandoff) {
          console.log('[HANDOFF] Handoff failed on target. Source continuing playback.');
          s.activeHandoff = null;
        }
        break;
      }

      case 'HANDOFF_COMPLETED': {
        if (event.payload.handoff) {
          s.activeHandoff = event.payload.handoff;
        }
        break;
      }

      case 'HOST_MIGRATED':
      case 'HOST_TRANSFERRED': {
        const newHostId = event.payload.newHostId;
        const newHostName = event.payload.newHostName || 'Host';
        s.hostId = newHostId;
        s.hostName = newHostName;

        if (s.participants[newHostId]) {
          s.participants[newHostId].isHost = true;
          s.participants[newHostId].role = 'HOST';
        }
        if (event.payload.previousHostId && s.participants[event.payload.previousHostId]) {
          s.participants[event.payload.previousHostId].isHost = false;
        }

        const isMe = newHostId === this.currentUserId;
        console.log(isMe
          ? `👑 [HOST_MIGRATION] You are now the authoritative Jam Host!`
          : `🔄 [HOST_MIGRATION] Host migrated to ${newHostName}`
        );

        if (this.lanTransport) {
          JamAudioSync.getInstance().init(this.lanTransport, isMe);
        }

        import('@/context/useJamStore').then(({ useJamStore }) => {
          useJamStore.setState({ isHost: isMe, session: { ...s } });
        }).catch(() => {});
        break;
      }

      case 'SESSION_ENDED': {
        this.cleanupSession();
        return;
      }

      case 'SYNC': {
        if (event.payload.session) {
          this.applySessionSnapshot(event.payload.session);
          return;
        }
        break;
      }
    }

    this.notify();
  }

  /**
  /**
   * Full snapshot restoration with same-identity short-circuit.
   * If incoming snapshot has the same playback identity (trackId+generation+timelineId)
   * as current active session, only update drift engine — no audio reload.
   * This prevents reconnect/snapshot from restarting audio on the same track.
   */
  public applySessionSnapshot(session: JamSession) {
    if (!session) return;

    // Ignore stale out-of-order snapshots (e.g. from delayed background HTTP requests or stale sync)
    if (this.activeSession) {
      if (typeof session.revision === 'number' && session.revision < this.localRevision) {
        console.log(`[JamClientManager] Ignoring stale snapshot revision ${session.revision} (current localRevision is ${this.localRevision})`);
        return;
      }
      if (
        typeof session.generation === 'number' &&
        typeof this.activeSession.generation === 'number' &&
        session.generation < this.activeSession.generation
      ) {
        console.log(`[JamClientManager] Ignoring stale snapshot generation ${session.generation} (current activeGeneration is ${this.activeSession.generation})`);
        return;
      }
    }

    // RECONNECT DIRECT RECONCILIATION (Phase 5 + 8):
    // If the snapshot has the same playback identity as what is already active,
    // only update the drift engine — do NOT reload audio or call stateMachine.handleTransition
    // (which would trigger prepareAudioPlayback on the already-playing track).
    const prevSession = this.activeSession;
    const isSamePlaybackIdentity =
      prevSession !== null &&
      prevSession.trackId === session.trackId &&
      prevSession.generation === session.generation &&
      prevSession.timelineId === session.timelineId &&
      session.trackId !== null;

    this.activeSession = session;
    this.localRevision = Math.max(this.localRevision, session.revision);

    if (session.currentSong) {
      usePlayerStore.setState({ currentSong: session.currentSong });
    }

    if (isSamePlaybackIdentity) {
      // Same track already playing/paused: only update drift anchors
      console.log(`[SNAPSHOT_RECONCILE] action=IDENTITY_UNCHANGED trackId=${session.trackId} generation=${session.generation} timelineId=${session.timelineId} revision=${session.revision}`);
      this.driftEngine.setSession(session);
      // Still reconcile state (playing/paused) without reloading audio
      this.stateMachine.handleTransition(session);
    } else {
      console.log(`[SNAPSHOT_RECONCILE] action=IDENTITY_CHANGED toTrackId=${session.trackId} generation=${session.generation} revision=${session.revision}`);
      this.driftEngine.setSession(session);
      // Full reconciliation — new track or new generation
      this.stateMachine.handleTransition(session);
    }

    // NOTE: syncPlaybackWithSession is intentionally NOT called here.
    // stateMachine.handleTransition is the single authoritative reconciliation entrypoint.
    // Calling both caused double audio loads (the original double-reconciliation bug).

    this.setParticipantState(session.state === 'PLAYING' ? 'PLAYING' : 'READY');
    this.notify();
  }

  /**
   * Fetches latest authoritative session snapshot from server with multi-attempt resilience
   */
  public async resyncSnapshot(jamId: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/jam/${jamId}`), { cache: 'no-store' });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (res.status === 410 || data?.code === 'JAM_ENDED') {
        console.warn(`[JamClientManager] Session ${jamId} has ended (410). Cleaning up.`);
        this.notFoundVerificationRetries = 0;
        this.cleanupSession();
        if (typeof window !== 'undefined') {
          usePlayerStore.getState().setToastMessage('Jam session ended');
        }
        return false;
      }

      if (res.status === 404 || data?.code === 'JAM_NOT_FOUND') {
        this.notFoundVerificationRetries++;
        console.warn(`[JamClientManager] Session ${jamId} returned 404 (verification attempt ${this.notFoundVerificationRetries}/4). Retrying before concluding session ended...`);
        if (this.notFoundVerificationRetries >= 4) {
          this.notFoundVerificationRetries = 0;
          this.cleanupSession();
          if (typeof window !== 'undefined') {
            usePlayerStore.getState().setToastMessage('Jam session not found');
          }
          return false;
        }
        return false;
      }

      if (!res.ok) return false;

      if (data?.session) {
        this.notFoundVerificationRetries = 0;
        this.applySessionSnapshot(data.session);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Synchronizes local audio player and store with the authoritative session
   */
  private async syncPlaybackWithSession(session: JamSession, autoPlay: boolean) {
    if (!session.currentSong) return;
    await this.stateMachine.handleTransition(session, undefined, 'RECONCILIATION');
  }

  /**
   * Sends an authoritative command through TransportRouter (LAN preferred, Cloud fallback)
   */
  public async sendCommand(action: JamCommandAction, payload?: any): Promise<boolean> {
    if (!this.activeSession) return false;

    const jamId = this.activeSession.jamId;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const response = await this.transportRouter.sendCommand({
        commandId: requestId,
        jamId,
        userId: this.currentUserId,
        action,
        payload,
        timestamp: Date.now(),
      });

      if (response && response.session) {
        this.notFoundVerificationRetries = 0;
        this.applySessionSnapshot(response.session);
        return true;
      }

      if (!response.success) {
        if (response.error?.includes('410') || response.error?.includes('ended')) {
          this.cleanupSession();
          if (typeof window !== 'undefined') usePlayerStore.getState().setToastMessage('Jam session ended');
          return false;
        }
        if (response.error && typeof window !== 'undefined' && action !== 'UPDATE_PARTICIPANT_STATUS' && action !== 'HEARTBEAT') {
          usePlayerStore.getState().setToastMessage(response.error);
        }
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // --- Convenient Command Wrappers ---

  public async sendPlay(positionMs?: number) {
    return this.sendCommand('PLAY', { positionMs });
  }

  public async sendPause() {
    return this.sendCommand('PAUSE');
  }

  public async sendStop() {
    return this.sendCommand('STOP');
  }

  public async sendSeek(positionMs: number) {
    return this.sendCommand('SEEK', { positionMs });
  }

  public getInterpolatedPosition(): number {
    return this.stateMachine.getInterpolatedPosition(this.activeSession);
  }

  public async sendSkipNext() {
    return this.sendCommand('SKIP_NEXT');
  }

  public async sendSkipPrev() {
    return this.sendCommand('SKIP_PREV');
  }

  public async sendAddTrack(song: Song, playNow: boolean = false) {
    return this.sendCommand('ADD_TRACK', { song, playNow });
  }

  public async sendAddTracks(songs: Song[], playNow: boolean = false, startIndex: number = 0) {
    return this.sendCommand('ADD_TRACKS', { songs, playNow, startIndex });
  }

  public async sendRemoveTrack(queueItemId: string) {
    return this.sendCommand('REMOVE_TRACK', { queueItemId });
  }

  public async sendReorderQueue(newQueue: JamQueueItem[]) {
    return this.sendCommand('REORDER_QUEUE', { queue: newQueue });
  }

  public async sendUpdatePermissions(permissions: Partial<JamPermissions>) {
    return this.sendCommand('UPDATE_PERMISSIONS', { permissions });
  }

  public async sendTransferHost(newHostId: string) {
    return this.sendCommand('TRANSFER_HOST', { newHostId });
  }

  public async sendKickParticipant(targetUserId: string) {
    return this.sendCommand('KICK_PARTICIPANT', { targetUserId });
  }

  public async sendEndSession() {
    return this.sendCommand('END_SESSION');
  }

  public async sendRequestHandoff(targetUserId: string, targetDeviceId?: string) {
    return this.sendCommand('REQUEST_HANDOFF', { targetUserId, targetDeviceId });
  }

  public getTransportRouter(): TransportRouter {
    return this.transportRouter;
  }

  public getLocalDeviceCapabilities(): DeviceCapabilities {
    let platform: DeviceCapabilities['platform'] = 'web';
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/android/i.test(ua)) platform = 'android';
      else if (/iphone|ipad|ipod/i.test(ua)) platform = 'ios';
      else if (/windows/i.test(ua)) platform = 'windows';
      else if (/macintosh|mac os x/i.test(ua)) platform = 'macos';
      else if (/linux/i.test(ua)) platform = 'linux';
    }

    const supportedCodecs: string[] = ['mp3', 'aac'];
    if (typeof MediaSource !== 'undefined') {
      if (MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')) supportedCodecs.push('m4a');
      if (MediaSource.isTypeSupported('audio/ogg; codecs="opus"')) supportedCodecs.push('opus');
      if (MediaSource.isTypeSupported('audio/flac')) supportedCodecs.push('flac');
    }

    return {
      deviceId: this.currentUserId || `dev_${Date.now().toString(36)}`,
      platform,
      supportedCodecs,
      audioCapabilities: {
        sampleRates: [44100, 48000],
        channelCount: 2,
        maxBitrate: 320,
      },
      backgroundPlayback: platform === 'android' || platform === 'ios',
      outputCapabilities: {
        speaker: true,
      },
    };
  }

  // --- Network Resilience & Metrics ---

  private scheduleReconnection(jamId: string) {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= 6) {
      console.warn(`[JamClientManager] Max reconnection attempts (6) reached for ${jamId}. Cleaning up.`);
      this.cleanupSession();
      if (typeof window !== 'undefined') {
        usePlayerStore.getState().setToastMessage('Disconnected from Jam Party');
      }
      return;
    }

    this.setParticipantState('RECONNECTING');

    const delay = Math.min(8000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.activeSession) return;

      try {
        const success = await this.resyncSnapshot(jamId);
        if (!success) {
          // If resyncSnapshot failed (e.g. 404 session ended), do not reconnect SSE
          return;
        }
        this.connectRealtimeTransport(jamId);
        this.setParticipantState(this.activeSession?.state === 'PLAYING' ? 'PLAYING' : 'READY');
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnection(jamId);
      }
    }, delay);
  }

  private handleNetworkLoss() {
    this.setParticipantState('RECONNECTING');
  }

  private handleNetworkRestore() {
    if (this.activeSession) {
      this.reconnectAttempts = 0;
      this.clockSync.synchronize(4);
      this.resyncSnapshot(this.activeSession.jamId);
      this.connectRealtimeTransport(this.activeSession.jamId);
    }
  }

  private handleForegroundWake() {
    if (this.activeSession) {
      this.clockSync.synchronize(3);
      this.resyncSnapshot(this.activeSession.jamId);
    }
  }

  private startMetricsReporting(jamId: string) {
    if (this.metricsReportTimer) clearInterval(this.metricsReportTimer);

    this.metricsReportTimer = setInterval(() => {
      if (!this.activeSession) return;
      const clockState = this.clockSync.getState();
      const netMetrics = this.networkEngine.getMetrics();
      const drift = this.driftEngine.getPlaybackDriftMs();

      this.sendCommand('HEARTBEAT', {
        status: this.participantState,
        clockOffsetMs: clockState.offsetMs,
        rttMs: netMetrics.rttMedian,
        playbackDriftMs: drift,
        isReadyForPlayback: true,
      }).catch(() => {});
    }, 15000);
  }

  private detectDeviceType(): 'mobile' | 'desktop' | 'web' {
    if (typeof window === 'undefined') return 'web';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isMobile ? 'mobile' : 'desktop';
  }
}
