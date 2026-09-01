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
import { NtpClockEngine } from '@/lib/connect/protocol/NtpClockEngine';

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

  // 3. 60fps RequestAnimationFrame Interpolation Loop (No server polling)
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
        return;
      }

      const serverAlignedNow = NtpClockEngine.getInstance().getServerAlignedTime(Date.now());
      const anchorTimeMs = remoteSession.anchorTimeMs || remoteSession.updatedAt || Date.now();
      const anchorPosMs = remoteSession.anchorPositionMs ?? remoteSession.positionMs ?? 0;
      const elapsedMs = Math.max(0, serverAlignedNow - anchorTimeMs);
      const computedPosMs = anchorPosMs + elapsedMs;

      const clampedPosMs = durationMs > 0 ? Math.min(computedPosMs, durationMs) : computedPosMs;
      setInterpolatedPositionMs(clampedPosMs);

      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [status, remoteSession?.anchorTimeMs, remoteSession?.anchorPositionMs, remoteSession?.isPlaying, remoteSession?.durationMs]);

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
