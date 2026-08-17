'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Share2, Copy, Check, Play, 
  Flame, Music, Sparkles, User, Globe, Disc, Award, RotateCcw,
  Clock, Heart, ShieldCheck
} from 'lucide-react';
import { MusicRecapData } from '@/lib/recap/RecapEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { ArtistAvatar } from '@/components/common/ArtistAvatar';

interface RecapStoryModalProps {
  recap: MusicRecapData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RecapStoryModal({ recap, isOpen, onClose }: RecapStoryModalProps) {
  const { playSong, setToastMessage } = usePlayerStore();
  const { user } = useAuthStore();
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  const TOTAL_SLIDES = 7;
  const SLIDE_DURATION_MS = 5500;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      setIsPaused(false);
      setCopied(false);
    }
  }, [isOpen, recap?.id]);

  const handleNext = useCallback(() => {
    if (currentSlide >= TOTAL_SLIDES - 1) {
      onClose();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }, [currentSlide, TOTAL_SLIDES, onClose]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  // Story Auto-Advance Timer
  useEffect(() => {
    if (!isOpen || isPaused) return;

    timerRef.current = setTimeout(() => {
      handleNext();
    }, SLIDE_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, currentSlide, isPaused, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen || !recap) return null;

  const handleShare = async () => {
    const text = `🏆 My RaagaX ${recap.title} (${recap.periodLabel}):\n• ${recap.totalListeningDisplay} listened across ${recap.totalSongsPlayed} tracks\n• #1 Song: ${recap.topSong?.song.title || 'Melody'}\n• Top Artist: ${recap.topArtist?.name || 'Various'}\n• Top Language: ${recap.topLanguage}\n• Persona: ${recap.persona.title}\n\nListen lossless on RaagaX!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `RaagaX ${recap.title}`,
          text,
          url: 'https://raagax.com',
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setToastMessage('Recap copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setToastMessage('RaagaX Music Recap');
    }
  };

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'Listener';

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-2 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-md h-[92vh] max-h-[740px] bg-[#0c0d14] border border-white/15 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Story Progress Bars */}
        <div className="absolute top-3.5 left-4 right-4 z-40 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-white transition-all ${
                  idx < currentSlide 
                    ? 'w-full' 
                    : idx === currentSlide && !isPaused
                      ? 'w-full duration-[5500ms] ease-linear' 
                      : idx === currentSlide && isPaused
                        ? 'w-1/2'
                        : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Top Action Header */}
        <div className="absolute top-7 left-4 right-4 z-40 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 backdrop-blur-md">
              {recap.type.toUpperCase()} RECAP
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Click Zones (Left 30% for prev, Right 70% for next) */}
        <div 
          onClick={handlePrev}
          className="absolute inset-y-16 left-0 w-[30%] z-20 cursor-pointer"
          aria-label="Previous slide"
        />
        <div 
          onClick={handleNext}
          className="absolute inset-y-16 right-0 w-[70%] z-20 cursor-pointer"
          aria-label="Next slide"
        />

        {/* ── SLIDE CONTENTS ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 py-14 relative z-10 text-white text-center">
          
          {/* SLIDE 0: INTRO */}
          {currentSlide === 0 && (
            <div className="space-y-6 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#fa233b] to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(250,35,59,0.4)] border border-white/20">
                <Flame className="w-10 h-10 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#fa233b] uppercase tracking-widest mb-1">{recap.periodLabel}</p>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  {recap.title}
                </h2>
                <p className="text-xs text-slate-300 mt-2">
                  Hey {displayName}, your soundtrack for this period is ready.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Tap anywhere to explore
              </div>
            </div>
          )}

          {/* SLIDE 1: TOTAL LISTENING TIME */}
          {currentSlide === 1 && (
            <div className="space-y-6 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-300">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Listening Time</p>
                <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-300 to-indigo-300 tracking-tight">
                  {recap.totalListeningDisplay}
                </h2>
                <p className="text-xs text-slate-300 mt-3">
                  You explored <span className="font-bold text-white">{recap.totalSongsPlayed} tracks</span> during this period.
                </p>
              </div>
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-around text-center mt-4">
                <div>
                  <div className="text-xs text-slate-400">Peak Day</div>
                  <div className="text-sm font-bold text-white mt-0.5">{recap.habits?.mostActiveDayOfWeek || 'Friday'}</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-xs text-slate-400">Peak Time</div>
                  <div className="text-sm font-bold text-white mt-0.5">{recap.habits?.peakHourOfDay || 'Late Night'}</div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: TOP #1 SONG */}
          {currentSlide === 2 && (
            <div className="space-y-5 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <p className="text-xs font-bold text-[#fa233b] uppercase tracking-widest">Your #1 Most Played Song</p>
              
              <div className="relative w-44 h-44 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 group">
                <img 
                  src={recap.topSong?.song.coverUrl || '/app-icon.png'} 
                  alt={recap.topSong?.song.title || 'Song'}
                  className="w-full h-full object-cover"
                />
                {recap.topSong && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      playSong(recap.topSong!.song);
                    }}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#fa233b] text-white flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </button>
                )}
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white truncate max-w-[280px]">
                  {recap.topSong?.song.title || 'Melody'}
                </h3>
                <p className="text-xs font-semibold text-slate-300 mt-1 truncate max-w-[280px]">
                  {recap.topSong?.song.artist || 'Artist'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#fa233b]/20 border border-[#fa233b]/30 rounded-full text-[11px] font-bold text-white mt-3">
                  <Flame className="w-3 h-3 text-[#fa233b]" /> {recap.topSong?.plays || 1} plays
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: TOP ARTIST */}
          {currentSlide === 3 && (
            <div className="space-y-5 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Your Top Artist</p>
              
              <ArtistAvatar 
                name={recap.topArtist?.name || 'Artist'}
                imageUrl={recap.topArtist?.coverUrl}
                language={recap.topLanguage}
                className="w-40 h-40 rounded-full shadow-[0_0_40px_rgba(168,85,247,0.3)] border-4 border-purple-500/40"
              />

              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center gap-1.5">
                  {recap.topArtist?.name || 'Various Artists'}
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  You spent <span className="font-bold text-white">{recap.topArtist?.durationDisplay || recap.totalListeningDisplay}</span> listening to their music.
                </p>
              </div>

              {recap.topArtists.length > 1 && (
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-center gap-2 overflow-hidden text-xs text-slate-300">
                  <span className="text-slate-400">Also loved:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">
                    {recap.topArtists.slice(1, 4).map(a => a.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 4: TOP REGIONAL LANGUAGES */}
          {currentSlide === 4 && (
            <div className="space-y-6 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300">
                <Globe className="w-8 h-8" />
              </div>

              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Language Universe</p>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  {recap.topLanguage} was your #1
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {recap.languageShares.length > 1 
                    ? `You listened across ${recap.languageShares.length} distinct regional languages.`
                    : `Pure devotion to ${recap.topLanguage} melodies.`}
                </p>
              </div>

              <div className="w-full space-y-2.5 bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
                {recap.languageShares.slice(0, 4).map((lang) => (
                  <div key={lang.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white">{lang.name}</span>
                      <span className="text-emerald-400">{lang.percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" 
                        style={{ width: `${lang.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLIDE 5: DISCOVERIES & HABITS */}
          {currentSlide === 5 && (
            <div className="space-y-5 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Discoveries & Habits</p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                  <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <div className="text-2xl font-black text-white">{recap.newArtistsDiscovered || 1}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">New Artists Discovered</div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                  <RotateCcw className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                  <div className="text-2xl font-black text-white">{recap.mostReplayedSong?.replayCount || recap.mostReplayedSong?.plays || 1}x</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Most Replayed Song</div>
                </div>
              </div>

              {recap.mostReplayedSong && (
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center gap-3 text-left">
                  <img 
                    src={recap.mostReplayedSong.song.coverUrl || '/app-icon.png'} 
                    alt={recap.mostReplayedSong.song.title}
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{recap.mostReplayedSong.song.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{recap.mostReplayedSong.song.artist}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SLIDE 6: PERSONA & SHARE */}
          {currentSlide === 6 && (
            <div className="space-y-6 animate-in zoom-in-95 fade-in duration-300 flex flex-col items-center">
              <div className="p-3 bg-[#fa233b]/20 border border-[#fa233b]/40 rounded-2xl text-[#fa233b]">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-amber-300 border border-white/15">
                  {recap.persona.badge}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-3">
                  {recap.persona.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 px-2 leading-relaxed">
                  {recap.persona.description}
                </p>
              </div>

              <div className="w-full pt-2 flex flex-col gap-2.5 z-30 pointer-events-auto">
                <button
                  onClick={handleShare}
                  className="w-full py-3 rounded-2xl bg-[#fa233b] hover:bg-[#d91e32] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  <span>{copied ? 'Copied Recap Link!' : 'Share Your Recap'}</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Back to Music
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Slide Indicators */}
        <div className="p-4 flex items-center justify-between text-xs text-slate-500 relative z-30">
          <button 
            onClick={handlePrev} 
            disabled={currentSlide === 0}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-opacity cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-mono text-[11px] font-semibold">{currentSlide + 1} / {TOTAL_SLIDES}</span>
          <button 
            onClick={handleNext}
            className="p-2 text-slate-400 hover:text-white transition-opacity cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
