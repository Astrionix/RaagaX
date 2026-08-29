'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Play, Heart, Download, Music, User, Mic, Radio, 
  Flame, Disc3, Sparkles, Clock, Trash2, CheckCircle2, 
  ListMusic, ArrowRight, X, ChevronLeft, Layers, Compass
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { 
  UnifiedSearchEngine, 
  UnifiedSearchResults 
} from '@/lib/search/UnifiedSearchEngine';
import { 
  CategoryDiscoveryEngine, 
  RaagaCategory 
} from '@/lib/discovery/CategoryDiscoveryEngine';
import { ArtistAvatar } from '@/components/common/ArtistAvatar';
import { DownloadStatusIndicator } from '@/components/common/DownloadStatusIndicator';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { PersonalizationEngine } from '@/lib/recommendation/PersonalizationEngine';
import { haptics } from '@/lib/haptics/HapticEngine';

export function SearchView() {
  const {
    searchQuery,
    setSearchQuery,
    playSong,
    likedSongIds,
    downloadedSongIds,
    queue,
    currentSong,
    isPlaying,
    setSelectedArtistId,
    setSelectedAlbumId,
    setSelectedPlaylistId,
    setActiveTab,
    preferredLanguage,
  } = usePlayerStore();

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

  const [searchResults, setSearchResults] = useState<UnifiedSearchResults>({
    query: '',
    topResult: null,
    songs: [],
    albums: [],
    artists: [],
    playlists: [],
    localMatches: { downloadedSongs: [], userPlaylists: [] },
    isOffline: false,
    timestamp: Date.now(),
  });

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<RaagaCategory | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'downloaded'>('all');
  const [intentExplanation, setIntentExplanation] = useState<string | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(UnifiedSearchEngine.getInstance().getRecentSearches());
  }, []);

  // Personalized Categories from CategoryDiscoveryEngine
  const { languages, genres, curated } = useMemo(() => {
    return CategoryDiscoveryEngine.getInstance().getPersonalizedCategories(preferredLanguage || 'Telugu');
  }, [preferredLanguage]);

  // Debounced Unified Search
  useEffect(() => {
    let isCancelled = false;
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      if (!selectedCategory) {
        setSearchResults({
          query: '',
          topResult: null,
          songs: [],
          albums: [],
          artists: [],
          playlists: [],
          localMatches: { downloadedSongs: [], userPlaylists: [] },
          isOffline: false,
          timestamp: Date.now(),
        });
      }
      setIntentExplanation(null);
      setIsSearching(false);
      return;
    }

    // User is actively searching, clear selected category
    setSelectedCategory(null);
    setIsSearching(true);

    // 0ms instant local search for UI snappiness
    UnifiedSearchEngine.getInstance().searchLocalOnly(trimmedQuery).then((local) => {
      if (!isCancelled && local.downloadedSongs.length > 0) {
        setSearchResults((prev) => ({
          ...prev,
          query: trimmedQuery,
          localMatches: local,
          songs: prev.songs.length === 0 ? local.downloadedSongs : prev.songs,
        }));
      }
    });

    // 250ms debounced remote search
    const timer = setTimeout(async () => {
      try {
        const { MusicIntelligenceEngine } = await import('@/lib/intelligence/MusicIntelligenceEngine');
        const intent = MusicIntelligenceEngine.getInstance().parseNaturalQuery(trimmedQuery);
        if (intent && (intent.mood || intent.era || intent.activity)) {
          setIntentExplanation(intent.explanation || null);
        } else {
          setIntentExplanation(null);
        }
      } catch {}

      try {
        const results = await UnifiedSearchEngine.getInstance().search(trimmedQuery, preferredLanguage);
        if (!isCancelled) {
          setSearchResults(results);

          // Record language interest
          const { LanguageEligibilityEngine } = await import('@/lib/language/LanguageEligibilityEngine');
          const inferredLang = LanguageEligibilityEngine.getInstance().inferLanguageFromQuery(trimmedQuery);
          if (inferredLang) {
            usePlayerStore.getState().recordLanguageInterest(inferredLang, 0.15);
          }
        }
      } catch (err) {
        console.error('[SearchView] Search execution error:', err);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, preferredLanguage]);

  // Handle Category Selection
  const handleSelectCategory = async (category: RaagaCategory) => {
    haptics.mediumImpact();
    setSelectedCategory(category);
    setSearchQuery('');
    setIsSearching(true);
    setFilterType('all');

    try {
      const { results } = await CategoryDiscoveryEngine.getInstance().discover(
        category,
        preferredLanguage || 'Telugu'
      );
      setSearchResults(results);
    } catch (e) {
      console.error('[SearchView] Error discovering category:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearCategory = () => {
    haptics.lightImpact();
    setSelectedCategory(null);
    setSearchResults({
      query: '',
      topResult: null,
      songs: [],
      albums: [],
      artists: [],
      playlists: [],
      localMatches: { downloadedSongs: [], userPlaylists: [] },
      isOffline: false,
      timestamp: Date.now(),
    });
  };

  const handleCommitSearch = (queryToCommit?: string) => {
    const q = (queryToCommit ?? searchQuery).trim();
    if (!q) return;
    UnifiedSearchEngine.getInstance().addRecentSearch(q);
    setRecentSearches(UnifiedSearchEngine.getInstance().getRecentSearches());
  };

  const handleClearRecent = () => {
    haptics.lightImpact();
    UnifiedSearchEngine.getInstance().clearRecentSearches();
    setRecentSearches([]);
  };

  const handleRemoveRecentItem = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.lightImpact();
    UnifiedSearchEngine.getInstance().removeRecentSearch(term);
    setRecentSearches(UnifiedSearchEngine.getInstance().getRecentSearches());
  };

  const [dynamicTrendingSearches, setDynamicTrendingSearches] = useState<Array<{ rank: number; term: string }>>([
    { rank: 1, term: 'Thandel' },
    { rank: 2, term: 'Game Changer' },
    { rank: 3, term: 'Devara Songs' },
    { rank: 4, term: 'Pushpa 2' },
    { rank: 5, term: 'Sid Sriram' },
    { rank: 6, term: 'Anirudh Ravichander' },
  ]);

  // Dynamic Trending Searches based on active language
  useEffect(() => {
    let isCancelled = false;
    const fetchTrends = async () => {
      try {
        const lang = preferredLanguage || 'Telugu';
        const res = await fetch(`/api/home/trending-searches?lang=${encodeURIComponent(lang)}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && Array.isArray(json.data) && json.data.length > 0) {
            setDynamicTrendingSearches(json.data);
          }
        }
      } catch (err) {
        console.warn('[SearchView] Failed to fetch dynamic trending searches:', err);
      }
    };
    fetchTrends();
    return () => {
      isCancelled = true;
    };
  }, [preferredLanguage]);

  const queuedSongIds = useMemo(() => new Set(queue.map((s) => s.id)), [queue]);

  const downloadedOnlyResults = useMemo(() => {
    return searchResults.songs.filter((s) => downloadedSongIds.includes(s.id));
  }, [searchResults.songs, downloadedSongIds]);

  const rankedSearchSongs = useMemo(() => {
    const list = filterType === 'downloaded' ? downloadedOnlyResults : searchResults.songs;
    if (!list || list.length === 0) return [];
    
    const engine = PersonalizationEngine.getInstance();
    const scored = list.map((song, index) => {
      const searchRelevance = 100 - (index * 4);
      const personalizationScore = engine.scoreTrack(song);
      const finalScore = searchRelevance + (personalizationScore * 0.15);
      return { song, finalScore };
    });

    scored.sort((a, b) => {
      if (Math.abs(b.finalScore - a.finalScore) > 0.01) {
        return b.finalScore - a.finalScore;
      }
      return a.song.id.localeCompare(b.song.id);
    });

    return scored.map((item) => item.song);
  }, [searchResults.songs, downloadedOnlyResults, filterType]);

  const isDiscoveryView = !searchQuery && !selectedCategory;

  return (
    <div className="w-full space-y-6 pb-2 text-white select-none animate-in fade-in duration-200">
      {/* ── 1. CENTERED PROMINENT PILL SEARCH BAR ─────────────────────────── */}
      <div className="pt-2 pb-1 flex justify-center w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCommitSearch();
          }}
          className="relative w-full max-w-2xl"
        >
          <div className="relative flex items-center rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] backdrop-blur-xl border border-white/10 focus-within:border-[#FA233B]/60 focus-within:bg-black/50 transition-all shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <Search className="w-4 h-4 text-[#FA233B] ml-4 flex-shrink-0" />
            <input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="raagax-main-search-query"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCommitSearch();
                }
              }}
              placeholder="Artists, Songs, Albums, Lyrics and More"
              className="w-full bg-transparent px-3.5 py-3 text-sm text-white placeholder-zinc-400 font-medium focus:outline-none"
              autoFocus={false}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  haptics.lightImpact();
                  setSearchQuery('');
                }}
                className="mr-3 p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/15 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="mr-3.5 flex items-center gap-1.5 opacity-60">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-zinc-300 font-bold">
                  RaagaX
                </span>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── 2. ACTIVE CATEGORY HEADER BANNER (When Category is clicked) ────── */}
      {selectedCategory && !searchQuery && (
        <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-white/[0.07] to-white/[0.02] border border-white/10 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearCategory}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Back to all categories"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#FA233B] bg-[#FA233B]/15 px-2 py-0.5 rounded-full border border-[#FA233B]/25">
                  {selectedCategory.badge || 'CATEGORY'}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">{selectedCategory.title}</h2>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{selectedCategory.description || selectedCategory.subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleClearCategory}
            className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── 3. DISCOVERY VIEW (When idle) ──────────────────────────────────── */}
      {isDiscoveryView && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* A. RECENTLY SEARCHED */}
          {recentSearches.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Recently Searched
                </h2>
                <button
                  onClick={handleClearRecent}
                  className="text-xs font-semibold text-zinc-400 hover:text-[#FA233B] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    onClick={() => {
                      haptics.lightImpact();
                      setSearchQuery(term);
                      handleCommitSearch(term);
                    }}
                    className="group px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <span className="max-w-[180px] sm:max-w-[240px] truncate" title={term}>{term}</span>
                    <button
                      onClick={(e) => handleRemoveRecentItem(term, e)}
                      className="text-zinc-500 hover:text-[#FA233B] transition-colors p-0.5"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* B. LANGUAGES */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#FA233B]" /> Languages
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {languages.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`h-28 sm:h-32 rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 flex flex-col justify-between font-bold text-white shadow-lg border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 text-left cursor-pointer group relative overflow-hidden`}
                >
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
                  <span className="text-[9px] font-black tracking-widest text-white/70 uppercase z-10 font-mono">
                    {cat.badge}
                  </span>
                  <div className="z-10">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight group-hover:translate-x-0.5 transition-transform">
                      {cat.title}
                    </h3>
                    <p className="text-[10px] text-zinc-300/80 font-medium truncate mt-0.5">
                      {cat.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* C. GENRES & MOODS */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FA233B]" /> Genres & Moods
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {genres.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`h-28 sm:h-32 rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 flex flex-col justify-between font-bold text-white shadow-lg border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 text-left cursor-pointer group relative overflow-hidden`}
                >
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
                  <span className="text-[9px] font-black tracking-widest text-white/70 uppercase z-10 font-mono">
                    {cat.badge}
                  </span>
                  <div className="z-10">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight group-hover:translate-x-0.5 transition-transform">
                      {cat.title}
                    </h3>
                    <p className="text-[10px] text-zinc-300/80 font-medium truncate mt-0.5">
                      {cat.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* D. CURATED THEMES */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FA233B]" /> Curated Themes
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {curated.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`h-28 sm:h-32 rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 flex flex-col justify-between font-bold text-white shadow-lg border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 text-left cursor-pointer group relative overflow-hidden`}
                >
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
                  <span className="text-[9px] font-black tracking-widest text-white/70 uppercase z-10 font-mono">
                    {cat.badge}
                  </span>
                  <div className="z-10">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight group-hover:translate-x-0.5 transition-transform">
                      {cat.title}
                    </h3>
                    <p className="text-[10px] text-zinc-300/80 font-medium truncate mt-0.5">
                      {cat.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* E. TRENDING SEARCHES */}
          <section className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#FA233B]" /> Trending Searches
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {dynamicTrendingSearches.map((item) => (
                <button
                  key={`${item.term}-${item.rank}`}
                  onClick={() => {
                    haptics.lightImpact();
                    setSearchQuery(item.term);
                    handleCommitSearch(item.term);
                  }}
                  className="py-2.5 px-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/15 flex items-center gap-3 transition-colors text-left cursor-pointer group"
                >
                  <span className="text-xs font-black text-[#FA233B] w-4 text-center">{item.rank}</span>
                  <span className="text-xs font-semibold text-zinc-200 capitalize group-hover:text-white truncate">
                    {item.term}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── 4. RESULTS VIEW (When query or category is active) ──────────────── */}
      {(!isDiscoveryView || isSearching) && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Offline Notice Banner */}
          {searchResults.isOffline && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
              <span className="font-bold">Offline Mode — Showing downloaded music</span>
              <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">Local Index</span>
            </div>
          )}

          {/* Natural Intent Badge */}
          {intentExplanation && (
            <div className="px-3.5 py-2 rounded-xl bg-[#FA233B]/10 border border-[#FA233B]/25 flex items-center gap-2 text-xs text-white/90 shadow-sm">
              <Sparkles className="w-4 h-4 text-[#FA233B] flex-shrink-0" />
              <span className="font-semibold">{intentExplanation}</span>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {(['all', 'songs', 'artists', 'albums', 'playlists'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  haptics.lightImpact();
                  setFilterType(type);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  filterType === type
                    ? 'bg-[#FA233B] text-white shadow-md shadow-[#FA233B]/20'
                    : 'bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.12] border border-white/[0.08]'
                }`}
              >
                {type === 'all' ? 'All' : type}
              </button>
            ))}
          </div>

          {/* Loading Skeleton */}
          {isSearching && (
            <div className="space-y-4 pt-2">
              <div className="h-28 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <div key={k} className="h-16 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isSearching &&
            searchResults.songs.length === 0 &&
            searchResults.artists.length === 0 &&
            searchResults.albums.length === 0 &&
            searchResults.playlists.length === 0 && (
              <div className="py-20 text-center text-zinc-400 space-y-3 bg-white/[0.01] rounded-3xl border border-dashed border-white/10 p-8">
                <Search className="w-10 h-10 text-zinc-500 mx-auto opacity-70" />
                <h3 className="text-base font-bold text-white">No results found {searchQuery ? `for "${searchQuery}"` : ''}</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Check your spelling or try searching for another artist, song, or soundtrack.
                </p>
              </div>
            )}

          {/* Top Result Card */}
          {filterType === 'all' && searchResults.topResult && !isSearching && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-white/[0.07] to-white/[0.02] border border-white/10 shadow-lg relative overflow-hidden group">
              <div className="text-[10px] font-bold text-[#FA233B] uppercase tracking-wider mb-2 font-mono">
                TOP RESULT
              </div>
              <div className="flex items-center gap-4">
                {searchResults.topResult.type === 'artist' ? (
                  <ArtistAvatar
                    name={searchResults.topResult.title}
                    id={searchResults.topResult.item?.id}
                    imageUrl={searchResults.topResult.coverUrl}
                    className="w-16 h-16 sm:w-20 sm:h-20 shadow-md flex-shrink-0 border border-white/10"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-white/10">
                    <OptimizedImage
                      src={searchResults.topResult.coverUrl}
                      alt={searchResults.topResult.title}
                      size="thumb"
                      className="w-full h-full object-cover"
                      fallbackSrc="/app-icon.png"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-xl font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                    {SongFormatter.cleanSongTitle(searchResults.topResult.title)}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {SongFormatter.decodeHtml(searchResults.topResult.subtitle)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    {searchResults.topResult.type === 'song' ? (
                      <button
                        onClick={() => {
                          handleCommitSearch();
                          playSong(searchResults.topResult!.item, searchResults.songs);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#FA233B] text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-105 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Play
                      </button>
                    ) : searchResults.topResult.type === 'artist' ? (
                      <button
                        onClick={() => {
                          handleCommitSearch();
                          setSelectedArtistId(searchResults.topResult!.item.id);
                          setActiveTab('artist');
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        View Artist <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handleCommitSearch();
                          setSelectedAlbumId(searchResults.topResult!.item.id);
                          setActiveTab('album');
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        View Album <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Artists Section */}
          {(filterType === 'all' || filterType === 'artists') && searchResults.artists.length > 0 && !isSearching && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#FA233B]" /> Artists
              </h3>
              {filterType === 'artists' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                  {searchResults.artists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => {
                        handleCommitSearch();
                        setSelectedArtistId(artist.id);
                        setActiveTab('artist');
                      }}
                      className="text-center cursor-pointer group p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 transition-all"
                    >
                      <ArtistAvatar
                        name={artist.name}
                        id={artist.id}
                        imageUrl={artist.coverUrl}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full mb-2.5 border-2 border-white/10 group-hover:border-[#FA233B] transition-all shadow-md mx-auto"
                      />
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                        {artist.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{artist.role || 'Artist'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                  {searchResults.artists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => {
                        handleCommitSearch();
                        setSelectedArtistId(artist.id);
                        setActiveTab('artist');
                      }}
                      className="w-24 sm:w-28 flex-shrink-0 text-center cursor-pointer group"
                    >
                      <ArtistAvatar
                        name={artist.name}
                        id={artist.id}
                        imageUrl={artist.coverUrl}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full mb-2 border-2 border-white/10 group-hover:border-[#FA233B] transition-all shadow-md mx-auto"
                      />
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                        {artist.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400">{artist.role || 'Artist'}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Albums Section */}
          {(filterType === 'all' || filterType === 'albums') && searchResults.albums.length > 0 && !isSearching && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Disc3 className="w-3.5 h-3.5 text-[#FA233B]" /> Albums
              </h3>
              {filterType === 'albums' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                  {searchResults.albums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => {
                        handleCommitSearch();
                        setSelectedAlbumId(album.id);
                        setActiveTab('album');
                      }}
                      className="cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden mb-2.5 shadow-md border border-white/10 group-hover:border-white/20 transition-all bg-zinc-900">
                        <OptimizedImage
                          src={album.coverUrl}
                          alt={album.title}
                          size="card"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          fallbackSrc="/app-icon.png"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors" title={album.title}>
                          {SongFormatter.cleanSongTitle(album.title)}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{album.artist}</p>
                        {album.releaseYear && (
                          <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">{album.releaseYear}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                  {searchResults.albums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => {
                        handleCommitSearch();
                        setSelectedAlbumId(album.id);
                        setActiveTab('album');
                      }}
                      className="w-32 flex-shrink-0 cursor-pointer group"
                    >
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2 shadow-md border border-white/10 bg-zinc-900">
                        <OptimizedImage
                          src={album.coverUrl}
                          alt={album.title}
                          size="thumb"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          fallbackSrc="/app-icon.png"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-7 h-7 text-white fill-white" />
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors" title={album.title}>
                        {SongFormatter.cleanSongTitle(album.title)}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate">{album.artist}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Playlists Section */}
          {(filterType === 'all' || filterType === 'playlists') && searchResults.playlists.length > 0 && !isSearching && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5 text-[#FA233B]" /> Playlists
              </h3>
              {filterType === 'playlists' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                  {searchResults.playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => {
                        handleCommitSearch();
                        setSelectedPlaylistId(playlist.id);
                        setActiveTab('playlist');
                      }}
                      className="cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden mb-2.5 shadow-md border border-white/10 group-hover:border-white/20 transition-all bg-zinc-900">
                        <OptimizedImage
                          src={playlist.coverUrl}
                          alt={playlist.title}
                          size="card"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          fallbackSrc="/app-icon.png"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-[#FA233B] text-white flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FA233B] transition-colors" title={playlist.title}>
                          {playlist.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {playlist.songCount ? `${playlist.songCount} songs` : 'Playlist'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                  {searchResults.playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => {
                        handleCommitSearch();
                        setSelectedPlaylistId(playlist.id);
                        setActiveTab('playlist');
                      }}
                      className="w-32 flex-shrink-0 cursor-pointer group"
                    >
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2 shadow-md border border-white/10 bg-zinc-900">
                        <OptimizedImage
                          src={playlist.coverUrl}
                          alt={playlist.title}
                          size="thumb"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          fallbackSrc="/app-icon.png"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-7 h-7 text-white fill-white" />
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors" title={playlist.title}>
                        {playlist.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {playlist.songCount ? `${playlist.songCount} songs` : 'Playlist'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Songs Section */}
          {(filterType === 'all' || filterType === 'songs') && rankedSearchSongs.length > 0 && !isSearching && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#FA233B]" /> Songs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {rankedSearchSongs.map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  const isDownloaded = downloadedSongIds.includes(song.id);
                  const isQueued = queuedSongIds.has(song.id);

                  return (
                    <div
                      key={song.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-3 group transition-all ${
                        isCurrent
                          ? 'bg-[#FA233B]/15 border-[#FA233B]/35 shadow-[0_0_15px_rgba(250,35,59,0.15)]'
                          : 'bg-white/[0.03] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.06]'
                      }`}
                    >
                      {/* Cover Art with Play overlay */}
                      <div
                        onClick={() => {
                          handleCommitSearch();
                          playSong(song, searchResults.songs);
                        }}
                        className="relative w-11 h-11 rounded-lg overflow-hidden shadow-sm flex-shrink-0 cursor-pointer border border-white/10"
                      >
                        <OptimizedImage
                          src={song.coverUrl}
                          alt={song.title}
                          size="thumb"
                          className="w-full h-full object-cover"
                          fallbackSrc="/app-icon.png"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Song Details */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          handleCommitSearch();
                          playSong(song, searchResults.songs);
                        }}
                      >
                        <h4
                          className={`text-xs font-bold truncate ${
                            isCurrent ? 'text-[#FA233B]' : 'text-white group-hover:text-[#FA233B] transition-colors'
                          }`}
                        >
                          {SongFormatter.cleanSongTitle(song.title)}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {SongFormatter.decodeHtml(song.artist)}
                        </p>
                      </div>

                      {/* Action Menu & Download Status */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <DownloadStatusIndicator song={song} size="sm" showPercentage />
                        <SongActionMenu song={song} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
