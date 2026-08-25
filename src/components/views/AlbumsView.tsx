'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Play, Sparkles, Disc, Flame, Trophy, Layers, Search,
  Heart, Shuffle, Music, ChevronRight, X, User, Plus, Disc3,
  Check, Bookmark, ArrowRight, Loader2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';

export function AlbumsView() {
  const {
    preferredLanguage = 'Telugu',
    setPreferredLanguage,
    setSelectedAlbumId,
    playSong,
    favoriteAlbumIds = [],
    toggleFavoriteAlbum,
    playAlbumSequence,
    setRemoteState,
    setToastMessage,
    currentSong,
    isPlaying,
  } = usePlayerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'saved' | 'recent' | 'trending' | 'top'>('all');
  const [realAlbums, setRealAlbums] = useState<AlbumItem[]>([]);
  const [resolvedSavedAlbums, setResolvedSavedAlbums] = useState<AlbumItem[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Fetch albums for current language catalog
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCatalog(true);
    const initial = AlbumCatalogEngine.getAlbumsForLanguage(preferredLanguage);
    setRealAlbums(initial);

    AlbumCatalogEngine.fetchRealAlbumsForLanguage(preferredLanguage)
      .then((fetched) => {
        if (isMounted && fetched && fetched.length > 0) {
          setRealAlbums(fetched);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingCatalog(false);
      });

    return () => {
      isMounted = false;
    };
  }, [preferredLanguage]);

  // Dynamically resolve ALL saved albums in favoriteAlbumIds across languages/searches
  useEffect(() => {
    if (favoriteAlbumIds.length === 0) {
      setResolvedSavedAlbums([]);
      setIsLoadingSaved(false);
      return;
    }

    let isMounted = true;
    setIsLoadingSaved(true);

    const resolved: AlbumItem[] = [];
    const missingIds: string[] = [];

    for (const albumId of favoriteAlbumIds) {
      const known = AlbumCatalogEngine.getAlbumById(albumId, preferredLanguage);
      if (known) {
        resolved.push(known);
      } else {
        missingIds.push(albumId);
      }
    }

    if (missingIds.length === 0) {
      setResolvedSavedAlbums(resolved);
      setIsLoadingSaved(false);
      return;
    }

    Promise.all(
      missingIds.map(async (id) => {
        try {
          const { RealMusicEngine } = await import('@/lib/realMusicEngine');
          const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${id}`);
          if (details) {
            return {
              id,
              title: details.title,
              artist: details.songs?.[0]?.artist || 'Various Artists',
              artistId: `art-${id}`,
              coverUrl: details.coverUrl || '/app-icon.png',
              releaseDate: '2024-01-01',
              releaseYear: 2024,
              trackCount: details.songs?.length || 6,
              durationSec: (details.songs?.length || 6) * 210,
              language: preferredLanguage,
              albumType: 'soundtrack' as const,
              freshnessScore: 90,
              trendingScore: 90,
              topScore: 90,
              tracks: details.songs || [],
            };
          }
        } catch { }
        return null;
      })
    ).then((fetchedMissing) => {
      if (!isMounted) return;
      const valid: AlbumItem[] = [];
      for (const item of fetchedMissing) {
        if (item) valid.push(item);
      }
      setResolvedSavedAlbums([...resolved, ...valid]);
      setIsLoadingSaved(false);
    });

    return () => {
      isMounted = false;
    };
  }, [favoriteAlbumIds, preferredLanguage]);

  const { recentlyReleased, trending, popular } = useMemo(() => {
    return AlbumCatalogEngine.getThreeCategorizedShelves(preferredLanguage);
  }, [preferredLanguage]);

  const allCatalogAlbums = useMemo(() => {
    const combined = [...resolvedSavedAlbums, ...realAlbums, ...recentlyReleased, ...trending, ...popular];
    const map = new Map<string, AlbumItem>();
    combined.forEach((a) => {
      if (a && a.id && !map.has(a.id)) {
        map.set(a.id, a);
      }
    });
    return Array.from(map.values());
  }, [resolvedSavedAlbums, realAlbums, recentlyReleased, trending, popular]);

  // Filtered by Search Query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allCatalogAlbums.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.artist.toLowerCase().includes(q) ||
        a.releaseYear?.toString().includes(q)
    );
  }, [allCatalogAlbums, searchQuery]);

  const handlePlayAlbum = async (album: AlbumItem, shuffle: boolean = false) => {
    haptics.mediumImpact();
    let tracks = album.tracks;
    if (!tracks || tracks.length === 0) {
      const { RealMusicEngine } = await import('@/lib/realMusicEngine');
      const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${album.id}`);
      tracks = details?.songs || [];
    }
    if (tracks.length > 0) {
      if (shuffle) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        setRemoteState({ shuffleMode: 'STANDARD' });
        playSong(shuffled[0], shuffled, {
          contextType: 'ALBUM',
          contextUri: `raagax:album:${album.id}`,
          title: album.title,
        });
        setToastMessage(`Shuffling album "${album.title}"`);
      } else {
        setRemoteState({ shuffleMode: 'OFF' });
        playSong(tracks[0], tracks, {
          contextType: 'ALBUM',
          contextUri: `raagax:album:${album.id}`,
          title: album.title,
        });
        setToastMessage(`Playing album "${album.title}"`);
      }
    } else {
      await playAlbumSequence([album.id]);
    }
  };

  const handleToggleSave = (album: AlbumItem) => {
    haptics.mediumImpact();
    const isSaved = favoriteAlbumIds.includes(album.id);
    toggleFavoriteAlbum(album.id);
    setToastMessage(isSaved ? `Removed "${album.title}" from Library` : `Saved "${album.title}" to Library (Albums)`);
  };

  const handleClearAllSaved = () => {
    haptics.mediumImpact();
    usePlayerStore.setState({ favoriteAlbumIds: [] });
    setResolvedSavedAlbums([]);
    setToastMessage('Cleared all saved albums');
  };

  const handleOpenAlbum = (album: AlbumItem) => {
    haptics.lightImpact();
    setSelectedAlbumId(album.id);
  };

  return (
    <div className="space-y-8 pb-32 select-none animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── HEADER BANNER: 💿 YOUR ALBUM LIBRARY ────────────────────────────── */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#1c0a1a] via-[#101322] to-[#07090e] p-6 sm:p-8 border border-purple-500/20 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
            <Disc className="w-3.5 h-3.5" /> Your Personal Library
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                💿 Albums
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed mt-1">
                Your saved studio albums, soundtrack collections, and multi-track regional releases.
              </p>
            </div>

            {resolvedSavedAlbums.length > 0 && (
              <button
                onClick={() => handlePlayAlbum(resolvedSavedAlbums[0], false)}
                className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-2 shadow-xl shadow-purple-600/25 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Play Saved Albums ({resolvedSavedAlbums.length})</span>
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative max-w-md pt-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 mt-1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search saved albums, soundtracks, artists...`}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/10 text-xs sm:text-sm text-white placeholder:text-slate-400 border border-white/15 focus:border-purple-500 focus:bg-black/60 focus:outline-none transition-all shadow-inner font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 mt-1 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER TABS ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        {/* Clean Mode Switcher: Saved Albums vs Explore */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              haptics.lightImpact();
              setActiveFilterTab('saved');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilterTab === 'saved'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/25 border border-purple-500/40'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            💿 Your Saved ({resolvedSavedAlbums.length})
          </button>

          <button
            onClick={() => {
              haptics.lightImpact();
              setActiveFilterTab('all');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilterTab === 'all'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/25 border border-purple-500/40'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Explore
          </button>
        </div>

        {/* User's Preferred Language Indicator */}
        <span className="text-xs font-bold text-slate-400">
          <span className="text-white font-black">{preferredLanguage}</span> Albums
        </span>
      </div>

      {/* ── SEARCH RESULTS (If user is filtering/searching) ─────────────────── */}
      {searchQuery.trim() ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Search Results for "{searchQuery}"
            </h3>
            <span className="text-xs font-mono text-slate-400">{searchResults.length} albums found</span>
          </div>

          {searchResults.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2 bg-white/[0.02] rounded-3xl border border-white/10 p-8">
              <Disc className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No Albums Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Try searching with a different movie title or music director.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {searchResults.map((album) => (
                <AlbumCard
                  key={`search-alb-${album.id}`}
                  album={album}
                  isSaved={favoriteAlbumIds.includes(album.id)}
                  onOpen={() => handleOpenAlbum(album)}
                  onPlay={(shuffle) => handlePlayAlbum(album, shuffle)}
                  onToggleSave={() => handleToggleSave(album)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── DEDICATED LIBRARY ALBUMS VIEW ────────────────────────────────────── */
        <div className="space-y-10">
          {/* SECTION 1: YOUR SAVED ALBUMS */}
          {((activeFilterTab === 'saved') || (activeFilterTab === 'all' && resolvedSavedAlbums.length > 0)) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2.5">
                  <Bookmark className="w-4 h-4 text-purple-400 fill-purple-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-purple-300">
                    Your Saved Albums ({resolvedSavedAlbums.length})
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {resolvedSavedAlbums.length > 0 && activeFilterTab === 'saved' && (
                    <button
                      onClick={handleClearAllSaved}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Remove all albums from saved collection"
                    >
                      <span>Clear All</span>
                    </button>
                  )}
                  {resolvedSavedAlbums.length > 0 && activeFilterTab !== 'saved' && (
                    <button
                      onClick={() => setActiveFilterTab('saved')}
                      className="text-xs font-bold text-slate-400 hover:text-purple-400 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All Saved</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {isLoadingSaved ? (
                <div className="py-16 text-center text-slate-400 space-y-3 flex flex-col items-center">
                  <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
                  <p className="text-xs font-bold">Loading your saved albums...</p>
                </div>
              ) : resolvedSavedAlbums.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3 bg-white/[0.02] rounded-3xl border border-white/10 p-8">
                  <Disc className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-base font-bold text-white">No Saved Albums in Library</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Browse albums below and tap <span className="text-purple-300 font-bold">＋ Save</span> or the bookmark icon on any album page to build your collection.
                  </p>
                  <button
                    onClick={() => setActiveFilterTab('all')}
                    className="mt-2 px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    Explore All Albums →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {resolvedSavedAlbums.map((album) => (
                    <AlbumCard
                      key={`saved-alb-${album.id}`}
                      album={album}
                      isSaved={true}
                      onOpen={() => handleOpenAlbum(album)}
                      onPlay={(shuffle) => handlePlayAlbum(album, shuffle)}
                      onToggleSave={() => handleToggleSave(album)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: TRENDING SOUNDTRACKS */}
          {(activeFilterTab === 'all' || activeFilterTab === 'trending') && trending.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Flame className="w-4 h-4" /> Trending Soundtracks
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {trending.map((album) => (
                  <AlbumCard
                    key={`trend-alb-${album.id}`}
                    album={album}
                    isSaved={favoriteAlbumIds.includes(album.id)}
                    onOpen={() => handleOpenAlbum(album)}
                    onPlay={(shuffle) => handlePlayAlbum(album, shuffle)}
                    onToggleSave={() => handleToggleSave(album)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: ALL-TIME POPULAR & CLASSICS */}
          {(activeFilterTab === 'all' || activeFilterTab === 'top') && popular.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> All-Time Popular & Classic Soundtracks
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {popular.map((album) => (
                  <AlbumCard
                    key={`pop-alb-${album.id}`}
                    album={album}
                    isSaved={favoriteAlbumIds.includes(album.id)}
                    onOpen={() => handleOpenAlbum(album)}
                    onPlay={(shuffle) => handlePlayAlbum(album, shuffle)}
                    onToggleSave={() => handleToggleSave(album)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ALBUM CARD COMPONENT ────────────────────────────────────────────────────
interface AlbumCardProps {
  album: AlbumItem;
  isSaved: boolean;
  onOpen: () => void;
  onPlay: (shuffle: boolean) => void;
  onToggleSave: () => void;
}

function AlbumCard({ album, isSaved, onOpen, onPlay, onToggleSave }: AlbumCardProps) {
  return (
    <div
      onClick={onOpen}
      className="p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-purple-500/30 transition-all cursor-pointer group space-y-2.5 hover:scale-[1.02] shadow-sm relative flex flex-col justify-between"
    >
      {/* Album Cover & Hover Quick Actions */}
      <div className="w-full aspect-square rounded-xl overflow-hidden shadow-[0_8px_25px_rgba(0,0,0,0.5)] relative bg-black/60 border border-white/10 group-hover:border-purple-500/40 transition-colors">
        <OptimizedImage
          src={album.coverUrl}
          alt={album.title}
          size="card"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Vinyl / CD Spine Inner Highlight */}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-xl pointer-events-none" />

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(false);
            }}
            className="w-10 h-10 rounded-full bg-[#fa233b] hover:bg-[#d91c2e] text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95 hover:scale-110 cursor-pointer"
            title="Play Album"
          >
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(true);
            }}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 hover:scale-110 cursor-pointer"
            title="Shuffle Album"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* In Library Badge */}
        {isSaved && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-600/90 backdrop-blur-md text-[9px] font-black text-white flex items-center gap-1 shadow">
            <Check className="w-3 h-3 stroke-[3]" /> Saved
          </span>
        )}

        {/* Track Count Badge */}
        {album.trackCount && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] font-mono font-bold text-slate-300">
            {album.trackCount} Tracks
          </span>
        )}
      </div>

      {/* Album Metadata & Add to Library / Favorite Toggle */}
      <div className="flex items-start justify-between gap-1.5 pt-1">
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-400 transition-colors">
            {album.title}
          </h4>
          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
            {album.artist}
          </p>
          <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-0.5">
            {album.releaseYear && <span>{album.releaseYear}</span>}
            {album.releaseYear && <span>•</span>}
            <span>Album</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          className={`p-1.5 rounded-full transition-all active:scale-125 cursor-pointer ${
            isSaved
              ? 'text-purple-400 bg-purple-500/15'
              : 'text-slate-400 hover:text-purple-400 hover:bg-white/10'
          }`}
          title={isSaved ? "Remove from Library" : "Add to Library"}
        >
          {isSaved ? (
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
