'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, MoreVertical, Clock, ListPlus, SkipForward, Trash2, Disc3 } from 'lucide-react';
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

function fmt(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ── Three-dot context menu ──────────────────────────────────────────────────
function CardMenu({
  session,
  onClose,
  onRemove,
}: {
  session: ContinueListeningSession;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { addToQueue } = usePlayerStore();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const actions = [
    {
      label: 'Play Next',
      icon: <SkipForward className="w-3.5 h-3.5" />,
      action: () => { addToQueue(session.song); onClose(); },
    },
    {
      label: 'Add to Queue',
      icon: <ListPlus className="w-3.5 h-3.5" />,
      action: () => { addToQueue(session.song); onClose(); },
    },
    {
      label: 'Remove',
      icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
      action: () => { onRemove(session.id); onClose(); },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100 origin-bottom-right"
    >
      {actions.map(a => (
        <button
          key={a.label}
          role="menuitem"
          onClick={a.action}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors rounded-none hover:bg-[var(--bg-surface)] ${
            a.danger ? 'text-red-400' : 'text-[var(--text-primary)]'
          }`}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ── Single card ──────────────────────────────────────────────────────────────
function ContinueListeningCard({
  session,
  onRemove,
}: {
  session: ContinueListeningSession;
  onRemove: (id: string) => void;
}) {
  const { currentSong, isPlaying, playSong, togglePlayPause, seek } = usePlayerStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive  = currentSong?.id === session.song.id;
  const isPlaying_ = isActive && isPlaying;
  const pct = Math.min(100, Math.max(3, (session.currentTimeSec / (session.durationSec || 1)) * 100));

  const handleResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.lightImpact();
    if (isActive) {
      togglePlayPause();
    } else {
      await playSong(session.song);
      if (session.currentTimeSec > 3) {
        setTimeout(() => seek(session.currentTimeSec), 200);
      }
    }
  };

  return (
    <div
      onClick={handleResume}
      role="button"
      tabIndex={0}
      aria-label={`Resume ${session.song.title} by ${session.song.artist}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleResume(e as unknown as React.MouseEvent); } }}
      className={[
        'group relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer',
        'transition-all duration-200 ease-out',
        'border backdrop-blur-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-crimson)] focus-visible:ring-offset-1',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
        isPlaying_
          ? 'bg-[var(--bg-surface)] border-[var(--accent-crimson)]/50 shadow-sm shadow-rose-950/20'
          : 'bg-[var(--bg-surface)]/80 border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)]/40',
      ].join(' ')}
    >
      {/* ── Artwork ────────────────────────────────────────────── */}
      <div className="relative w-[52px] h-[52px] shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm group-hover:shadow-md transition-shadow duration-200">
        <OptimizedImage
          src={session.song.coverUrl}
          alt={session.song.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200 ease-out"
        />

        {/* Playing: animated equalizer bars */}
        {isPlaying_ && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-[3px]" aria-hidden>
            <span className="w-[3px] h-3   rounded-full bg-[var(--accent-crimson)] animate-[equalizerBar_0.8s_ease-in-out_infinite]" />
            <span className="w-[3px] h-5   rounded-full bg-[var(--accent-crimson)] animate-[equalizerBar_0.8s_ease-in-out_infinite_0.1s]" />
            <span className="w-[3px] h-2.5 rounded-full bg-[var(--accent-crimson)] animate-[equalizerBar_0.8s_ease-in-out_infinite_0.2s]" />
          </div>
        )}

        {/* Hover: play icon */}
        {!isPlaying_ && (
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200" aria-hidden>
            <Play className="w-4 h-4 text-white fill-current ml-0.5 drop-shadow" />
          </div>
        )}
      </div>

      {/* ── Meta ────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 flex flex-col gap-0.5 overflow-hidden">
        <p className={`text-[13px] font-semibold leading-tight truncate transition-colors ${
          isPlaying_ ? 'text-[var(--accent-crimson)]' : 'text-[var(--text-primary)]'
        }`}>
          {session.song.title}
        </p>
        <p className="text-[11px] text-[var(--text-secondary)] truncate font-medium leading-tight">
          {session.song.artist}
        </p>

        {/* Progress */}
        <div className="mt-1.5 space-y-1">
          <div
            className="w-full h-[3px] rounded-full bg-zinc-700/50 dark:bg-zinc-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(session.currentTimeSec)}
            aria-valuemax={Math.round(session.durationSec)}
            aria-label={`${fmt(session.currentTimeSec)} of ${fmt(session.durationSec)}`}
          >
            <div
              className="h-full rounded-full transition-all duration-200 ease-out group-hover:brightness-125"
              style={{
                width: `${pct}%`,
                background: isPlaying_
                  ? 'var(--accent-crimson)'
                  : 'color-mix(in srgb, var(--accent-crimson) 80%, transparent)',
              }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-tight">
            {fmt(session.currentTimeSec)} / {fmt(session.durationSec)}
          </p>
        </div>
      </div>

      {/* ── Resume button (visible on hover / when playing) ─────── */}
      <button
        onClick={handleResume}
        aria-label={isPlaying_ ? 'Pause' : 'Resume'}
        className={[
          'w-8 h-8 rounded-full bg-[var(--accent-crimson)] text-white',
          'flex items-center justify-center shrink-0',
          'transition-all duration-150 active:scale-90',
          isPlaying_ ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100',
        ].join(' ')}
      >
        {isPlaying_
          ? <Pause className="w-3.5 h-3.5 fill-current" />
          : <Play  className="w-3.5 h-3.5 fill-current ml-0.5" />
        }
      </button>

      {/* ── Three-dot menu ──────────────────────────────────────── */}
      <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
        <button
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <CardMenu
            session={session}
            onClose={() => setMenuOpen(false)}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] sm:text-base font-bold text-[var(--text-primary)] tracking-tight leading-none">
          <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden />
          Continue Listening
        </h2>
        <p className="mt-1 text-[11px] text-[var(--text-muted)] font-medium">
          Pick up right where you left off
        </p>
      </div>
      {count > 3 && (
        <button className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent-crimson)] transition-colors whitespace-nowrap focus-visible:underline">
          View all →
        </button>
      )}
    </div>
  );
}

// ── Main shelf ────────────────────────────────────────────────────────────────
export function ContinueListeningShelf({
  sessions: propSessions,
}: {
  sessions?: ContinueListeningSession[];
}) {
  const [sessions, setSessions] = useState<ContinueListeningSession[]>(() => {
    if (propSessions && propSessions.length > 0) return propSessions;
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('raagax_continue_listening');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Keep in sync when prop changes
  useEffect(() => {
    if (propSessions && propSessions.length > 0) setSessions(propSessions);
  }, [propSessions]);

  const handleRemove = (id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      try { localStorage.setItem('raagax_continue_listening', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  if (!sessions || sessions.length === 0) return null;

  return (
    <section
      id="continue-listening"
      aria-labelledby="cl-heading"
      className="pb-1"
    >
      <SectionHeader count={sessions.length} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {sessions.slice(0, 6).map(session => (
          <ContinueListeningCard
            key={session.id}
            session={session}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </section>
  );
}
