'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Play,
  Pause,
  Heart,
  Download,
  Flame,
  Radio as RadioIcon,
  Disc3,
  Clock,
  Radio,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { RecommendationEngine } from '@/lib/recommendationEngine';

export function HomeView() {
  const {
    playSong,
    currentSong,
    isPlaying,
    likedSongIds,
    likedSongs,
    toggleLikeSong,
    downloadedSongIds,
    toggleDownloadSong,
    activeGenreFilter,
    setActiveGenreFilter,
    setSelectedArtistId,
    preferredLanguage,
  } = usePlayerStore();

  const [realSongs, setRealSongs] = useState<Song[]>([]);
  const [top100, setTop100] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good Morning');
  const [topArtistName, setTopArtistName] = useState('Sid Sriram');
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<Song[]>([]);
  const [isTop100Expanded, setIsTop100Expanded] = useState(false);

  const trendingRef = useRef<HTMLDivElement>(null);
  const top100Ref = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      ref.current.scrollBy({ left: direction === 'left' ? -800 : 800, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening');
  }, []);

  useEffect(() => {
    async function fetchHomeData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/home?language=${preferredLanguage}`);
        const result = await res.json();

        if (result.success && result.data) {
          const { trending, newReleases, top100, playlists: apiPlaylists } = result.data;

          if (trending && trending.length > 0) {
            setRealSongs(trending);
            const prefs = RecommendationEngine.getInstance().getPreferences();
            const ranked = RecommendationEngine.getInstance().rankSongs(trending);
            setTopArtistName(prefs.lastArtist || trending[0].artist);
            setFilteredSongs(ranked.length > 0 ? ranked : trending);
          }

          setTop100(top100 || []);
          setPlaylists(apiPlaylists || []);
        }
      } catch (e) {
        console.error('Failed to fetch home data', e);
      } finally {
        setIsLoading(false);
      }
    }
    async function fetchAiRecommendations() {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data } = await supabase
            .from('ai_recommendations')
            .select('recommended_songs')
            .eq('user_id', session.user.id)
            .single();
            
          if (data && data.recommended_songs) {
            setAiRecommendations(data.recommended_songs);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch AI recommendations', e);
      }
    }
    
    fetchHomeData();
    fetchAiRecommendations();
  }, [preferredLanguage]);

  const featuredSong = filteredSongs[0] || null;



  return (
    <div className="space-y-8 pb-6 text-white select-none">
      {/* Clean Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{greeting}</h1>
          <p className="text-xs text-slate-400 font-medium">Discover what's trending this week</p>
        </div>
      </div>



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
                  <Play className="w-6 h-6 fill-white text-white" />
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

      {/* Liked Songs Section */}
      {likedSongs && likedSongs.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#EF233C] fill-[#EF233C]" /> Liked Songs
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (likedSongs.length > 0) playSong(likedSongs[0], likedSongs);
                  }}
                  className="ml-2 w-7 h-7 rounded-full bg-[#EF233C] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-md shadow-[#EF233C]/20"
                >
                  <Play className="w-3 h-3 fill-white ml-0.5" />
                </button>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs font-bold text-slate-400 hover:text-white transition-colors">See All &gt;</button>
            </div>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar w-full min-w-0 overflow-y-hidden">
            {likedSongs.map((song) => (
              <div
                key={song.id}
                onClick={() => playSong(song, likedSongs)}
                className="p-3 min-w-[160px] max-w-[160px] w-[160px] flex-none rounded-2xl surface-card surface-card-hover space-y-2.5 cursor-pointer group flex-shrink-0"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-md relative">
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLikeSong(song.id); }} 
                    className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md ${likedSongIds.includes(song.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <Heart className={`w-4 h-4 ${likedSongIds.includes(song.id) ? 'fill-[#EF233C] text-[#EF233C]' : 'text-white'}`} />
                  </button>

                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-xl">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-[11px] sm:text-xs font-extrabold text-white truncate group-hover:text-[#EF233C] transition-colors">{song.title}</h4>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5 font-medium leading-snug">{song.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1. Trending Tracks */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-white tracking-tight">🔥 Trending {preferredLanguage}</h2>
            {isLoading && (
              <span className="text-[10px] font-bold text-[#EF233C] flex items-center gap-1 animate-pulse">
                <Radio className="w-3 h-3" /> Syncing...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => scrollCarousel(trendingRef, 'left')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
            <button onClick={() => scrollCarousel(trendingRef, 'right')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>

        <div ref={trendingRef} className="flex overflow-x-auto gap-4 pb-4 no-scrollbar w-full min-w-0 overflow-y-hidden">
          {filteredSongs.slice(0, 10).map((song) => (
            <div
              key={song.id}
              onClick={() => playSong(song, realSongs)}
              className="p-3 min-w-[160px] max-w-[160px] w-[160px] flex-none rounded-2xl surface-card surface-card-hover space-y-2.5 cursor-pointer group flex-shrink-0"
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden shadow-md relative">
                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleLikeSong(song.id); }} 
                  className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md z-10 ${likedSongIds.includes(song.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Heart className={`w-4 h-4 ${likedSongIds.includes(song.id) ? 'fill-[#EF233C] text-[#EF233C]' : 'text-white'}`} />
                </button>

                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-xl">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-[11px] sm:text-xs font-extrabold text-white truncate group-hover:text-[#EF233C] transition-colors">{song.title}</h4>
                <p className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5 font-medium leading-snug">{song.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 1.5 AI Recommendations - Split into 3 sections */}
      {aiRecommendations.length > 0 && (
        <>
          {/* Section 1: AI DJ */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span className="text-xl">🤖</span> AI DJ For You
                </h2>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">GENERATED BY RAAGAX ML ENGINE</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => scrollCarousel(aiRef, 'left')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
                <button onClick={() => scrollCarousel(aiRef, 'right')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
              </div>
            </div>
            <div ref={aiRef} className="flex overflow-x-auto gap-4 pb-4 no-scrollbar w-full min-w-0 overflow-y-hidden">
              {aiRecommendations.slice(0, 5).map((song) => (
                <div
                  key={song.id}
                  onClick={() => playSong(song, aiRecommendations)}
                  className="p-3 min-w-[160px] max-w-[160px] w-[160px] flex-none rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 hover:from-indigo-500/20 hover:to-purple-500/10 border border-indigo-500/20 transition-all duration-300 space-y-2.5 cursor-pointer group flex-shrink-0 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/20 blur-2xl rounded-full -mr-8 -mt-8 group-hover:bg-indigo-500/40 transition-colors"></div>
                  <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg relative border border-white/5">
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform shadow-indigo-500/30">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] sm:text-xs font-extrabold text-white truncate group-hover:text-indigo-400 transition-colors">{song.title}</h4>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5 font-medium leading-snug">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Discovery Mix */}
          {aiRecommendations.length > 5 && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <span className="text-xl">✨</span> Discovery Mix
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">HIDDEN GEMS TAILORED TO YOUR TASTE</p>
                </div>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar w-full min-w-0 overflow-y-hidden">
                {aiRecommendations.slice(5, 10).map((song) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, aiRecommendations)}
                    className="p-3 min-w-[160px] max-w-[160px] w-[160px] flex-none rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 hover:from-emerald-500/20 hover:to-teal-500/10 border border-emerald-500/20 transition-all duration-300 space-y-2.5 cursor-pointer group flex-shrink-0"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg relative border border-white/5">
                      <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform shadow-emerald-500/30">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-extrabold text-white truncate group-hover:text-emerald-400 transition-colors">{song.title}</h4>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5 font-medium leading-snug">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Deep Cuts */}
          {aiRecommendations.length > 10 && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <span className="text-xl">🔮</span> Deep Cuts
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">BASED ON YOUR PLAYBACK HISTORY</p>
                </div>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar w-full min-w-0 overflow-y-hidden">
                {aiRecommendations.slice(10, 15).map((song) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, aiRecommendations)}
                    className="p-3 min-w-[160px] max-w-[160px] w-[160px] flex-none rounded-2xl bg-gradient-to-br from-rose-500/10 to-orange-500/5 hover:from-rose-500/20 hover:to-orange-500/10 border border-rose-500/20 transition-all duration-300 space-y-2.5 cursor-pointer group flex-shrink-0"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg relative border border-white/5">
                      <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform shadow-rose-500/30">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[11px] sm:text-xs font-extrabold text-white truncate group-hover:text-rose-400 transition-colors">{song.title}</h4>
                      <p className="text-[9px] sm:text-[10px] text-slate-400 truncate mt-0.5 font-medium leading-snug">{song.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* 2. Top 100 */}
      {top100.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">📈 {preferredLanguage} Top 100</h2>
            </div>
            <button 
              onClick={() => setIsTop100Expanded(!isTop100Expanded)}
              className="text-xs font-bold text-slate-400 hover:text-[#EF233C] transition-colors pr-2"
            >
              {isTop100Expanded ? 'Show Less' : 'See All >'}
            </button>
          </div>

          <div className="flex flex-col space-y-1.5 w-full">
            {(isTop100Expanded ? top100 : top100.slice(0, 10)).map((song, idx) => (
              <div
                key={song.id}
                onClick={() => playSong(song, top100)}
                className="flex items-center gap-4 p-2 rounded-xl hover:bg-white/5 group cursor-pointer transition-colors"
              >
                <div className="w-8 text-center flex-shrink-0 text-slate-400 font-mono font-medium group-hover:text-white transition-colors">
                  {(idx + 1).toString().padStart(2, '0')}
                </div>
                <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden">
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate leading-tight group-hover:text-[#EF233C] transition-colors">
                    {song.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {song.artist}
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-mono pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {song.duration ? `${Math.floor(Number(song.duration) / 60)}:${Math.floor(Number(song.duration) % 60).toString().padStart(2, '0')}` : '3:45'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Popular Playlists */}
      {playlists.length > 0 && (
        <section className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🎧</span> Popular Playlists
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map((pl, idx) => (
              <div
                key={pl.id}
                onClick={() => {
                  if (pl.songs && pl.songs.length > 0) {
                    playSong(pl.songs[0], pl.songs);
                  }
                }}
                className="group relative flex flex-col gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg">
                  <img
                    src={pl.coverUrl}
                    alt={pl.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-full bg-[#EF233C] flex items-center justify-center translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-lg">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-1 pt-1">
                  <h3 className="font-bold text-sm text-white line-clamp-1">{pl.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-snug">
                    {pl.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
