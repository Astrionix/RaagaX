import { supabase } from '@/lib/supabase';
import { usePlayerStore, isOfflineMode } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { CommandSequencer } from './CommandSequencer';
import { DeviceRegistry } from './DeviceRegistry';
import { RaagaXNativePlayer } from '../playback/native/RaagaXNativePlayer';
import { PlaybackService } from '../playback/PlaybackService';
import { SeekLock } from '../playback/SeekLock';
import { ClockSynchronizer } from './ClockSynchronizer';
import { QueueManager } from '../queue/QueueManager';

export interface RemotePlaybackState {
  activeDeviceId: string;
  activeDeviceName: string;
  songId: string | null;
  songData: Song | null;
  isPlaying: boolean;
  isBuffering?: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  queue: Song[];
  queueIndex: number;
  shuffleMode?: string;
  repeatMode?: string;
  serverTimestamp: number;
  epoch: number;
  revision?: number;
}

export class PlaybackStateSync {
  private static instance: PlaybackStateSync;
  private lastPublishTime: number = 0;
  private publishTimer: NodeJS.Timeout | null = null;

  // Command-specific optimistic shielding to eliminate feedback loops
  private activeCommandShield: {
    commandId: string | null;
    type: string | null;
    songId: string | null;
    queueIndex: number | null;
    startedAt: number;
    expectedPlayingState?: boolean;
  } | null = null;

  // Dedicated Target-Aware Seek State Machine
  private seekShieldState = {
    active: false,
    targetMs: 0,
    commandId: null as string | null,
    startedAt: 0,
    songId: null as string | null,
  };

  private cachedRemoteStates: Map<string, RemotePlaybackState> = new Map();

  // ── Zero-Jump Reconciliation ─────────────────────────────────────────────
  // When a new remote position arrives, if it's close to our predicted position
  // we smoothly drift toward it rather than hard-snapping.
  private driftCorrection: {
    active: boolean;
    targetMs: number;
    startMs: number;
    startedAt: number;
    durationMs: number;
  } = { active: false, targetMs: 0, startMs: 0, startedAt: 0, durationMs: 500 };

  private driftTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  public static getInstance(): PlaybackStateSync {
    if (!PlaybackStateSync.instance) {
      PlaybackStateSync.instance = new PlaybackStateSync();
    }
    return PlaybackStateSync.instance;
  }

  public getCachedRemoteState(deviceId: string): RemotePlaybackState | null {
    return this.cachedRemoteStates.get(deviceId) || null;
  }

  /**
   * Tracks a sent command to shield optimistic UI state from conflicting incoming updates.
   */
  public recordSentCommand(
    type: string,
    songId: string | null = null,
    queueIndex: number | null = null,
    positionMs?: number,
    commandId?: string
  ) {
    this.activeCommandShield = {
      commandId: commandId || null,
      type,
      songId,
      queueIndex,
      startedAt: Date.now(),
      expectedPlayingState: type === 'PLAY' ? true : (type === 'PAUSE' ? false : undefined),
    };

    if (type === 'SEEK') {
      const store = usePlayerStore.getState();
      const target = typeof positionMs === 'number' ? positionMs : Math.round(store.currentTime * 1000);
      this.seekShieldState = {
        active: true,
        targetMs: target,
        commandId: commandId || null,
        startedAt: Date.now(),
        songId: songId || store.currentSong?.id || null,
      };
      console.log(`[PlaybackStateSync] SEEK state machine activated for target ${target}ms (commandId: ${commandId})`);
    }

    console.log(`[PlaybackStateSync] Command-specific shield activated for ${type} (commandId=${commandId}, songId=${songId}, queueIndex=${queueIndex}, pos=${positionMs})`);
  }

  public releaseCommandShield(commandId?: string) {
    if (!commandId || this.activeCommandShield?.commandId === commandId) {
      this.activeCommandShield = null;
    }
  }

  /**
   * Broadcasts the authoritative playback state to all connected devices in the session.
   * Called only by the active renderer device.
   */
  public broadcastState(immediate: boolean = false) {
    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return; // Only active renderer broadcasts state

    const now = Date.now();
    if (!immediate && now - this.lastPublishTime < 1500) {
      // Throttle rapid time updates
      if (!this.publishTimer) {
        this.publishTimer = setTimeout(() => {
          this.publishTimer = null;
          this.broadcastState(true);
        }, 1500);
      }
      return;
    }

    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }

    this.lastPublishTime = now;
    const sequencer = CommandSequencer.getInstance();
    const deviceName = typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_name') || 'RaagaX Player') : 'RaagaX Player';

    const nextRevision = (store.localPlaybackRevision || 0) + 1;
    usePlayerStore.setState({ localPlaybackRevision: nextRevision });

    const payload: RemotePlaybackState = {
      activeDeviceId: store.deviceId,
      activeDeviceName: deviceName,
      songId: store.currentSong?.id || null,
      songData: store.currentSong || null,
      isPlaying: store.isPlaying,
      positionMs: Math.round(store.currentTime * 1000),
      durationMs: Math.round(store.duration * 1000),
      volume: store.volume,
      isMuted: store.isMuted,
      queue: store.queue || [],
      queueIndex: store.queueIndex || 0,
      shuffleMode: store.shuffleMode,
      repeatMode: store.repeatMode,
      serverTimestamp: now,
      epoch: sequencer.getEpoch(),
      revision: nextRevision,
    };

    import('./ConnectManager').then(({ ConnectManager }) => {
      ConnectManager.getInstance().broadcastSessionState(payload);
    });
  }

  /**
   * Handles incoming live playback state from the active renderer device.
   * Updates remote controller UI without starting local audio playback.
   */
  public handleRemoteStateUpdate(remoteState: RemotePlaybackState) {
    if (!remoteState || !remoteState.activeDeviceId) return;

    if (isOfflineMode()) {
      return;
    }

    const store = usePlayerStore.getState();
    const localDeviceId = store.deviceId;

    // Ignore if sent by our own device
    if (remoteState.activeDeviceId === localDeviceId) return;

    // Always cache device playback metadata so the device picker can display live status (e.g. "Playing · Inthandham")
    this.cachedRemoteStates.set(remoteState.activeDeviceId, remoteState);
    
    // Update lightweight device preview in store without modifying active playback
    const currentPreviews = { ...(store.availableDevicePlaybackStates || {}) };
    currentPreviews[remoteState.activeDeviceId] = {
      isPlaying: remoteState.isPlaying,
      songTitle: remoteState.songData?.title,
      artist: remoteState.songData?.artist,
    };
    usePlayerStore.setState({ availableDevicePlaybackStates: currentPreviews });

    // CRITICAL: Connection Gating
    // Only adopt remote state into the active player store if the user has explicitly connected to this device,
    // or this device is in follower/remote-controller mode targeting this device.
    const isConnectedToThisDevice = store.connectedDeviceId === remoteState.activeDeviceId;
    const isRemoteFollowerOfThis = !store.isActiveDevice && (store.activeDeviceId === remoteState.activeDeviceId || store.connectedDeviceId === remoteState.activeDeviceId);

    if (!isConnectedToThisDevice && !isRemoteFollowerOfThis) {
      // Not connected to this device — discovery only. Do not touch local player!
      return;
    }

    // Epoch & Revision validation to filter out stale/out-of-order state snapshots
    const currentEpoch = CommandSequencer.getInstance().getEpoch();
    if (remoteState.epoch < currentEpoch) {
      console.log(`[PlaybackStateSync] Ignoring remote state with stale epoch ${remoteState.epoch} < current ${currentEpoch}`);
      return;
    }

    const lastRemoteRevision = store.lastReceivedPlaybackRevision || 0;
    const incomingRevision = remoteState.revision || 0;
    if (incomingRevision <= lastRemoteRevision && remoteState.epoch === currentEpoch && lastRemoteRevision > 0) {
      console.log(`[PlaybackStateSync] Ignoring stale remote state revision ${incomingRevision} <= last ${lastRemoteRevision}`);
      return;
    }

    // While the user is dragging the seekbar or seek is settling, suppress
    // incoming remote position updates so the thumb doesn't snap back mid-drag.
    if (SeekLock.shouldBlockRemoteUpdate) {
      console.log('[PlaybackStateSync] Suppressing remote position update — SeekLock active (user is seeking)');
      return;
    }

    const now = Date.now();

    // 1. Target-Aware SEEK State Machine Shielding
    if (this.seekShieldState.active) {
      const timeSinceSeek = now - this.seekShieldState.startedAt;
      const isSameSong = !this.seekShieldState.songId || !remoteState.songId || this.seekShieldState.songId === remoteState.songId;

      if (isSameSong) {
        const delta = Math.abs(remoteState.positionMs - this.seekShieldState.targetMs);

        // Guard against transient 0ms reporting during player buffering/seeking
        const isTransientZero = remoteState.positionMs === 0 && this.seekShieldState.targetMs > 3000;

        if (delta < 2500 && !isTransientZero) {
          // The remote player has reached the requested seek position (PLAYER_POSITION_CONFIRMED -> SEEK_COMPLETE)
          console.log(`[PlaybackStateSync] Remote player reached seek target ${remoteState.positionMs}ms (target: ${this.seekShieldState.targetMs}ms, delta: ${delta}ms). Cleared seek shield.`);
          this.seekShieldState.active = false;
        } else if (timeSinceSeek < 5000) {
          // The remote player is still in transition (e.g. reporting transient 0ms). Preserve our local target.
          console.log(`[PlaybackStateSync] Shielding stale remote seek position ${remoteState.positionMs}ms (waiting for ~${this.seekShieldState.targetMs}ms, elapsed: ${timeSinceSeek}ms)`);
          remoteState.positionMs = this.seekShieldState.targetMs;
        } else {
          // Timeout (>5s) safety release
          console.warn(`[PlaybackStateSync] Seek shield timed out after ${timeSinceSeek}ms. Accepting remote pos ${remoteState.positionMs}ms.`);
          this.seekShieldState.active = false;
        }
      } else {
        this.seekShieldState.active = false;
      }
    }

    // 2. Apply command-specific shielding for PLAY, PAUSE, NEXT, PREV
    if (this.activeCommandShield && now - this.activeCommandShield.startedAt < 3000) {
      const shield = this.activeCommandShield;
      if (shield.type === 'PLAY' || shield.type === 'NEXT' || shield.type === 'PREV') {
        const isSongMatched = !shield.songId || remoteState.songId === shield.songId;
        const isPlayingMatched = remoteState.isPlaying === true;
        if (isSongMatched && isPlayingMatched) {
          // Renderer has caught up to the matching command state, release shield immediately!
          console.log(`[PlaybackStateSync] Remote player caught up to ${shield.type} (songId=${remoteState.songId}, isPlaying=true). Released command shield.`);
          this.activeCommandShield = null;
        } else {
          console.log(`[PlaybackStateSync] Shielding optimistic play/song state. Incoming: isPlaying=${remoteState.isPlaying}, songId=${remoteState.songId}. Preserving optimistic isPlaying=true`);
          remoteState.isPlaying = true;
          if (shield.songId && store.currentSong && store.currentSong.id === shield.songId) {
            remoteState.songId = shield.songId;
            remoteState.songData = store.currentSong;
            if (shield.queueIndex !== null) {
              remoteState.queueIndex = shield.queueIndex;
            }
          }
        }
      } else if (shield.type === 'PAUSE') {
        if (remoteState.isPlaying === false) {
          // Renderer caught up to pause, release shield immediately!
          console.log(`[PlaybackStateSync] Remote player caught up to PAUSE. Released command shield.`);
          this.activeCommandShield = null;
        } else {
          console.log(`[PlaybackStateSync] Shielding optimistic pause state. Incoming: isPlaying=true. Preserving optimistic isPlaying=false`);
          remoteState.isPlaying = false;
        }
      }
    } else if (this.activeCommandShield) {
      // Shield expired
      this.activeCommandShield = null;
    }

    console.log(`[PlaybackStateSync] Received remote state from ${remoteState.activeDeviceName} (${remoteState.activeDeviceId}):`, {
      song: remoteState.songData?.title,
      isPlaying: remoteState.isPlaying,
      pos: (remoteState.positionMs / 1000).toFixed(1) + 's',
      revision: incomingRevision
    });

    this.adoptRemoteState(remoteState, incomingRevision);
  }

  /**
   * Adopts remote playback state into local store without producing local audio.
   * Applies zero-jump reconciliation: small drifts are smoothed, large drifts snap.
   */
  public adoptRemoteState(remoteState: RemotePlaybackState, revision?: number) {
    const store = usePlayerStore.getState();
    const now = Date.now();

    // 1. Controller MUST NOT output audio locally ONLY when following a remote device
    const isFollowing = !store.isActiveDevice || (store.connectedDeviceId === remoteState.activeDeviceId && remoteState.activeDeviceId !== store.deviceId);
    if (isFollowing && remoteState.activeDeviceId !== store.deviceId) {
      if (RaagaXNativePlayer.isNative()) {
        RaagaXNativePlayer.pause().catch(() => {});
      } else {
        const active = PlaybackService.getInstance().getActiveAudio();
        if (active && !active.paused) {
          active.pause();
        }
      }
    }

    // ── Zero-Jump Position Reconciliation ────────────────────────────────────
    // Predict what position we'd expect based on the anchor we have
    const anchorMs = store.remoteAnchorPositionMs ?? remoteState.positionMs;
    const anchorAge = store.remoteAnchorTimeMs ? now - store.remoteAnchorTimeMs : 0;
    const predictedMs = anchorMs + (remoteState.isPlaying ? anchorAge : 0);

    const incomingMs = remoteState.positionMs;
    const drift = Math.abs(incomingMs - predictedMs);

    // Uncertainty tolerance = clock uncertainty + network jitter headroom
    const uncertaintyMs = ClockSynchronizer.getInstance().getUncertaintyMs() + 200;
    const SNAP_THRESHOLD_MS = 1500; // Drifts larger than this snap immediately

    let finalPositionMs = incomingMs;

    // If a seek shield was recently active, the incoming position is authoritative
    // (renderer confirmed it) — adopt directly without drift animation.
    const seekJustCleared = !this.seekShieldState.active && this.seekShieldState.startedAt > 0
      && (Date.now() - this.seekShieldState.startedAt) < 6000;



    if (seekJustCleared) {
      // Accept incoming position as-is: it is the renderer's confirmed seek position
      finalPositionMs = incomingMs;
    } else if (drift < uncertaintyMs) {
      // Within tolerance: use incomingMs directly (prediction adds noise at sub-50ms granularity)
      finalPositionMs = incomingMs;
    } else if (drift < SNAP_THRESHOLD_MS) {
      // Gradual correction: drift toward remote position over 500ms
      this.startDriftCorrection(predictedMs, incomingMs, 500);
      finalPositionMs = predictedMs; // Use local prediction now; drift timer will correct
    }
    // else: large drift → hard snap to incomingMs (user performed explicit seek, track changed, etc.)

    // 2. Adopt remote state into local store for display in MiniPlayer / PlayerBar / SeekBar
    usePlayerStore.setState({
      isActiveDevice: false,
      activeDeviceId: remoteState.activeDeviceId,
      connectedDeviceId: remoteState.activeDeviceId,
      remoteDeviceName: remoteState.activeDeviceName,
      deviceConnectionState: 'CONNECTED',
      currentSong: remoteState.songData,
      currentTime: finalPositionMs / 1000,
      duration: remoteState.durationMs / 1000,
      isPlaying: remoteState.isPlaying,
      playbackIntent: remoteState.isPlaying ? 'PLAYING' : 'PAUSED',
      remoteAnchorPositionMs: incomingMs,  // Always anchor to the canonical remote position
      remoteAnchorTimeMs: now,
      queue: remoteState.queue || [],
      queueIndex: remoteState.queueIndex || 0,
      shuffleMode: (remoteState.shuffleMode || 'OFF') as any,
      repeatMode: (remoteState.repeatMode || 'OFF') as any,
      volume: remoteState.volume ?? 0.8,
      isMuted: remoteState.isMuted ?? false,
      lastReceivedPlaybackRevision: revision ?? (remoteState.revision || 0),
    });

    // 3. Keep local QueueManager aligned with remote repeat and shuffle modes
    try {
      const manager = QueueManager.getInstance();
      if (remoteState.repeatMode && manager.getRepeatMode() !== remoteState.repeatMode) {
        manager.setRepeatMode(remoteState.repeatMode as any);
      }
      if (remoteState.shuffleMode && manager.getShuffleMode() !== remoteState.shuffleMode) {
        manager.setShuffleMode(remoteState.shuffleMode as any);
      }
    } catch {}
  }

  /**
   * Starts a gradual drift correction animation from startMs to targetMs over durationMs.
   * Uses setInterval to step currentTime smoothly in the store.
   */
  private startDriftCorrection(startMs: number, targetMs: number, durationMs: number) {
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = null;
    }

    this.driftCorrection = {
      active: true,
      startMs,
      targetMs,
      startedAt: Date.now(),
      durationMs,
    };

    const STEP_MS = 16; // ~60fps
    this.driftTimer = setInterval(() => {
      const { active, startMs, targetMs, startedAt, durationMs } = this.driftCorrection;
      if (!active) {
        clearInterval(this.driftTimer!);
        this.driftTimer = null;
        return;
      }

      const elapsed = Date.now() - startedAt;
      const t = Math.min(elapsed / durationMs, 1);
      // Ease-out: decelerate as we approach target
      const eased = 1 - Math.pow(1 - t, 2);
      const correctedMs = startMs + (targetMs - startMs) * eased;

      usePlayerStore.setState({ currentTime: correctedMs / 1000 });

      if (t >= 1) {
        this.driftCorrection.active = false;
        clearInterval(this.driftTimer!);
        this.driftTimer = null;
      }
    }, STEP_MS);
  }
}
