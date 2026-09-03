'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Smartphone,
  Laptop,
  Tv,
  Speaker,
  Play,
  X,
  Radio,
} from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useConnectStore } from '@/context/useConnectStore';
import { supabase } from '@/lib/supabase';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { Song } from '@/types/music';

interface RemotePlaybackState {
  user_id: string;
  device_id: string;
  device_name: string;
  device_type?: string;
  current_track_id: string;
  track_title: string;
  artist_name: string;
  cover_url?: string;
  audio_url?: string;
  progress_ms: number;
  duration_ms: number;
  is_playing: boolean;
  updated_at: string;
}

/**
 * PassiveConnectPromptBanner — Spotify Connect Passive Handshake Banner
 *
 * Implements Spotify Connect Passive Handshake rule:
 * 1. Never plays audio automatically or makes a sound on device wake.
 * 2. Displays a floating card: "Playing on [Device Name] — [Song Title] • [Artist]"
 * 3. Two explicit user actions:
 *    - [ Play Here ]: Pauses the mobile phone and seamlessly resumes on Laptop at exact progress_ms.
 *    - [ Dismiss ]: Dismisses the prompt and allows this device to operate independently.
 */
function normalizePlaybackState(raw: any): RemotePlaybackState | null {
  if (!raw) return null;
  const device_id = raw.active_device_id || raw.device_id || 'remote_device';
  const device_name = raw.active_device_name || raw.device_name || 'Remote Device';
  const current_track_id = raw.current_track_id || raw.current_track?.id || '';
  const track_title = raw.track_title || raw.current_track?.title || 'Unknown Track';
  const artist_name = raw.artist_name || raw.current_track?.artist || 'Unknown Artist';
  const cover_url = raw.cover_url || raw.current_track?.coverUrl || raw.current_track?.cover_url || '';
  const audio_url = raw.audio_url || raw.current_track?.audioUrl || raw.current_track?.audio_url || null;

  return {
    user_id: raw.user_id,
    device_id,
    device_name,
    device_type: raw.device_type || 'mobile',
    current_track_id,
    track_title,
    artist_name,
    cover_url,
    audio_url,
    progress_ms: raw.progress_ms || 0,
    duration_ms: raw.duration_ms || (raw.current_track?.duration ? raw.current_track.duration * 1000 : 0),
    is_playing: Boolean(raw.is_playing),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

export function PassiveConnectPromptBanner() {
  const [remoteState, setRemoteState] = useState<RemotePlaybackState | null>(null);
  const [dismissedTrackId, setDismissedTrackId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const user = useAuthStore((s) => s.user);
  const localSong = usePlayerStore((s) => s.currentSong);
  const localIsPlaying = usePlayerStore((s) => s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const setSeekTarget = usePlayerStore((s) => s.setSeekTarget);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);

  const isRemoteMode = useConnectStore((s) => s.isRemoteMode);
  const isControlledByRemote = useConnectStore((s) => s.isControlledByRemote);

  const localDevice = typeof window !== 'undefined'
    ? ConnectDiscoveryEngine.getInstance().getLocalDevice()
    : null;
  const localDeviceId = localDevice?.deviceId || 'dev_local';

  // 1. Check active remote playback on mount & on auth changes
  useEffect(() => {
    if (!user?.id) {
      setRemoteState(null);
      return;
    }

    let isMounted = true;

    async function checkRemoteState() {
      try {
        const { data, error } = await supabase
          .from('user_playback_state')
          .select('*')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (error || !data || !isMounted) return;

        const normalized = normalizePlaybackState(data);
        if (!normalized) return;

        const ageMs = Date.now() - new Date(normalized.updated_at).getTime();
        // Valid if playing, on a different device, active within the last 10 minutes, and not dismissed
        if (
          normalized.is_playing &&
          normalized.device_id !== localDeviceId &&
          ageMs < 10 * 60 * 1000 &&
          normalized.current_track_id !== dismissedTrackId &&
          !localIsPlaying
        ) {
          setRemoteState(normalized);
        }
      } catch {}
    }

    checkRemoteState();

    // 2. Realtime listener for cross-device playback state changes
    const channelName = `playback_sync_${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_playback_state',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (!isMounted) return;
          const normalized = normalizePlaybackState(payload.new);
          if (!normalized) {
            setRemoteState(null);
            return;
          }

          if (
            normalized.is_playing &&
            normalized.device_id !== localDeviceId &&
            normalized.current_track_id !== dismissedTrackId &&
            !usePlayerStore.getState().isPlaying
          ) {
            setRemoteState(normalized);
          } else if (!normalized.is_playing || normalized.device_id === localDeviceId) {
            setRemoteState(null);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user?.id, localDeviceId, dismissedTrackId, localIsPlaying]);

  // Hide if this device is already active or in explicit remote mode
  if (!remoteState || isRemoteMode || isControlledByRemote || localIsPlaying) {
    return null;
  }

  const getDeviceIcon = () => {
    const type = (remoteState.device_type || '').toLowerCase();
    if (type.includes('tv')) return <Tv className="w-4 h-4 text-[#1db954]" />;
    if (type.includes('laptop') || type.includes('desktop')) return <Laptop className="w-4 h-4 text-[#1db954]" />;
    if (type.includes('speaker')) return <Speaker className="w-4 h-4 text-[#1db954]" />;
    return <Smartphone className="w-4 h-4 text-[#1db954]" />;
  };

  const handlePlayHere = async () => {
    if (!remoteState || isTransferring) return;
    setIsTransferring(true);

    try {
      // 1. Tell the remote phone to pause
      ConnectDiscoveryEngine.getInstance().sendSupabaseBroadcast('CONNECT_COMMAND', {
        action: 'PAUSE',
        targetDeviceId: remoteState.device_id,
        timestamp: Date.now(),
      });

      // 2. Fetch full track if URL is missing, or construct Song object
      let songToPlay: Song;
      if (remoteState.audio_url) {
        songToPlay = {
          id: remoteState.current_track_id,
          title: remoteState.track_title || 'Unknown Track',
          artist: remoteState.artist_name || 'Unknown Artist',
          artistId: 'unknown',
          album: 'Single',
          albumId: 'unknown',
          duration: remoteState.duration_ms ? remoteState.duration_ms / 1000 : 0,
          coverUrl: remoteState.cover_url || '',
          audioUrl: remoteState.audio_url,
          genre: 'Music',
          category: 'global_trending',
          releaseYear: new Date().getFullYear(),
          plays: 0,
          likes: 0,
        };
      } else {
        // Fallback fetch track metadata from API
        try {
          const res = await fetch(`/api/songs/${remoteState.current_track_id}`);
          if (res.ok) {
            const data = await res.json();
            songToPlay = data.song || data;
          } else {
            songToPlay = {
              id: remoteState.current_track_id,
              title: remoteState.track_title || 'Unknown Track',
              artist: remoteState.artist_name || 'Unknown Artist',
              artistId: 'unknown',
              album: 'Single',
              albumId: 'unknown',
              duration: remoteState.duration_ms ? remoteState.duration_ms / 1000 : 0,
              coverUrl: remoteState.cover_url || '',
              audioUrl: null,
              genre: 'Music',
              category: 'global_trending',
              releaseYear: new Date().getFullYear(),
              plays: 0,
              likes: 0,
            };
          }
        } catch {
          songToPlay = {
            id: remoteState.current_track_id,
            title: remoteState.track_title || 'Unknown Track',
            artist: remoteState.artist_name || 'Unknown Artist',
            artistId: 'unknown',
            album: 'Single',
            albumId: 'unknown',
            duration: remoteState.duration_ms ? remoteState.duration_ms / 1000 : 0,
            coverUrl: remoteState.cover_url || '',
            audioUrl: null,
            genre: 'Music',
            category: 'global_trending',
            releaseYear: new Date().getFullYear(),
            plays: 0,
            likes: 0,
          };
        }
      }

      // 3. Play locally and seek to matching progress
      playSong(songToPlay);
      if (remoteState.progress_ms && remoteState.progress_ms > 1000) {
        setTimeout(() => {
          setSeekTarget(remoteState.progress_ms / 1000);
        }, 300);
      }

      // 4. Update cloud record with local device as active player
      if (user?.id) {
        await supabase.from('user_playback_state').upsert({
          user_id: user.id,
          device_id: localDeviceId,
          device_name: localDevice?.deviceName || 'This Computer',
          device_type: localDevice?.deviceType || 'desktop',
          current_track_id: remoteState.current_track_id,
          track_title: remoteState.track_title,
          artist_name: remoteState.artist_name,
          cover_url: remoteState.cover_url,
          audio_url: songToPlay.audioUrl || remoteState.audio_url || null,
          progress_ms: remoteState.progress_ms,
          duration_ms: remoteState.duration_ms,
          is_playing: true,
          updated_at: new Date().toISOString(),
        });
      }

      setRemoteState(null);
    } catch (e) {
      console.error('[PassiveConnectPrompt] Transfer failed:', e);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDismiss = () => {
    if (remoteState) {
      setDismissedTrackId(remoteState.current_track_id);
    }
    setRemoteState(null);
  };

  return (
    <div
      className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-40 select-none flex items-center justify-between px-4 py-2 bg-[#0e0e11]/95 hover:bg-[#121217] backdrop-blur-2xl border border-[#1db954]/40 hover:border-[#1db954]/60 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(29,185,84,0.18)] transition-all duration-300 max-w-[calc(100vw-2rem)] md:max-w-[680px] w-auto h-[46px] gap-3.5 -translate-x-1/2 animate-in slide-in-from-bottom-3 ${
        isQueueOpen
          ? 'left-1/2 md:left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
          : 'left-1/2 md:left-[calc(50%+8rem)]'
      }`}
    >
      {/* Device & Status Indicator */}
      <div className="flex items-center gap-2.5 min-w-0 flex-shrink truncate">
        <div className="relative flex-shrink-0 w-7 h-7 rounded-full bg-[#1db954]/15 flex items-center justify-center">
          {getDeviceIcon()}
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1db954] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1db954]"></span>
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold text-zinc-200 truncate">
            Playing on <span className="text-[#1db954] font-bold">{remoteState.device_name}</span>
          </span>
          <span className="text-[10px] text-zinc-400 truncate max-w-[220px] sm:max-w-[280px]">
            {remoteState.track_title} • {remoteState.artist_name}
          </span>
        </div>
      </div>

      {/* Explicit Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handlePlayHere}
          disabled={isTransferring}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black text-[11px] font-bold shadow-md shadow-[#1db954]/20 transition-all cursor-pointer"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isTransferring ? 'Switching...' : 'Play Here'}</span>
        </button>

        <button
          onClick={handleDismiss}
          title="Dismiss banner"
          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
