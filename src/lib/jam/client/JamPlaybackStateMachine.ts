import { JamSession, JamEvent, TrackMetadata } from '@/types/jam';
import { Song } from '@/types/music';
import { TrackMetadataCache } from '@/lib/music/TrackMetadataCache';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PreloadManager } from '@/lib/playback/PreloadManager';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';

export interface JamPlaybackCoordinatorState {
  activeGeneration: number;
  activeTimelineId: string | null;
  activeTransitionId: string | null;
  activeQueueItemId: string | null;
  activeTrackId: string | null;
  playbackState: 'PLAYING' | 'PAUSED' | 'STOPPED';
  currentMetadata: TrackMetadata | null;
  isPreloadingNext: boolean;
}

export interface PlaybackIdentity {
  generation: number;
  timelineId: string | null;
  transitionId: string | null;
  trackId: string | null;
  queueItemId: string | null;
}

/**
 * JamPlaybackStateMachine
 * 
 * Central coordinator connecting:
 * - Music Catalog / Metadata Service (TrackMetadataCache)
 * - Physical Playback Service (PlaybackService & PreloadManager)
 * - Authoritative Jam Service (JamClientManager / JamServerEngine)
 * - Clock Sync & Drift Engine (DriftCorrectionEngine)
 * - Local UI Store (usePlayerStore)
 * 
 * Guarantees:
 * 1. Playback Identity checks prevent duplicate transitions & seek-bar jumping.
 * 2. Snapshot reconciliation is atomic and never restarts running audio.
 * 3. Stale transitions produce zero playback effects.
 * 4. Preloading next track (P1 standby) never interferes with current playback.
 * 5. Structured telemetry logs [PLAYBACK_EFFECT] for complete observability.
 */
export class JamPlaybackStateMachine {
  private static instance: JamPlaybackStateMachine;

  private state: JamPlaybackCoordinatorState = {
    activeGeneration: 0,
    activeTimelineId: null,
    activeTransitionId: null,
    activeQueueItemId: null,
    activeTrackId: null,
    playbackState: 'PAUSED',
    currentMetadata: null,
    isPreloadingNext: false,
  };

  private metadataCache: TrackMetadataCache;
  private driftEngine: DriftCorrectionEngine;
  private clockSync: ClockSyncEngine;
  private preloadManager: PreloadManager;

  private constructor() {
    this.metadataCache = TrackMetadataCache.getInstance();
    this.driftEngine = DriftCorrectionEngine.getInstance();
    this.clockSync = ClockSyncEngine.getInstance();
    this.preloadManager = PreloadManager.getInstance();
  }

  public static getInstance(): JamPlaybackStateMachine {
    if (!JamPlaybackStateMachine.instance) {
      JamPlaybackStateMachine.instance = new JamPlaybackStateMachine();
    }
    return JamPlaybackStateMachine.instance;
  }

  public getState(): JamPlaybackCoordinatorState {
    return { ...this.state };
  }

  public getPlaybackIdentity(): PlaybackIdentity {
    return {
      generation: this.state.activeGeneration,
      timelineId: this.state.activeTimelineId,
      transitionId: this.state.activeTransitionId,
      trackId: this.state.activeTrackId,
      queueItemId: this.state.activeQueueItemId,
    };
  }

  /**
   * Authoritative entrypoint: processes a JamEvent or fresh JamSession snapshot.
   * Separates NEW PLAYBACK TRANSITIONS from STATE RECONCILIATION and DRIFT CORRECTION.
   *
   * Identity rules (Phase 1 + 2):
   *  - PAUSE / PLAY (pure resume) preserve generation → same generation + same trackId → STATE_ONLY
   *  - SEEK, SKIP_NEXT/PREV, STOP, ADD_TRACK increment generation → NEW_TRANSITION
   *  - Same generation + same transitionId → DUPLICATE → NO_OP
   */
  public async handleTransition(
    session: JamSession,
    triggerEvent?: JamEvent,
    sourceReason: 'NEW_TRANSITION' | 'RECONCILIATION' | 'EVENT' = 'EVENT'
  ): Promise<void> {
    const eventGeneration = triggerEvent?.generation ?? session.generation ?? 0;
    const timelineId = triggerEvent?.timelineId ?? session.timelineId ?? `TL_${eventGeneration}`;
    const transitionId = triggerEvent?.transitionId ?? session.transitionId ?? `TR_${eventGeneration}`;
    const trackId = session.trackId || session.currentSong?.id || null;
    const currentSong = session.currentSong;
    const queueItemId = session.currentQueueItemId || (session.queue[0]?.queueItemId ?? null);

    // isPureResume: server signals PAUSE/PLAY did not change track, generation is preserved
    const isPureResume = triggerEvent?.payload?.isPureResume !== undefined
      ? Boolean(triggerEvent.payload.isPureResume)
      : (session as any).isPureResume !== undefined
        ? Boolean((session as any).isPureResume)
        : false;

    // 1. Stale generation check: reject before any side effects
    if (eventGeneration < this.state.activeGeneration) {
      console.warn(`[JamPlaybackStateMachine] Discarding stale transition (Gen ${eventGeneration} < Active ${this.state.activeGeneration})`);
      console.log(`[PLAYBACK_EFFECT] action=NO_OP reason=STALE_TRANSITION_DISCARDED transitionId=${transitionId} timelineId=${timelineId} generation=${eventGeneration} activeGen=${this.state.activeGeneration}`);
      return;
    }

    // 2a. Exact duplicate identity check (same generation + timelineId + transitionId + trackId)
    const isSameIdentity =
      this.state.activeGeneration === eventGeneration &&
      this.state.activeTimelineId === timelineId &&
      this.state.activeTransitionId === transitionId &&
      this.state.activeTrackId === trackId;

    if (isSameIdentity) {
      // Reconcile state changes without restarting playback or reloading audio
      const targetState = session.state === 'PLAYING' ? 'PLAYING' : 'PAUSED';
      if (this.state.playbackState !== targetState) {
        this.state.playbackState = targetState;
        if (targetState === 'PAUSED') {
          PlaybackService.getInstance().pause();
          usePlayerStore.setState({ isPlaying: false, playbackIntent: 'PAUSED' });
          console.log(`[PLAYBACK_EFFECT] action=PAUSE reason=STATE_RECONCILED transitionId=${transitionId} timelineId=${timelineId} generation=${eventGeneration}`);
        } else {
          this.driftEngine.evaluateScheduledStart(session);
          usePlayerStore.setState({ isPlaying: true, playbackIntent: 'PLAYING' });
          console.log(`[PLAYBACK_EFFECT] action=PLAY reason=STATE_RECONCILED transitionId=${transitionId} timelineId=${timelineId} generation=${eventGeneration}`);
        }
      } else {
        console.log(`[PLAYBACK_EFFECT] action=NO_OP reason=DUPLICATE_TRANSITION transitionId=${transitionId} timelineId=${timelineId} generation=${eventGeneration}`);
      }

      // Reconcile queue & metadata in player store cleanly without touching playback position
      const activeSong = session.currentSong || usePlayerStore.getState().currentSong;
      if (session.queue) {
        const clientQueue: Song[] = activeSong ? [activeSong, ...session.queue.map((item) => item.song)] : session.queue.map((item) => item.song);
        usePlayerStore.setState({ queue: clientQueue, currentSong: activeSong });
      } else if (activeSong && usePlayerStore.getState().currentSong?.id !== activeSong.id) {
        usePlayerStore.setState({ currentSong: activeSong });
      }
      return;
    }

    // 2b. Pure PAUSE/PLAY on same track: same generation + same trackId → state-only reconciliation
    //     Do NOT reload audio. Do NOT call prepareAudioPlayback. Just update play/pause state.
    const isSameTrackSameGeneration =
      this.state.activeGeneration === eventGeneration &&
      this.state.activeTrackId === trackId &&
      trackId !== null;

    if (isSameTrackSameGeneration) {
      // Update the timeline/transition IDs so subsequent duplicate checks work correctly
      this.state.activeTimelineId = timelineId;
      this.state.activeTransitionId = transitionId;
      if (queueItemId) this.state.activeQueueItemId = queueItemId;

      const targetState = session.state === 'PLAYING' ? 'PLAYING' : 'PAUSED';
      this.state.playbackState = targetState;
      if (targetState === 'PAUSED') {
        PlaybackService.getInstance().pause();
        usePlayerStore.setState({ isPlaying: false, playbackIntent: 'PAUSED' });
        console.log(`[PLAYBACK_EFFECT] action=PAUSE reason=PURE_SAME_TRACK_PAUSE trackId=${trackId} positionMs=${session.positionMs} timelineId=${timelineId} generation=${eventGeneration}`);
      } else {
        // Resume: drift engine will seek to correct position and call play()
        this.driftEngine.evaluateScheduledStart(session);
        usePlayerStore.setState({ isPlaying: true, playbackIntent: 'PLAYING' });
        console.log(`[PLAYBACK_EFFECT] action=RESUME reason=PURE_SAME_TRACK_RESUME trackId=${trackId} positionMs=${session.positionMs} timelineId=${timelineId} generation=${eventGeneration}`);
      }

      // Reconcile queue in player store without touching audio position
      const activeSong2b = session.currentSong || usePlayerStore.getState().currentSong;
      if (session.queue) {
        const clientQueue: Song[] = activeSong2b ? [activeSong2b, ...session.queue.map((item) => item.song)] : session.queue.map((item) => item.song);
        usePlayerStore.setState({ queue: clientQueue, currentSong: activeSong2b });
      } else if (activeSong2b && usePlayerStore.getState().currentSong?.id !== activeSong2b.id) {
        usePlayerStore.setState({ currentSong: activeSong2b });
      }
      return;
    }

    // 3. Authoritative New Transition Commit
    this.state.activeGeneration = eventGeneration;
    this.state.activeTimelineId = timelineId;
    this.state.activeTransitionId = transitionId;
    this.state.activeQueueItemId = queueItemId;
    this.state.activeTrackId = trackId;
    this.state.playbackState = session.state === 'PLAYING' ? 'PLAYING' : 'PAUSED';

    console.log('[JamPlaybackStateMachine] Transition committed:', {
      generation: eventGeneration,
      timelineId,
      transitionId,
      trackId,
      queueItemId,
      state: session.state,
      reason: sourceReason,
    });

    console.log(`[PLAYBACK_EFFECT] action=NEW_TRANSITION reason=${sourceReason} transitionId=${transitionId} timelineId=${timelineId} generation=${eventGeneration} trackId=${trackId}`);

    if (!currentSong || !trackId) {
      const pb = PlaybackService.getInstance();
      pb.pause();
      usePlayerStore.setState({
        currentSong: null,
        isPlaying: false,
        playbackIntent: 'PAUSED',
      });
      return;
    }

    // Step 1: Parallel Metadata & Artwork Resolution (Non-Blocking)
    this.resolveMetadataInParallel(trackId, eventGeneration, currentSong);

    // Step 2: Physical Audio Preparation (Protected against stale loads & duplicate resets)
    await this.prepareAudioPlayback(session, currentSong, eventGeneration, transitionId, triggerEvent);

    // Step 3: Trigger Background Preload for the Next Track (P1 Standby)
    this.triggerNextTrackPreload(session, eventGeneration);
  }

  /**
   * Resolves metadata in parallel without stalling physical audio loading
   */
  private async resolveMetadataInParallel(trackId: string, generation: number, song: Song) {
    try {
      const metadata = await this.metadataCache.resolve(trackId, generation, song);
      
      // Generation Guard: if a newer transition has occurred while resolving, discard!
      if (this.state.activeGeneration > generation) {
        console.log(`[JamPlaybackStateMachine] Discarding resolved metadata for stale generation ${generation}`);
        return;
      }

      if (metadata) {
        this.state.currentMetadata = metadata;
      }
    } catch (err) {
      console.error('[JamPlaybackStateMachine] Error resolving metadata:', err);
    }
  }

  private loadedTrackId: string | null = null;

  /**
   * Prepares and coordinates physical audio playback on the local device
   */
  private async prepareAudioPlayback(
    session: JamSession,
    song: Song,
    generation: number,
    transitionId: string,
    triggerEvent?: JamEvent
  ) {
    const store = usePlayerStore.getState();
    const pb = PlaybackService.getInstance();
    const isNative = RaagaXNativePlayer.isNative();
    const activeAudio = pb.getActiveAudio();

    const isAlreadyLoaded = this.loadedTrackId === song.id;
    const clientQueue: Song[] = [song, ...session.queue.map((item) => item.song)];

    const inFlightMs = this.driftEngine.calculateExpectedPositionMs(session);
    const inFlightSec = inFlightMs / 1000;
    const isExplicitSeek = triggerEvent?.type === 'SEEK';

    // Update player store representation
    usePlayerStore.setState({
      currentSong: song,
      queue: clientQueue,
      queueIndex: 0,
      duration: song.duration || 0,
      isPlaying: session.state === 'PLAYING',
      playbackIntent: session.state === 'PLAYING' ? 'PLAYING' : 'PAUSED',
      currentTime: inFlightSec,
    });
    store.setCurrentTime(inFlightSec, true);

    if (!isAlreadyLoaded) {
      // New track: load audio source with inFlightSec preserved
      const reqId = Date.now();
      pb.setPlaybackRequestId(reqId);
      let loadSuccess = false;
      try {
        loadSuccess = await pb.loadAudioSource(song, reqId, false, inFlightSec);
      } catch (err) {
        console.warn(`[JamPlaybackStateMachine] Audio loading error on joining device for track ${song.id}:`, err);
        loadSuccess = false;
      }

      // Generation Guard: verify active generation and transitionId after async load
      if (this.state.activeGeneration > generation || this.state.activeTransitionId !== transitionId) {
        console.log(`[JamPlaybackStateMachine] Discarding loaded audio for stale generation ${generation} (Active is ${this.state.activeGeneration})`);
        return;
      }

      if (!loadSuccess) {
        console.warn(`[JamPlaybackStateMachine] Audio source unavailable for track ${song.id} on joining device`);
        return;
      }

      this.loadedTrackId = song.id;

      if (activeAudio) {
        if (!activeAudio.dataset) {
          (activeAudio as any).dataset = {};
        }
        activeAudio.dataset.trackId = song.id;
      }
    } else if (isExplicitSeek) {
      // Same track with explicit SEEK: set currentTime to seek target
      if (activeAudio) {
        activeAudio.currentTime = inFlightSec;
      }
      if (isNative) {
        RaagaXNativePlayer.seekTo(inFlightMs);
      }
      usePlayerStore.setState({ currentTime: inFlightSec });
      store.setCurrentTime(inFlightSec, true);
    }

    if (session.state === 'PLAYING') {
      this.driftEngine.evaluateScheduledStart(session);
    } else {
      pb.pause();
      if (activeAudio && isExplicitSeek) {
        activeAudio.currentTime = inFlightSec;
      }
      if (isNative && isExplicitSeek) {
        RaagaXNativePlayer.seekTo(inFlightMs);
      }
      store.setCurrentTime(inFlightSec, true);
    }
  }

  /**
   * Preloads the next queue item in the background (P1 Standby) without modifying Jam state
   */
  private triggerNextTrackPreload(session: JamSession, generation: number) {
    if (session.queue.length === 0) return;

    const nextItem = session.queue[0];
    if (!nextItem?.song) return;

    this.state.isPreloadingNext = true;
    const standby = PlaybackService.getInstance().getStandbyAudio();
    this.preloadManager
      .prepareNextTrack(nextItem.song, standby)
      .then(() => {
        if (this.state.activeGeneration === generation) {
          console.log(`[JamPlaybackStateMachine] Next track preloaded in standby: ${nextItem.song.title}`);
        }
      })
      .catch(() => {})
      .finally(() => {
        this.state.isPreloadingNext = false;
      });
  }

  /**
   * Calculates smooth interpolated playback position locally without polling server
   */
  public getInterpolatedPosition(session: JamSession | null): number {
    if (!session || !session.currentSong) return 0;

    if (session.state !== 'PLAYING') {
      return session.positionMs / 1000;
    }

    const serverNow = this.clockSync.estimatedServerNow();
    const timelineStart = session.startAtServerTime || session.serverTimestamp;

    if (serverNow < timelineStart) {
      return (session.basePositionMs || session.positionMs) / 1000;
    }

    const elapsedMs = serverNow - timelineStart;
    const baseMs = session.basePositionMs || session.positionMs || 0;
    const totalMs = baseMs + elapsedMs;
    const durationMs = session.currentSong.duration ? session.currentSong.duration * 1000 : Infinity;

    return Math.min(durationMs, totalMs) / 1000;
  }

  /**
   * Resets coordinator state (e.g. On Jam session end or test cleanup)
   */
  public reset(): void {
    this.state = {
      activeGeneration: 0,
      activeTimelineId: null,
      activeTransitionId: null,
      activeQueueItemId: null,
      activeTrackId: null,
      playbackState: 'PAUSED',
      currentMetadata: null,
      isPreloadingNext: false,
    };
    this.loadedTrackId = null;
    this.metadataCache.clear();
  }
}
