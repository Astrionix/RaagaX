/**
 * RaagaX Connect — Instant Remote Session Hydration Hook
 *
 * Implements Spotify Connect client-side hydration:
 * 1. Evaluates incoming canonical session state.
 * 2. Enforces strict Audio Silence Guard if playing on a remote speaker (no local sound).
 * 3. Drives 60fps client-side timeline interpolation using NTP clock drift offset.
 * 4. Binds remote controller transport dispatchers (Play, Pause, Skip, Seek, Volume).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export type DevicePlaybackStatus = 'AUTHORITATIVE_SPEAKER' | 'REMOTE_CONTROLLER' | 'IDLE';

export interface RemoteSessionHydrationState {
  status: DevicePlaybackStatus;
  isRemoteMode: boolean;
  activeDeviceName: string | null;
  interpolatedPositionMs: number;
  progressRatio: number;
  durationMs: number;
  isPlaying: boolean;
  takeoverPlayback: () => Promise<boolean>;
  sendPlay: () => Promise<boolean>;
  sendPause: () => Promise<boolean>;
  sendSeek: (positionMs: number) => Promise<boolean>;
  sendNext: () => Promise<boolean>;
  sendPrev: () => Promise<boolean>;
  sendVolume: (volume: number) => Promise<boolean>;
}

export function useRemoteSessionHydration(): RemoteSessionHydrationState {
  const {
    isRemoteMode,
    activePlaybackDevice,
    remoteSession,
    sendPlay,
    sendPause,
    sendSeek,
    sendNext,
    sendPrev,
    sendVolume,
    disconnectAndPlayLocally,
  } = useConnectStore();

  const localCurrentSong = usePlayerStore((s) => s.currentSong);
  const localIsPlaying = usePlayerStore((s) => s.isPlaying);
  const localCurrentTime = usePlayerStore((s) => s.currentTime);
  const localDuration = usePlayerStore((s) => s.duration);

  const [interpolatedPositionMs, setInterpolatedPositionMs] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // 1. Determine Device Status
  const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
  const isPlayingOnRemote =
    isRemoteMode &&
    activePlaybackDevice &&
    activePlaybackDevice.deviceId !== localDevice.deviceId &&
    activePlaybackDevice.deviceId !== 'dev_local';

  const status: DevicePlaybackStatus = isPlayingOnRemote
    ? 'REMOTE_CONTROLLER'
    : localCurrentSong || (remoteSession && remoteSession.currentSong)
      ? 'AUTHORITATIVE_SPEAKER'
      : 'IDLE';

  // 2. Audio Safety Guard: Explicitly silence local audio engine in REMOTE_CONTROLLER mode
  useEffect(() => {
    if (status === 'REMOTE_CONTROLLER') {
      try {
        const playback = PlaybackService.getInstance();
        playback.pause();
        playback.stopAllAudio();
      } catch {}
    }
  }, [status, remoteSession?.currentTrackId]);

  // 3. 60fps RequestAnimationFrame Interpolation Loop (Monotonic — Clock-Drift Proof)
  useEffect(() => {
    if (status !== 'REMOTE_CONTROLLER' || !remoteSession) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const durationMs = remoteSession.durationMs || (remoteSession.currentSong?.duration ? remoteSession.currentSong.duration * 1000 : 0);

    const updateFrame = () => {
      if (!remoteSession.isPlaying) {
        setInterpolatedPositionMs(Math.min(remoteSession.positionMs || 0, durationMs || Infinity));
        // Do NOT loop when paused — we only need a single accurate paint
        return;
      }

      // Use the arrival-anchored monotonic interpolation from ConnectClientManager.
      // This is clock-drift-proof and never uses Date.now() subtraction across devices.
      const livePosSec = ConnectClientManager.getInstance().getInterpolatedPosition();
      const livePosMs = Math.min(livePosSec * 1000, durationMs > 0 ? durationMs : Infinity);
      setInterpolatedPositionMs(livePosMs);

      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [status, remoteSession?.anchorPositionMs, remoteSession?.anchorTimeMs, remoteSession?.isPlaying, remoteSession?.durationMs, remoteSession?.revision]);

  // 3b. Wakeup Resiliency: on visibility/focus re-entry, immediately request
  // a fresh session snapshot so the position re-anchors after mobile suspend.
  // Resume SilentMediaAnchor first — iOS drops the notification card the moment
  // the anchor pauses. We must re-play it before rebinding handlers.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const onWakeup = () => {
      if (status === 'REMOTE_CONTROLLER') {
        // 1. Resume silent keepalive audio FIRST so iOS notification card stays alive
        import('@/lib/connect/SilentAudioAnchor').then(({ silentMediaAnchor }) => {
          silentMediaAnchor.resumeAfterSuspend();
        }).catch(() => {});

        // 2. Re-bind media key handlers (iOS clears them on background suspend)
        import('@/lib/playback/MediaSessionManager').then(({ MediaSessionManager }) => {
          MediaSessionManager.getInstance().setupRemoteMediaHandlers();
        }).catch(() => {});

        // 3. Request fresh session snapshot to re-anchor the monotonic clock
        ConnectClientManager.getInstance().requestCurrentPlaybackState().catch?.(() => {});
      }
    };

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') onWakeup();
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', onWakeup);

    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('focus', onWakeup);
    };
  }, [status]);

  // 4. One-Click Takeover ("Play on This Device")
  const takeoverPlayback = useCallback(async (): Promise<boolean> => {
    return disconnectAndPlayLocally();
  }, [disconnectAndPlayLocally]);

  const activeDurationMs = status === 'REMOTE_CONTROLLER' && remoteSession
    ? remoteSession.durationMs || (remoteSession.currentSong?.duration ? remoteSession.currentSong.duration * 1000 : 0)
    : (localDuration || 0) * 1000;

  const currentLivePosMs = status === 'REMOTE_CONTROLLER'
    ? interpolatedPositionMs
    : (localCurrentTime || 0) * 1000;

  const progressRatio = activeDurationMs > 0
    ? Math.min(1, Math.max(0, currentLivePosMs / activeDurationMs))
    : 0;

  return {
    status,
    isRemoteMode: status === 'REMOTE_CONTROLLER',
    activeDeviceName: isPlayingOnRemote ? (activePlaybackDevice?.deviceName || 'Remote Speaker') : null,
    interpolatedPositionMs: currentLivePosMs,
    progressRatio,
    durationMs: activeDurationMs,
    isPlaying: status === 'REMOTE_CONTROLLER' ? Boolean(remoteSession?.isPlaying) : localIsPlaying,
    takeoverPlayback,
    sendPlay,
    sendPause,
    sendSeek,
    sendNext,
    sendPrev,
    sendVolume,
  };
}
