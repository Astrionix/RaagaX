'use client';

import React, { useState, useEffect } from 'react';
import { Search, Play, Heart, Download, Music, User, Mic, Radio, Flame, Disc3 } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { SongActionMenu } from '@/components/common/SongActionMenu';
import { Song } from '@/types/music';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';

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
      const [songResults, albumResults] = await Promise.all([
        RealMusicEngine.getInstance().searchRealSongs(searchQuery, 16),
        RealMusicEngine.getInstance().searchRealAlbums(searchQuery, 8)
      ]);
      if (!isCancelled) {
        setRealSearchResults(songResults);
        setRealAlbumResults(albumResults);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const categories = [
    { name: 'Telugu', bg: 'from-red-600 to-rose-800' },
    { name: 'New Music', bg: 'from-orange-500 to-amber-700' },
    { name: 'Charts', bg: 'from-[#EF233C] to-red-900' },
    { name: 'Playlists', bg: 'from-blue-600 to-indigo-800' },
    { name: 'Mood', bg: 'from-purple-600 to-violet-900' },
    { name: 'Genres', bg: 'from-pink-600 to-purple-800' },
  ];

  const trendingSearches = [
    { rank: 1, term: 'sid sriram' },
    { rank: 2, term: 'anirudh ravichander' },
    { rank: 3, term: 'hit 3 songs' },
    { rank: 4, term: 'arijit singh' },
    { rank: 5, term: 'love songs telugu' },
  ];

  return (
    <div className="space-y-6 pb-6 text-white select-none">
      {/* Search Header */}
      <h1 className="text-3xl font-black tracking-tight text-white pt-1">Search</h1>

      {/* iOS Search Pill Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Artists, Songs, Lyrics and More"
          className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl py-3 pl-11 pr-10 text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-[#EF233C] transition-colors"
        />
        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
          <Mic className="w-4 h-4" />
        </button>
      </div>

      {!searchQuery && (
        <>
          {/* Browse Categories Tile Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Browse Categories</h3>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSearchQuery(cat.name)}
                  className={`h-24 rounded-2xl bg-gradient-to-br ${cat.bg} p-4 flex items-end font-black text-base text-white shadow-lg active:scale-95 transition-transform text-left`}
                >
                  {cat.name}
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
