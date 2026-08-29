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
    <div className="space-y-4 pb-2 text-white select-none animate-in fade-in duration-200 max-w-7xl mx-auto px-4 sm:px-8 md:px-10 lg:px-12">
      {/* ── CONTROLS TOOLBAR: Filter Tabs, Language, Search & Sort ─────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
        {/* Filter Categories */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          <button
            onClick={() => {
              haptics.lightImpact();
              setActiveFilterTab('all');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilterTab === 'all'
                ? 'bg-white text-black font-extrabold shadow-sm'
                : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
            }`}
          >
            All
          </button>

          <button
            onClick={() => {
              haptics.lightImpact();
              setActiveFilterTab('saved');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilterTab === 'saved'
                ? 'bg-[#FA233B] text-white font-extrabold shadow-sm shadow-[#FA233B]/20'
                : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>Saved ({resolvedSavedAlbums.length})</span>
          </button>

          <button
            onClick={() => {
              haptics.lightImpact();
              setActiveFilterTab('recent');
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilterTab === 'popular'
                ? 'bg-white text-black font-extrabold shadow-sm'
                : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
            }`}
          >
            Popular
          </button>
        </div>

        {/* Language, Search & Sort */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* User's Preferred Language Selector */}
          <div className="relative flex-shrink-0">
            <select
              value={lang}
              onChange={(e) => {
                haptics.lightImpact();
                setPreferredLanguage(e.target.value);
              }}
              className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-bold rounded-full px-3.5 py-2 outline-none cursor-pointer transition-colors appearance-none pr-7"
              aria-label="Language selector"
            >
              {ALL_LANGUAGES.map((language) => (
                <option key={language} value={language} className="bg-[#1c1c1e] text-white">
                  {language}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[9px]">
              ▼
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-52 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search albums or artists..."
              className="w-full bg-white/[0.05] border border-white/10 text-xs text-white placeholder-slate-500 rounded-full pl-9 pr-8 py-2 outline-none focus:border-[#FA233B]/60 focus:bg-black/40 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/10 px-3 py-2 rounded-full text-xs shadow-sm flex-shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#FA233B]" />
            <select
              value={sortOption}
              onChange={(e) => {
                haptics.lightImpact();
                setSortOption(e.target.value as SortOption);
              }}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer pr-1"
              aria-label="Sort albums"
            >
              <option value="recent_added" className="bg-[#1c1c1e] text-white">Recently Added</option>
              <option value="year" className="bg-[#1c1c1e] text-white">Release Year</option>
              <option value="az" className="bg-[#1c1c1e] text-white">Title: A → Z</option>
              <option value="za" className="bg-[#1c1c1e] text-white">Title: Z → A</option>
              <option value="popular" className="bg-[#1c1c1e] text-white">Most Popular</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── ALBUM GRID (SPACIOUS & UNCONGESTED) ───────────────────────────────── */}
      {isLoading && displayAlbums.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={`album-skeleton-${idx}`} className="space-y-3">
              <div className="w-full aspect-square rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              <div className="h-4 w-3/4 rounded-md bg-white/[0.05] animate-pulse" />
              <div className="h-3 w-1/2 rounded-md bg-white/[0.03] animate-pulse" />
            </div>
          ))}
        </div>
      ) : displayAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
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
      {/* 1. Square Artwork with Clean Aspect Ratio */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-white/5 group-hover:border-white/20 transition-all">
        <OptimizedImage
          src={album.coverUrl}
          alt={album.title}
          size="card"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Subtle Edge Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* In Library / Saved Badge */}
        {isSaved && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#FA233B]/90 backdrop-blur-md text-[9px] font-black text-white flex items-center gap-1 shadow-md">
            <Check className="w-2.5 h-2.5 stroke-[3]" /> Saved
          </span>
        )}

        {/* Desktop Hover Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(false);
          }}
          className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-[#FA233B] text-white shadow-xl shadow-black/80 flex items-center justify-center translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer z-10"
          title={`Play ${album.title}`}
          aria-label={`Play ${album.title}`}
        >
          <Play className="w-4 h-4 fill-white ml-0.5" />
        </button>
      </div>

      {/* 2. Album Information (Spacious & Clean) */}
      <div className="pt-2.5 flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-white truncate leading-snug group-hover:text-[#FA233B] transition-colors" title={album.title}>
            {album.title}
          </h4>
          <p className="text-xs text-slate-400 truncate mt-0.5 font-medium" title={album.artist}>
            {album.artist}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {album.releaseYear || 2024} · {album.albumType === 'soundtrack' ? 'Soundtrack' : 'Album'}
          </p>
        </div>

        {/* Save to Library Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          className={`p-1.5 rounded-full transition-all active:scale-125 cursor-pointer flex-shrink-0 mt-0.5 ${
            isSaved
              ? 'text-[#FA233B] bg-[#FA233B]/10 hover:bg-[#FA233B]/20'
              : 'text-slate-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity'
          }`}
          title={isSaved ? 'Remove from Library' : 'Save to Library'}
          aria-label={isSaved ? 'Remove from Library' : 'Save to Library'}
        >
          {isSaved ? (
            <Bookmark className="w-4 h-4 fill-current" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
