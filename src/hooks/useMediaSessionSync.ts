'use client';

/**
 * useMediaSessionSync — Remote Controller Lock Screen & Notification Shade Sync
 *
 * Keeps OS lock screen widgets, system notification shade controls, and Bluetooth/earbud
 * hardware buttons synchronized with remote speaker playback:
 * 1. Activates SilentMediaAnchor on remote controllers so mobile OS maintains active notification card.
 * 2. Injects authoritative track metadata with speaker attribution (e.g. "Artist • Listening on Speaker").
 * 3. Updates OS playback state ('playing' | 'paused') and scrub position.
 * 4. Routes lock screen transport controls (Play/Pause, Next, Prev, Seek) directly over RPC to the Speaker.
 */

import { useEffect } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { silentMediaAnchor } from '@/lib/connect/SilentAudioAnchor';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';

export function useMediaSessionSync() {
  const isRemoteMode = useConnectStore((s) => s.isRemoteMode);
  const activePlaybackDevice = useConnectStore((s) => s.activePlaybackDevice);
  const remoteSession = useConnectStore((s) => s.remoteSession);

  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (isRemoteMode && remoteSession?.currentSong) {
      // 1. Controller Mode: Activate silent loop to force OS notification display
      silentMediaAnchor.activate();

      const track = remoteSession.currentSong;
      const isPlaying = remoteSession.isPlaying;
      const speakerName = activePlaybackDevice?.deviceName || remoteSession.playbackDeviceName || 'Remote Speaker';

      // 2. Populate Notification Bar / Lock Screen Metadata
      MediaSessionManager.getInstance().updateSongMetadata(track, {
        remoteSpeakerName: speakerName,
      });

      // 3. Update Play/Pause Notification State
      MediaSessionManager.getInstance().setPlaybackState(isPlaying ? 'playing' : 'paused');

      // 4. Update Position State in Notification Scrub Bar
      const durationSec = (remoteSession.durationMs || (track.duration ? track.duration * 1000 : 0)) / 1000;
      const posSec = (remoteSession.positionMs || 0) / 1000;
      if (durationSec > 0) {
        MediaSessionManager.getInstance().setPositionState({
          duration: durationSec,
          playbackRate: isPlaying ? 1.0 : 0.0,
          position: Math.min(posSec, durationSec),
        });
      }

      // 5. Intercept OS / Hardware Action Buttons and forward to Speaker
      MediaSessionManager.getInstance().setupRemoteMediaHandlers();
    } else if (!isRemoteMode) {
      // Deactivate silent anchor when not in remote mode
      silentMediaAnchor.deactivate();
    }
  }, [isRemoteMode, remoteSession, activePlaybackDevice]);
}
