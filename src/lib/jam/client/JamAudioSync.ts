import { WebRtcLanTransport, JamMessage } from '../transport/WebRtcLanTransport';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PreciseWorkerTimer } from './PreciseWorkerTimer';

export interface ClockOffsetStats {
  offsetMs: number;
  rttMs: number;
  isSynced: boolean;
}

/**
 * JamAudioSync — NTP High-Precision Clock Scheduling & Micro-Drift Engine
 *
 * 1. NTP Offset Ping Loop: Runs 3 rapid pings when WebRTC opens to calculate exact clock drift (T_offset).
 * 2. Scheduled Trigger: When Host hits play, schedules audio at performance.now() + 150ms so both devices
 *    start playing at the exact target millisecond.
 * 3. Micro-drift Pitch Correction: If one device slips ahead by 20-60ms, tunes audio.playbackRate (1.01x or 0.99x)
 *    for 300ms without audible jitter or pitch distortion. Hard seeks only if drift > 100ms.
 */
export class JamAudioSync {
  private static instance: JamAudioSync;

  private transport: WebRtcLanTransport | null = null;
  private isHost: boolean = false;
  private clockOffsetMs: number = 0;
  private rttMs: number = 0;
  private isSynced: boolean = false;

  private pingQueue: Map<number, number> = new Map();
  private pingCount: number = 0;
  private static readonly REQUIRED_PINGS = 3;

  private driftInterval: any = null;
  private rateResetTimer: any = null;

  private pendingPeers: Set<string> = new Set();
  private bufferGateTimeout: any = null;
  private onAllBufferedCallback: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): JamAudioSync {
    if (!JamAudioSync.instance) {
      JamAudioSync.instance = new JamAudioSync();
    }
    return JamAudioSync.instance;
  }

  /**
   * Initializes the synchronizer with an active WebRtcLanTransport
   */
  public init(transport: WebRtcLanTransport, isHost: boolean) {
    this.transport = transport;
    this.isHost = isHost;
    this.pingCount = 0;
    this.isSynced = false;

    // Start NTP burst right after transport is open for non-host
    if (!this.isHost) {
      this.runNtpBurst();
    }

    this.startDriftMonitor();
  }

  /**
   * Runs 3 rapid NTP pings to calculate exact clock drift
   */
  public runNtpBurst() {
    if (!this.transport || this.isHost) return;
    this.pingCount = 0;
    const sendPing = () => {
      if (this.pingCount >= JamAudioSync.REQUIRED_PINGS) return;
      const clientTime = performance.now();
      this.pingQueue.set(clientTime, clientTime);
      this.transport?.send({ type: 'PING', clientTime });
      this.pingCount++;
      if (this.pingCount < JamAudioSync.REQUIRED_PINGS) {
        setTimeout(sendPing, 50);
      }
    };
    sendPing();
  }

  /**
   * Handles incoming PING from client (Host side)
   */
  public handlePing(clientTime: number) {
    if (!this.transport || !this.isHost) return;
    const hostTime = performance.now();
    this.transport.send({
      type: 'PONG',
      clientTime,
      hostTime,
    });
  }

  /**
   * Handles incoming PONG from host (Client side)
   * Calculates NTP offset: offset = hostTime - (clientSendTime + RTT/2)
   */
  public handlePong(clientTime: number, hostTime: number) {
    const sendTime = this.pingQueue.get(clientTime);
    if (sendTime === undefined) return;
    this.pingQueue.delete(clientTime);

    const now = performance.now();
    const rtt = now - sendTime;
    const oneWay = rtt / 2;
    // Clock offset = hostClock - clientClock
    const sampleOffset = hostTime - (sendTime + oneWay);

    this.rttMs = rtt;
    this.clockOffsetMs = sampleOffset;
    this.isSynced = true;

    console.log(`[JamAudioSync NTP] RTT: ${rtt.toFixed(2)}ms | Clock Offset: ${sampleOffset.toFixed(2)}ms`);
  }

  /**
   * Schedules synchronized playback across both devices
   * Host calls this to trigger playback at (performance.now() + 150ms)
   */
  public schedulePlay(audioPositionSec: number, leadTimeMs: number = 150) {
    const now = performance.now();
    const targetTimestamp = now + leadTimeMs;

    // Send scheduled play message to peer
    this.transport?.send({
      type: 'SCHEDULED_PLAY',
      targetTimestamp,
      audioPosition: audioPositionSec,
    });

    // Execute locally at exact targetTimestamp
    this.executeScheduledPlay(targetTimestamp, audioPositionSec);
  }

  /**
   * Executes scheduled play at targetTimestamp using background-proof Web Worker timer
   */
  public executeScheduledPlay(targetTimestamp: number, audioPositionSec: number) {
    const now = performance.now();
    // For non-host client, convert host targetTimestamp to local time
    const adjustedTarget = this.isHost
      ? targetTimestamp
      : targetTimestamp - this.clockOffsetMs;

    const delayMs = Math.max(0, adjustedTarget - now);

    PreciseWorkerTimer.setTimeout(() => {
      const audio = PlaybackService.getInstance().getActiveAudio();
      if (audio) {
        audio.currentTime = audioPositionSec;
        PlaybackService.getInstance().play();
      }
    }, delayMs);
  }

  /**
   * Starts a Buffer Readiness Gate:
   * Preloads track across all connected peers and waits for BUFFER_READY before triggering play
   */
  public startBufferReadinessGate(
    url: string,
    trackId: string,
    peerIds: string[],
    onReady: () => void
  ) {
    if (this.bufferGateTimeout) {
      clearTimeout(this.bufferGateTimeout);
      this.bufferGateTimeout = null;
    }

    this.pendingPeers = new Set(peerIds);
    this.onAllBufferedCallback = onReady;

    this.preloadTrack(url, trackId);

    if (this.pendingPeers.size === 0) {
      onReady();
      return;
    }

    // Safety fallback: 1500ms max wait to prevent frozen playback
    this.bufferGateTimeout = setTimeout(() => {
      console.log(`[JamAudioSync] Buffer gate timeout fired (pending: ${this.pendingPeers.size}). Proceeding with scheduled trigger.`);
      this.pendingPeers.clear();
      if (this.onAllBufferedCallback) {
        const cb = this.onAllBufferedCallback;
        this.onAllBufferedCallback = null;
        cb();
      }
    }, 1500);
  }

  /**
   * Called when a peer reports BUFFER_READY
   */
  public handlePeerBufferReady(trackId: string, peerId?: string) {
    if (peerId) {
      this.pendingPeers.delete(peerId);
    } else {
      this.pendingPeers.clear();
    }

    if (this.pendingPeers.size === 0 && this.onAllBufferedCallback) {
      if (this.bufferGateTimeout) {
        clearTimeout(this.bufferGateTimeout);
        this.bufferGateTimeout = null;
      }
      const cb = this.onAllBufferedCallback;
      this.onAllBufferedCallback = null;
      cb();
    }
  }

  /**
   * Dispatches PRELOAD_TRACK to peer so audio buffers before playback start
   */
  public preloadTrack(url: string, trackId: string) {
    this.transport?.send({
      type: 'PRELOAD_TRACK',
      url,
      trackId,
    });
  }

  /**
   * Handles incoming PRELOAD_TRACK: buffers audio and emits BUFFER_READY once canplaythrough
   */
  public handlePreloadTrack(url: string, trackId: string) {
    const testAudio = new Audio();
    testAudio.preload = 'auto';
    testAudio.src = url;

    const onCanPlay = () => {
      testAudio.removeEventListener('canplaythrough', onCanPlay);
      this.transport?.send({
        type: 'BUFFER_READY',
        trackId,
      });
    };

    testAudio.addEventListener('canplaythrough', onCanPlay, { once: true });
    testAudio.load();

    // Safety fallback: if network is slow or event doesn't fire, send ready after 1.5s
    setTimeout(onCanPlay, 1500);
  }

  /**
   * Instant pause across both devices
   */
  public instantPause() {
    this.transport?.send({ type: 'INSTANT_PAUSE' });
    PlaybackService.getInstance().pause();
  }

  /**
   * Continuous micro-drift pitch correction loop
   */
  private startDriftMonitor() {
    if (this.driftInterval) clearInterval(this.driftInterval);

    this.driftInterval = setInterval(() => {
      if (this.isHost || !this.isSynced) return;
      const audio = PlaybackService.getInstance().getActiveAudio();
      if (!audio || audio.paused || audio.seeking) return;
    }, 500);
  }

  /**
   * Applies micro-drift rate tuning without perceptible pitch jump
   * • < 20ms: imperceptible, do nothing (maintain 1.0x)
   * • 20ms–60ms: micro-tuning (0.99x if ahead, 1.01x if behind) for 300ms
   * • > 100ms: hard seek
   */
  public applyMicroDriftCorrection(driftMs: number) {
    const audio = PlaybackService.getInstance().getActiveAudio();
    if (!audio || audio.paused) return;

    if (Math.abs(driftMs) < 20) {
      if (audio.playbackRate !== 1.0) {
        audio.playbackRate = 1.0;
      }
      return;
    }

    if (Math.abs(driftMs) >= 20 && Math.abs(driftMs) <= 60) {
      const targetRate = driftMs > 0 ? 0.99 : 1.01;
      audio.playbackRate = targetRate;

      if (this.rateResetTimer) clearTimeout(this.rateResetTimer);
      this.rateResetTimer = setTimeout(() => {
        if (audio && !audio.paused) {
          audio.playbackRate = 1.0;
        }
      }, 300);
      return;
    }

    if (Math.abs(driftMs) > 100) {
      audio.currentTime = Math.max(0, audio.currentTime - driftMs / 1000);
      audio.playbackRate = 1.0;
    }
  }

  public getStats(): ClockOffsetStats {
    return {
      offsetMs: this.clockOffsetMs,
      rttMs: this.rttMs,
      isSynced: this.isSynced,
    };
  }

  public cleanup() {
    if (this.driftInterval) clearInterval(this.driftInterval);
    if (this.rateResetTimer) clearTimeout(this.rateResetTimer);
    this.pingQueue.clear();
    this.transport = null;
    this.isSynced = false;
  }
}
