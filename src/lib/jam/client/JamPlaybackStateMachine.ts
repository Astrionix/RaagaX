import { JamSession, JamEvent, TrackMetadata } from '@/types/jam';
import { Song } from '@/types/music';
import { TrackMetadataCache } from '@/lib/music/TrackMetadataCache';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PreloadManager } from '@/lib/playback/PreloadManager';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { usePlayerStore } from '@/context/usePlayerStore';

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
 * 1. Audio, metadata, artwork, and queue identity never mismatch.
 * 2. Artwork/metadata resolution runs in parallel and never stalls audio playback.
 * 3. Generation guards discard stale async callbacks from prior track transitions.
 * 4. Preloading next track (P1 standby) never falsely advances Jam state.
 * 5. Smooth 60fps local timeline progress without spamming 16ms server updates.
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

  /**
   * Authoritative entrypoint: processes a JamEvent or fresh JamSession snapshot
   */
  public async handleTransition(session: JamSession, triggerEvent?: JamEvent): Promise<void> {
    const eventGeneration = triggerEvent?.generation ?? session.generation ?? 0;
    const timelineId = triggerEvent?.timelineId ?? session.timelineId ?? `TL_${eventGeneration}`;
    const transitionId = triggerEvent?.transitionId ?? session.transitionId ?? `TR_${eventGeneration}`;
    const trackId = session.trackId;
    const currentSong = session.currentSong;
    const queueItemId = session.currentQueueItemId || (session.queue[0]?.queueItemId ?? null);

    // Stale generation check
    if (eventGeneration < this.state.activeGeneration) {
      console.warn(`[JamPlaybackStateMachine] Discarding stale transition (Gen ${eventGeneration} < Active ${this.state.activeGeneration})`);
      return;
    }

    // Advance active coordinator state
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
    });

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

    // Step 2: Physical Audio Preparation
    await this.prepareAudioPlayback(session, currentSong, eventGeneration, transitionId);

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

  /**
   * Prepares and coordinates physical audio playback on the local device
   */
  private async prepareAudioPlayback(
    session: JamSession,
    song: Song,
    generation: number,
    transitionId: string
  ) {
    const store = usePlayerStore.getState();
    const isAlreadyLoaded = store.currentSong?.id === song.id;
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
      const reqId = Date.now();
      pb.setPlaybackRequestId(reqId);
      await pb.loadAudioSource(song, reqId, false);

      // Generation Guard: verify active generation and transitionId after async load
      if (this.state.activeGeneration > generation || this.state.activeTransitionId !== transitionId) {
        console.log(`[JamPlaybackStateMachine] Discarding loaded audio for stale generation ${generation} (Active is ${this.state.activeGeneration})`);
        return;
      }
    }

    if (session.state === 'PLAYING') {
      this.driftEngine.evaluateScheduledStart(session);
    } else {
      pb.pause();
      const activeAudio = pb.getActiveAudio();
      if (activeAudio) {
        activeAudio.currentTime = session.positionMs / 1000;
      }
      store.setCurrentTime(session.positionMs / 1000, true);
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

    const clockState = this.clockSync.getState();
    const serverNow = Date.now() + clockState.offsetMs;
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
    this.metadataCache.clear();
  }
}
