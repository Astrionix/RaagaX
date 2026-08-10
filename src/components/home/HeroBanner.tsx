'use client';

import React from 'react';
import { Play, Shuffle, Sparkles, Music } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

interface HeroBannerProps {
  featuredSongs: Song[];
  language: string;
  onLanguageChange: (lang: string) => void;
}

const LANGUAGES = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];

export function HeroBanner({ featuredSongs, language, onLanguageChange }: HeroBannerProps) {
  const { playSong, setRemoteState } = usePlayerStore();

  const currentFeatured = featuredSongs.length > 0 ? featuredSongs[0] : null;

  const handlePlayAll = () => {
    if (featuredSongs.length === 0) return;
    setRemoteState({ isShuffle: false });
    playSong(featuredSongs[0], featuredSongs);
  };

  const handleShufflePlay = () => {
    if (featuredSongs.length === 0) return;
    setRemoteState({ isShuffle: true });
    const randomIndex = Math.floor(Math.random() * featuredSongs.length);
    playSong(featuredSongs[randomIndex], featuredSongs);
  };

  return (
    <section className="relative rounded-3xl bg-gradient-to-r from-[#1b0914] via-[#161224] to-[#0a0c12] p-6 sm:p-8 md:p-10 border border-white/10 overflow-hidden shadow-2xl select-none">
      {/* Dynamic Background Art Blur */}
      {currentFeatured && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15 blur-3xl scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${currentFeatured.coverUrl})` }}
        />
      )}

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        
        {/* Left Editorial Text */}
        <div className="space-y-4 text-center md:text-left flex-1 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fa233b]/20 border border-[#fa233b]/30 text-[#fa233b] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Editorial Featured
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            New Releases <span className="text-[#fa233b] block sm:inline">This Week</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-md">
            Hand-curated, verified regional releases across JioSaavn & Spotify Editorial charts.
          </p>

          {/* Regional Language Selector Pills */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  language.toLowerCase() === lang.toLowerCase()
                    ? 'bg-[#fa233b] text-white shadow-md shadow-red-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
            <button
              onClick={handlePlayAll}
              className="px-6 py-3 rounded-full bg-[#fa233b] hover:bg-[#ff3b53] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-xl shadow-red-500/30"
            >
              <Play className="w-4 h-4 fill-white" /> Play All
            </button>
            <button
              onClick={handleShufflePlay}
              className="px-5 py-3 rounded-full font-bold text-xs flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all hover:scale-105"
            >
              <Shuffle className="w-4 h-4 text-slate-300" /> Shuffle
            </button>
          </div>
        </div>

        {/* Right Artwork Showcase */}
        {currentFeatured ? (
          <div className="relative group w-44 h-44 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 cursor-pointer" onClick={handlePlayAll}>
            <img 
              src={currentFeatured.coverUrl} 
              alt={currentFeatured.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
              <p className="text-xs font-black text-white truncate">{currentFeatured.title}</p>
              <p className="text-[10px] text-slate-300 truncate font-medium">{currentFeatured.artist}</p>
            </div>
          </div>
        ) : (
          <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Music className="w-10 h-10 text-slate-600 animate-pulse" />
          </div>
        )}

      </div>
    </section>
  );
}
