import { supabase } from '@/lib/supabase';
import { usePlayerStore, isOfflineMode } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { CommandSequencer } from './CommandSequencer';
import { DeviceRegistry } from './DeviceRegistry';
import { RaagaXNativePlayer } from '../playback/native/RaagaXNativePlayer';
import { PlaybackService } from '../playback/PlaybackService';
import { SeekLock } from '../playback/SeekLock';
import { TrackChangeLock } from '../playback/TrackChangeLock';
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

  private lastBroadcastSongId: string | null = null;
  private lastBroadcastIsPlaying: boolean | null = null;

  /**
   * Broadcasts the authoritative playback state to all connected devices in the session.
   * Called only by the active renderer device.
   */
  public broadcastState(immediate: boolean = false) {
    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return; // Only active renderer broadcasts state

    const now = Date.now();
    const isTrackChange = store.currentSong?.id !== this.lastBroadcastSongId;
    const isPlayingChange = store.isPlaying !== this.lastBroadcastIsPlaying;
    const isCritical = isTrackChange || isPlayingChange;

    if (!isCritical && !immediate && (now - this.lastPublishTime < 1000)) {
      if (!this.publishTimer) {
        this.publishTimer = setTimeout(() => {
          this.publishTimer = null;
          this.broadcastState(false);
        }, 1000);
      }
      return;
    }

    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }

    this.lastPublishTime = now;
    this.lastBroadcastSongId = store.currentSong?.id || null;
    this.lastBroadcastIsPlaying = store.isPlaying;

    const sequencer = CommandSequencer.getInstance();
    const deviceName = typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_name') || 'RaagaX Player') : 'RaagaX Player';

    const nextRevision = (store.localPlaybackRevision || 0) + 1;
    usePlayerStore.setState({ localPlaybackRevision: nextRevision });

    const effectiveIsPlaying = Boolean(store.isPlaying || store.playbackIntent === 'PLAYING');


    const payload: RemotePlaybackState = {
      activeDeviceId: store.deviceId,
      activeDeviceName: deviceName,
      songId: store.currentSong?.id || null,
      songData: store.currentSong || null,
      isPlaying: effectiveIsPlaying,
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

    // ── Connection Gating ─────────────────────────────────────────────────────────
    // Use connectedDeviceId as the PRIMARY gate, NOT isActiveDevice.
    // Reason: isActiveDevice transitions to false AFTER the handshake, but STATE_UPDATE
    // messages can arrive during the handshake window (race). Using connectedDeviceId
    // avoids that race — it is written BEFORE the LAN connect attempt begins.
    //
    // Accept state if:
    //   a) we are explicitly connected to this remote device, OR
    //   b) our activeDeviceId points at this remote device (following it)
    const isFollowingThisDevice = (
      store.connectedDeviceId === remoteState.activeDeviceId ||
      (!store.isActiveDevice && store.activeDeviceId === remoteState.activeDeviceId)
    );

    // Local Device Priority Guard: if this device is the authoritative renderer
    // and has NO connection to a remote device, remote state must NOT override local playback.
    if (store.isActiveDevice && !store.connectedDeviceId) {
      return;
    }

    if (!isFollowingThisDevice) {
      // Not connected to this device — discovery-only update. Do NOT touch local player.
      return;
    }

    // Revision & Track Change validation
    const lastRemoteRevision = store.lastReceivedPlaybackRevision || 0;
    const incomingRevision = remoteState.revision || 0;
    const isTrackChange = Boolean(remoteState.songId && remoteState.songId !== store.currentSong?.id);

    // TrackChangeLock Shielding: if the remote device hasn't loaded our optimistically switched song yet, ignore the old state
    if (TrackChangeLock.isLocked(remoteState.songId)) {
      console.log(`[PlaybackStateSync] Shielding remote state for song ${remoteState.songId} - waiting for target track: ${TrackChangeLock.lockedTrackId}`);
      return;
    } else if (remoteState.songId) {
      TrackChangeLock.unlock();
    }

    if (incomingRevision <= lastRemoteRevision && lastRemoteRevision > 0 && !isTrackChange) {
      console.log(`[CONNECT][REMOTE] Ignoring stale remote state revision ${incomingRevision} <= last ${lastRemoteRevision}`);
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

    // 2. Clear command shield - Authoritative Owner's incoming state ALWAYS wins for track identity and playback state!
    this.activeCommandShield = null;

    console.log(`[CONNECT][REMOTE] PLAYBACK_STATE_RECEIVED trackId=${remoteState.songId} stateVersion=${incomingRevision}`);

    this.adoptRemoteState(remoteState, incomingRevision);
  }

  /**
   * Adopts remote playback state into local store without producing local audio.
   * Applies zero-jump reconciliation: small drifts are smoothed, large drifts snap.
   */
  public adoptRemoteState(remoteState: RemotePlaybackState, revision?: number) {
    const store = usePlayerStore.getState();
    const now = Date.now();

    // Echo-loop guard: never adopt state that identifies THIS device as the active renderer.
    // This prevents the laptop from accidentally pausing its own audio when it receives
    // an echo of its own broadcast (e.g. via the global playback state channel).
    if (remoteState.activeDeviceId === store.deviceId) {
      console.log(`[PlaybackStateSync] Ignoring self-echo: remote state claims this device (${store.deviceId}) is active renderer`);
      return;
    }

    // Local Device Priority: If the local device is actively playing locally and not connected to a remote device, local player remains authoritative.
    if (store.isActiveDevice && !store.connectedDeviceId) {
      return;
    }

    // 1. Silence local audio output — this device is the follower/controller, not the renderer.
    // Use remoteState.activeDeviceId !== store.deviceId (already guaranteed above) to decide.
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.pause().catch(() => {});
    } else {
      const active = PlaybackService.getInstance().getActiveAudio();
      if (active && !active.paused) {
        active.pause();
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
    // Always spread songData into a NEW object so React detects the reference change
    // and every UI component (cover, title, artist, SeekBar) re-renders atomically.
    const newSong = remoteState.songData ? { ...remoteState.songData } : null;
    usePlayerStore.setState({
      isActiveDevice: false,
      activeDeviceId: remoteState.activeDeviceId,
      connectedDeviceId: remoteState.activeDeviceId,
      remoteDeviceName: remoteState.activeDeviceName,
      deviceConnectionState: 'CONNECTED',
      currentSong: newSong,
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

    console.log(`[CONNECT][UI] PLAYBACK_STATE_APPLIED trackId=${newSong?.id} title="${newSong?.title}" artwork=${newSong?.coverUrl}`);

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

    // 4. Keep native Android lock screen & notification media controls synced
    if (remoteState.songData) {
      try {
        const { MediaSessionManager } = require('../playback/MediaSessionManager');
        MediaSessionManager.getInstance().updateSongMetadata(remoteState.songData);
        MediaSessionManager.getInstance().setPlaybackState(remoteState.isPlaying ? 'playing' : 'paused');
        MediaSessionManager.getInstance().setPositionState({
          duration: remoteState.durationMs / 1000,
          position: finalPositionMs / 1000,
        });
      } catch {}
    }
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
