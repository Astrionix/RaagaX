/**
 * RaagaX Connect — Cross-Device Synchronization Hook
 *
 * Implements the client-side state engine for Spotify Connect architecture:
 * - Listens for authoritative SESSION_STATE broadcasts.
 * - Enforces monotonic sequence version validation.
 * - Completely flushes and detaches local audio hardware when in Remote Controller mode.
 * - Dispatches typed transport and transfer RPC commands.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { DeviceIdentity } from '@/lib/connect/identity/DeviceIdentity';
import { PlaybackSessionState, TrackMetadata, DeviceInfo, ClientCommandMessage } from '@/lib/connect/protocol/types';
import { Song } from '@/types/music';

export function useCrossDeviceSync() {
  const localDeviceId = useRef<string>('');
  const [currentSession, setCurrentSession] = useState<PlaybackSessionState | null>(null);
  const lastKnownVersion = useRef<number>(0);

  const {
    devices,
    activePlaybackDevice,
    remoteSession,
    isRemoteMode,
    transferPlayback,
    disconnectAndPlayLocally,
    sendPlay,
    sendPause,
    sendNext,
    sendPrev,
    sendSeek,
    sendVolume,
  } = useConnectStore();

  const storeSong = usePlayerStore((s) => s.currentSong);
  const storeIsPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localDeviceId.current = DeviceIdentity.getInstance().getDeviceId();
    }
  }, []);

  // Synchronize incoming remoteSession with monotonic version validation
  useEffect(() => {
    if (!remoteSession) return;

    // Discard stale out-of-order packets
    if (remoteSession.revision < lastKnownVersion.current) {
      console.warn(`[CROSS_DEVICE_SYNC] Dropped stale packet (rev ${remoteSession.revision} < ${lastKnownVersion.current})`);
      return;
    }
    lastKnownVersion.current = remoteSession.revision;

    const availableDevicesList: DeviceInfo[] = devices.map((d) => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      deviceType: d.deviceType === 'mobile' ? 'MOBILE' : d.deviceType === 'desktop' ? 'DESKTOP' : 'WEB',
      isSink: true,
      isActive: d.deviceId === remoteSession.playbackDeviceId,
    }));

    const adaptedState: PlaybackSessionState = {
      sessionId: remoteSession.sessionId,
      userId: 'usr_current',
      activeSinkDeviceId: remoteSession.playbackDeviceId,
      stateVersion: remoteSession.revision,
      serverTimestampMs: remoteSession.anchorTimeMs || remoteSession.updatedAt || Date.now(),
      playbackState: remoteSession.isPlaying ? 'PLAYING' : 'PAUSED',
      currentTrack: remoteSession.currentSong
        ? {
            uri: remoteSession.currentSong.audioUrl || '',
            title: remoteSession.currentSong.title,
            artist: remoteSession.currentSong.artist || 'Unknown',
            album: remoteSession.currentSong.album || 'RaagaX',
            artworkUrl: remoteSession.currentSong.coverUrl || '',
            durationMs: Math.round((remoteSession.currentSong.duration || 0) * 1000),
            bitrateBps: 320000,
          }
        : null,
      positionMs: remoteSession.positionMs,
      volume: remoteSession.volume ?? 0.8,
      shuffle: remoteSession.shuffle ?? false,
      repeat: (remoteSession.repeat as 'OFF' | 'ALL' | 'ONE') || 'OFF',
      queue: (remoteSession.queue || []).map((s) => ({
        uri: s.audioUrl || '',
        title: s.title,
        artist: s.artist || '',
        album: s.album || '',
        artworkUrl: s.coverUrl || '',
        durationMs: Math.round((s.duration || 0) * 1000),
        bitrateBps: 320000,
      })),
      queueIndex: remoteSession.queueIndex ?? 0,
    };

    setCurrentSession(adaptedState);

    // MODE SWITCHER:
    // If transitioning to Remote Controller mode, flush local audio hardware
    if (isRemoteMode) {
      try {
        const { PlaybackService } = require('@/lib/playback/PlaybackService');
        PlaybackService.getInstance().stopAllAudio();
      } catch {}
    }
  }, [remoteSession, devices, isRemoteMode]);

  const handleTransfer = useCallback(
    async (targetDeviceId: string) => {
      const target = devices.find((d) => d.deviceId === targetDeviceId);
      if (!target) return;

      if (target.isCurrentDevice) {
        await disconnectAndPlayLocally();
      } else {
        await transferPlayback(target);
      }
    },
    [devices, transferPlayback, disconnectAndPlayLocally]
  );

  const activeTrack = currentSession?.currentTrack || (storeSong ? {
    uri: storeSong.audioUrl || '',
    title: storeSong.title,
    artist: storeSong.artist || 'Unknown',
    album: storeSong.album || 'RaagaX',
    artworkUrl: storeSong.coverUrl || '',
    durationMs: Math.round((storeSong.duration || 0) * 1000),
    bitrateBps: 320000,
  } : null);

  const isPlaying = currentSession ? currentSession.playbackState === 'PLAYING' : storeIsPlaying;

  return {
    session: currentSession,
    activeTrack,
    isPlaying,
    isRemoteMode,
    currentDeviceId: localDeviceId.current,
    activeSinkDevice: activePlaybackDevice,
    availableDevices: devices,
    transferPlayback: handleTransfer,
    play: sendPlay,
    pause: sendPause,
    skipNext: sendNext,
    skipPrev: sendPrev,
    seek: sendSeek,
    setVolume: sendVolume,
  };
}
