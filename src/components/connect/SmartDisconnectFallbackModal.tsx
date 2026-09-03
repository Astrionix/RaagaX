'use client';

import React from 'react';
import { Radio, Play, X } from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

/**
 * SmartDisconnectFallbackModal — Spotify Connect Smart Reconnect / Fallback Banner
 *
 * When the remote speaker (e.g. Laptop) is disconnected or closed unexpectedly:
 * 1. Keeps phone audio muted initially to avoid sudden loud blast.
 * 2. Displays proactive fallback card: "[Speaker] disconnected. Resume here on Phone?"
 * 3. User chooses [ Resume on this device ] to continue at exact same millisecond,
 *    or [ Dismiss ] to stay paused.
 */
export function SmartDisconnectFallbackModal() {
  const isFallbackPromptOpen = useConnectStore((s) => s.isFallbackPromptOpen);
  const fallbackPromptSession = useConnectStore((s) => s.fallbackPromptSession);
  const dismissFallbackPrompt = useConnectStore((s) => s.dismissFallbackPrompt);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const playSong = usePlayerStore((s) => s.playSong);
  const setSeekTarget = usePlayerStore((s) => s.setSeekTarget);

  if (!isFallbackPromptOpen || !fallbackPromptSession || !fallbackPromptSession.currentSong) {
    return null;
  }

  const speakerName = fallbackPromptSession.playbackDeviceName || 'Remote Speaker';
  const track = fallbackPromptSession.currentSong;

  const handleResumeLocally = async () => {
    try {
      const songToPlay: Song = {
        ...track,
        duration: track.duration || (fallbackPromptSession.durationMs ? fallbackPromptSession.durationMs / 1000 : 0),
      };

      playSong(songToPlay);

      const resumeSec = (fallbackPromptSession.positionMs || 0) / 1000;
      if (resumeSec > 1) {
        setTimeout(() => {
          setSeekTarget(resumeSec);
        }, 250);
      }
    } finally {
      dismissFallbackPrompt();
    }
  };

  return (
    <div
      className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-50 select-none flex items-center justify-between px-4 py-2 bg-[#0e0e12]/95 hover:bg-[#131318] backdrop-blur-2xl border border-amber-500/40 hover:border-amber-500/60 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.9),0_0_24px_rgba(245,158,11,0.2)] transition-all duration-300 max-w-[calc(100vw-2rem)] md:max-w-[680px] w-auto h-[46px] gap-3.5 -translate-x-1/2 animate-in slide-in-from-bottom-3 ${
        isQueueOpen
          ? 'left-1/2 md:left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
          : 'left-1/2 md:left-[calc(50%+8rem)]'
      }`}
    >
      {/* Device & Track Info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-shrink truncate">
        <div className="relative flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400">
          <Radio className="w-3.5 h-3.5" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold text-zinc-200 truncate">
            <span className="text-amber-400 font-bold">{speakerName}</span> disconnected
          </span>
          <span className="text-[10px] text-zinc-400 truncate max-w-[220px] sm:max-w-[280px]">
            Resume "{track.title}" here?
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleResumeLocally}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black text-[11px] font-bold shadow-md shadow-[#1db954]/20 transition-all cursor-pointer"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Resume Here</span>
        </button>

        <button
          onClick={dismissFallbackPrompt}
          title="Dismiss"
          className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
