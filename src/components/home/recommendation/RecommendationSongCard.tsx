'use client';

import React, { useState, useRef } from 'react';
import { Play, MoreHorizontal } from 'lucide-react';
import { RecommendationResult, FeedbackSignal } from '@/types/recommendation';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { RecommendationSongMenu } from './RecommendationSongMenu';

interface RecommendationSongCardProps {
  result: RecommendationResult;
  isCurrentlyPlaying: boolean;
  isPlaying: boolean;
  onPlay: (result: RecommendationResult) => void;
  onFeedback: (signal: FeedbackSignal, result: RecommendationResult) => void;
  /** Animated slide-out when "Not Interested" is selected */
  isRemoving?: boolean;
}

export function RecommendationSongCard({
  result,
  isCurrentlyPlaying,
  isPlaying,
  onPlay,
  onFeedback,
  isRemoving = false,
}: RecommendationSongCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const handleCardClick = (e: React.MouseEvent) => {
    // Ignore clicks that bubble from the three-dot button or menu
    if ((e.target as HTMLElement).closest('[data-rec-menu]')) return;
    onPlay(result);
  };

  const handleQuickPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(result);
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moreButtonRef.current) {
      setMenuAnchor(moreButtonRef.current.getBoundingClientRect());
    }
    setMenuOpen((v) => !v);
  };

  const formatDuration = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={[
          'group relative flex-shrink-0 w-[140px] sm:w-[164px] cursor-pointer',
          'rounded-2xl p-2.5 sm:p-3',
          'transition-all duration-300',
          // Hover: float + border glow
          'hover:-translate-y-1 hover:scale-[1.02]',
          // Currently playing: persistent crimson tint
          isCurrentlyPlaying
            ? 'bg-[#E50914]/12 border border-[#E50914]/40 shadow-[0_0_20px_rgba(229,9,20,0.25)]'
            : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] hover:border-[#E50914]/30 hover:shadow-[0_8px_24px_rgba(229,9,20,0.15)]',
          // Slide-out animation when "Not Interested"
          isRemoving ? 'opacity-0 scale-95 translate-x-4 pointer-events-none' : 'opacity-100',
        ].join(' ')}
        style={{ transition: isRemoving ? 'all 0.35s ease' : undefined }}
      >
        {/* ── Artwork ─────────────────────────────────────────────────────── */}
        <div className="relative w-full aspect-square mb-2.5 rounded-xl overflow-hidden bg-slate-800/80 shadow-[0_6px_20px_rgba(0,0,0,0.2)]">
          <OptimizedImage
            src={result.artwork}
            alt={result.title}
            size="card"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Currently-playing animated EQ indicator */}
          {isCurrentlyPlaying && (
            <div className="absolute top-2 left-2 flex items-end gap-[2px] h-4">
              {isPlaying ? (
                <>
                  <div className="w-[3px] bg-[#E50914] rounded-full animate-eq-1" style={{ height: '100%' }} />
                  <div className="w-[3px] bg-[#E50914] rounded-full animate-eq-2" style={{ height: '75%' }} />
                  <div className="w-[3px] bg-[#E50914] rounded-full animate-eq-3" style={{ height: '55%' }} />
                  <div className="w-[3px] bg-[#E50914] rounded-full animate-eq-4" style={{ height: '85%' }} />
                </>
              ) : (
                <div className="flex items-end gap-[2px] h-4">
                  <div className="w-[3px] h-[8px] bg-[#E50914] rounded-full" />
                  <div className="w-[3px] h-[12px] bg-[#E50914] rounded-full" />
                  <div className="w-[3px] h-[6px] bg-[#E50914] rounded-full" />
                  <div className="w-[3px] h-[10px] bg-[#E50914] rounded-full" />
                </div>
              )}
            </div>
          )}

          {/* Hover play button */}
          <button
            onClick={handleQuickPlay}
            className="absolute bottom-2 right-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E50914] hover:bg-[#FF1E27] text-white flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 active:scale-90"
            aria-label={`Play ${result.title}`}
          >
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </button>
        </div>

        {/* ── Text info ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-1 min-w-0">
          <div className="min-w-0 flex-1">
            <h3
              className={`font-bold text-[12px] sm:text-[13px] truncate leading-tight transition-colors ${
                isCurrentlyPlaying ? 'text-[#E50914]' : 'text-[var(--text-primary)] group-hover:text-[#FF1E27]'
              }`}
            >
              {result.title}
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate font-medium leading-tight">
              {result.artist}
            </p>
          </div>

          {/* Three-dot more button */}
          <button
            ref={moreButtonRef}
            onClick={handleMoreClick}
            className="flex-shrink-0 p-1 -mr-0.5 -mt-0.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
            aria-label="More options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Language badge + duration ────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-1.5 min-w-0">
          {result.language ? (
            <span className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 py-0.5 uppercase tracking-wide truncate max-w-[80px]">
              {result.language}
            </span>
          ) : <span />}
          {result.duration > 0 && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono tabular-nums flex-shrink-0">
              {formatDuration(result.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Three-dot context menu — rendered via portal */}
      <RecommendationSongMenu
        song={result.rawSong}
        isOpen={menuOpen}
        anchorRect={menuAnchor}
        onClose={() => setMenuOpen(false)}
        onFeedback={(signal, song) => {
          onFeedback(signal, result);
          setMenuOpen(false);
        }}
      />
    </>
  );
}
