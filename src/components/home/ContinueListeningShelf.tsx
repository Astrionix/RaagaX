'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, MoreVertical, Clock, ListPlus, SkipForward, Trash2, Disc, User, PlusCircle } from 'lucide-react';
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

// ── Exact 6 required fallback sessions ──────────────────────────────────────
export const DEFAULT_CONTINUE_LISTENING_SESSIONS: ContinueListeningSession[] = [
  {
    id: 'cl-session-1',
    song: {
      id: 'cl-song-1',
      title: 'Mellaga',
      artist: 'Devi Sri Prasad, S.P. Charan, Sumangali',
      album: 'Varsham',
      coverUrl: 'https://c.saavncdn.com/568/Varsham-Telugu-2004-20230303173740-500x500.jpg',
      audioUrl: 'https://cdn.jiosaavn.com/preview/Mellaga.mp3',
      duration: 321,
    } as unknown as Song,
    currentTimeSec: 134, // 2:14
    durationSec: 321,    // 5:21
    lastPlayedAt: Date.now() - 3600000,
  },
  {
    id: 'cl-session-2',
    song: {
      id: 'cl-song-2',
      title: 'Gongoora Thota',
      artist: 'Pushpavanam Kuppusamy, Kalpana',
      album: 'Gongoora Thota',
      coverUrl: 'https://c.saavncdn.com/123/Gongoora-Thota-Telugu-2015-500x500.jpg',
      audioUrl: 'https://cdn.jiosaavn.com/preview/Gongoora.mp3',
      duration: 291,
    } as unknown as Song,
    currentTimeSec: 182, // 3:02
    durationSec: 291,    // 4:51
    lastPlayedAt: Date.now() - 7200000,
  },
  {
    id: 'cl-session-3',
    song: {
      id: 'cl-session-3',
      title: 'Varshamlo Vennella',
      artist: 'Sanjana Kalmane, Aditya RK',
      album: 'Varshamlo Vennella',
      coverUrl: 'https://c.saavncdn.com/456/Varshamlo-Vennella-Telugu-2022-500x500.jpg',
      audioUrl: 'https://cdn.jiosaavn.com/preview/Varshamlo.mp3',
      duration: 212,
    } as unknown as Song,
    currentTimeSec: 95,  // 1:35
    durationSec: 212,    // 3:32
    lastPlayedAt: Date.now() - 10800000,
  },
  {
    id: 'cl-session-4',
    song: {
      id: 'cl-song-4',
      title: 'Ee Amrutha Varsham',
      artist: 'Sree Kalyanarama, V.V. Prasanna, Abhi',
      album: 'Ee Amrutha Varsham',
      coverUrl: 'https://c.saavncdn.com/789/Ee-Amrutha-Varsham-Telugu-2021-500x500.jpg',
      audioUrl: 'https://cdn.jiosaavn.com/preview/EeAmrutha.mp3',
      duration: 284,
    } as unknown as Song,
    currentTimeSec: 210, // 3:30
    durationSec: 284,    // 4:44
    lastPlayedAt: Date.now() - 14400000,
  },
  {
    id: 'cl-session-5',
    song: {
      id: 'cl-session-5',
      title: 'Niluvaddham',
      artist: 'Karthik, Sumangali',
      album: 'Nuvvostanante Nenoddantana',
      coverUrl: 'https://c.saavncdn.com/321/Nuvvostanante-Nenoddantana-Telugu-2005-500x500.jpg',
      audioUrl: 'https://cdn.jiosaavn.com/preview/Niluvaddham.mp3',
      duration: 357,
    } as unknown as Song,
    currentTimeSec: 145, // 2:25
    durationSec: 357,    // 5:57
    lastPlayedAt: Date.now() - 18000000,
  },
  {
    id: 'cl-session-6',
    song: {
      id: 'cl-session-6',
      title: 'Mellaga Tellarindoi',
      artist: 'Anurag Kulkarni, Ramya Behara, Mohana Bhogaraju',
      album: 'Shatamanam Bhavati',
      coverUrl: 'https://c.saavncdn.com/654/Shatamanam-Bhavati-Telugu-2016-500x500.jpg',
      audioUrl: 'https://cdn.jiosaavn.com/preview/MellagaTellarindoi.mp3',
      duration: 252,
    } as unknown as Song,
    currentTimeSec: 60,  // 1:00
    durationSec: 252,    // 4:12
    lastPlayedAt: Date.now() - 21600000,
  },
];

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
      label: 'Add to Playlist',
      icon: <PlusCircle className="w-3.5 h-3.5" />,
      action: () => { onClose(); },
    },
    {
      label: 'View Album',
      icon: <Disc className="w-3.5 h-3.5" />,
      action: () => { onClose(); },
    },
    {
      label: 'View Artist',
      icon: <User className="w-3.5 h-3.5" />,
      action: () => { onClose(); },
    },
    {
      label: 'Remove from Continue Listening',
      icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />,
      action: () => { onRemove(session.id); onClose(); },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl py-1 text-xs animate-in fade-in zoom-in-95 duration-100 origin-top-right backdrop-blur-xl"
    >
      {actions.map(a => (
        <button
          key={a.label}
          role="menuitem"
          onClick={a.action}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface)] ${
            a.danger ? 'text-red-400' : 'text-[var(--text-primary)]'
          }`}
        >
          {a.icon}
          <span className="truncate">{a.label}</span>
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

  const isActive  = currentSong?.id === session.song.id || currentSong?.title === session.song.title;
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
        'group relative flex flex-col justify-between p-3 rounded-xl cursor-pointer select-none',
        'h-[116px] w-full',
        'transition-all duration-200 ease-out',
        'border backdrop-blur-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-crimson)] focus-visible:ring-offset-1',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25',
        isPlaying_
          ? 'bg-[var(--bg-surface)] border-[var(--accent-crimson)]/50 shadow-md shadow-rose-950/20'
          : 'bg-[var(--bg-surface)]/80 border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)]/40',
      ].join(' ')}
    >
      {/* Top Section: [ART] Song Title, Artist Name & 3-Dot Menu */}
      <div className="flex items-start gap-3 min-w-0">
        {/* Album Artwork */}
        <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm group-hover:shadow-md transition-shadow duration-200">
          <OptimizedImage
            src={session.song.coverUrl}
            alt={session.song.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200 ease-out"
          />

          {/* Equalizer bars when playing */}
          {isPlaying_ && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-[3px]" aria-hidden>
              <span className="w-[3px] h-3   rounded-full bg-[var(--accent-crimson)] animate-[equalizerBar_0.8s_ease-in-out_infinite]" />
              <span className="w-[3px] h-5   rounded-full bg-[var(--accent-crimson)] animate-[equalizerBar_0.8s_ease-in-out_infinite_0.1s]" />
              <span className="w-[3px] h-2.5 rounded-full bg-[var(--accent-crimson)] animate-[equalizerBar_0.8s_ease-in-out_infinite_0.2s]" />
            </div>
          )}
        </div>

        {/* Title & Artist details */}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className={`text-[13px] font-semibold leading-tight truncate transition-colors ${
            isPlaying_ ? 'text-[var(--accent-crimson)]' : 'text-[var(--text-primary)]'
          }`}>
            {session.song.title}
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] truncate font-medium mt-0.5 leading-tight">
            {session.song.artist}
          </p>
        </div>

        {/* Three-dot Context Menu (Top Right) */}
        <div className="relative shrink-0 -mt-0.5 -mr-1" onClick={e => e.stopPropagation()}>
          <button
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:opacity-100"
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

      {/* Bottom Section: Progress bar + Timestamp (Left) AND Circular Play Button (Right) */}
      <div className="flex items-center justify-between gap-3 mt-1.5">
        {/* Left Column: Progress Bar & Time */}
        <div className="flex-1 min-w-0 space-y-1">
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
                  : 'color-mix(in srgb, var(--accent-crimson) 85%, transparent)',
              }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-tight leading-none">
            {fmt(session.currentTimeSec)} / {fmt(session.durationSec)}
          </p>
        </div>

        {/* Right Column: Always Visible Circular Play/Resume Button */}
        <button
          onClick={handleResume}
          aria-label={isPlaying_ ? 'Pause' : 'Resume'}
          className={[
            'w-8 h-8 rounded-full bg-[var(--accent-crimson)] text-white',
            'flex items-center justify-center shrink-0 shadow-md',
            'hover:scale-105 active:scale-95 transition-all duration-200',
          ].join(' ')}
        >
          {isPlaying_
            ? <Pause className="w-3.5 h-3.5 fill-current" />
            : <Play  className="w-3.5 h-3.5 fill-current ml-0.5" />
          }
        </button>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <div>
        <h2 className="flex items-center gap-1.5 text-base sm:text-lg font-extrabold text-[var(--text-primary)] tracking-tight leading-none">
          <span>Continue Listening</span>
          <Clock className="w-4 h-4 text-[var(--text-secondary)] shrink-0 inline-block ml-0.5" aria-hidden />
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)] font-medium">
          Pick up right where you left off
        </p>
      </div>
      <button className="px-3 py-1 rounded-full text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-all shadow-sm cursor-pointer">
        View all →
      </button>
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
    if (propSessions && propSessions.length >= 6) return propSessions;
    return DEFAULT_CONTINUE_LISTENING_SESSIONS;
  });

  useEffect(() => {
    if (propSessions && propSessions.length >= 6) {
      setSessions(propSessions);
    } else {
      setSessions(DEFAULT_CONTINUE_LISTENING_SESSIONS);
    }
  }, [propSessions]);

  const handleRemove = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  if (!sessions || sessions.length === 0) return null;

  // Render EXACTLY 6 cards
  const displaySessions = sessions.slice(0, 6);

  return (
    <section
      id="continue-listening"
      aria-labelledby="cl-heading"
      className="pb-2 select-none"
    >
      <SectionHeader count={displaySessions.length} />

      {/* 3 columns x 2 rows on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5">
        {displaySessions.map(session => (
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
