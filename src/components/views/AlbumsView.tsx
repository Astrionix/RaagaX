'use client';

import React, { useState } from 'react';
import { Play, Sparkles, Disc, Flame, Trophy, Layers } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AlbumCatalogEngine, AlbumItem } from '@/lib/albumCatalog';

const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];

export function AlbumsView() {
  const { 
    preferredLanguage, 
    setPreferredLanguage, 
    setSelectedAlbumId, 
    playSong, 
    setRemoteState 
  } = usePlayerStore();

  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'recent' | 'trending' | 'top'>('all');
  const [realAlbums, setRealAlbums] = useState<AlbumItem[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    const initial = AlbumCatalogEngine.getAlbumsForLanguage(preferredLanguage);
    setRealAlbums(initial);

    AlbumCatalogEngine.fetchRealAlbumsForLanguage(preferredLanguage).then(fetched => {
      if (isMounted && fetched && fetched.length > 0) {
        setRealAlbums(fetched);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [preferredLanguage]);

  const { recentlyReleased, trending, popular } = AlbumCatalogEngine.getThreeCategorizedShelves(preferredLanguage);
  const allAlbums = [...recentlyReleased, ...trending, ...popular];

  const handlePlayAlbum = async (e: React.MouseEvent, album: AlbumItem) => {
    e.stopPropagation();
    let tracks = album.tracks;
    if (!tracks || tracks.length === 0) {
      const { RealMusicEngine } = await import('@/lib/realMusicEngine');
      const details = await RealMusicEngine.getInstance().getPlaylistDetails(`album:${album.id}`);
      tracks = details?.songs || [];
    }
    if (tracks.length > 0) {
      setRemoteState({ isShuffle: false });
      playSong(tracks[0], tracks);
    }
  };

  const handleOpenAlbum = (album: AlbumItem) => {
    setSelectedAlbumId(album.id);
  };

  return (
    <div className="space-y-8 pb-8 select-none">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#1a0c1e] via-[#101424] to-[#07090e] p-6 sm:p-8 border border-white/10 overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fa233b]/20 border border-[#fa233b]/30 text-[#fa233b] text-xs font-bold uppercase tracking-wider">
            <Disc className="w-3.5 h-3.5" /> Official Album Catalog
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Explore <span className="text-[#fa233b]">{preferredLanguage}</span> Albums
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            Verified, ranked full releases and EPs (2+ tracks) curated directly across regional charts.
          </p>

          {/* 6-Language Selector Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setPreferredLanguage(lang)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  preferredLanguage.toLowerCase() === lang.toLowerCase()
                    ? 'bg-[#fa233b] text-white shadow-lg shadow-red-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTabFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTabFilter === 'all' ? 'bg-[#fa233b] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          All 50 Albums
        </button>
        <button
          onClick={() => setActiveTabFilter('recent')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTabFilter === 'recent' ? 'bg-[#fa233b] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🆕 Recently Released
        </button>
        <button
          onClick={() => setActiveTabFilter('trending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTabFilter === 'trending' ? 'bg-[#fa233b] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🔥 Trending
        </button>
        <button
          onClick={() => setActiveTabFilter('top')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTabFilter === 'top' ? 'bg-[#fa233b] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🏆 Top Ranked
        </button>
      </div>

      {/* Shelf 1: Recently Released Albums */}
      {(activeTabFilter === 'all' || activeTabFilter === 'recent') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#fa233b]" /> 🆕 Recently Released Albums
            </h2>
          </div>

          <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {recentlyReleased.map((album) => (
              <div 
                key={album.id}
                onClick={() => handleOpenAlbum(album)}
                className="group relative bg-[#12141c]/60 p-3 rounded-2xl border border-white/5 hover:border-white/20 transition-all hover:scale-[1.02] cursor-pointer shadow-lg w-[145px] sm:w-auto flex-shrink-0 snap-start"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5">
                  <img 
                    src={album.coverUrl} 
                    alt={album.title} 
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=500&h=500';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-slate-800" 
                  />
                  <button
                    onClick={(e) => handlePlayAlbum(e, album)}
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#fa233b] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-105 shadow-xl"
                  >
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </button>
                </div>
                <h3 className="font-bold text-xs text-white truncate">{album.title}</h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">{album.artist}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                  <span>{album.trackCount} tracks</span>
                  <span>•</span>
                  <span>{album.releaseYear}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shelf 2: Trending Albums */}
      {(activeTabFilter === 'all' || activeTabFilter === 'trending') && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> 🔥 Trending Albums
            </h2>
          </div>

          <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {trending.map((album) => (
              <div 
                key={album.id}
                onClick={() => handleOpenAlbum(album)}
                className="group relative bg-[#12141c]/60 p-3 rounded-2xl border border-white/5 hover:border-white/20 transition-all hover:scale-[1.02] cursor-pointer shadow-lg w-[145px] sm:w-auto flex-shrink-0 snap-start"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5">
                  <img 
                    src={album.coverUrl} 
                    alt={album.title} 
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=500&h=500';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-slate-800" 
                  />
                  <button
                    onClick={(e) => handlePlayAlbum(e, album)}
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#fa233b] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-105 shadow-xl"
                  >
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </button>
                </div>
                <h3 className="font-bold text-xs text-white truncate">{album.title}</h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">{album.artist}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                  <span className="text-orange-400 font-bold">Trending</span>
                  <span>•</span>
                  <span>{album.trackCount} tracks</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shelf 3: Top Albums Catalog Grid */}
      {(activeTabFilter === 'all' || activeTabFilter === 'top') && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> 🏆 Popular & Top Ranked Albums
            </h2>
            <span className="text-xs text-slate-400 font-bold">{popular.length} Verified Albums</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popular.map((album, idx) => (
              <div 
                key={album.id}
                onClick={() => handleOpenAlbum(album)}
                className="group relative bg-[#12141c]/60 p-3 rounded-2xl border border-white/5 hover:border-white/20 transition-all hover:scale-[1.02] cursor-pointer shadow-lg"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5">
                  <img 
                    src={album.coverUrl} 
                    alt={album.title} 
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=500&h=500';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-slate-800" 
                  />
                  
                  {/* Rank Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-black border border-white/10">
                    #{idx + 1}
                  </div>

                  <button
                    onClick={(e) => handlePlayAlbum(e, album)}
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#fa233b] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-105 shadow-xl"
                  >
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </button>
                </div>

                <h3 className="font-bold text-xs text-white truncate">{album.title}</h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">{album.artist}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                  <span>{album.trackCount} tracks</span>
                  <span>•</span>
                  <span>{album.releaseYear}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
