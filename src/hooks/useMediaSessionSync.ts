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

  // Sync metadata and media key handlers on session / mode change
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

      // 4. Intercept OS / Hardware Action Buttons and forward to Speaker
      MediaSessionManager.getInstance().setupRemoteMediaHandlers();
    } else if (!isRemoteMode) {
      // Deactivate silent anchor when not in remote mode
      silentMediaAnchor.deactivate();
    }
  }, [isRemoteMode, remoteSession, activePlaybackDevice]);

  // 5. Drive lock screen scrubber with live monotonic-interpolated position.
  //    setPositionState is called once per second — OS notification scrubbers
  //    redraw at ~1 FPS and setPositionState has a built-in 250ms throttle,
  //    so calling faster has zero UX benefit but meaningful overhead.
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!isRemoteMode || !remoteSession) return;

    const durationSec = (remoteSession.durationMs || 0) / 1000;
    if (durationSec <= 0) return;

    const tick = () => {
      if (!remoteSession.isPlaying) return; // Nothing to advance when paused

      try {
        // Use arrival-anchored monotonic interpolation — same source as the in-app scrubber
        const { ConnectClientManager } = require('@/lib/connect/ConnectClientManager');
        const livePosSec = ConnectClientManager.getInstance().getInterpolatedPosition();
        const clampedPos = Math.min(livePosSec, durationSec);
        MediaSessionManager.getInstance().setPositionState({
          duration: durationSec,
          playbackRate: 1.0,
          position: clampedPos,
        });
      } catch { }
    };

    tick(); // Immediate first update
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [isRemoteMode, remoteSession?.isPlaying, remoteSession?.durationMs, remoteSession?.revision]);
}
