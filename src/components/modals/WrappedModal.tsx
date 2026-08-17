'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Share2, Copy, Check, Download, 
  Flame, Music, Sparkles, User, Globe, Disc, Play, Award, RotateCcw,
  Volume2
} from 'lucide-react';
import { WrappedGenerator, WrappedData } from '@/lib/analytics/WrappedGenerator';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';

interface WrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  year?: number;
}

export function WrappedModal({ isOpen, onClose, year = 2026 }: WrappedModalProps) {
  const { user } = useAuthStore();
  const { playSong, setToastMessage } = usePlayerStore();
  
  const [data, setData] = useState<WrappedData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeShareCard, setActiveShareCard] = useState<'top_song' | 'top_artist' | 'full_recap'>('full_recap');

  const TOTAL_SLIDES = 6;

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      WrappedGenerator.getInstance()
        .generateWrapped(user?.id || 'guest', year)
        .then(res => setData(res))
        .catch(() => {});
    }
  }, [isOpen, user?.id, year]);

  // Keyboard navigation & timer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlide(prev => Math.min(prev + 1, TOTAL_SLIDES - 1));
      }
      if (e.key === 'ArrowLeft') {
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const handleShare = async () => {
    const text = `🏆 My RaagaX ${year} Wrapped:\n• ${data.totalListeningDisplay} listened\n• #1 Song: ${data.topSong?.song.title || 'Melody'}\n• Top Artist: ${data.topArtist?.name || 'Various'}\n• Top Language: ${data.topLanguage} (${data.languageShares[0]?.percentage || 100}%)\n• Persona: ${data.persona.title}\n\nListen on RaagaX Studio!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `RaagaX ${year} Wrapped`,
          text,
          url: 'https://raagax.com',
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setToastMessage('Wrapped recap copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setToastMessage('RaagaX Wrapped 2026');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-2 sm:p-4 select-none animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg h-[92vh] max-h-[780px] bg-[#0d0e15] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
        
        {/* Top Progress Bars (Story Style) */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-white transition-all duration-300 ${
                  idx <= currentSlide ? 'w-full' : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-7 right-4 z-30 p-2 rounded-full bg-black/40 text-slate-300 hover:text-white hover:bg-black/60 transition-all cursor-pointer backdrop-blur-md"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Slide Content Area */}
        <div className="flex-1 flex flex-col justify-center px-6 pt-16 pb-6 relative z-10 text-center">
          
          {/* SLIDE 0: Welcome & Total Listening Time */}
          {currentSlide === 0 && (
            <div className="space-y-6 animate-in zoom-in-95 duration-300 flex flex-col items-center">
              <div className="px-3.5 py-1 rounded-full bg-[#FA233B]/20 border border-[#FA233B]/30 text-xs font-black uppercase tracking-widest text-[#FA233B]">
                RAAGAX WRAPPED {year}
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Your Year in Music
              </h2>

              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-[#FA233B] via-rose-500 to-amber-400 p-1 shadow-2xl flex items-center justify-center my-2">
                <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-2 text-center">
                  <Flame className="w-8 h-8 text-[#FA233B] mb-1" />
                  <span className="text-xl font-black text-white leading-none">{data.totalListeningDisplay}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono mt-1">Listened</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-200">
                  You played <span className="text-white font-black">{data.totalSongsPlayed} songs</span> across your regional library.
                </p>
                <p className="text-xs text-slate-400">
                  {data.downloadedPercentage}% listened completely offline in private storage.
                </p>
              </div>
            </div>
          )}

          {/* SLIDE 1: #1 Top Song */}
          {currentSlide === 1 && (
            <div className="space-y-5 animate-in zoom-in-95 duration-300 flex flex-col items-center">
              <span className="text-xs font-mono font-bold text-[#FA233B] uppercase tracking-widest">
                YOUR #1 SONG OF {year}
              </span>

              <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 group">
                <img 
                  src={data.topSong?.song.coverUrl || '/app-icon.png'} 
                  alt={data.topSong?.song.title || 'Top Song'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#FA233B] text-white font-black text-[10px] shadow">
                  #1
                </div>
              </div>

              <div className="space-y-1 max-w-xs">
                <h3 className="text-xl sm:text-2xl font-black text-white truncate">
                  {data.topSong?.song.title || 'Melody Song'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-medium truncate">
                  {data.topSong?.song.artist || 'Unknown Artist'}
                </p>
                <div className="pt-2 text-xs font-mono text-emerald-400 font-bold">
                  {data.topSong?.plays || 1} plays • {data.topSong?.durationDisplay || '3m'} listened
                </div>
              </div>

              {data.topSong && (
                <button
                  onClick={() => playSong(data.topSong!.song)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#FA233B] text-white font-bold text-xs shadow-lg hover:scale-105 transition-transform cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Play #1 Song
                </button>
              )}
            </div>
          )}

          {/* SLIDE 2: Top 5 Songs List */}
          {currentSlide === 2 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-300 text-left">
              <div className="text-center pb-1">
                <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest">
                  YOUR TOP TRACKS
                </span>
                <h3 className="text-2xl font-black text-white">Top 5 Songs of {year}</h3>
              </div>

              <div className="space-y-2 max-w-sm mx-auto">
                {data.top10Songs.slice(0, 5).map((item, idx) => (
                  <div 
                    key={item.song.id || idx}
                    onClick={() => playSong(item.song)}
                    className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`w-5 text-center font-mono font-black text-sm ${
                        idx === 0 ? 'text-[#FA233B]' : 'text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <img 
                        src={item.song.coverUrl || '/app-icon.png'} 
                        alt={item.song.title} 
                        className="w-10 h-10 rounded-xl object-cover shadow bg-slate-800 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                          {item.song.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">{item.song.artist}</p>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-300 flex-shrink-0">
                      {item.plays} plays
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLIDE 3: Top Artist & Album */}
          {currentSlide === 3 && (
            <div className="space-y-5 animate-in zoom-in-95 duration-300 flex flex-col items-center">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                YOUR TOP ARTIST & ALBUM
              </span>

              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                {/* Artist Card */}
                <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 flex flex-col items-center text-center space-y-2">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FA233B] to-purple-600 flex items-center justify-center text-xl font-black text-white shadow-xl">
                    {data.topArtist?.name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Top Artist</span>
                  <h4 className="text-sm font-black text-white truncate w-full">{data.topArtist?.name || 'Various'}</h4>
                  <span className="text-xs font-mono font-bold text-emerald-400">{data.topArtist?.plays || 0} plays</span>
                </div>

                {/* Album Card */}
                <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 flex flex-col items-center text-center space-y-2">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl bg-slate-800">
                    <img 
                      src={data.topAlbum?.coverUrl || data.topSong?.song.coverUrl || '/app-icon.png'} 
                      alt="Top Album" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Top Album</span>
                  <h4 className="text-sm font-black text-white truncate w-full">{data.topAlbum?.title || 'Singles'}</h4>
                  <span className="text-xs text-slate-400 truncate w-full">{data.topAlbum?.artist || 'Various'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 max-w-xs">
                You discovered <span className="text-white font-bold">{data.newArtistsDiscovered} new artists</span> this year!
              </div>
            </div>
          )}

          {/* SLIDE 4: Regional Languages Breakdown */}
          {currentSlide === 4 && (
            <div className="space-y-5 animate-in zoom-in-95 duration-300 text-left max-w-sm mx-auto">
              <div className="text-center pb-1">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  REGIONAL TAPESTRY
                </span>
                <h3 className="text-2xl font-black text-white">Your Music Languages</h3>
              </div>

              <div className="space-y-3">
                {data.languageShares.slice(0, 4).map(lang => (
                  <div key={lang.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white">{lang.name}</span>
                      <span className="text-cyan-400 font-mono">{lang.percentage}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(lang.percentage, 8)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {lang.songsPlayed} songs • {lang.hoursListened}h
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 text-center">
                Top Language: <span className="font-bold text-white">{data.topLanguage}</span>
              </div>
            </div>
          )}

          {/* SLIDE 5: Listener Persona & Share Card */}
          {currentSlide === 5 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-300 flex flex-col items-center">
              <div className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                {data.persona.badge}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {data.persona.title}
              </h2>

              <p className="text-xs text-slate-300 max-w-xs italic">
                "{data.persona.tagline}"
              </p>

              {/* Shareable Summary Card Box */}
              <div className={`w-full max-w-xs p-4 rounded-3xl bg-gradient-to-br ${data.persona.gradient} shadow-2xl text-left text-white space-y-3 relative overflow-hidden border border-white/20`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest opacity-80">RAAGAX • {year}</span>
                  <span className="text-[10px] font-bold bg-black/30 px-2 py-0.5 rounded-full">{data.persona.badge}</span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-2xl font-black">{data.totalListeningDisplay}</div>
                  <div className="text-[10px] opacity-80">Total Listening Time</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/20">
                  <div>
                    <span className="text-[9px] uppercase opacity-75 block font-mono">#1 Song</span>
                    <span className="font-bold truncate block">{data.topSong?.song.title || 'Melody'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase opacity-75 block font-mono">Top Artist</span>
                    <span className="font-bold truncate block">{data.topArtist?.name || 'Various'}</span>
                  </div>
                </div>
              </div>

              {/* Share Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleShare}
                  className="px-6 py-2.5 rounded-full bg-white text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-xl cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Share Wrapped'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Navigation Controls */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between relative z-20 backdrop-blur-md">
          <button
            onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-xs font-mono text-slate-400 font-bold">
            {currentSlide + 1} of {TOTAL_SLIDES}
          </span>

          <button
            onClick={() => {
              if (currentSlide === TOTAL_SLIDES - 1) {
                onClose();
              } else {
                setCurrentSlide(prev => Math.min(prev + 1, TOTAL_SLIDES - 1));
              }
            }}
            className="px-4 py-2 rounded-xl bg-[#FA233B] hover:bg-[#d91e32] text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>{currentSlide === TOTAL_SLIDES - 1 ? 'Done' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
