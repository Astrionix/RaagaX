'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { supabase } from '@/lib/supabase';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';

/**
 * usePlaybackCloudSync — Spotify Connect Style Cloud State Syncer
 *
 * Keeps the public.user_playback_state table updated with the active playback session:
 * - Upserts on track change, play, pause, seek
 * - Throttles position updates to at most once every 8 seconds during active playback
 * - Marks is_playing = false on unmount or pause
 */
export function usePlaybackCloudSync() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const user = useAuthStore((s) => s.user);

  const lastSyncTimeRef = useRef<number>(0);
  const lastStateRef = useRef<{ songId: string | null; isPlaying: boolean }>({
    songId: null,
    isPlaying: false,
  });

  useEffect(() => {
    if (!user?.id) return;

    const now = Date.now();
    const songId = currentSong?.id || null;
    const isPlayingChanged = lastStateRef.current.isPlaying !== isPlaying;
    const songChanged = lastStateRef.current.songId !== songId;

    // Throttle progress updates to at least 8 seconds, unless play/pause or track changed
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    const shouldSync = isPlayingChanged || songChanged || (isPlaying && timeSinceLastSync >= 8000);

    if (!shouldSync) return;

    lastSyncTimeRef.current = now;
    lastStateRef.current = { songId, isPlaying };

    const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();

    const coverUrl =
      currentSong?.coverUrl ||
      (currentSong as any)?.artworkUrl ||
      (currentSong as any)?.image?.[2]?.url ||
      '';

    const audioUrl = currentSong?.audioUrl || (currentSong as any)?.url || null;

    const currentTrackObj = currentSong ? {
      id: currentSong.id,
      title: currentSong.title,
      artist: currentSong.artist,
      coverUrl: coverUrl,
      audioUrl: audioUrl,
      duration: currentSong.duration,
    } : null;

    (async () => {
      try {
        const fullPayload = {
          user_id: user.id,
          device_id: localDevice.deviceId,
          device_name: localDevice.deviceName,
          device_type: localDevice.deviceType || 'mobile',
          current_track_id: currentSong?.id || null,
          track_title: currentSong?.title || null,
          artist_name: currentSong?.artist || null,
          cover_url: coverUrl,
          audio_url: audioUrl,
          current_track: currentTrackObj,
          progress_ms: Math.round((currentTime || 0) * 1000),
          duration_ms: Math.round((duration || 0) * 1000),
          is_playing: Boolean(isPlaying && currentSong),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('user_playback_state')
          .upsert(fullPayload);

        // If table was created with minimal schema (active_device_id, active_device_name, current_track JSONB)
        if (error && (error.code === '42703' || error.message?.includes('column'))) {
          await supabase
            .from('user_playback_state')
            .upsert({
              user_id: user.id,
              active_device_id: localDevice.deviceId,
              active_device_name: localDevice.deviceName,
              current_track: currentTrackObj,
              progress_ms: Math.round((currentTime || 0) * 1000),
              is_playing: Boolean(isPlaying && currentSong),
              updated_at: new Date().toISOString(),
            });
        }
      } catch {}
    })();
  }, [user?.id, currentSong, isPlaying, currentTime, duration]);

  // Clean up on unmount or tab close
  useEffect(() => {
    return () => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.id) {
        const localDevice = ConnectDiscoveryEngine.getInstance().getLocalDevice();
        (async () => {
          try {
            await supabase
              .from('user_playback_state')
              .update({
                is_playing: false,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', currentUser.id)
              .eq('device_id', localDevice.deviceId);
          } catch {}
        })();
      }
    };
  }, []);
}
