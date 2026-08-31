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
  Heart,
  FolderHeart,
  ChevronDown,
  ChevronUp,
  Disc,
} from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore, UserPlaylist } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { Song } from '@/types/music';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { UnifiedSearchEngine } from '@/lib/search/UnifiedSearchEngine';

type TabType = 'trending' | 'liked' | 'playlists' | 'queue' | 'downloads';

export function AddToJamModal() {
  const { session, isAddToJamModalOpen, toggleAddToJamModal, sendAddTrack, sendAddTracks } = useJamStore();
  const playerQueue = usePlayerStore((s) => s.queue);
  const likedSongs = usePlayerStore((s) => s.likedSongs || []);
  const playlists = usePlaylistStore((s) => s.playlists || []);
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
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);

  // Fetch initial popular/trending songs on open
  useEffect(() => {
    if (!isAddToJamModalOpen) return;

    setQuery('');
    setAddedIds(new Set());
    setExpandedPlaylistId(null);

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
      usePlayerStore.getState().setToastMessage(`Added "${song.title}" to Jam Queue`);
    },
    [sendAddTrack]
  );

  const handleAddAll = useCallback(
    async (songsToAdd: Song[], contextName?: string) => {
      if (!songsToAdd || songsToAdd.length === 0) return;
      
      const unadded = songsToAdd.filter((s) => !addedIds.has(s.id));
      if (unadded.length === 0) {
        usePlayerStore.getState().setToastMessage('All songs are already in Jam Queue');
        return;
      }

      setAddedIds((prev) => {
        const next = new Set(prev);
        unadded.forEach((s) => next.add(s.id));
        return next;
      });

      await sendAddTracks(unadded, false);
      const name = contextName ? `from "${contextName}" ` : '';
      usePlayerStore.getState().setToastMessage(`Added ${unadded.length} songs ${name}to Jam Queue`);
    },
    [addedIds, sendAddTracks]
  );

  if (!isAddToJamModalOpen || !session) return null;

  // Determine current display list when query is empty
  const getTabSongs = (): Song[] => {
    switch (activeTab) {
      case 'trending':
        return trendingSongs;
      case 'liked':
        return likedSongs;
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
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md h-[88vh] max-h-[660px] bg-[#0A0B10]/95 border border-white/15 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.9)] overflow-hidden text-white flex flex-col p-5 animate-in zoom-in-95 duration-200">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-[#FA233B]/15 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FA233B] to-rose-500 flex items-center justify-center text-white shadow-[0_4px_16px_rgba(250,35,59,0.35)]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Add Songs to Jam</h3>
              <p className="text-xs text-slate-400">Search tracks, liked songs, albums & playlists</p>
            </div>
          </div>
          <button
            onClick={() => toggleAddToJamModal(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
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
          <div className="flex items-center gap-1 mb-3 flex-shrink-0 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setActiveTab('trending')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'trending'
                  ? 'bg-[#FA233B] text-white shadow-md'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Trending</span>
            </button>

            <button
              onClick={() => setActiveTab('liked')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'liked'
                  ? 'bg-[#FA233B] text-white shadow-md'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Liked ({likedSongs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('playlists')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'playlists'
                  ? 'bg-[#FA233B] text-white shadow-md'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <FolderHeart className="w-3.5 h-3.5" />
              <span>Playlists ({playlists.length})</span>
            </button>

            {playerQueue.length > 0 && (
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'queue'
                    ? 'bg-[#FA233B] text-white shadow-md'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Queue ({playerQueue.length})</span>
              </button>
            )}

            {downloadedSongs.length > 0 && (
              <button
                onClick={() => setActiveTab('downloads')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'downloads'
                    ? 'bg-[#FA233B] text-white shadow-md'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Library className="w-3.5 h-3.5" />
                <span>Downloads ({downloadedSongs.length})</span>
              </button>
            )}
          </div>
        )}

        {/* Header summary + Add All button */}
        {!isSearching && activeTab !== 'playlists' && displayedSongs.length > 1 && (
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-white/5 flex-shrink-0">
            <span className="text-[11px] text-slate-400 font-medium">
              Showing {displayedSongs.length} tracks
            </span>
            <button
              onClick={() => handleAddAll(displayedSongs, activeTab === 'liked' ? 'Liked Songs' : undefined)}
              className="text-xs font-black text-[#FA233B] hover:text-[#ff4d64] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add All ({displayedSongs.length})</span>
            </button>
          </div>
        )}

        {isSearching && displayedSongs.length > 1 && (
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-white/5 flex-shrink-0">
            <span className="text-[11px] text-slate-400 font-medium">
              Found {displayedSongs.length} search results
            </span>
            <button
              onClick={() => handleAddAll(displayedSongs, query)}
              className="text-xs font-black text-[#FA233B] hover:text-[#ff4d64] transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add All Results ({displayedSongs.length})</span>
            </button>
          </div>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {initialLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2 py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#FA233B]" />
              <p>Loading songs...</p>
            </div>
          ) : !isSearching && activeTab === 'playlists' ? (
            /* Playlists Tab View */
            playlists.length > 0 ? (
              <div className="space-y-2.5">
                {playlists.map((pl) => {
                  const isExpanded = expandedPlaylistId === pl.id;
                  const plSongs = pl.songs || [];
                  return (
                    <div
                      key={pl.id}
                      className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden transition-all"
                    >
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          onClick={() => setExpandedPlaylistId(isExpanded ? null : pl.id)}
                        >
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-white/5 border border-white/10 flex items-center justify-center">
                            {pl.coverUrl ? (
                              <OptimizedImage
                                src={pl.coverUrl}
                                alt={pl.title}
                                className="w-full h-full object-cover"
                                fallbackSrc="/app-icon.png"
                              />
                            ) : (
                              <Disc className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-white truncate">{pl.title}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              {plSongs.length} {plSongs.length === 1 ? 'track' : 'tracks'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {plSongs.length > 0 && (
                            <button
                              onClick={() => handleAddAll(plSongs, pl.title)}
                              className="px-3 py-1.5 rounded-xl bg-[#FA233B] hover:bg-[#ff3b53] text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
                              title="Add entire playlist to Jam queue"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Playlist</span>
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedPlaylistId(isExpanded ? null : pl.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse tracks' : 'View tracks'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded tracks inside playlist */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-1.5 bg-black/20">
                          {plSongs.length > 0 ? (
                            plSongs.map((song) => {
                              const isAdded = addedIds.has(song.id);
                              return (
                                <div
                                  key={song.id}
                                  className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] flex items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                                      <OptimizedImage
                                        src={song.coverUrl}
                                        alt={song.title}
                                        className="w-full h-full object-cover"
                                        fallbackSrc="/app-icon.png"
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h5 className="font-bold text-xs text-white truncate">
                                        {SongFormatter.cleanSongTitle(song.title)}
                                      </h5>
                                      <p className="text-[9px] text-slate-400 truncate">
                                        {SongFormatter.decodeHtml(song.artist) || song.artist}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleAddSong(song)}
                                    disabled={isAdded}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                      isAdded
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-[#FA233B] hover:bg-[#ff3b53] text-white shadow-sm active:scale-95'
                                    }`}
                                  >
                                    {isAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    <span>{isAdded ? 'Added' : 'Add'}</span>
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-[10px] text-slate-500 py-2 text-center">Playlist is empty</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 text-center py-10">
                <FolderHeart className="w-8 h-8 opacity-40 text-[#FA233B]" />
                <p>No playlists found in your library</p>
                <p className="text-[11px] text-slate-600">Create playlists in your library to quickly add them here</p>
              </div>
            )
          ) : displayedSongs.length > 0 ? (
            displayedSongs.map((song) => {
              const isAdded = addedIds.has(song.id);
              return (
                <div
                  key={song.id}
                  className="p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between transition-all group"
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
                <p className="text-[11px] text-slate-600">Try searching for a song name, album, or artist</p>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 text-center py-10">
              <Sparkles className="w-8 h-8 opacity-40 text-[#FA233B]" />
              <p>No tracks in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
