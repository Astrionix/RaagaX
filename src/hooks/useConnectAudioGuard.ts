/**
 * RaagaX Connect — Strict Audio Hardware Gating Hook
 *
 * Enforces the Spotify Connect single-speaker rule:
 * Only the device matching activeSpeakerId is allowed to output sound.
 * If this device is a Remote Controller, all local HTML5 Audio and Native
 * ExoPlayer instances are strictly paused, cleared of src buffer, and silenced.
 */

import { useEffect } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { RaagaXNativePlayer } from '@/lib/playback/native/RaagaXNativePlayer';

export function useConnectAudioGuard() {
  const isRemoteMode = useConnectStore((s) => s.isRemoteMode);
  const activePlaybackDevice = useConnectStore((s) => s.activePlaybackDevice);
  const remoteSession = useConnectStore((s) => s.remoteSession);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentSong = usePlayerStore((s) => s.currentSong);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
    const localDeviceId = localDevice?.deviceId || 'dev_local';

    // 3-Way State Evaluation
    const activeSpeakerId = remoteSession?.playbackDeviceId || (isRemoteMode ? activePlaybackDevice?.deviceId : null);
    const isController = isRemoteMode || (Boolean(activeSpeakerId) && activeSpeakerId !== localDeviceId);

    if (isController) {
      // 🔇 I AM CONTROLLER: Strict Hardware Audio Cut (Zero Sound Output)
      try {
        const playback = PlaybackService.getInstance();
        playback.pauseAudioElementOnly();
        playback.hardResetAudioPipeline();

        if (RaagaXNativePlayer.isNative()) {
          RaagaXNativePlayer.pause();
        }
      } catch (err) {
        console.error('[useConnectAudioGuard] Failed to cut controller audio:', err);
      }
    }
  }, [isRemoteMode, activePlaybackDevice, remoteSession, isPlaying, currentSong]);
}
