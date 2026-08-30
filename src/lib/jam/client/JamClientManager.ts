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
  private stateListeners: Set<JamStateListener> = new Set();

  private constructor() {
    this.clockSync = ClockSyncEngine.getInstance();
    this.driftEngine = DriftCorrectionEngine.getInstance();
    this.networkEngine = NetworkQualityEngine.getInstance();
    this.stateMachine = JamPlaybackStateMachine.getInstance();

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
  public async createJam(params?: { jamName?: string; initialSong?: Song | null; initialQueue?: Song[] }): Promise<JamSession> {
    const store = usePlayerStore.getState();
    const currentSong = params?.initialSong ?? store.currentSong;
    const initialQueue = params?.initialQueue ?? store.queue;

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
        deviceType: this.detectDeviceType(),
      }),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Failed to communicate with Jam server');
    }

    if (!res.ok || !data.session) {
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
    this.driftEngine.start();

    // Connect real-time transport
    this.connectRealtimeTransport(session.jamId);
    this.startMetricsReporting(session.jamId);

    // Start nearby discovery beacon advertising
    JamDiscoveryEngine.getInstance().startBroadcasting(session);

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
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Could not reach Jam server. Please check your network connection.');
    }

    if (!res.ok || !data.success || !data.jamId) {
      throw new Error(data.error || 'Invalid or expired Join Code');
    }

    return this.joinJam(data.jamId);
  }

  /**
   * Joins an existing Jam session with full synchronization flow
   */
  public async joinJam(jamId: string): Promise<JamSession> {
    this.setParticipantState('JOINING');

    // Step 1: Authenticate / identify
    this.setParticipantState('AUTHENTICATING');

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
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      this.setParticipantState('READY');
      throw new Error('Could not parse server response');
    }

    if (!res.ok || !data.session) {
      this.setParticipantState('READY');
      throw new Error(data.error || 'Failed to join Jam');
    }

    const session: JamSession = data.session;

    this.activeSession = session;
    this.localRevision = session.revision;

    // Step 2: Synchronize clock
    this.setParticipantState('SYNCING');
    await this.clockSync.synchronize(6);
    this.clockSync.startPeriodicSync(15000);

    // Step 3: Buffer audio & synchronize playback
    this.setParticipantState('BUFFERING');
    await this.syncPlaybackWithSession(session, true);

    this.driftEngine.setSession(session);
    this.driftEngine.start();

    // Step 4: Ready
    this.setParticipantState(session.state === 'PLAYING' ? 'PLAYING' : 'READY');

    // Connect real-time channels
    this.connectRealtimeTransport(jamId);
    this.startMetricsReporting(jamId);

    return session;
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
    JamDiscoveryEngine.getInstance().stopBroadcasting();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }

    if (this.metricsReportTimer) {
      clearInterval(this.metricsReportTimer);
      this.metricsReportTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.notify();
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
            this.handleIncomingEvent(payload.payload);
          }
        })
        .subscribe();
    } catch {}
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

    // Stale event check
    if (event.revision <= this.localRevision && event.type !== 'SYNC') {
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
        usePlayerStore.setState({ isPlaying: true });

        // Bug #2 fix: Verify audio is loaded to the correct track before scheduling playback start.
        // If the audio element is not yet ready (e.g. guest just joined or previous load is in progress),
        // we trigger syncPlaybackWithSession which will load then schedule start.
        const pb = PlaybackService.getInstance();
        const audio = pb.getActiveAudio();
        const expectedTrackId = s.trackId || s.currentSong?.id;
        const audioTrackId = audio?.dataset?.trackId || '';
        const isAudioReady = audio && audio.readyState >= 2 && audioTrackId === expectedTrackId;

        if (!isAudioReady) {
          console.log(`[JamClientManager] PLAY: audio not ready for track ${expectedTrackId}, triggering load+sync`);
          this.syncPlaybackWithSession(s, true);
        } else {
          this.driftEngine.evaluateScheduledStart(s);
        }
        break;
      }

      case 'PAUSE': {
        s.state = 'PAUSED';
        s.positionMs = event.payload.positionMs;
        s.serverTimestamp = event.serverTimestamp;

        this.driftEngine.setSession(s);
        PlaybackService.getInstance().pause();
        usePlayerStore.setState({ isPlaying: false });
        this.stateMachine.handleTransition(s, event);
        break;
      }

      case 'STOP': {
        s.state = 'PAUSED';
        s.positionMs = 0;
        s.basePositionMs = 0;
        this.driftEngine.setSession(s);
        PlaybackService.getInstance().pause();
        const activeAudio = PlaybackService.getInstance().getActiveAudio();
        if (activeAudio) activeAudio.currentTime = 0;
        usePlayerStore.getState().setCurrentTime(0, true);
        usePlayerStore.setState({ isPlaying: false });
        this.stateMachine.handleTransition(s, event);
        break;
      }

      case 'SEEK': {
        s.positionMs = event.payload.positionMs;
        s.startAtServerTime = event.payload.startAtServerTime;
        s.state = event.payload.state || s.state;

        this.driftEngine.setSession(s);
        const pb = PlaybackService.getInstance();
        const activeAudio = pb.getActiveAudio();
        const targetSec = s.positionMs / 1000;

        if (activeAudio) {
          if (activeAudio.readyState >= 2) {
            // Audio is ready: apply seek immediately
            activeAudio.currentTime = targetSec;
          } else {
            // Bug #4 fix: Audio not yet ready — defer seek application until canplay.
            // This handles the case where SEEK arrives while the audio element is still loading.
            const onCanPlay = () => {
              activeAudio.removeEventListener('canplay', onCanPlay);
              if (this.activeSession?.positionMs === s.positionMs) {
                activeAudio.currentTime = targetSec;
              }
            };
            activeAudio.addEventListener('canplay', onCanPlay, { once: true });
          }
        }
        usePlayerStore.getState().setCurrentTime(targetSec, true);

        if (s.state === 'PLAYING') {
          this.driftEngine.evaluateScheduledStart(s);
        } else {
          pb.pause();
        }
        this.stateMachine.handleTransition(s, event);
        break;
      }

      case 'TRACK_CHANGED': {
        s.currentSong = event.payload.currentSong;
        s.trackId = event.payload.trackId;
        s.currentQueueItemId = event.payload.currentQueueItemId;
        s.positionMs = event.payload.positionMs;
        s.startAtServerTime = event.payload.startAtServerTime;
        s.queue = event.payload.queue || s.queue;
        // Bug #5 / server fix: also sync history so guest prev-track state matches
        if (Array.isArray(event.payload.history)) {
          s.history = event.payload.history;
        }

        // Bug #3 fix: Set activeTransitionId BEFORE the async load so stale loads can detect they've been superseded.
        const thisTransitionId = event.transitionId || event.payload?.transitionId || `TR_${Date.now()}`;
        this.activeTransitionId = thisTransitionId;

        this.stateMachine.handleTransition(s, event);
        this.syncPlaybackWithSession(s, s.state === 'PLAYING');
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

      case 'HOST_TRANSFERRED': {
        if (event.payload.newHostId) {
          s.hostId = event.payload.newHostId;
          s.hostName = event.payload.newHostName;
          for (const p of Object.values(s.participants)) {
            p.isHost = p.userId === s.hostId;
            if (p.isHost) p.role = 'HOST';
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
   * Full snapshot restoration
   */
  public applySessionSnapshot(session: JamSession) {
    this.activeSession = session;
    this.localRevision = session.revision;

    this.driftEngine.setSession(session);
    this.stateMachine.handleTransition(session);
    this.syncPlaybackWithSession(session, session.state === 'PLAYING');
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

    const store = usePlayerStore.getState();
    const song = session.currentSong;
    const isAlreadyLoaded = store.currentSong?.id === song.id;

    // Convert JamQueueItem[] to Song[] for local player store UI
    const clientQueue: Song[] = [song, ...session.queue.map((item) => item.song)];
    const initialSec = (session.positionMs || 0) / 1000;
    usePlayerStore.setState({
      currentSong: song,
      queue: clientQueue,
      queueIndex: 0,
      duration: song.duration || 0,
      isPlaying: session.state === 'PLAYING',
      playbackIntent: session.state === 'PLAYING' ? 'PLAYING' : 'PAUSED',
      currentTime: initialSec,
    });
    store.setCurrentTime(initialSec, true);

    const pb = PlaybackService.getInstance();

    if (!isAlreadyLoaded) {
      // Bug #3 fix: Snapshot the transitionId before the async load begins.
      // After the await, if activeTransitionId has changed, a newer TRACK_CHANGED event
      // arrived while we were loading — discard this stale result entirely.
      const snapshotTransitionId = this.activeTransitionId;
      const reqId = Date.now();
      pb.setPlaybackRequestId(reqId);
      await pb.loadAudioSource(song, reqId, false);

      if (this.activeTransitionId !== snapshotTransitionId) {
        console.log(`[JamClientManager] syncPlaybackWithSession: stale load for ${song.id} (transitionId changed from ${snapshotTransitionId} to ${this.activeTransitionId}) — discarding`);
        return;
      }
    }

    if (session.state === 'PLAYING' && autoPlay) {
      this.driftEngine.evaluateScheduledStart(session);
    } else {
      pb.pause();
      const activeAudio = pb.getActiveAudio();
      if (activeAudio) {
        activeAudio.currentTime = initialSec;
      }
      store.setCurrentTime(initialSec, true);
    }
  }

  /**
   * Sends an authoritative command to the Jam server with precise error handling
   */
  public async sendCommand(action: JamCommandAction, payload?: any): Promise<boolean> {
    if (!this.activeSession) return false;

    const jamId = this.activeSession.jamId;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await fetch(getApiUrl(`/api/jam/${jamId}/command`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: requestId,
          jamId,
          userId: this.currentUserId,
          action,
          payload,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (res.status === 410 || data.code === 'JAM_ENDED') {
        console.warn(`[JamClientManager] Session ${jamId} has ended. Cleaning up.`);
        this.cleanupSession();
        if (typeof window !== 'undefined') {
          usePlayerStore.getState().setToastMessage('Jam session ended');
        }
        return false;
      }

      if (res.status === 404 || data.code === 'JAM_NOT_FOUND') {
        // Background telemetry & heartbeats must NEVER directly destroy the local session!
        if (action === 'UPDATE_PARTICIPANT_STATUS' || action === 'HEARTBEAT' || action === 'REPORT_METRICS') {
          console.log(`\n[JAM_HEARTBEAT_FAILED]\njamId=${jamId}\nparticipantId=${this.currentUserId}\nreason=TRANSIENT_404\n`);
          this.resyncSnapshot(jamId);
          return false;
        }

        // For user-triggered actions, verify authoritative status before teardown
        console.warn(`[JamClientManager] Command ${action} encountered 404 for ${jamId}. Verifying session snapshot...`);
        const snapshotValid = await this.resyncSnapshot(jamId);
        return snapshotValid;
      }

      if (res.status === 403 || data.code === 'UNAUTHORIZED') {
        // If participant was cleared on server (e.g. server restart in dev), auto re-join silently
        if (action === 'UPDATE_PARTICIPANT_STATUS' || action === 'HEARTBEAT' || action === 'REPORT_METRICS') {
          console.warn(`[JamClientManager] Participant unauthorized during heartbeat. Auto re-joining Jam ${jamId}...`);
          this.joinJam(jamId).catch(() => {});
          return false;
        }
        if (typeof window !== 'undefined' && data.error) {
          usePlayerStore.getState().setToastMessage(data.error);
        }
        return false;
      }

      if (!res.ok) {
        // 400 INVALID_COMMAND or 5xx: Reconcile state, do NOT delete local session
        console.warn(`[JamClientManager] Command ${action} rejected (${res.status}): ${data.error || 'Unknown error'}`);
        if (typeof window !== 'undefined' && data.error && action !== 'UPDATE_PARTICIPANT_STATUS' && action !== 'HEARTBEAT') {
          usePlayerStore.getState().setToastMessage(data.error);
        }
        return false;
      }

      if (data?.session) {
        this.notFoundVerificationRetries = 0;
        this.applySessionSnapshot(data.session);
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
        bluetooth: true,
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
