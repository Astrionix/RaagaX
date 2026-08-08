'use client';

import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  Download,
  Flame,
  Radio as RadioIcon,
  Disc3,
  Clock,
  Radio
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { RecommendationEngine } from '@/lib/recommendationEngine';
import { Song } from '@/types/music';
import { POPULAR_ARTISTS } from '@/lib/popularArtists';

export function HomeView() {
  const {
    playSong,
    currentSong,
    isPlaying,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    toggleDownloadSong,
    activeGenreFilter,
    setActiveGenreFilter,
    setSelectedArtistId,
  } = usePlayerStore();

  const [realSongs, setRealSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good Morning');

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening');
  }, []);

  useEffect(() => {
    async function loadRealTracks() {
      setIsLoading(true);
      const liveSongs = await RealMusicEngine.getInstance().getRealTrendingSongs(16);
      if (liveSongs && liveSongs.length > 0) {
        setRealSongs(liveSongs);
      }
      setIsLoading(false);
    }
    loadRealTracks();
  }, []);

  const userPrefs = RecommendationEngine.getInstance().getPreferences();
  const recommendedSongs = RecommendationEngine.getInstance().rankSongs(realSongs);
  const topArtistName = userPrefs.lastArtist || 'Sid Sriram';
  const filteredSongs = recommendedSongs.length > 0 ? recommendedSongs : realSongs;
  const featuredSong = filteredSongs[0] || null;

  const dailyMixes = [
    { id: 'mix-1', title: 'Daily Mix 1', desc: 'Sid Sriram, Thaman S, Gopi Sundar', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80', songs: realSongs.slice(0, 3) },
    { id: 'mix-2', title: 'Daily Mix 2', desc: 'Anirudh, Rahul Sipligunj, DSP', cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80', songs: realSongs.slice(3, 6) },
    { id: 'mix-3', title: 'Focus & Study Mix', desc: 'Ambient Telugu Flute & Acoustic Beats', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80', songs: realSongs.slice(6, 9) },
    { id: 'mix-4', title: 'Weekend Party Mix', desc: 'High Energy Mass Party Anthems', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80', songs: realSongs.slice(9, 12) },
  ];

  return (
    <div className="space-y-8 pb-6 text-white select-none">
      {/* Clean Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{greeting}</h1>
          <p className="text-xs text-slate-400 font-medium">Apple Music Experience for RaagaX</p>
        </div>
      </div>

      {/* Dynamic Recommendation Card: Because You Enjoyed */}
      <section className="p-6 rounded-3xl bg-[#161618] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#EF233C] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Contextual Recommendation Engine
          </span>
          <h3 className="text-lg font-black text-white">Because you&apos;re enjoying {topArtistName}</h3>
          <p className="text-xs text-slate-400">Handpicked Telugu Melody Mix weighted by your listening profile & completion rates.</p>
        </div>
        <button
          onClick={() => playSong(filteredSongs[0] || realSongs[0], filteredSongs)}
          className="px-6 py-2.5 rounded-2xl bg-[#EF233C] text-white font-extrabold text-xs shadow-lg shadow-red-500/20 hover:scale-105 transition-transform flex-shrink-0"
        >
          ▶ Play Mix
        </button>
      </section>

      {/* Elegant Apple Music Red Feature Card */}
      <section className="relative rounded-2xl bg-gradient-to-r from-[#800A18] via-[#EF233C] to-[#59040F] p-8 sm:p-12 overflow-hidden shadow-2xl text-white border border-red-500/30 flex flex-col items-center justify-center text-center space-y-4">
        <p className="text-xs font-extrabold tracking-widest uppercase text-white/90">
          Explore millions of live tracks. All Lossless & Ad-free.
        </p>

        {/* 3D Music Branding */}
        <div className="flex items-center gap-3 py-1">
          <Disc3 className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '14s' }} />
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-white drop-shadow-lg">
            Raaga<span className="text-black/80">X</span> Music
          </h2>
        </div>

        <div className="pt-2">
          <button
            onClick={() => featuredSong && playSong(featuredSong, realSongs)}
            className="px-8 py-3 rounded-full bg-white text-[#EF233C] font-black text-xs uppercase tracking-wider hover:scale-105 transition-transform shadow-xl"
          >
            ▶ Listen Now
          </button>
        </div>

        <p className="text-[11px] text-white/75 font-medium">
          320kbps High Fidelity Studio Audio • RaagaX Engine
        </p>
      </section>

      {/* Continue Listening Section */}
      {currentSong && (
        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#EF233C]" /> Continue Listening
          </h2>

          <div
            onClick={() => playSong(currentSong, realSongs)}
            className="p-3 rounded-2xl surface-card surface-card-hover flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md flex-shrink-0 relative">
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-[#EF233C] uppercase tracking-wider">RESUME PLAYBACK</span>
                  <span className="text-[8px] font-mono bg-black/60 text-slate-300 px-1.5 py-0.2 rounded font-semibold border border-white/10">
                    {currentSong.audioQuality || '24-bit FLAC'}
                  </span>
                </div>
                <h3 className="text-xs font-extrabold text-white group-hover:text-[#EF233C] transition-colors mt-0.5">
                  {currentSong.title}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">{currentSong.artist} • {currentSong.album}</p>
              </div>
            </div>

            <button className="w-9 h-9 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform mr-2">
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>
          </div>
        </section>
      )}

      {/* Trending Live Songs Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Trending Tracks</h2>
          </div>
          {isLoading && (
            <span className="text-xs font-bold text-[#EF233C] flex items-center gap-1.5 animate-pulse">
              <Radio className="w-4 h-4" /> Syncing Live Stream Catalog...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSongs.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            const isLiked = likedSongIds.includes(song.id);
            const isDownloaded = downloadedSongIds.includes(song.id);

            return (
              <div
                key={song.id}
                className={`p-3 rounded-2xl bg-[#1C1C1E] border border-white/10 flex items-center gap-3 relative group ${
                  isCurrent ? 'border-[#EF233C] bg-red-500/10' : ''
                }`}
              >
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <button
                    onClick={() => playSong(song, realSongs)}
                    className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-lg">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-extrabold text-white truncate group-hover:text-[#EF233C] transition-colors">
                    {song.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">{song.artist}</p>
                </div>

                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleLikeSong(song.id)} title="Like Song" className="p-1">
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'text-[#EF233C] fill-[#EF233C]' : 'text-slate-400 hover:text-[#EF233C]'}`} />
                  </button>
                  <button onClick={() => toggleDownloadSong(song.id)} title="Download Offline" className="p-1">
                    <Download className={`w-3.5 h-3.5 ${isDownloaded ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Made For You Daily Mixes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Made For You</h2>
            <p className="text-xs text-slate-400">Personalized Daily Mixes & Flow Streams</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dailyMixes.map((mix) => (
            <div
              key={mix.id}
              onClick={() => mix.songs.length > 0 && playSong(mix.songs[0], realSongs)}
              className="p-4 rounded-2xl surface-card surface-card-hover space-y-3 cursor-pointer group"
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden shadow-md relative">
                <img src={mix.cover} alt={mix.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="w-10 h-10 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-white truncate group-hover:text-[#EF233C] transition-colors">{mix.title}</h4>
                <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 font-medium">{mix.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* Featured Artists */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Artist Spotlight</h2>
            <p className="text-xs text-slate-400">Legends & Contemporary Maestros</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {POPULAR_ARTISTS.map((artist) => (
            <div
              key={artist.id}
              onClick={() => setSelectedArtistId(artist.id)}
              className="p-4 rounded-2xl surface-card surface-card-hover text-center space-y-2.5 cursor-pointer group"
            >
              <div className="w-20 h-20 mx-auto rounded-full overflow-hidden shadow-lg border-2 border-white/10 group-hover:scale-105 transition-transform relative">
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h4 className="text-xs font-black text-white group-hover:text-[#EF233C] transition-colors">{artist.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {(artist.monthlyListeners / 1000000).toFixed(1)}M Monthly Listeners
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
