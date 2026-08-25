'use client';

import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Flame,
  Play,
  Disc,
  Music,
  Calendar,
  Film,
  TrendingUp,
  User,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';
import { useNewReleases } from '@/lib/catalog/useNewReleases';

// ─────────────────────────────────────────────────────────────────────────────
// Language list
// ─────────────────────────────────────────────────────────────────────────────
const ALL_LANGUAGES = [
  'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'English', 'Punjabi',
  'Bhojpuri', 'Marathi', 'Gujarati', 'Bengali', 'Haryanvi'
];

// ─────────────────────────────────────────────────────────────────────────────
// Compact Song Row
// ─────────────────────────────────────────────────────────────────────────────
function SongRow({ song, queue, index }: { song: Song; queue: Song[]; index: number }) {
  const { playSong, currentSong, isPlaying } = usePlayerStore();
  const isCurrent = currentSong?.id === song.id;

  return (
    <div
      className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between group ${
        isCurrent
          ? 'bg-white/[0.08] border-[#FA233B]/40 shadow-lg'
          : 'bg-white/[0.025] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05]'
      }`}
    >
      <div
        onClick={() => { haptics.lightImpact(); playSong(song, queue, { type: 'new_releases', id: 'new', title: 'New Releases' }); }}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pr-3"
      >
        <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-800 border border-white/5">
          <OptimizedImage src={song.coverUrl} alt={song.title} size="thumb" className="w-full h-full object-cover" />
          {isCurrent && isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
              <span className="w-0.5 h-2 bg-[#FA233B] rounded-full animate-[pulse_0.4s_infinite_alternate]" />
              <span className="w-0.5 h-3 bg-white rounded-full animate-[pulse_0.5s_infinite_alternate_0.1s]" />
              <span className="w-0.5 h-1.5 bg-[#FA233B] rounded-full animate-[pulse_0.45s_infinite_alternate_0.2s]" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={`text-xs font-bold truncate transition-colors ${isCurrent ? 'text-[#FA233B]' : 'text-white group-hover:text-[#FA233B]'}`}>
            {song.title}
          </h4>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
        </div>
      </div>

      {/* Fixed Right-Side Action Column */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <DownloadStatusIndicator song={song} size="sm" />
        </div>
        <SongActionMenu song={song} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small Artwork Card (New This Week / Singles / EPs)
// ─────────────────────────────────────────────────────────────────────────────
function ArtworkCard({ song, queue, size = 'md' }: { song: Song; queue: Song[]; size?: 'sm' | 'md' }) {
  const { playSong } = usePlayerStore();
  const w = size === 'sm' ? 'w-28' : 'w-36';

  return (
    <div
      onClick={() => { haptics.lightImpact(); playSong(song, queue, { type: 'new_releases', id: 'new', title: 'New Releases' }); }}
      className={`${w} flex-shrink-0 cursor-pointer group`}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden mb-2 bg-slate-800 shadow-md border border-white/5">
        <OptimizedImage src={song.coverUrl} alt={song.title} size="card" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-md">
            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">{song.title}</h4>
      <p className="text-[10px] text-slate-400 truncate mt-0.5">{song.artist}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        {icon} {title}
      </h2>
      {action && onAction && (
        <button
          onClick={() => { haptics.lightImpact(); onAction(); }}
          className="text-xs font-bold text-[#FA233B] hover:underline cursor-pointer flex items-center gap-1"
        >
          {action} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main NewView
// ─────────────────────────────────────────────────────────────────────────────
export function NewView() {
  const {
    preferredLanguage = 'Telugu',
    setPreferredLanguage,
    playSong,
    setActiveTab,
    setSelectedAlbumId,
    setSelectedArtistId,
    setSelectedPlaylistId,
  } = usePlayerStore();

  const lang = preferredLanguage || 'Telugu';

  // ── Unified Single Source of Truth (Cache-First + Background Revalidation)
  const { songs: allSongs, isLoading, isRevalidating, refresh } = useNewReleases(lang, 50);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefresh = async () => {
    haptics.mediumImpact();
    setIsManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 500);
    }
  };

  const isDataLoading = isLoading && allSongs.length === 0;

  // ── Section slices — purely based on release order, no personalisation
  const featuredCards    = useMemo(() => allSongs.slice(0,  4),  [allSongs]);
  const bestNewSongs     = useMemo(() => allSongs.slice(4,  14), [allSongs]);
  const newThisWeek      = useMemo(() => allSongs.slice(14, 22), [allSongs]);
  const newAlbums        = useMemo(() => {
    const seen = new Map<string, Song>();
    allSongs.forEach((s) => { if (s.album && !seen.has(s.album)) seen.set(s.album, s); });
    return Array.from(seen.values()).slice(0, 8);
  }, [allSongs]);
  const newSingles       = useMemo(() => allSongs.slice(22, 30), [allSongs]);
  const newEPs           = useMemo(() => allSongs.slice(30, 36), [allSongs]);
  const newSoundtracks   = useMemo(() => allSongs.slice(36, 42), [allSongs]);
  const trendingNew      = useMemo(() =>
    [...allSongs].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 10),
    [allSongs]
  );
  const newArtists       = useMemo(() => {
    const seen = new Map<string, Song>();
    allSongs.forEach((s) => {
      if (s.artistId && s.artistId !== 'unknown' && !seen.has(s.artistId)) {
        seen.set(s.artistId, s);
      } else if (s.artist && !seen.has(`name:${s.artist}`)) {
        seen.set(`name:${s.artist}`, s);
      }
    });
    return Array.from(seen.values()).slice(0, 8);
  }, [allSongs]);

  const handlePlayAll = (shuffle = false) => {
    if (!allSongs.length) return;
    haptics.mediumImpact();
    if (shuffle) {
      usePlayerStore.getState().shufflePlay(allSongs, { contextType: 'NEW_RELEASES', title: `Latest ${lang} Releases` });
    } else {
      playSong(allSongs[0], allSongs, { type: 'new_releases', id: 'new', title: `Latest ${lang} Releases` });
    }
  };

  const SkeletonRow = () => (
    <div className="h-16 rounded-2xl bg-white/[0.025] border border-white/5 animate-pulse" />
  );

  return (
    <div className={`space-y-4 pb-8 text-white select-none transition-opacity duration-300 ${isManualRefreshing ? 'opacity-70 pointer-events-none' : 'opacity-100'} animate-in fade-in duration-200 max-w-5xl mx-auto`}>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. HEADER + LANGUAGE FILTER + REFRESH                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">New</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              What's actually been released — strictly <span className="text-white font-bold">{lang}</span>
            </p>
          </div>

          {/* Smooth Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isManualRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Refresh New Releases"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualRefreshing ? 'animate-spin text-[#FA233B]' : ''}`} />
            <span>{isManualRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Strict Language Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {ALL_LANGUAGES.map((l) => {
            const isSelected = lang.toLowerCase() === l.toLowerCase();
            return (
              <button
                key={l}
                onClick={() => { haptics.lightImpact(); setPreferredLanguage(l); }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#FA233B] text-white shadow-md shadow-[#FA233B]/25 scale-[1.04]'
                    : 'bg-white/[0.05] hover:bg-white/10 text-slate-400 hover:text-white border border-white/[0.07]'
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {allSongs.length === 0 && (
        <div className="space-y-6 pt-2 animate-in fade-in duration-200">
          <div className="flex gap-4 overflow-hidden pb-2">
            <div className="w-[280px] sm:w-[320px] h-52 rounded-3xl bg-white/[0.04] border border-white/5 animate-pulse flex-shrink-0" />
            <div className="w-[280px] sm:w-[320px] h-52 rounded-3xl bg-white/[0.04] border border-white/5 animate-pulse flex-shrink-0" />
          </div>

          <div className="space-y-3">
            <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <div key={k} className="h-16 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. FEATURED NEW MUSIC — Large editorial hero cards                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {featuredCards.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Sparkles className="w-3.5 h-3.5 text-[#FA233B]" />}
            title="Featured New Music"
            action="Play All"
            onAction={() => handlePlayAll(false)}
          />

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
            {featuredCards.map((item, idx) => (
              <div
                key={`featured-${item.id || 'card'}-${idx}`}
                onClick={() => { haptics.lightImpact(); playSong(item, allSongs, { type: 'new_releases', id: 'new', title: `${lang} New Releases` }); }}
                className="w-[280px] sm:w-[320px] flex-shrink-0 snap-start p-4 rounded-3xl bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent border border-white/10 shadow-xl hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-1.5 mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FA233B]/20 text-[#FA233B] border border-[#FA233B]/30 inline-block">
                    {idx === 0 ? 'Premiered Today' : idx === 1 ? 'New This Week' : 'Hot Release'}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white group-hover:text-[#FA233B] transition-colors truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{item.artist}</p>
                </div>

                <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                  <OptimizedImage src={item.coverUrl} alt={item.title} size="card" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-between p-3">
                    <span className="text-[10px] font-bold text-white/80 uppercase font-mono">{lang}</span>
                    <div className="w-8 h-8 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. BEST NEW SONGS — Latest releases, sorted by date                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-3">
        <SectionHeader
          icon={<Flame className="w-3.5 h-3.5 text-[#FA233B]" />}
          title={`Best New ${lang} Songs`}
          action="Play All"
          onAction={() => handlePlayAll(false)}
        />

        {isDataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {bestNewSongs.map((song, i) => (
              <SongRow key={`best-${song.id || 'song'}-${i}`} song={song} queue={allSongs} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. NEW THIS WEEK — Horizontal release cards                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {newThisWeek.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Calendar className="w-3.5 h-3.5 text-blue-400" />}
            title="New This Week"
          />
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {newThisWeek.map((song, idx) => (
              <ArtworkCard key={`week-${song.id || 'song'}-${idx}`} song={song} queue={allSongs} size="md" />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5. NEW ALBUMS — Grid sorted by release date                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {newAlbums.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Disc className="w-3.5 h-3.5 text-purple-400" />}
            title="New Albums"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {newAlbums.map((album, idx) => (
              <div
                key={`album-${album.albumId || album.id || 'album'}-${idx}`}
                onClick={() => {
                  haptics.lightImpact();
                  setSelectedAlbumId(album.albumId || album.id || album.album);
                }}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-slate-800 shadow-md">
                  <OptimizedImage src={album.coverUrl} alt={album.album || ''} size="card" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">{album.album}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{album.artist}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 6. NEW SINGLES — Small artwork cards                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {newSingles.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Music className="w-3.5 h-3.5 text-emerald-400" />}
            title="New Singles"
          />
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {newSingles.map((song, idx) => (
              <ArtworkCard key={`single-${song.id || 'song'}-${idx}`} song={song} queue={allSongs} size="sm" />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 7. NEW EPs                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {newEPs.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Disc className="w-3.5 h-3.5 text-sky-400" />}
            title="New EPs"
          />
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {newEPs.map((song, idx) => (
              <ArtworkCard key={`ep-${song.id || 'song'}-${idx}`} song={song} queue={allSongs} size="sm" />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 8. NEW SOUNDTRACKS & CINEMA SCORES                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {newSoundtracks.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Film className="w-3.5 h-3.5 text-amber-400" />}
            title="New Soundtracks"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {newSoundtracks.map((item, idx) => (
              <div
                key={`soundtrack-${item.id || 'track'}-${idx}`}
                onClick={() => { haptics.lightImpact(); playSong(item, allSongs, { type: 'new_releases', id: 'new', title: `${lang} New Releases` }); }}
                className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-slate-800 shadow-md">
                  <OptimizedImage src={item.coverUrl} alt={item.title} size="card" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">{item.title}</h4>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.artist}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 9. TRENDING NEW — Recently released songs gaining popularity           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {trendingNew.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<TrendingUp className="w-3.5 h-3.5 text-[#FA233B]" />}
            title={`Trending New ${lang} Music`}
            action="Shuffle"
            onAction={() => handlePlayAll(true)}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {trendingNew.map((song, i) => (
              <SongRow key={`trending-${song.id || 'song'}-${i}`} song={song} queue={trendingNew} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 10. NEW ARTISTS — Artists appearing recently in new releases           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {newArtists.length > 0 && (
        <section className="space-y-2">
          <SectionHeader
            icon={<User className="w-3.5 h-3.5 text-violet-400" />}
            title="New Artists"
          />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {newArtists.map((item, idx) => (
              <div
                key={`artist-${item.artistId || item.id || 'artist'}-${idx}`}
                onClick={() => {
                  haptics.lightImpact();
                  setSelectedArtistId(item.artistId || item.id || item.artist);
                }}
                className="w-20 flex-shrink-0 text-center cursor-pointer group"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden mb-1.5 border-2 border-white/10 group-hover:border-[#FA233B] transition-all shadow-md mx-auto">
                  <OptimizedImage src={item.coverUrl} alt={item.artist} size="thumb" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <h4 className="text-[11px] font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">{item.artist}</h4>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
