'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Play, Search, Disc, Bookmark, ArrowUpDown, X, LayoutGrid, Grid2X2,
  ListFilter, Sparkles, Check, Plus
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { haptics } from '@/lib/haptics/HapticEngine';
import { NavigationStack } from '@/lib/navigation/NavigationStack';

type SortOption = 'recent_added' | 'year' | 'az' | 'za' | 'popular';
type FilterTab = 'all' | 'saved' | 'recent' | 'trending' | 'popular';
type ViewMode = 'grid' | 'compact';

const ALL_LANGUAGES = [
  'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'English',
  'Punjabi', 'Bhojpuri', 'Marathi', 'Gujarati', 'Bengali', 'Haryanvi'
];

export function AlbumsView() {
  const {
    preferredLanguage = 'Telugu',
    setPreferredLanguage,
    setSelectedAlbumId,
    playSong,
    favoriteAlbumIds = [],
    toggleFavoriteAlbum,
    setRemoteState,
    setToastMessage,
    currentSong,
    isPlaying,
  } = usePlayerStore();

  const lang = preferredLanguage || 'Telugu';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent_added');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Synchronous cache-first state
  const [catalogAlbums, setCatalogAlbums] = useState<AlbumItem[]>(() =>
    AlbumCatalogEngine.getAlbumsForLanguage(lang)
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => catalogAlbums.length === 0);
  const [resolvedSavedAlbums, setResolvedSavedAlbums] = useState<AlbumItem[]>([]);

  // 1. Load catalog albums for language (Cache-First + Background Revalidation)
  useEffect(() => {
    let isMounted = true;
    const initial = AlbumCatalogEngine.getAlbumsForLanguage(lang);
    if (initial && initial.length > 0) {
      setCatalogAlbums(initial);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    AlbumCatalogEngine.fetchRealAlbumsForLanguage(lang)
      .then((fetched) => {
        if (isMounted && fetched && fetched.length > 0) {
          setCatalogAlbums(fetched);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lang]);

  // 2. Resolve Saved Albums in Library
  useEffect(() => {
    if (favoriteAlbumIds.length === 0) {
      setResolvedSavedAlbums([]);
      return;
    }

    let isMounted = true;
    const resolved: AlbumItem[] = [];
    const missingIds: string[] = [];

    for (const albumId of favoriteAlbumIds) {
      const known = AlbumCatalogEngine.getAlbumById(albumId, lang);
      if (known) {
        resolved.push(known);
      } else {
        missingIds.push(albumId);
      }
    }

    if (missingIds.length === 0) {
      setResolvedSavedAlbums(resolved);
      return;
    }

    // Resolve missing saved album metadata asynchronously
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
              language: lang,
              albumType: 'soundtrack' as const,
              freshnessScore: 90,
              trendingScore: 90,
              topScore: 90,
              tracks: details.songs || [],
            };
          }
        } catch {}
        return null;
      })
    ).then((fetchedMissing) => {
      if (!isMounted) return;
      const valid: AlbumItem[] = [];
      for (const item of fetchedMissing) {
        if (item) valid.push(item);
      }
      setResolvedSavedAlbums([...resolved, ...valid]);
    });

    return () => {
      isMounted = false;
    };
  }, [favoriteAlbumIds, lang]);

  // 3. Categorized Subsets
  const { recentlyReleased, trending, popular } = useMemo(() => {
    return AlbumCatalogEngine.getThreeCategorizedShelves(lang);
  }, [lang, catalogAlbums]);

  // 4. Combined & Canonical Deduplication
  const combinedAlbums = useMemo(() => {
    const map = new Map<string, AlbumItem>();

    // Priority to saved albums, then catalog, then shelves
    resolvedSavedAlbums.forEach((a) => { if (a?.id) map.set(a.id, a); });
    catalogAlbums.forEach((a) => { if (a?.id && !map.has(a.id)) map.set(a.id, a); });
    recentlyReleased.forEach((a) => { if (a?.id && !map.has(a.id)) map.set(a.id, a); });
    trending.forEach((a) => { if (a?.id && !map.has(a.id)) map.set(a.id, a); });
    popular.forEach((a) => { if (a?.id && !map.has(a.id)) map.set(a.id, a); });

    return Array.from(map.values());
  }, [resolvedSavedAlbums, catalogAlbums, recentlyReleased, trending, popular]);

  // 5. Filter by Active Tab
  const tabFilteredAlbums = useMemo(() => {
    switch (activeFilterTab) {
      case 'saved':
        return resolvedSavedAlbums;
      case 'recent':
        return recentlyReleased.length > 0 ? recentlyReleased : combinedAlbums.slice(0, 20);
      case 'trending':
        return trending.length > 0 ? trending : combinedAlbums;
      case 'popular':
        return popular.length > 0 ? popular : combinedAlbums;
      case 'all':
      default:
        return combinedAlbums;
    }
  }, [activeFilterTab, resolvedSavedAlbums, recentlyReleased, trending, popular, combinedAlbums]);

  // 6. Search Filter (Debounced In-Memory, zero network overhead)
  const searchFilteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredAlbums;
    const q = searchQuery.toLowerCase().trim();
    return tabFilteredAlbums.filter(
      (a) =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.artist && a.artist.toLowerCase().includes(q)) ||
        (a.releaseYear && a.releaseYear.toString().includes(q))
    );
  }, [tabFilteredAlbums, searchQuery]);

  // 7. Deterministic Sorting
  const displayAlbums = useMemo(() => {
    const list = [...searchFilteredAlbums];
    switch (sortOption) {
      case 'year':
        return list.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
      case 'az':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'za':
        return list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      case 'popular':
        return list.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
      case 'recent_added':
      default:
        return list;
    }
  }, [searchFilteredAlbums, sortOption]);

  // Actions
  const handleOpenAlbum = (album: AlbumItem) => {
    haptics.lightImpact();
    NavigationStack.getInstance().push({
      activeTab: 'album',
      selectedAlbumId: album.id,
      selectedArtistId: null,
      selectedPlaylistId: null,
      isPlayerExpanded: false,
    });
    setSelectedAlbumId(album.id);
  };

  const handlePlayAlbum = async (album: AlbumItem, shuffle = false) => {
    haptics.mediumImpact();
    let tracks = album.tracks;
    if (!tracks || tracks.length === 0) {
      const { RealMusicEngine } = await import('@/lib/realMusicEngine');
      const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${album.id}`);
      tracks = details?.songs || [];
    }

    if (tracks.length > 0) {
      const tracklist = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
      setRemoteState({ shuffleMode: shuffle ? 'STANDARD' : 'OFF' });
      playSong(tracklist[0], tracklist, {
        type: 'album',
        id: album.id,
        title: album.title,
        name: album.title,
      });
      setToastMessage(shuffle ? `Shuffling "${album.title}"` : `Playing "${album.title}"`);
    } else {
      setSelectedAlbumId(album.id);
    }
  };

  const handleToggleSave = (album: AlbumItem) => {
    haptics.mediumImpact();
    const isSaved = favoriteAlbumIds.includes(album.id);
    toggleFavoriteAlbum(album.id);
    setToastMessage(isSaved ? `Removed "${album.title}" from Library` : `Saved "${album.title}" to Library`);
  };

  return (
    <div className="space-y-6 pb-28 text-white select-none animate-in fade-in duration-200 max-w-7xl mx-auto">
      {/* ── HEADER AREA ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">ALBUMS</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
              Your music collection & regional studio releases
            </p>
          </div>

          {/* User's Preferred Language Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
            {ALL_LANGUAGES.map((language) => {
              const isSelected = lang === language;
              return (
                <button
                  key={language}
                  onClick={() => {
                    haptics.lightImpact();
                    setPreferredLanguage(language);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#FA233B] text-white shadow-sm shadow-[#FA233B]/25'
                      : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
                  }`}
                >
                  {language}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONTROLS TOOLBAR: Filter Tabs, Search, Sort & View Mode ─────────── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                haptics.lightImpact();
                setActiveFilterTab('all');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilterTab === 'all'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
              }`}
            >
              All Albums
            </button>

            <button
              onClick={() => {
                haptics.lightImpact();
                setActiveFilterTab('saved');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilterTab === 'saved'
                  ? 'bg-[#FA233B] text-white font-extrabold shadow-sm shadow-[#FA233B]/20'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
              }`}
            >
              <Bookmark className="w-3 h-3 fill-current" />
              <span>Saved ({resolvedSavedAlbums.length})</span>
            </button>

            <button
              onClick={() => {
                haptics.lightImpact();
                setActiveFilterTab('recent');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilterTab === 'recent'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
              }`}
            >
              Recent Releases
            </button>

            <button
              onClick={() => {
                haptics.lightImpact();
                setActiveFilterTab('trending');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilterTab === 'trending'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
              }`}
            >
              Trending
            </button>

            <button
              onClick={() => {
                haptics.lightImpact();
                setActiveFilterTab('popular');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeFilterTab === 'popular'
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
              }`}
            >
              Most Popular
            </button>
          </div>

          {/* Search, Sort, View Toggle */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter albums or artists..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-slate-500 rounded-full pl-8 pr-7 py-1.5 outline-none focus:border-[#FA233B]/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1.5 rounded-full text-xs shadow-sm flex-shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#FA233B]" />
              <select
                value={sortOption}
                onChange={(e) => {
                  haptics.lightImpact();
                  setSortOption(e.target.value as SortOption);
                }}
                className="bg-transparent text-[var(--text-primary)] text-xs font-bold outline-none cursor-pointer pr-1"
                aria-label="Sort albums"
              >
                <option value="recent_added" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Recently Added</option>
                <option value="year" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Release Year</option>
                <option value="az" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Title: A → Z</option>
                <option value="za" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Title: Z → A</option>
                <option value="popular" className="bg-[var(--bg-elevated)] text-[var(--text-primary)]">Most Popular</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full p-0.5 flex-shrink-0">
              <button
                onClick={() => {
                  haptics.lightImpact();
                  setViewMode('grid');
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  haptics.lightImpact();
                  setViewMode('compact');
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  viewMode === 'compact' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Dense View"
              >
                <Grid2X2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALBUM GRID / SKELETONS ───────────────────────────────────────────── */}
      {isLoading && displayAlbums.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={`album-skeleton-${idx}`} className="space-y-2.5">
              <div className="w-full aspect-square rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              <div className="h-3.5 w-3/4 rounded-md bg-white/[0.05] animate-pulse" />
              <div className="h-3 w-1/2 rounded-md bg-white/[0.03] animate-pulse" />
            </div>
          ))}
        </div>
      ) : displayAlbums.length > 0 ? (
        <div
          className={
            viewMode === 'compact'
              ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5'
          }
        >
          {displayAlbums.map((album) => {
            const isSaved = favoriteAlbumIds.includes(album.id);
            return (
              <AlbumCard
                key={`alb-${album.id}`}
                album={album}
                isSaved={isSaved}
                onOpen={() => handleOpenAlbum(album)}
                onPlay={(shuffle) => handlePlayAlbum(album, shuffle)}
                onToggleSave={() => handleToggleSave(album)}
              />
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center text-slate-400 space-y-3 bg-white/[0.02] rounded-3xl border border-white/5 p-8">
          <Disc className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-white">
            {activeFilterTab === 'saved' ? 'No Saved Albums in Library' : 'No Albums Found'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeFilterTab === 'saved'
              ? 'Tap the bookmark icon or + Save on any album to add it to your personal library.'
              : `No albums match "${searchQuery}". Try a different title or artist name.`}
          </p>
          {activeFilterTab === 'saved' && (
            <button
              onClick={() => setActiveFilterTab('all')}
              className="mt-2 px-5 py-2 rounded-full bg-[#FA233B] hover:bg-[#d91e32] text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md"
            >
              Explore All Albums
            </button>
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
      className="group flex flex-col justify-between cursor-pointer select-none transition-transform duration-200 hover:-translate-y-1"
    >
      {/* 1. Square Artwork with Reserved Aspect Ratio */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 shadow-md border border-white/5 group-hover:border-white/15 transition-all">
        <OptimizedImage
          src={album.coverUrl}
          alt={album.title}
          size="card"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Subtle Edge Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* In Library / Saved Badge */}
        {isSaved && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#FA233B]/90 backdrop-blur-md text-[9px] font-black text-white flex items-center gap-1 shadow-md">
            <Check className="w-2.5 h-2.5 stroke-[3]" /> Saved
          </span>
        )}

        {/* Desktop Hover Play Button (Placed over lower-right portion of artwork) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(false);
          }}
          className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#FA233B] text-white shadow-xl shadow-black/70 flex items-center justify-center translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer z-10"
          title={`Play ${album.title}`}
          aria-label={`Play ${album.title}`}
        >
          <Play className="w-4 h-4 fill-white ml-0.5" />
        </button>
      </div>

      {/* 2. Album Information (Clean & Minimal) */}
      <div className="pt-2 flex items-start justify-between gap-1.5 min-w-0">
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
            {album.title}
          </h4>
          <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
            {album.artist}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
            {album.releaseYear || 2024} · {album.albumType === 'soundtrack' ? 'Soundtrack' : 'Album'}
          </p>
        </div>

        {/* Save to Library Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          className={`p-1.5 rounded-full transition-all active:scale-125 cursor-pointer flex-shrink-0 ${
            isSaved
              ? 'text-[#FA233B] bg-[#FA233B]/10 hover:bg-[#FA233B]/20'
              : 'text-slate-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity'
          }`}
          title={isSaved ? 'Remove from Library' : 'Save to Library'}
          aria-label={isSaved ? 'Remove from Library' : 'Save to Library'}
        >
          {isSaved ? (
            <Bookmark className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
