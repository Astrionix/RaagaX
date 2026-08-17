'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Play, Heart, Download, Music, User, Mic, Radio, 
  Flame, Disc3, Sparkles, Clock, Trash2, CheckCircle2, 
  ListMusic, FolderHeart, ArrowRight, ExternalLink 
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { CATEGORY_SPOTIFY_SOURCES } from '@/lib/spotifySources';
import { 
  UnifiedSearchEngine, 
  UnifiedSearchResults, 
  UnifiedAlbumResult, 
  UnifiedArtistResult, 
  UnifiedPlaylistResult 
} from '@/lib/search/UnifiedSearchEngine';

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
    setPreferredLanguage,
  } = usePlayerStore();

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
  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'downloaded'>('all');
  const [intentExplanation, setIntentExplanation] = useState<string | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(UnifiedSearchEngine.getInstance().getRecentSearches());
  }, []);

  // Debounced Unified Search
  useEffect(() => {
    let isCancelled = false;
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
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
      setIntentExplanation(null);
      setIsSearching(false);
      return;
    }

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
          setRecentSearches(UnifiedSearchEngine.getInstance().getRecentSearches());

          // Language eligibility inference
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

  const handleClearRecent = () => {
    UnifiedSearchEngine.getInstance().clearRecentSearches();
    setRecentSearches([]);
  };

  const handleRemoveRecentItem = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    UnifiedSearchEngine.getInstance().removeRecentSearch(term);
    setRecentSearches(UnifiedSearchEngine.getInstance().getRecentSearches());
  };

  const categories = [
    { id: 'language', name: preferredLanguage || 'Telugu', bg: 'from-red-600 to-rose-800' },
    { id: 'new_music', name: 'New Music', bg: 'from-orange-500 to-amber-700' },
    { id: 'charts', name: 'Charts', bg: 'from-[#EF233C] to-red-900' },
    { id: 'playlists', name: 'Playlists', bg: 'from-blue-600 to-indigo-800' },
    { id: 'mood', name: 'Mood', bg: 'from-purple-600 to-violet-900' },
    { id: 'genres', name: 'Genres', bg: 'from-pink-600 to-purple-800' },
  ];

  const trendingSearches = [
    { rank: 1, term: 'sid sriram' },
    { rank: 2, term: 'anirudh ravichander' },
    { rank: 3, term: 'devara songs' },
    { rank: 4, term: 'pushpa 2' },
    { rank: 5, term: 'samajavaragamana' },
    { rank: 6, term: 'love songs telugu' },
  ];

  const queuedSongIds = useMemo(() => new Set(queue.map((s) => s.id)), [queue]);

  const downloadedOnlyResults = useMemo(() => {
    return searchResults.songs.filter((s) => downloadedSongIds.includes(s.id));
  }, [searchResults.songs, downloadedSongIds]);

  return (
    <div className="space-y-6 pb-28 text-white select-none">
      {/* 3D Liquid Lens Search Bar */}
      <div className="relative">
        <div className="relative flex items-center rounded-2xl lens-soft border border-white/18 focus-within:border-[#E50914]/60 shadow-[0_12px_35px_rgba(0,0,0,0.6)] focus-within:shadow-[0_12px_40px_rgba(229,9,20,0.25)] transition-all">
          <Search className="w-5 h-5 text-[#E50914] ml-4 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="✦ Search songs, albums, artists, or Telugu/Hindi lyrics..."
            className="w-full bg-transparent px-3.5 py-3.5 text-sm text-white placeholder-slate-400 font-medium focus:outline-none"
            autoFocus
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="mr-3.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
          ) : (
            <div className="mr-3.5 flex items-center gap-1.5">
              <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-mono text-slate-400">RaagaX</span>
              <Mic className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>

        {/* AI DJ Natural Language Quick Suggestions */}
        {!searchQuery && (
          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar py-1">
            {[
              '“Late night Telugu melodies”',
              '“Sid Sriram top tracks”',
              '“Energetic gym Telugu beats”',
              '“2000s nostalgic hits”',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => setSearchQuery(prompt.replace(/[“”]/g, ''))}
                className="px-3 py-1.5 rounded-full lens-floating text-xs font-medium text-slate-300 hover:text-white border border-white/12 hover:border-[#E50914]/40 whitespace-nowrap transition-all active:scale-95 cursor-pointer"
              >
                ✦ {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* IDLE VIEW: Recent Searches, Categories, and Trending */}
      {!searchQuery && (
        <>
          {/* Recent Searches Section */}
          {recentSearches.length > 0 && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Recent Searches
                </h3>
                <button
                  onClick={handleClearRecent}
                  className="text-xs font-semibold text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    onClick={() => setSearchQuery(term)}
                    className="group px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/12 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <span>{term}</span>
                    <button
                      onClick={(e) => handleRemoveRecentItem(term, e)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                      title="Remove from history"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explore Categories Tile Grid */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Explore Categories</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (cat.id === 'language') {
                      const languages = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
                      const nextIndex = (languages.indexOf(preferredLanguage) + 1) % languages.length;
                      setPreferredLanguage(languages[nextIndex]);
                    } else {
                      const langSources = CATEGORY_SPOTIFY_SOURCES[preferredLanguage] || CATEGORY_SPOTIFY_SOURCES['Telugu'];
                      const targetSource = langSources[cat.id];
                      if (targetSource) {
                        setSelectedPlaylistId(`spotify:${targetSource.id}`);
                        setActiveTab('playlist');
                      } else {
                        setActiveTab('home');
                      }
                    }
                  }}
                  className={`h-24 rounded-2xl bg-gradient-to-br ${cat.bg} p-4 flex flex-col justify-between font-black text-base text-white shadow-lg active:scale-95 transition-transform text-left cursor-pointer group`}
                >
                  <span className="text-xs font-bold tracking-wider opacity-70 uppercase">
                    {cat.id === 'language' ? 'Active Language' : 'Category'}
                  </span>
                  <span className="text-lg font-black">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trending Searches List */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#EF233C]" /> Trending Searches
            </h3>
            <div className="divide-y divide-white/5 bg-[#1C1C1E] rounded-2xl border border-white/10 overflow-hidden">
              {trendingSearches.map((item) => (
                <button
                  key={item.term}
                  onClick={() => setSearchQuery(item.term)}
                  className="w-full py-3.5 px-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <span className="text-sm font-black text-[#EF233C] min-w-[16px]">{item.rank}</span>
                  <span className="text-sm font-bold text-slate-200 capitalize">{item.term}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ACTIVE SEARCH RESULTS VIEW */}
      {searchQuery && (
        <div className="space-y-6">
          {/* Offline Notice Banner */}
          {searchResults.isOffline && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
              <span className="font-bold">Offline Mode — Showing downloaded music</span>
              <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">Local Index</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Search className="w-4 h-4 text-[#EF233C]" /> Search Results
            </h3>
            {isSearching && (
              <span className="text-xs font-bold text-[#EF233C] flex items-center gap-1.5 animate-pulse">
                <Radio className="w-4 h-4" /> Searching...
              </span>
            )}
          </div>

          {/* AI Natural Intent Badge */}
          {intentExplanation && (
            <div className="px-3.5 py-2 rounded-xl bg-[#fa233b]/10 border border-[#fa233b]/25 flex items-center gap-2 text-xs text-white/90 shadow-sm animate-in fade-in duration-200">
              <Sparkles className="w-4 h-4 text-[#fa233b] flex-shrink-0" />
              <span className="font-semibold">{intentExplanation}</span>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('songs')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'songs'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15'
              }`}
            >
              <Music className="w-3.5 h-3.5" /> Songs
            </button>
            <button
              onClick={() => setFilterType('artists')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'artists'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Artists
            </button>
            <button
              onClick={() => setFilterType('albums')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'albums'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" /> Albums
            </button>
            <button
              onClick={() => setFilterType('playlists')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterType === 'playlists'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/15'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" /> Playlists
            </button>
            {downloadedOnlyResults.length > 0 && (
              <button
                onClick={() => setFilterType('downloaded')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterType === 'downloaded'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Downloaded
              </button>
            )}
          </div>

          {/* TOP RESULT CARD (Apple/Spotify Style) */}
          {filterType === 'all' && searchResults.topResult && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-white/10 to-white/5 border border-white/15 shadow-xl relative overflow-hidden group">
              <div className="text-[10px] font-black text-[#EF233C] uppercase tracking-widest mb-3">
                Top Result
              </div>
              <div className="flex items-center gap-4 sm:gap-5">
                <img
                  src={searchResults.topResult.coverUrl}
                  alt={searchResults.topResult.title}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                  className={`w-20 h-20 sm:w-24 sm:h-24 object-cover shadow-2xl flex-shrink-0 border border-white/10 ${
                    searchResults.topResult.type === 'artist' ? 'rounded-full' : 'rounded-2xl'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-2xl font-black text-white truncate group-hover:text-[#EF233C] transition-colors">
                    {searchResults.topResult.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold text-slate-300 truncate mt-1">
                    {searchResults.topResult.subtitle}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {searchResults.topResult.type === 'song' ? (
                      <button
                        onClick={() => playSong(searchResults.topResult!.item, searchResults.songs)}
                        className="px-4 py-1.5 rounded-full bg-[#EF233C] text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/30 hover:scale-105 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Play
                      </button>
                    ) : searchResults.topResult.type === 'artist' ? (
                      <button
                        onClick={() => {
                          setSelectedArtistId(searchResults.topResult!.item.id);
                          setActiveTab('artist');
                        }}
                        className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        View Artist <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : searchResults.topResult.type === 'album' ? (
                      <button
                        onClick={() => {
                          setSelectedAlbumId(searchResults.topResult!.item.id);
                          setActiveTab('album');
                        }}
                        className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        View Album <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedPlaylistId(searchResults.topResult!.item.id);
                          setActiveTab('playlist');
                        }}
                        className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        View Playlist <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ARTISTS SECTION */}
          {(filterType === 'all' || filterType === 'artists') && searchResults.artists.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#EF233C]" /> Artists
              </h4>
              <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                {searchResults.artists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => {
                      setSelectedArtistId(artist.id);
                      setActiveTab('artist');
                    }}
                    className="w-24 sm:w-28 flex-shrink-0 text-center cursor-pointer group"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-2 border-2 border-white/10 group-hover:border-[#EF233C] transition-all shadow-md mx-auto">
                      <img
                        src={artist.coverUrl}
                        alt={artist.name}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">
                      {artist.name}
                    </h4>
                    <p className="text-[10px] text-slate-400">{artist.role || 'Artist'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ALBUMS SECTION */}
          {(filterType === 'all' || filterType === 'albums') && searchResults.albums.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-[#EF233C]" /> Albums
              </h4>
              <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                {searchResults.albums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => {
                      setSelectedAlbumId(album.id);
                      setActiveTab('album');
                    }}
                    className="w-32 flex-shrink-0 cursor-pointer group"
                  >
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2 shadow-md border border-white/10">
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">
                      {album.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">{album.artist}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLAYLISTS SECTION */}
          {(filterType === 'all' || filterType === 'playlists') && searchResults.playlists.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-[#EF233C]" /> Playlists
              </h4>
              <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                {searchResults.playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => {
                      setSelectedPlaylistId(playlist.id);
                      setActiveTab('playlist');
                    }}
                    className="w-32 flex-shrink-0 cursor-pointer group"
                  >
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2 shadow-md border border-white/10 bg-slate-900">
                      <img
                        src={playlist.coverUrl}
                        alt={playlist.title}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {playlist.isUserOwned && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-black uppercase">
                          Yours
                        </div>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">
                      {playlist.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {playlist.songCount ? `${playlist.songCount} songs` : playlist.source || 'Playlist'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SONGS SECTION */}
          {(filterType === 'all' || filterType === 'songs' || filterType === 'downloaded') && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#EF233C]" /> Songs
                </span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {(filterType === 'downloaded' ? downloadedOnlyResults : searchResults.songs).map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  const isDownloaded = downloadedSongIds.includes(song.id);
                  const isQueued = queuedSongIds.has(song.id);

                  return (
                    <div
                      key={song.id}
                      className={`p-2.5 sm:p-3 rounded-2xl border flex items-center gap-3 group transition-all ${
                        isCurrent
                          ? 'bg-[#fa233b]/15 border-[#fa233b]/35 shadow-[0_0_15px_rgba(250,35,59,0.15)]'
                          : 'bg-[#1C1C1E]/90 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Cover Art with Play overlay */}
                      <div
                        onClick={() => playSong(song, searchResults.songs)}
                        className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0 cursor-pointer"
                      >
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                      </div>

                      {/* Song Details */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => playSong(song, searchResults.songs)}
                      >
                        <div className="flex items-center gap-1.5">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isCurrent ? 'text-[#fa233b]' : 'text-white group-hover:text-[#EF233C] transition-colors'
                            }`}
                          >
                            {song.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {song.artist}
                        </p>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5 mt-1">
                          {isDownloaded && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/25">
                              ✓ Downloaded
                            </span>
                          )}
                          {isQueued && !isCurrent && (
                            <span className="text-[9px] font-semibold text-slate-400 bg-white/5 px-1.5 py-0.2 rounded">
                              In Queue
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Menu */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <SongActionMenu song={song} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
