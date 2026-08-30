'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Check,
  Music,
  X,
  Loader2,
  Sparkles,
  Flame,
  ListMusic,
  Library,
} from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { Song } from '@/types/music';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { UnifiedSearchEngine } from '@/lib/search/UnifiedSearchEngine';

type TabType = 'trending' | 'queue' | 'downloads';

export function AddToJamModal() {
  const { session, isAddToJamModalOpen, toggleAddToJamModal, sendAddTrack } = useJamStore();
  const playerQueue = usePlayerStore((s) => s.queue);
  const downloadTasks = useDownloadStore((s) => s.tasks);

  const downloadedSongs = React.useMemo(
    () => Object.values(downloadTasks || {}).filter((t) => t.status === 'COMPLETED').map((t) => t.song),
    [downloadTasks]
  );

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [results, setResults] = useState<Song[]>([]);
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Fetch initial popular/trending songs on open
  useEffect(() => {
    if (!isAddToJamModalOpen) return;

    setQuery('');
    setAddedIds(new Set());

    let isMounted = true;
    setInitialLoading(true);

    UnifiedSearchEngine.getInstance()
      .search('trending')
      .then((res) => {
        if (isMounted && res.songs.length > 0) {
          setTrendingSongs(res.songs);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setInitialLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAddToJamModalOpen]);

  // Live search debounce with UnifiedSearchEngine
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const searchRes = await UnifiedSearchEngine.getInstance().search(trimmed);
        setResults(searchRes.songs || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleAddSong = useCallback(
    async (song: Song) => {
      setAddedIds((prev) => new Set(prev).add(song.id));
      await sendAddTrack(song);
    },
    [sendAddTrack]
  );

  const handleAddAll = useCallback(
    async (songsToAdd: Song[]) => {
      for (const song of songsToAdd) {
        if (!addedIds.has(song.id)) {
          setAddedIds((prev) => new Set(prev).add(song.id));
          await sendAddTrack(song);
        }
      }
    },
    [addedIds, sendAddTrack]
  );

  if (!isAddToJamModalOpen || !session) return null;

  // Determine current display list when query is empty
  const getTabSongs = (): Song[] => {
    switch (activeTab) {
      case 'trending':
        return trendingSongs;
      case 'queue':
        return playerQueue;
      case 'downloads':
        return downloadedSongs;
      default:
        return trendingSongs;
    }
  };

  const isSearching = Boolean(query.trim());
  const displayedSongs = isSearching ? results : getTabSongs();

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={() => toggleAddToJamModal(false)}
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md h-[85vh] max-h-[640px] bg-[#12131a]/95 border border-white/15 rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden text-white flex flex-col p-4 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FA233B]/15 text-[#FA233B] border border-[#FA233B]/25">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Add Songs to Jam</h3>
              <p className="text-[10px] text-zinc-400">Search millions of songs or choose from your library</p>
            </div>
          </div>
          <button
            onClick={() => toggleAddToJamModal(false)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative my-3 flex-shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, albums, or all songs..."
            autoFocus
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white/5 border border-white/10 focus:border-[#FA233B]/50 focus:bg-white/10 text-xs text-white placeholder:text-slate-500 outline-none transition-all"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 text-[#FA233B] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Category Tabs (shown when not searching) */}
        {!isSearching && (
          <div className="flex items-center gap-1.5 mb-3 flex-shrink-0">
            <button
              onClick={() => setActiveTab('trending')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'trending'
                  ? 'bg-[#FA233B] text-white shadow-md'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Trending</span>
            </button>

            {playerQueue.length > 0 && (
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'queue'
                    ? 'bg-[#FA233B] text-white shadow-md'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Current Queue ({playerQueue.length})</span>
              </button>
            )}

            {downloadedSongs.length > 0 && (
              <button
                onClick={() => setActiveTab('downloads')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'downloads'
                    ? 'bg-[#FA233B] text-white shadow-md'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>Downloaded ({downloadedSongs.length})</span>
              </button>
            )}

            {displayedSongs.length > 1 && (
              <button
                onClick={() => handleAddAll(displayedSongs)}
                className="ml-auto text-[11px] font-bold text-[#FA233B] hover:text-[#ff4d64] transition-colors cursor-pointer"
              >
                + Add All ({displayedSongs.length})
              </button>
            )}
          </div>
        )}

        {/* Songs List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {initialLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2 py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#FA233B]" />
              <p>Loading songs...</p>
            </div>
          ) : displayedSongs.length > 0 ? (
            displayedSongs.map((song) => {
              const isAdded = addedIds.has(song.id);
              return (
                <div
                  key={song.id}
                  className="p-2 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/5 flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-white/10">
                      <OptimizedImage
                        src={song.coverUrl}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        fallbackSrc="/app-icon.png"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-white truncate group-hover:text-[#FA233B] transition-colors">
                        {SongFormatter.cleanSongTitle(song.title)}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                        {SongFormatter.decodeHtml(song.artist) || song.artist || 'Unknown Artist'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddSong(song)}
                    disabled={isAdded}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isAdded
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#FA233B] hover:bg-[#ff3b53] text-white shadow-sm active:scale-95'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : isSearching ? (
            !loading && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 text-center py-10">
                <Music className="w-8 h-8 opacity-40" />
                <p>No songs found matching "{query}"</p>
                <p className="text-[11px] text-slate-600">Try searching for a song name, movie, or artist</p>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 text-center py-10">
              <Sparkles className="w-8 h-8 opacity-40 text-[#FA233B]" />
              <p>Search for songs above or select from your queue</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
