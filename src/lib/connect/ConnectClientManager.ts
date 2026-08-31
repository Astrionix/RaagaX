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

type RemoteSessionListener = (session: ConnectPlaybackSession) => void;

export class ConnectClientManager {
  private static instance: ConnectClientManager;
  private activeTargetDevice: ConnectDevice | null = null;
  private remoteSession: ConnectPlaybackSession | null = null;
  private lastAppliedRevision: number = 0;
  private listeners: Set<RemoteSessionListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private sessionPollTimer: any = null;

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
        }
      };
    } catch {}
  }

  public getActiveTargetDevice(): ConnectDevice | null {
    return this.activeTargetDevice;
  }

  public isRemoteMode(): boolean {
    return this.activeTargetDevice !== null && !this.activeTargetDevice.isCurrentDevice;
  }

  public getRemoteSession(): ConnectPlaybackSession | null {
    return this.remoteSession;
  }

  public getLastAppliedRevision(): number {
    return this.lastAppliedRevision;
  }

  /**
   * Smoothly calculates current displayed position from authoritative timeline anchor
   */
  public getInterpolatedPosition(): number {
    if (!this.remoteSession) return 0;
    if (!this.remoteSession.isPlaying) {
      return this.remoteSession.positionMs / 1000;
    }

    const elapsedMs = Math.max(0, Date.now() - this.remoteSession.anchorTimeMs);
    const totalPosMs = this.remoteSession.anchorPositionMs + elapsedMs;
    const clampedMs = this.remoteSession.durationMs > 0
      ? Math.min(this.remoteSession.durationMs, totalPosMs)
      : totalPosMs;

    return clampedMs / 1000;
  }

  /**
   * Connect to target device and transfer playback without restarting from 0
   */
  public async transferPlaybackTo(targetDevice: ConnectDevice): Promise<boolean> {
    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();

    if (targetDevice.deviceId === localDevice.deviceId) {
      return this.disconnectAndPlayLocally();
    }

    const store = usePlayerStore.getState();
    const currentSong = store.currentSong;

    if (!currentSong) {
      this.activeTargetDevice = targetDevice;
      this.startSessionPolling();
      return true;
    }

    const currentPositionMs = Math.round((store.currentTime || 0) * 1000);
    const isPlaying = store.isPlaying;

    console.log(`[CONNECT_HANDOFF]\nfromDevice=${localDevice.deviceId}\ntoDevice=${targetDevice.deviceId}\npositionMs=${currentPositionMs}`);

    const command: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: localDevice.deviceId,
      senderName: localDevice.deviceName,
      targetDeviceId: targetDevice.deviceId,
      action: 'TRANSFER_PLAYBACK',
      payload: {
        song: currentSong,
        queue: store.queue,
        queueIndex: store.queueIndex,
        positionMs: currentPositionMs,
        isPlaying,
        volume: store.volume,
        timelineId: `TL_${Date.now().toString(36)}`,
      },
      timestamp: Date.now(),
    };

    // 1. Set active target device
    this.activeTargetDevice = targetDevice;

    // 2. Dispatch command
    await this.dispatchCommand(command);

    // 3. Mute/stop local audio on this device
    store.setIsPlaying(false);
    try {
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      PlaybackService.getInstance().pause();
      PlaybackService.getInstance().stopAllAudio();
    } catch {}
    ConnectDiscoveryEngine.getInstance().setLocalPlaybackState('IDLE');

    // 4. Start polling target session
    this.startSessionPolling();

    return true;
  }

  /**
   * Disconnect from target device:
   * INVARIANT: DISCONNECT MUST NOT STOP THE MUSIC ON THE PLAYBACK DEVICE.
   */
  public async disconnect(shouldResumeLocally: boolean = false): Promise<boolean> {
    if (!this.activeTargetDevice) return true;

    const target = this.activeTargetDevice;
    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();

    console.log(`[CONNECT_DISCONNECT]\ncontrollerId=${localDevice.deviceId}\nplaybackContinues=true`);

    // 1. Notify playback device that this controller is disconnecting
    const command: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: localDevice.deviceId,
      senderName: localDevice.deviceName,
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

    return true;
  }

  /**
   * Disconnect and resume playback on THIS device
   */
  public async disconnectAndPlayLocally(): Promise<boolean> {
    const currentSession = this.remoteSession;
    await this.disconnect(false);

    if (currentSession && currentSession.currentSong) {
      usePlayerStore.setState({
        queue: currentSession.queue,
        queueIndex: currentSession.queueIndex,
        currentSong: currentSession.currentSong,
        currentTime: currentSession.positionMs / 1000,
        isPlaying: currentSession.isPlaying,
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
            currentSession.positionMs / 1000
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

    this.activeTargetDevice = toDevice;
    this.startSessionPolling();

    return true;
  }

  /**
   * Request current playback snapshot on reconnection / foreground
   */
  public async requestCurrentPlaybackState(): Promise<ConnectPlaybackSession | null> {
    if (!this.activeTargetDevice) return null;

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(`/api/connect/session?deviceId=${encodeURIComponent(this.activeTargetDevice.deviceId)}`);
        const data = await res.json();
        if (data.success && data.session) {
          this.handleIncomingSession(data.session);
          return data.session;
        }
      } catch {}
    }

    const serverSession = ConnectServerEngine.getInstance().getSession();
    if (serverSession && serverSession.playbackDeviceId === this.activeTargetDevice.deviceId) {
      this.handleIncomingSession(serverSession);
      return serverSession;
    }

    return null;
  }

  /**
   * Dispatch a remote command with UUID requestId and expectedRevision
   */
  public async sendCommand(action: ConnectCommandAction, payload?: any): Promise<boolean> {
    if (!this.activeTargetDevice) return false;

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    const command: ConnectCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: localDevice.deviceId,
      senderName: localDevice.deviceName,
      targetDeviceId: this.activeTargetDevice.deviceId,
      action,
      expectedRevision: this.remoteSession?.revision,
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

    // 3. HTTP Server Command Queue (cross-browser / cross-device)
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/connect/command', {
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
    if (!this.activeTargetDevice || typeof window === 'undefined' || typeof fetch === 'undefined') return;

    fetch(`/api/connect/session?deviceId=${encodeURIComponent(this.activeTargetDevice.deviceId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.session) {
          this.handleIncomingSession(data.session);
        }
      })
      .catch(() => {});
  }

  public handleIncomingSession(session: ConnectPlaybackSession): void {
    if (!this.activeTargetDevice || session.playbackDeviceId !== this.activeTargetDevice.deviceId) return;

    if (session.revision <= this.lastAppliedRevision && this.remoteSession) {
      return;
    }

    this.lastAppliedRevision = session.revision;
    this.remoteSession = session;
    useConnectStore.setState({ remoteSession: session });

    // Atomically synchronize the target playback device's track, queue, and state into the local store
    if (session.currentSong) {
      usePlayerStore.setState({
        currentSong: session.currentSong,
        queue: session.queue && session.queue.length > 0 ? session.queue : [session.currentSong],
        queueIndex: typeof session.queueIndex === 'number' ? session.queueIndex : 0,
        isPlaying: session.isPlaying,
        playbackIntent: session.isPlaying ? 'PLAYING' : 'PAUSED',
        duration: (session.durationMs || (session.currentSong.duration ? session.currentSong.duration * 1000 : 0)) / 1000,
        currentTime: session.positionMs / 1000,
      });
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
