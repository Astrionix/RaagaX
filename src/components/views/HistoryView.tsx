'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Clock, Play, Pause, Shuffle, Trash2, Heart, Search, Music, Disc, Sparkles
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { haptics } from '@/lib/haptics/HapticEngine';

export function HistoryView() {
  const {
    setActiveTab,
    playSong,
    currentSong,
    isPlaying,
    togglePlayPause,
    likedSongIds = [],
    toggleLikeSong,
    historySongIds = [],
    setToastMessage,
  } = usePlayerStore();

  const [historySongs, setHistorySongs] = useState<{ song: Song; playedAt?: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadHistory = async () => {
      try {
        const qh = QueueHistory.getInstance();
        await qh.ensureLoaded();
        const entries = qh.getRecentlyPlayed(100);

        if (!isCancelled) {
          if (entries && entries.length > 0) {
            const mapped = entries
              .map((e) => ({
                song: e.song,
                playedAt: e.startedAt,
              }))
              .filter((e) => Boolean(e.song && e.song.id));
            setHistorySongs(mapped);
          } else {
            setHistorySongs([]);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadHistory();
    return () => {
      isCancelled = true;
    };
  }, [historySongIds]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return historySongs;
    const q = searchQuery.toLowerCase();
    return historySongs.filter(
      (item) =>
        item.song.title.toLowerCase().includes(q) ||
        item.song.artist.toLowerCase().includes(q) ||
        (item.song.album && item.song.album.toLowerCase().includes(q))
    );
  }, [historySongs, searchQuery]);

  const handlePlayAll = (shuffle = false) => {
    if (filteredHistory.length === 0) return;
    const songs = filteredHistory.map((h) => h.song);
    const list = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
    playSong(list[0], list);
  };

  const handleClearHistory = () => {
    usePlayerStore.setState({ historySongIds: [] });
    setHistorySongs([]);
    setShowClearConfirm(false);
    setToastMessage('Listening history cleared');
  };

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Recently';
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${mins}:${remSec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-24 select-none pt-2 max-w-5xl mx-auto text-white animate-in fade-in duration-200">
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('home')}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" /> LISTENING LOGS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
              Listening History
            </h1>
            <p className="text-xs text-slate-400">
              {historySongs.length > 0
                ? `${historySongs.length} tracks recently played across your devices`
                : 'Your stream history will automatically show up here as you listen'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        {historySongs.length > 0 && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handlePlayAll(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-bold text-xs shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              <span>Play All</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
              title="Shuffle History"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2.5 rounded-full bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 border border-white/10 text-slate-400 transition-colors cursor-pointer"
              title="Clear History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── SEARCH FILTER ────────────────────────────────────────────────────── */}
      {historySongs.length > 0 && (
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recent songs or artists..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-medium"
          />
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-24 text-center text-slate-400 space-y-4 bg-white/[0.01] rounded-3xl border border-dashed border-white/10 max-w-md mx-auto p-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-white">
              {searchQuery ? 'No Matching Tracks Found' : 'No Listening History Yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'Try searching with a different song title or artist name.'
                : 'Play songs from Home, Search, or Discovery Hub to start building your personal listening log.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => setActiveTab('home')}
              className="px-6 py-2.5 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white font-black text-xs shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer"
            >
              Discover Music
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredHistory.map((item, idx) => {
            const song = item.song;
            const isPlayingCurrent = currentSong?.id === song.id;
            const isLiked = likedSongIds.includes(song.id);

            return (
              <div
                key={`${song.id}-${idx}`}
                onClick={() => playSong(song, filteredHistory.map(h => h.song))}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer group select-none ${
                  isPlayingCurrent
                    ? 'bg-[#fa233b]/15 border border-[#fa233b]/30 text-white shadow-lg shadow-red-500/10'
                    : 'bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-white/10'
                }`}
              >
                {/* Left: Index / Waveform + Cover + Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-6 text-center flex-shrink-0 flex items-center justify-center">
                    {isPlayingCurrent ? (
                      <div className="flex items-end gap-[2px] h-3.5">
                        <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-3.5`} />
                        <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-2`} style={{ animationDelay: '150ms' }} />
                        <span className={`w-1 bg-[#fa233b] rounded-full ${isPlaying ? 'animate-pulse' : ''} h-3`} style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <span className="text-xs font-mono font-bold text-slate-500 group-hover:hidden">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                    )}
                    <button className={`w-5 h-5 text-white items-center justify-center hidden ${!isPlayingCurrent ? 'group-hover:flex' : ''}`}>
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>

                  <img
                    src={song.coverUrl || '/app-icon.png'}
                    alt={song.title}
                    className="w-11 h-11 rounded-xl object-cover shadow-sm bg-slate-900 border border-white/10 flex-shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <h4 className={`text-xs sm:text-sm font-bold truncate leading-snug ${isPlayingCurrent ? 'text-[#fa233b]' : 'text-white'}`}>
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {song.artist} {song.album ? `• ${song.album}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Timestamp + Duration + Heart + Menu */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-semibold text-slate-400 hidden md:inline px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                    {formatRelativeTime(item.playedAt)}
                  </span>

                  <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                    {formatDuration(song.duration || 210)}
                  </span>

                  <button
                    onClick={() => {
                      haptics.lightImpact();
                      toggleLikeSong(song.id);
                    }}
                    className="p-1.5 rounded-full text-slate-400 hover:text-[#fa233b] hover:bg-white/5 transition-all"
                    title={isLiked ? 'Liked' : 'Like track'}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'text-[#fa233b] fill-current' : ''}`} />
                  </button>

                  <SongActionMenu song={song} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CLEAR HISTORY CONFIRMATION MODAL ─────────────────────────────────── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1c1d22] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Clear Listening History?</h3>
              <p className="text-xs text-slate-400">
                This will reset your recently played tracks log. Your liked songs and playlists will remain untouched.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="px-4 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-colors cursor-pointer"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
