'use client';

import React, { useState } from 'react';
import { Play, Pause, MoreHorizontal, Clock, Heart, ListPlus } from 'lucide-react';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface ContinueListeningSession {
  id: string;
  song: Song;
  currentTimeSec: number;
  durationSec: number;
  lastPlayedAt: number;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function ContinueListeningShelf({
  sessions: initialSessions,
}: {
  sessions?: ContinueListeningSession[];
}) {
  const { currentSong, isPlaying, playSong, togglePlayPause, seek, toggleLikeSong, likedSongIds } = usePlayerStore();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [sessions] = useState<ContinueListeningSession[]>(() => {
    if (initialSessions && initialSessions.length > 0) return initialSessions;
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('raagax_continue_listening_sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const handleResume = async (session: ContinueListeningSession, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.lightImpact();

    const isCurrentTrack = currentSong?.id === session.id;

    if (isCurrentTrack) {
      togglePlayPause();
    } else {
      await playSong(session.song);
      if (session.currentTimeSec > 0) {
        setTimeout(() => {
          seek(session.currentTimeSec);
        }, 150);
      }
    }
  };

  if (!sessions || sessions.length === 0) {
    return null;
  }

  return (
    <section id="continue-listening" className="pt-1 pb-3 select-none">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {sessions.slice(0, 6).map((session) => {
          const isCurrentTrack = currentSong?.id === session.id;
          const isCurrentPlaying = isCurrentTrack && isPlaying;
          const progressPercent = Math.min(
            100,
            Math.max(4, (session.currentTimeSec / (session.durationSec || 1)) * 100)
          );
          const isLiked = session.song.id ? likedSongIds.includes(session.song.id) : false;

          return (
            <div
              key={session.id}
              onClick={(e) => handleResume(session, e)}
              className={`group relative flex items-center gap-3.5 p-2.5 rounded-xl backdrop-blur-md transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                isCurrentPlaying
                  ? 'bg-surface border border-crimson/50 shadow-rose-950/20'
                  : 'bg-surface/80 border border-subtle hover:bg-surface-hover hover:border-subtle'
              }`}
            >
              {/* Artwork Container */}
              <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm">
                <OptimizedImage
                  src={session.song.coverUrl}
                  alt={session.song.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Equalizer / Play indicator when playing */}
                {isCurrentPlaying ? (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-0.5">
                    <span className="w-0.5 h-3 bg-crimson animate-pulse" />
                    <span className="w-0.5 h-5 bg-crimson animate-pulse delay-75" />
                    <span className="w-0.5 h-2.5 bg-crimson animate-pulse delay-150" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                  </div>
                )}
              </div>

              {/* Title & Artist details */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate transition-colors ${
                  isCurrentPlaying ? 'text-crimson' : 'text-primary group-hover:text-primary'
                }`}>
                  {session.song.title}
                </p>
                <p className="text-xs text-secondary truncate mt-0.5 font-medium">
                  {session.song.artist}
                </p>

                {/* Progress bar & timestamp */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-tertiary font-mono">
                    <span>{formatTime(session.currentTimeSec)} / {formatTime(session.durationSec)}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-crimson rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Circular Resume / Play button */}
              <button
                onClick={(e) => handleResume(session, e)}
                className={`w-9 h-9 flex items-center justify-center rounded-full bg-crimson text-white shrink-0 mr-1 shadow transition active:scale-95 ${
                  isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                aria-label={isCurrentPlaying ? 'Pause' : 'Resume'}
              >
                {isCurrentPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
