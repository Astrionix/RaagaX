/**
 * RaagaX Connect — Remote Controller Client Manager
 *
 * Runs on the Controlling Device.
 * Dispatches remote RPC playback commands to the target playback device
 * and receives the authoritative ConnectPlaybackSession.
 *
 * Invariants:
 * 1. The playback device is the single authority.
 * 2. The controller smoothly calculates position from anchor:
 *    displayPosition = positionAnchorMs + (currentTime - anchorTimeMs)
 * 3. Stale older revisions (incoming <= lastAppliedRevision) are dropped immediately.
 * 4. DISCONNECT = REMOVE CONTROL RELATIONSHIP, NOT STOP MUSIC.
 */

import { ConnectCommand, ConnectCommandAction, ConnectDevice, ConnectEvent, ConnectPlaybackSession } from '@/types/connect';
import { ConnectDiscoveryEngine } from './ConnectDiscoveryEngine';
import { ConnectServerEngine } from './ConnectServerEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useConnectStore } from '@/context/useConnectStore';
import { getApiUrl } from '@/lib/config/apiConfig';

type RemoteSessionListener = (session: ConnectPlaybackSession) => void;

export class ConnectClientManager {
  private static instance: ConnectClientManager;
  private activeTargetDevice: ConnectDevice | null = null;
  private remoteSession: ConnectPlaybackSession | null = null;
  private lastAppliedRevision: number = 0;
  private listeners: Set<RemoteSessionListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private sessionPollTimer: any = null;
  private isTransferring: boolean = false;
  private transferLockTimer: any = null;
  private pendingTrackId: string | null = null;
  private pendingTrackLockUntil: number = 0;

  /**
   * Clock-Agnostic Timeline Anchor (Clock-Drift Proof)
   * ─────────────────────────────────────────────────
   * When a session packet arrives we record the local monotonic clock
   * (performance.now()) as the arrival anchor. We do NOT rely on wall-clock
   * Date.now() subtraction because wall clocks across devices can differ by
   * hundreds of milliseconds (DST, NTP drift, OS sleep). performance.now()
   * is monotonic and never jumps backwards, even when the device wakes from
   * suspend.
   *
   * interpolatedPosition = positionAnchorAtArrivalMs
   *                      + (performance.now() - arrivalMonotonicMs)
   *
   * FIX 1 — Mobile Suspend Clamp:
   * If the OS suspends the browser tab (iOS Safari, Android Chrome background)
   * performance.now() itself pauses or throttles. When the tab wakes, the first
   * rAF frame fires BEFORE the wakeup snapshot from requestCurrentPlaybackState()
   * arrives. Without a cap, `elapsed` could be minutes long and the scrubber
   * would appear to jump to the end of the track.
   *
   * We cap elapsed at MAX_STALE_EXTRAPOLATION_MS (10s). If the delta exceeds
   * this, we freeze the position at positionAnchorAtArrivalMs until the fresh
   * snapshot re-anchors. The visibilitychange handler in useRemoteSessionHydration
   * will fire requestCurrentPlaybackState() immediately, so the freeze window is
   * typically < 200ms on a fast network.
   */
  private static readonly MAX_STALE_EXTRAPOLATION_MS = 10_000;
  private arrivalMonotonicMs: number = typeof performance !== 'undefined' ? performance.now() : 0;
  private positionAnchorAtArrivalMs: number = 0;

  /**
   * FIX 3 — Handoff Token: Cross-Speaker Packet Reordering Guard
   * ─────────────────────────────────────────────────
   * When HANDOFF_COMMIT runs, the new speaker's session gets a new generation
   * and timelineId. But a late-arriving stale packet from the OLD speaker (with
   * its old timelineId) could still be routed here via BroadcastChannel, Supabase,
   * or the HTTP fallback poll — because HANDOFF_PREPARE/COMMIT bypass stale checks
   * on the server side.
   *
   * We store the timelineId of the committed session. Any incoming session whose
   * timelineId differs from the committed token AND whose playbackDeviceId does not
   * match our current activeTargetDevice is rejected during a HANDOFF_GRACE_PERIOD_MS
   * window after the commit. This closes the race without adding an extra RTT.
   */
  private static readonly HANDOFF_GRACE_PERIOD_MS = 5_000;
  private committedHandoffTimelineId: string | null = null;
  private handoffCommittedAt: number = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupBroadcastChannel();
    }
  }

  public static getInstance(): ConnectClientManager {
    if (!ConnectClientManager.instance) {
      ConnectClientManager.instance = new ConnectClientManager();
    }
    return ConnectClientManager.instance;
  }

  private setupBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('raaga_connect_rpc_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'SESSION_STATE_CHANGED' && event.data.session) {
          this.handleIncomingSession(event.data.session);
        } else if (event.data?.type === 'CONTROLLER_DETACHED_BY_SPEAKER') {
          const local = ConnectDiscoveryEngine.getInstance().getLocalDevice();
          if (event.data.controllerId === local.deviceId || event.data.controllerId === 'dev_local') {
            console.log(`[CONNECT_DETACHED_BY_SPEAKER] Controller disconnected by speaker: ${event.data.speakerId}`);
            const lastSession = this.remoteSession;
            this.activeTargetDevice = null;
            this.remoteSession = null;
            this.stopSessionPolling();
            useConnectStore.setState({
              isRemoteMode: false,
              activePlaybackDevice: null,
              remoteSession: null,
              fallbackPromptSession: lastSession?.currentSong ? lastSession : null,
              isFallbackPromptOpen: Boolean(lastSession?.currentSong),
            });
            try {
              const { PlaybackService } = require('@/lib/playback/PlaybackService');
              PlaybackService.getInstance().pauseAudioElementOnly();
              PlaybackService.getInstance().stopAllAudio();
            } catch {}
            try {
              const { MediaSessionManager } = require('@/lib/playback/MediaSessionManager');
              MediaSessionManager.getInstance().restoreLocalMediaHandlers();
            } catch {}
          }
        }
      };
    } catch {}
  }

  public getActiveTargetDevice(): ConnectDevice | null {
    return this.activeTargetDevice;
  }

  public isRemoteMode(): boolean {
    if (!this.activeTargetDevice) return false;
    const local = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    if (
      this.activeTargetDevice.isCurrentDevice ||
      this.activeTargetDevice.deviceId === local.deviceId ||
      this.activeTargetDevice.deviceId === 'dev_local'
    ) {
      return false;
    }
    return true;
  }

  public getRemoteSession(): ConnectPlaybackSession | null {
    return this.remoteSession;
  }

  public setOptimisticTrackLock(trackId: string, durationMs: number = 1000): void {
    this.pendingTrackId = trackId;
    this.pendingTrackLockUntil = Date.now() + durationMs;
  }

  public getLastAppliedRevision(): number {
    return this.lastAppliedRevision;
  }

  /**
   * Clock-Drift Proof: Smoothly calculates current displayed position using
   * a monotonic performance.now() arrival anchor instead of wall-clock Date.now().
   *
   * This is invariant to:
   * - NTP jumps / clock adjustments on the controller device
   * - DST transitions
   * - OS sleep / wake cycles (performance.now() is monotonic)
   * - Cross-device wall clock skew (no Date.now() subtraction across devices)
   *
   * Mobile Suspend Safety:
   * Elapsed time is capped at MAX_STALE_EXTRAPOLATION_MS (10s). If the browser
   * was suspended longer, we return the last-known anchor position and wait for
   * the wakeup snapshot (fired by visibilitychange in useRemoteSessionHydration)
   * to re-anchor. This prevents the scrubber from jumping to track end on resume.
   */
  public getInterpolatedPosition(): number {
    if (!this.remoteSession) return 0;
    if (!this.remoteSession.isPlaying) {
      return this.remoteSession.positionMs / 1000;
    }

    const nowMonotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const rawElapsedMs = Math.max(0, nowMonotonic - this.arrivalMonotonicMs);

    // FIX 1: Clamp elapsed time to prevent giant scrubber jumps after mobile suspend.
    // If elapsed > MAX_STALE_EXTRAPOLATION_MS, freeze at anchor until fresh snapshot arrives.
    const elapsedMs = Math.min(rawElapsedMs, ConnectClientManager.MAX_STALE_EXTRAPOLATION_MS);

    const totalPosMs = this.positionAnchorAtArrivalMs + elapsedMs;
    const clampedMs = this.remoteSession.durationMs > 0
      ? Math.min(this.remoteSession.durationMs, totalPosMs)
      : totalPosMs;

    return clampedMs / 1000;
  }

  /**
   * Connect to target device and transfer playback without restarting from 0
   */
  public async transferPlaybackTo(targetInput: ConnectDevice | string): Promise<boolean> {
    if (!targetInput) return false;

    const targetDevice: ConnectDevice = typeof targetInput === 'string'
      ? (ConnectDiscoveryEngine.getInstance().getDiscoveredDevices().find((d) => d.deviceId === targetInput) || {
          deviceId: targetInput,
          deviceName: 'Remote Device',
          deviceType: 'speaker',
          isCurrentDevice: false,
          isOnline: true,
          state: 'IDLE',
          transport: 'LOCAL_LAN',
          lastSeenAt: Date.now(),
        })
      : targetInput;

    if (!targetDevice || !targetDevice.deviceId) return false;

    // FIX: Target-aware debounce (Test 3 — Rapid Handoff Swap).
    // A repeated transfer to the SAME device within 1.5s is suppressed (prevents
    // double-click spam from a fast UI). But a transfer to a DIFFERENT device
    // (A→B then immediately B→A) must always proceed — blocking it would leave
    // audio on B with no way to reclaim it without a full page reload.
    const isSameTarget = this.activeTargetDevice?.deviceId === targetDevice.deviceId;
    if (typeof window !== 'undefined' && this.isTransferring && isSameTarget) {
      console.log('[CONNECT_HANDOFF] Debouncing duplicate transfer to same device:', targetDevice.deviceId);
      return false;
    }
    if (typeof window !== 'undefined') {
      this.isTransferring = true;
      if (this.transferLockTimer) clearTimeout(this.transferLockTimer);
      this.transferLockTimer = setTimeout(() => {
        this.isTransferring = false;
      }, 1500);
    }

    // Clear the previous handoff token — a new transfer starts a fresh token sequence.
    // Without this, the grace window from a prior A→B commit would block valid B→A packets.
    this.committedHandoffTimelineId = null;
    this.handoffCommittedAt = 0;

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    if (!localDevice || targetDevice.deviceId === localDevice.deviceId || targetDevice.isCurrentDevice || targetDevice.deviceId === 'dev_local') {
      return this.disconnectAndPlayLocally();
    }

    const store = usePlayerStore.getState();
    const currentSong = store.currentSong;
    const isLocalPlaying = store.isPlaying;

    // Spotify Connect Rule:
    // If this device is paused/idle or has no song, adopt the target device's active session.
    // If this device IS actively playing a song, transfer its audio to the target device.
    const shouldAdoptTargetSession = !currentSong || !isLocalPlaying;

    this.activeTargetDevice = targetDevice;

    if (shouldAdoptTargetSession) {
      // 1. Mute / pause local audio so sound only outputs from the target device
      store.setIsPlaying(false);
      try {
        const { PlaybackService } = await import('@/lib/playback/PlaybackService');
        PlaybackService.getInstance().pause();
        PlaybackService.getInstance().stopAllAudio();
      } catch {}
      ConnectDiscoveryEngine.getInstance().setLocalPlaybackState('IDLE');

      // 2. Start session polling & request active playback snapshot immediately
      this.startSessionPolling();
      await this.requestCurrentPlaybackState(targetDevice.deviceId);

      useConnectStore.setState({
        activePlaybackDevice: targetDevice,
        isRemoteMode: true,
      });

      return true;
    }

    // Otherwise, this device was actively outputting audio and is transferring to target
    const liveSec = typeof window !== 'undefined'
      ? (() => {
          try {
            const { PlaybackService } = require('@/lib/playback/PlaybackService');
            const active = PlaybackService.getInstance().getActiveAudio();
            if (active && typeof active.currentTime === 'number' && !isNaN(active.currentTime) && active.currentTime > 0) {
              return active.currentTime;
            }
          } catch {}
          return store.currentTime || 0;
        })()
      : (store.currentTime || 0);
    const currentPositionMs = Math.round(liveSec * 1000);

    console.log(`[CONNECT_HANDOFF]\nfromDevice=${localDevice.deviceId}\ntoDevice=${targetDevice.deviceId}\npositionMs=${currentPositionMs}`);

    // Pre-resolve direct stream URL if possible to eliminate speaker fetch latency
    let songPayload = currentSong;
    if (currentSong && (!currentSong.audioUrl || currentSong.audioUrl.includes('pixabay.com'))) {
      try {
        const { PlaybackSourceResolver } = await import('@/lib/playbackSourceResolver');
        const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(currentSong);
        if (source?.url) {
          songPayload = { ...currentSong, audioUrl: source.url };
        }
      } catch {}
    }

    const command: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: localDevice.deviceId,
      senderName: localDevice.deviceName,
      targetDeviceId: targetDevice.deviceId,
      action: 'TRANSFER_PLAYBACK',
      payload: {
        song: songPayload || undefined,
        queue: store.queue,
        queueIndex: store.queueIndex,
        positionMs: currentPositionMs,
        isPlaying: true,
        volume: store.volume,
        timelineId: `TL_${Date.now().toString(36)}`,
      },
      timestamp: Date.now(),
    };

    // 1. Dispatch command
    await this.dispatchCommand(command);

    // 2. Mute/stop local audio on this device
    store.setIsPlaying(false);
    try {
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      PlaybackService.getInstance().pause();
      PlaybackService.getInstance().stopAllAudio();
    } catch {}
    ConnectDiscoveryEngine.getInstance().setLocalPlaybackState('IDLE');

    // 3. Start polling target session
    this.startSessionPolling();

    // 4. Bind hardware media keys and lock screen controls to remote controller RPCs
    try {
      const { MediaSessionManager } = await import('@/lib/playback/MediaSessionManager');
      MediaSessionManager.getInstance().setupRemoteMediaHandlers();
    } catch {}

    return true;
  }

  /**
   * Disconnect from target device:
   * INVARIANT: DISCONNECT MUST NOT STOP THE MUSIC ON THE PLAYBACK DEVICE.
   */
  public async disconnect(shouldResumeLocally: boolean = false): Promise<boolean> {
    const target = this.activeTargetDevice;
    if (!target || !target.deviceId) {
      this.activeTargetDevice = null;
      this.remoteSession = null;
      this.stopSessionPolling();
      useConnectStore.setState({ isRemoteMode: false, activePlaybackDevice: null, remoteSession: null });
      return true;
    }

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();

    console.log(`[CONNECT_DISCONNECT]\ncontrollerId=${localDevice?.deviceId || 'dev_local'}\nplaybackContinues=true`);

    // 1. Notify playback device that this controller is disconnecting
    const command: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: localDevice?.deviceId || 'dev_local',
      senderName: localDevice?.deviceName || 'RaagaX Device',
      targetDeviceId: target.deviceId,
      action: 'DISCONNECT_CONTROLLER',
      expectedRevision: this.remoteSession?.revision,
      timestamp: Date.now(),
    };

    await this.dispatchCommand(command);

    // 2. Clear remote state locally
    this.activeTargetDevice = null;
    this.remoteSession = null;
    this.stopSessionPolling();
    useConnectStore.setState({ isRemoteMode: false, activePlaybackDevice: null, remoteSession: null });

    // 3. Keep local audio engine silent (Prevent unexpected audio blast)
    try {
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      PlaybackService.getInstance().pauseAudioElementOnly();
      PlaybackService.getInstance().stopAllAudio();
    } catch {}

    // 4. Restore local media handlers
    try {
      const { MediaSessionManager } = await import('@/lib/playback/MediaSessionManager');
      MediaSessionManager.getInstance().restoreLocalMediaHandlers();
    } catch {}

    // 5. Notify user
    try {
      usePlayerStore.getState().setToastMessage('Disconnected from speaker');
    } catch {}

    return true;
  }

  /**
   * Disconnect and resume playback on THIS device (Play on this device)
   */
  public async disconnectAndPlayLocally(): Promise<boolean> {
    if (!this.activeTargetDevice) return true;

    const target = this.activeTargetDevice;
    const currentSession = this.remoteSession;
    const livePosSec = this.getInterpolatedPosition();

    // 1. Pre-warm & Pre-buffer local audio engine before halting remote speaker (Zero Latency Handover)
    if (currentSession && currentSession.currentSong && currentSession.isPlaying) {
      try {
        const { PlaybackService } = await import('@/lib/playback/PlaybackService');
        await PlaybackService.getInstance().prepareTrack(currentSession.currentSong, livePosSec);
      } catch {}
    }

    // 2. Send PAUSE command to target speaker device so it stops outputting audio
    const pauseCmd: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: ConnectDiscoveryEngine.getInstance().getLocalDevice()?.deviceId || 'dev_local',
      targetDeviceId: target.deviceId,
      action: 'PAUSE',
      timestamp: Date.now(),
    };
    await this.dispatchCommand(pauseCmd);

    // 3. Disconnect remote controller mode
    await this.disconnect(false);

    // 4. Resume audio locally on this device at the exact same millisecond
    if (currentSession && currentSession.currentSong) {
      usePlayerStore.setState({
        queue: currentSession.queue,
        queueIndex: currentSession.queueIndex,
        currentSong: currentSession.currentSong,
        currentTime: livePosSec,
        isPlaying: currentSession.isPlaying,
        playbackIntent: currentSession.isPlaying ? 'PLAYING' : 'PAUSED',
      });
      if (currentSession.isPlaying) {
        try {
          const { PlaybackService } = await import('@/lib/playback/PlaybackService');
          const reqId = Date.now();
          PlaybackService.getInstance().setPlaybackRequestId(reqId);
          await PlaybackService.getInstance().loadAudioSource(
            currentSession.currentSong,
            reqId,
            true,
            livePosSec
          );
        } catch {}
      }
    }

    return true;
  }

  /**
   * Continuous handoff: Switch from active playback device to a NEW playback device
   * Target prepares before source stops.
   */
  public async switchPlaybackDevice(fromDevice: ConnectDevice, toDevice: ConnectDevice): Promise<boolean> {
    const currentSession = this.remoteSession;
    if (!currentSession || !currentSession.currentSong) {
      return this.transferPlaybackTo(toDevice);
    }

    const currentPositionMs = currentSession.isPlaying
      ? Math.round(this.getInterpolatedPosition() * 1000)
      : currentSession.positionMs;

    console.log(`[CONNECT_HANDOFF]\nfromDevice=${fromDevice.deviceId}\ntoDevice=${toDevice.deviceId}\npositionMs=${currentPositionMs}`);

    // 1. Prepare target device
    const transferCmd: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: fromDevice.deviceId,
      targetDeviceId: toDevice.deviceId,
      action: 'TRANSFER_PLAYBACK',
      payload: {
        song: currentSession.currentSong,
        queue: currentSession.queue,
        queueIndex: currentSession.queueIndex,
        positionMs: currentPositionMs,
        isPlaying: currentSession.isPlaying,
        volume: currentSession.volume,
        timelineId: `TL_${Date.now().toString(36)}`,
      },
      timestamp: Date.now(),
    };

    // 2. Target receives transfer and becomes authoritative
    await this.dispatchCommand(transferCmd);

    // 3. Pause old playback device
    if (fromDevice.deviceId !== toDevice.deviceId) {
      const pauseOldCmd: ConnectCommand = {
        commandId: `cmd_${Date.now().toString(36)}`,
        requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        senderDeviceId: toDevice.deviceId,
        targetDeviceId: fromDevice.deviceId,
        action: 'PAUSE',
        timestamp: Date.now(),
      };
      await this.dispatchCommand(pauseOldCmd);
    }

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    const isTargetLocal = toDevice.deviceId === localDevice.deviceId || toDevice.isCurrentDevice || toDevice.deviceId === 'dev_local';

    if (isTargetLocal) {
      this.activeTargetDevice = null;
      this.stopSessionPolling();
      useConnectStore.setState({ isRemoteMode: false, activePlaybackDevice: null });
    } else {
      this.activeTargetDevice = toDevice;
      this.startSessionPolling();
      useConnectStore.setState({ isRemoteMode: true, activePlaybackDevice: toDevice });
    }

    return true;
  }

  /**
   * Request current playback snapshot on reconnection / foreground
   */
  public async requestCurrentPlaybackState(deviceId?: string | null): Promise<ConnectPlaybackSession | null> {
    const targetDeviceId = deviceId || this.activeTargetDevice?.deviceId;
    if (!targetDeviceId) return null;

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(getApiUrl(`/api/connect/session?deviceId=${encodeURIComponent(targetDeviceId)}`));
        const data = await res.json();
        if (data.success && data.session) {
          this.handleIncomingSession(data.session);
          return data.session;
        }
      } catch {}
    }

    const serverSession = ConnectServerEngine.getInstance().getSession();
    if (serverSession && serverSession.playbackDeviceId === targetDeviceId) {
      this.handleIncomingSession(serverSession);
      return serverSession;
    }

    return null;
  }

  /**
   * Dispatch a remote command with UUID requestId and expectedRevision
   */
  public async sendCommand(action: ConnectCommandAction, payload?: any): Promise<boolean> {
    const target = this.activeTargetDevice;
    if (!target || !target.deviceId) return false;

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    const command: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: localDevice?.deviceId || 'dev_local',
      senderName: localDevice?.deviceName || 'RaagaX Device',
      targetDeviceId: target.deviceId,
      action,
      // Spotify Connect SSOT: Thin controller sends pure intention without stale revision constraints
      expectedRevision: undefined,
      payload,
      timestamp: Date.now(),
    };

    return this.dispatchCommand(command);
  }

  private async dispatchCommand(command: ConnectCommand): Promise<boolean> {
    // 1. Broadcast via local RPC BroadcastChannel (tab fast path)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'CONNECT_COMMAND',
          command,
        });
      } catch {}
    }

    // 2. Automated test runner fallback (only when running in Node / Vitest)
    if (typeof window === 'undefined') {
      try {
        const server = ConnectServerEngine.getInstance();
        const res = await server.handleIncomingCommand(command);
        if (res?.session) {
          this.handleIncomingSession(res.session);
        }
      } catch {}
    }

    // 2.5. Render WebSocket Relay (sub-10ms direct bidirectional pipe)
    try {
      const { LocalLanDiscovery } = require('./discovery/LocalLanDiscovery');
      LocalLanDiscovery.getInstance().sendWsMessage({
        type: 'CONNECT_COMMAND',
        targetDeviceId: command.targetDeviceId,
        command,
      });
    } catch {}

    // 3. Supabase Realtime Broadcast (sub-50ms cloud relay across networks)
    try {
      const { ConnectDiscoveryEngine } = require('./ConnectDiscoveryEngine');
      ConnectDiscoveryEngine.getInstance().sendSupabaseBroadcast('CONNECT_COMMAND', command);
    } catch {}

    // 4. HTTP Server Command Queue (fallback)
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch(getApiUrl('/api/connect/command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      }).catch(() => {});
    }

    return true;
  }

  private startSessionPolling(): void {
    if (this.sessionPollTimer) return;
    this.fetchTargetSession();

    this.sessionPollTimer = setInterval(() => {
      this.fetchTargetSession();
    }, 1500);
  }

  private stopSessionPolling(): void {
    if (this.sessionPollTimer) {
      clearInterval(this.sessionPollTimer);
      this.sessionPollTimer = null;
    }
  }

  private fetchTargetSession(): void {
    const target = this.activeTargetDevice;
    if (!target || !target.deviceId || typeof window === 'undefined' || typeof fetch === 'undefined') return;

    fetch(getApiUrl(`/api/connect/session?deviceId=${encodeURIComponent(target.deviceId)}`))
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.session) {
          this.handleIncomingSession(data.session);
        }
      })
      .catch(() => {});
  }

  public handleIncomingSession(session: ConnectPlaybackSession): void {
    if (!session) return;
    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    const isLocalPlaybackDevice = session.playbackDeviceId === localDevice.deviceId || session.playbackDeviceId === 'dev_local';

    // ── Arrival-Anchored Monotonic Timeline Anchor ──────────────────────────
    // FIX 1 (companion): Always update arrival anchor on EVERY incoming packet,
    // not only when isPlaying. A paused packet still pins the monotonic clock:
    //  - If the session later resumes, the anchor is recent (< packet RTT stale)
    //    rather than from minutes ago when the controller first connected.
    //  - If the OS suspended the tab and then a paused packet arrives on wakeup,
    //    the anchor resets before the next rAF frame, so the scrubber clamp in
    //    getInterpolatedPosition() has the correct reference point.
    const nowMonotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.arrivalMonotonicMs = nowMonotonic;
    this.positionAnchorAtArrivalMs = session.isPlaying
      ? (session.anchorPositionMs ?? session.positionMs ?? 0)
      : (session.positionMs ?? 0);

    if (isLocalPlaybackDevice) {
      if (this.isRemoteMode()) {
        this.activeTargetDevice = null;
        this.remoteSession = null;
        useConnectStore.setState({ isRemoteMode: false, activePlaybackDevice: null, remoteSession: null });
      }
      return;
    }

    // NOTE: Auto-adoption deliberately removed.
    // isRemoteMode is ONLY set via an explicit user action (transferPlaybackTo).
    // Auto-adopting here caused the speaker device to enter isRemoteMode, blocking
    // its own loadAudioSource, causing 2-minute flicker / stall on next-song playback.

    const isTarget = this.activeTargetDevice && (
      session.playbackDeviceId === this.activeTargetDevice.deviceId ||
      session.playbackDeviceId === 'dev_local'
    );

    if (!isTarget && !this.isRemoteMode()) return;

    // ── FIX 3: Handoff Token — Cross-Speaker Packet Reordering Guard ─────────────
    // Detect HANDOFF_COMMIT by a generation bump AND a new timelineId.
    // Once committed, store the new token and reject any session from a different
    // timeline that arrives within HANDOFF_GRACE_PERIOD_MS.
    if (
      this.remoteSession &&
      typeof session.generation === 'number' &&
      session.generation > this.remoteSession.generation &&
      session.timelineId && session.timelineId !== this.remoteSession.timelineId
    ) {
      // This is a HANDOFF_COMMIT generation bump — commit the token.
      this.committedHandoffTimelineId = session.timelineId;
      this.handoffCommittedAt = Date.now();
      console.log(`[CONNECT_HANDOFF_COMMITTED] timelineId=${session.timelineId} generation=${session.generation}`);
    }

    // During the grace window, reject any packet that doesn't belong to the
    // committed timeline AND comes from a different device (old speaker cross-talk).
    if (
      this.committedHandoffTimelineId &&
      Date.now() - this.handoffCommittedAt < ConnectClientManager.HANDOFF_GRACE_PERIOD_MS &&
      session.timelineId !== this.committedHandoffTimelineId &&
      session.playbackDeviceId !== this.activeTargetDevice?.deviceId
    ) {
      console.log(`[CONNECT_HANDOFF_STALE_REJECTED] Dropping old-speaker packet timelineId=${session.timelineId} (committed=${this.committedHandoffTimelineId})`);
      return;
    }

    // Optimistic Track Debounce Lock:
    // If the controller recently triggered a new track, ignore incoming updates still reflecting the old track
    if (this.pendingTrackId && Date.now() < this.pendingTrackLockUntil) {
      if (session.currentSong?.id !== this.pendingTrackId) {
        return; // Reject stale state from speaker
      } else {
        this.pendingTrackId = null;
        this.pendingTrackLockUntil = 0;
      }
    }

    const isDifferentSession = !this.remoteSession || session.sessionId !== this.remoteSession.sessionId;
    const isNewerGeneration = this.remoteSession && typeof session.generation === 'number' && typeof this.remoteSession.generation === 'number' && session.generation > this.remoteSession.generation;

    if (isDifferentSession || isNewerGeneration) {
      this.lastAppliedRevision = 0;
    }

    // Detect if this is a fresh timeline anchor (periodic position update) with the same revision
    const isNewerAnchor = this.remoteSession &&
      session.revision === this.lastAppliedRevision &&
      session.updatedAt > (this.remoteSession.updatedAt || 0);

    if (!isDifferentSession && !isNewerGeneration && session.revision < this.lastAppliedRevision) {
      return; // Drop strictly older revision within the same session generation
    }

    if (session.revision === this.lastAppliedRevision && !isNewerAnchor && this.remoteSession && !isDifferentSession) {
      return; // Exact duplicate
    }

    this.lastAppliedRevision = session.revision;
    this.remoteSession = session;
    useConnectStore.setState({ remoteSession: session });

    // Atomically synchronize the target playback device's track, queue, and state into the local store
    if (session.currentSong) {
      const normShuffle = session.shuffle ? 'STANDARD' : 'OFF';
      const normRepeat = session.repeat || 'OFF';
      const store = usePlayerStore.getState();
      const trackChanged = session.currentSong.id !== store.currentSong?.id;

      usePlayerStore.setState({
        currentSong: session.currentSong,
        queue: session.queue && session.queue.length > 0 ? session.queue : [session.currentSong],
        queueIndex: typeof session.queueIndex === 'number' ? session.queueIndex : 0,
        isPlaying: session.isPlaying,
        playbackIntent: session.isPlaying ? 'PLAYING' : 'PAUSED',
        duration: (session.durationMs || (session.currentSong.duration ? session.currentSong.duration * 1000 : 0)) / 1000,
        currentTime: trackChanged
          ? (typeof session.positionMs === 'number' ? session.positionMs / 1000 : 0)
          : (this.isRemoteMode()
            ? (typeof session.positionMs === 'number' ? session.positionMs / 1000 : 0)
            : store.currentTime),
        shuffleMode: normShuffle as any,
        repeatMode: normRepeat as any,
        volume: typeof session.volume === 'number' ? session.volume : store.volume,
      });

      // If this device is the speaker and the track changed, load the new audio
      if (isLocalPlaybackDevice && trackChanged) {
        try {
          const { PlaybackService } = require('@/lib/playback/PlaybackService');
          const reqId = Date.now();
          PlaybackService.getInstance().setPlaybackRequestId(reqId);
          PlaybackService.getInstance().loadAudioSource(
            session.currentSong,
            reqId,
            session.isPlaying,
            session.positionMs / 1000
          );
        } catch {}
      }

      try {
        const { MediaSessionManager } = require('@/lib/playback/MediaSessionManager');
        MediaSessionManager.getInstance().updateSongMetadata(session.currentSong, {
          remoteSpeakerName: this.activeTargetDevice?.deviceName,
        });
      } catch {}
    }

    this.notifyListeners();
  }

  public subscribe(listener: RemoteSessionListener): () => void {
    this.listeners.add(listener);
    if (this.remoteSession) {
      listener(this.remoteSession);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const s = this.remoteSession ? { ...this.remoteSession } : null;
    this.listeners.forEach((listener) => {
      try {
        if (s) listener(s);
      } catch {}
    });
  }
}
