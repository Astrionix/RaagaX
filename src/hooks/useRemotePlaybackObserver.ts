'use client';

/**
 * useRemotePlaybackObserver — Spotify-Style Cross-Device Playback Observer
 *
 * Implements:
 * 1. Deterministic Role Resolution (isSpeaker, isRemoteController, isIdle)
 * 2. Strict Audio Hardware Isolation (Zero audio decode/play calls on remote controllers)
 * 3. 60 FPS Mathematical Scrubber Interpolation Loop (No network audio polling)
 * 4. One-Click Audio Takeover ("Play on this device")
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export interface RemotePlaybackObserverState {
  // Role determination
  isSpeaker: boolean;
  isRemoteController: boolean;
  isIdle: boolean;

  // Active Device Info
  localDeviceId: string;
  activeSpeakerId: string | null;
  activeSpeakerName: string | null;

  // Track & Playback State
  trackTitle: string | null;
  trackArtist: string | null;
  trackCoverUrl: string | null;
  durationMs: number;
  isPaused: boolean;

  // Real-Time 60 FPS Interpolation
  interpolatedPositionMs: number;
  progressRatio: number;

  // Loading / Takeover state
  isTakingOver: boolean;

  // Controller Actions
  takeoverPlayback: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  sendPlay: () => Promise<boolean>;
  sendPause: () => Promise<boolean>;
  sendSeek: (positionMs: number) => Promise<boolean>;
  sendNext: () => Promise<boolean>;
  sendPrev: () => Promise<boolean>;
  sendVolume: (volume: number) => Promise<boolean>;
}

export function useRemotePlaybackObserver(): RemotePlaybackObserverState {
  const {
    localDeviceId,
    isRemoteMode,
    activePlaybackDevice,
    remoteSession,
    speakerSession,
    clockOffsetMs,
    transferPlayback,
    disconnect: disconnectController,
    sendPlay: storeSendPlay,
    sendPause: storeSendPause,
    sendSeek: storeSendSeek,
    sendNext: storeSendNext,
    sendPrev: storeSendPrev,
    sendVolume: storeSendVolume,
  } = useConnectStore();

  const [interpolatedPositionMs, setInterpolatedPositionMs] = useState(0);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  // Derive authoritative session (remote session if in controller mode, else local speaker session)
  const activeSession = isRemoteMode ? remoteSession : speakerSession;

  // ── 1. DETERMINISTIC ROLE RESOLUTION ──
  const activeSpeakerId = isRemoteMode
    ? activePlaybackDevice?.deviceId || remoteSession?.playbackDeviceId || null
    : localDeviceId;

  const activeSpeakerName = isRemoteMode
    ? activePlaybackDevice?.deviceName || remoteSession?.playbackDeviceName || 'Remote Device'
    : 'This Device';

  const isRemoteController = isRemoteMode && !!activeSpeakerId && activeSpeakerId !== localDeviceId;
  const isSpeaker = !isRemoteController;
  const isIdle = !activeSession?.currentSong && !usePlayerStore.getState().currentSong;

  const currentSong = activeSession?.currentSong || usePlayerStore.getState().currentSong;
  const durationMs = activeSession?.durationMs || Math.round((currentSong?.duration || 0) * 1000) || 0;
  const isPaused = activeSession ? !activeSession.isPlaying : !usePlayerStore.getState().isPlaying;

  // ── 2. STRICT AUDIO HARDWARE ISOLATION (ZERO AUDIO ON CONTROLLERS) ──
  useEffect(() => {
    if (isRemoteController) {
      // Strict silence on Remote Controller: pause and detach audio buffers
      try {
        const pb = PlaybackService.getInstance();
        pb.pause();
        pb.stopAllAudio();
        const activeAudio = pb.getActiveAudio();
        if (activeAudio) {
          activeAudio.volume = 0;
          activeAudio.src = '';
        }
      } catch {}
      usePlayerStore.setState({ isPlaying: false });
    }
  }, [isRemoteController]);

  // ── 3. 60 FPS MATHEMATICAL TIMELINE INTERPOLATION (NO AUDIO POLLING) ──
  useEffect(() => {
    const updateInterpolation = () => {
      if (!activeSession) {
        const localSec = usePlayerStore.getState().currentTime || 0;
        setInterpolatedPositionMs(Math.round(localSec * 1000));
        animFrameRef.current = requestAnimationFrame(updateInterpolation);
        return;
      }

      if (isPaused) {
        setInterpolatedPositionMs(activeSession.positionMs || 0);
      } else {
        const now = Date.now() + clockOffsetMs;
        const anchorTime = activeSession.anchorTimeMs || activeSession.updatedAt || now;
        const elapsedMs = Math.max(0, now - anchorTime);
        const calculatedMs = (activeSession.anchorPositionMs || activeSession.positionMs || 0) + elapsedMs;
        const clampedMs = durationMs > 0 ? Math.min(durationMs, calculatedMs) : calculatedMs;
        setInterpolatedPositionMs(clampedMs);
      }

      animFrameRef.current = requestAnimationFrame(updateInterpolation);
    };

    animFrameRef.current = requestAnimationFrame(updateInterpolation);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeSession, isPaused, durationMs, clockOffsetMs]);

  const progressRatio = durationMs > 0 ? Math.max(0, Math.min(1, interpolatedPositionMs / durationMs)) : 0;

  // ── 4. SEAMLESS TAKEOVER ACTION ("Play on this device") ──
  const takeoverPlayback = useCallback(async () => {
    setIsTakingOver(true);
    try {
      const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
      const success = await useConnectStore.getState().disconnectAndPlayLocally();
      return success;
    } finally {
      setTimeout(() => setIsTakingOver(false), 800);
    }
  }, []);

  const disconnect = useCallback(async () => {
    return disconnectController();
  }, [disconnectController]);

  return {
    isSpeaker,
    isRemoteController,
    isIdle,
    localDeviceId,
    activeSpeakerId,
    activeSpeakerName,
    trackTitle: currentSong?.title || null,
    trackArtist: currentSong?.artist || null,
    trackCoverUrl: currentSong?.coverUrl || null,
    durationMs,
    isPaused,
    interpolatedPositionMs,
    progressRatio,
    isTakingOver,
    takeoverPlayback,
    disconnect,
    sendPlay: storeSendPlay,
    sendPause: storeSendPause,
    sendSeek: storeSendSeek,
    sendNext: storeSendNext,
    sendPrev: storeSendPrev,
    sendVolume: storeSendVolume,
  };
}
