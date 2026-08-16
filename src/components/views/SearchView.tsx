'use client';

import React, { useState, useEffect } from 'react';
import { Search, Play, Heart, Download, Music, User, Mic, Radio, Flame, Disc3 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';
import { CATEGORY_SPOTIFY_SOURCES } from '@/lib/spotifySources';

export function SearchView() {
  const {
    searchQuery,
    setSearchQuery,
    playSong,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    toggleDownloadSong,
    setSelectedArtistId,
  } = usePlayerStore();

  const [realSearchResults, setRealSearchResults] = useState<Song[]>([]);
  const [realAlbumResults, setRealAlbumResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOfflineSearch, setIsOfflineSearch] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setRealSearchResults([]);
        setRealAlbumResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);

      const store = usePlayerStore.getState();
      const isOffline = store.networkMode === 'offline' || store.networkMode === 'offline_forced' || (typeof navigator !== 'undefined' && !navigator.onLine);
      setIsOfflineSearch(isOffline);

      if (isOffline) {
        try {
          const { OfflineCatalog } = await import('@/lib/offline/OfflineCatalog');
          const offlineTracks = await OfflineCatalog.getInstance().searchOfflineTracks(searchQuery);
          if (!isCancelled) {
            const mappedSongs: Song[] = offlineTracks.map((t) => ({
              id: t.trackId,
              title: t.title,
              artist: t.artist,
              artistId: `art-${t.trackId}`,
              album: t.album || 'Offline',
              albumId: `alb-${t.trackId}`,
              coverUrl: t.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop',
              duration: t.duration || Math.round(t.durationMs / 1000) || 180,
              audioUrl: '',
              genre: 'OFFLINE',
              category: 'melody',
              releaseYear: new Date().getFullYear(),
              plays: t.playCount || 1,
              likes: 1,
            }));
            setRealSearchResults(mappedSongs);
            setRealAlbumResults([]);
          }
        } catch (err) {
          console.warn('Offline search error:', err);
        } finally {
          if (!isCancelled) setIsSearching(false);
        }
        return;
      }

      try {
        const [songResults, albumResults] = await Promise.all([
          RealMusicEngine.getInstance().searchRealSongs(searchQuery, 16),
          RealMusicEngine.getInstance().searchRealAlbums(searchQuery, 8)
        ]);
        if (!isCancelled) {
          setRealSearchResults(songResults);
          setRealAlbumResults(albumResults);

          // 3-Tier Language System: Inferred search intent signal
          // Searching another language records soft interest without modifying global preferredLanguage
          const { LanguageEligibilityEngine } = await import('@/lib/language/LanguageEligibilityEngine');
          const inferredLang = LanguageEligibilityEngine.getInstance().inferLanguageFromQuery(searchQuery);
          if (inferredLang) {
            usePlayerStore.getState().recordLanguageInterest(inferredLang, 0.15);
          }
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const { preferredLanguage, setPreferredLanguage, setActiveTab, setSelectedPlaylistId } = usePlayerStore();

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
    { rank: 3, term: 'hit 3 songs' },
    { rank: 4, term: 'arijit singh' },
    { rank: 5, term: 'love songs telugu' },
  ];

  return (
    <div className="space-y-6 pb-24 text-white select-none">
      
      {/* 3D Liquid Lens Search Bar (Level 1 Soft Lens) */}
      <div className="relative">
        <div className="relative flex items-center rounded-2xl lens-soft border border-white/18 focus-within:border-[#E50914]/60 shadow-[0_12px_35px_rgba(0,0,0,0.6)] focus-within:shadow-[0_12px_40px_rgba(229,9,20,0.25)] transition-all">
          <Search className="w-5 h-5 text-[#E50914] ml-4 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="✦ Search songs, lyrics in Telugu/English, or ask AI DJ..."
            className="w-full bg-transparent px-3.5 py-3.5 text-sm text-white placeholder-slate-400 font-medium focus:outline-none"
            autoFocus
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="mr-3.5 px-2 py-1 text-xs text-slate-400 hover:text-white rounded-lg bg-white/5"
            >
              Clear
            </button>
          ) : (
            <div className="mr-3.5 flex items-center gap-1.5">
              <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-mono text-slate-400">AI DJ</span>
              <Mic className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>

        {/* AI DJ Natural Language Prompt Suggestions */}
        {!searchQuery && (
          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar py-1">
            {[
              '“Late night Telugu melodies”',
              '“Sid Sriram top tracks in FLAC”',
              '“Energetic gym Telugu beats”',
              '“2000s nostalgic classics”'
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => setSearchQuery(prompt.replace(/[“”]/g, ''))}
                className="px-3 py-1.5 rounded-full lens-floating text-xs font-medium text-slate-300 hover:text-white border border-white/12 hover:border-[#E50914]/40 whitespace-nowrap transition-all active:scale-95"
              >
                ✦ {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {!searchQuery && (
        <>
          {/* Browse Categories Tile Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Browse Categories</h3>
            <div className="grid grid-cols-2 gap-3">
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
                        setActiveTab('browse');
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
                  className="w-full py-3.5 px-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-sm font-black text-[#EF233C] min-w-[16px]">{item.rank}</span>
                  <span className="text-sm font-bold text-slate-200 capitalize">{item.term}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Active Search Results */}
      {searchQuery && (
        <div className="space-y-6">
          {/* Offline Notice Banner */}
          {isOfflineSearch && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
              <span className="font-bold">You're offline — Showing downloaded music</span>
              <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">Local Index</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Search className="w-4 h-4 text-[#EF233C]" /> Search Results {isOfflineSearch && `(${realSearchResults.length} offline tracks)`}
            </h3>
            {isSearching && (
              <span className="text-xs font-bold text-[#EF233C] flex items-center gap-1.5 animate-pulse">
                <Radio className="w-4 h-4" /> Searching...
              </span>
            )}
          </div>

          {/* Albums Section */}
          {realAlbumResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-[#EF233C]" /> Albums
              </h4>
              <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                {realAlbumResults.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => {
                      usePlayerStore.getState().setSelectedPlaylistId(`album:${album.id}`);
                      usePlayerStore.getState().setActiveTab('playlist');
                    }}
                    className="w-32 flex-shrink-0 cursor-pointer group"
                  >
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2">
                      <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">{album.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{album.artist || 'Various Artists'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Songs Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-[#EF233C]" /> Songs ({realSearchResults.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {realSearchResults.map((song) => {
              const isLiked = likedSongIds.includes(song.id);
              const isDownloaded = downloadedSongIds.includes(song.id);
              return (
                <div
                  key={song.id}
                  className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/10 flex items-center gap-3 group"
                >
                  {/* Album Art */}
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    onClick={() => playSong(song, realSearchResults)}
                    className="w-11 h-11 rounded-xl object-cover shadow-sm flex-shrink-0 cursor-pointer"
                  />

                  {/* Title + Artist — takes all remaining space, truncates */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => playSong(song, realSearchResults)}
                  >
                    <h4 className="text-xs font-bold text-white group-hover:text-[#EF233C] transition-colors truncate">
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{song.artist}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <SongActionMenu song={song} />
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
