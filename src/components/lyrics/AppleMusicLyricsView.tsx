'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useLyricsStore } from '@/context/useLyricsStore';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { haptics } from '@/lib/haptics/HapticEngine';
import { Loader2, Mic2, Sparkles } from 'lucide-react';

interface AppleMusicLyricsViewProps {
  className?: string;
  highlightColor?: string;
  fontSize?: 'compact' | 'regular' | 'large';
  noBlur?: boolean;
}

export default function AppleMusicLyricsView({
  className = '',
  highlightColor = '#FA233B',
  fontSize = 'regular',
  noBlur = false,
}: AppleMusicLyricsViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const seek = usePlayerStore((s) => s.seek);

  const lyricsStatus = useLyricsStore((s) => s.status);
  const lines = useLyricsStore((s) => s.lines);
  const currentLineIndex = useLyricsStore((s) => s.currentLineIndex);
  const scriptMode = useLyricsStore((s) => s.scriptMode);
  const userOffsetMs = useLyricsStore((s) => s.userOffsetMs);

  // 1. Authoritative: Load lyrics whenever current song changes
  useEffect(() => {
    if (currentSong?.id) {
      LyricsEngine.getInstance().loadTrack(currentSong.id, {
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
        durationMs: currentSong.duration ? currentSong.duration * 1000 : undefined,
      });
    }
  }, [currentSong?.id, currentSong?.title, currentSong?.artist]);

  // 2. High-precision hardware audio time sync loop (60 FPS)
  useEffect(() => {
    let animFrame: number;

    const getPinpointPositionMs = (): number => {
      try {
        const active = PlaybackService.getInstance().getActiveAudio();
        if (active && !isNaN(active.currentTime) && active.currentTime >= 0 && !active.seeking) {
          return active.currentTime * 1000;
        }
      } catch {}

      try {
        const engine = PlaybackEngine.getInstance();
        const ms = engine.getMediaPositionMs();
        if (ms > 0) return ms;
      } catch {}

      return LyricsEngine.getInstance().getEffectivePositionMs();
    };

    const loop = () => {
      const ms = getPinpointPositionMs();
      LyricsEngine.getInstance().evaluatePosition(ms);

      if (usePlayerStore.getState().isPlaying) {
        animFrame = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      animFrame = requestAnimationFrame(loop);
    } else {
      const ms = getPinpointPositionMs();
      LyricsEngine.getInstance().evaluatePosition(ms);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [isPlaying]);

  // 3. Apple Music Physics Auto-Scroll: Centers active line smoothly
  useEffect(() => {
    if (isUserScrollingRef.current || currentLineIndex < 0 || !lines || lines.length === 0) return;

    const activeEl = document.getElementById(`am-lyric-line-${currentLineIndex}`);
    if (activeEl && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetScrollTop =
        activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [currentLineIndex, lines]);

  // 4. Handle User Manual Scroll: Pause auto-scroll for 3.5s, then resume
  const handleScrollInteraction = useCallback(() => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 3500);
  }, []);

  // 5. Jump back to active line
  const handleResumeSync = useCallback(() => {
    isUserScrollingRef.current = false;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    if (currentLineIndex >= 0) {
      const activeEl = document.getElementById(`am-lyric-line-${currentLineIndex}`);
      if (activeEl && scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const targetScrollTop =
          activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }
  }, [currentLineIndex]);

  // Loading State
  if (lyricsStatus === 'loading' && (!lines || lines.length === 0)) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center py-20 text-white/60 gap-3 min-h-[300px] ${className}`}>
        <Loader2 className="w-8 h-8 text-[#FA233B] animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-white/70">
          Syncing Apple Music Lyrics...
        </p>
      </div>
    );
  }

  // Unavailable State
  if (lyricsStatus === 'unavailable' || (!lines || lines.length === 0)) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center py-20 text-center text-white/50 space-y-2 min-h-[300px] ${className}`}>
        <Mic2 className="w-10 h-10 text-white/20 mb-2 stroke-[1.2]" />
        <p className="text-base font-bold text-white">Lyrics unavailable</p>
        <p className="text-xs text-white/40 max-w-[280px]">
          No synchronized lyrics found for this track.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full flex flex-col select-none overflow-hidden ${className}`}>
      {/* ── Apple Music Synced Lyrics Viewport ── */}
      <div
        ref={scrollContainerRef}
        onWheel={handleScrollInteraction}
        onTouchMove={handleScrollInteraction}
        className="w-full h-full overflow-y-auto no-scrollbar py-24 sm:py-32 px-4 sm:px-8 space-y-7 sm:space-y-8 flex flex-col items-start"
      >
        {lines.map((line, idx) => {
          const isActive = idx === currentLineIndex;
          const isPassed = idx < currentLineIndex;

          const textToDisplay =
            scriptMode === 'transliteration' && line.romanizedText
              ? line.romanizedText
              : line.nativeText || line.text || '';

          return (
            <div
              key={line.id || idx}
              id={`am-lyric-line-${idx}`}
              onClick={() => {
                if (line.startMs !== undefined && line.startMs >= 0) {
                  seek(line.startMs / 1000);
                  LyricsEngine.getInstance().seek(line.startMs);
                  haptics.lightImpact();
                }
              }}
              style={{
                textShadow: isActive ? '0 0 8px rgba(255, 255, 255, 0.10)' : 'none',
                filter: 'none',
              }}
              className={`w-full text-left cursor-pointer transition-all duration-300 transform origin-left leading-snug sm:leading-relaxed filter-none ${
                isActive
                  ? fontSize === 'large'
                    ? 'text-3xl sm:text-4xl lg:text-[42px] font-bold text-white scale-[1.03] opacity-100 z-10'
                    : 'text-2xl sm:text-3xl lg:text-4xl font-bold text-white scale-[1.03] opacity-100 z-10'
                  : isPassed
                  ? fontSize === 'large'
                    ? 'text-xl sm:text-2xl lg:text-3xl font-normal text-[#808080] opacity-40 hover:text-white hover:opacity-100'
                    : 'text-lg sm:text-xl lg:text-2xl font-normal text-[#808080] opacity-40 hover:text-white hover:opacity-100'
                  : fontSize === 'large'
                  ? 'text-xl sm:text-2xl lg:text-3xl font-semibold text-[#D4D4D4] opacity-75 hover:text-white hover:opacity-100'
                  : 'text-lg sm:text-xl lg:text-2xl font-semibold text-[#D4D4D4] opacity-75 hover:text-white hover:opacity-100'
              }`}
            >
              {textToDisplay}
            </div>
          );
        })}
      </div>

      {/* Floating Sync to Current Button if user manually scrolled */}
      {isUserScrollingRef.current && currentLineIndex >= 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            onClick={handleResumeSync}
            className="px-4 py-2 rounded-full bg-black/85 backdrop-blur-xl border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Mic2 className="w-3.5 h-3.5 text-[#FA233B]" />
            <span>Sync to Current Line</span>
          </button>
        </div>
      )}
    </div>
  );
}
