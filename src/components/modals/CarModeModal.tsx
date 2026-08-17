'use client';

import React, { useState } from 'react';
import { 
  X, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, 
  Mic, Volume2, Car, Moon, Sun, Sparkles 
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

interface CarModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CarModeModal({ isOpen, onClose }: CarModeModalProps) {
  const { 
    currentSong, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrev,
    likedSongIds,
    toggleLikeSong,
    shuffleMode,
    toggleShuffle,
    setToastMessage
  } = usePlayerStore();

  const [isDayMode, setIsDayMode] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  if (!isOpen) return null;

  const handleVoiceSearch = () => {
    setIsListeningVoice(true);
    setToastMessage('Listening... Say a song or artist');
    
    // Web Speech Recognition if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.start();
        recognition.onresult = (event: any) => {
          const query = event.results[0][0].transcript;
          setIsListeningVoice(false);
          setToastMessage(`Searching: "${query}"`);
          usePlayerStore.getState().setSearchQuery(query);
          usePlayerStore.getState().setActiveTab('search');
          onClose();
        };
        recognition.onerror = () => {
          setIsListeningVoice(false);
        };
        return;
      } catch {}
    }

    setTimeout(() => {
      setIsListeningVoice(false);
      setToastMessage('Voice search ready. Type in Search.');
    }, 2000);
  };

  const songLiked = currentSong ? likedSongIds.includes(currentSong.id) : false;

  return (
    <div className={`fixed inset-0 z-[180] flex flex-col justify-between select-none p-4 sm:p-8 animate-in fade-in duration-200 ${
      isDayMode ? 'bg-slate-900 text-white' : 'bg-black text-white'
    }`}>
      
      {/* TOP BAR: CAR STATUS & CONTROLS */}
      <div className="flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-[#FA233B] text-white flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/30">
            <Car className="w-4 h-4" /> Car Mode
          </div>
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">Drive Safe</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDayMode(!isDayMode)}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Toggle Day/Night Contrast"
          >
            {isDayMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
          </button>

          <button
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Exit Car Mode"
          >
            <X className="w-5 h-5" />
            <span className="text-xs hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>

      {/* CENTER: MASSIVE COVER & TRACK TITLE */}
      <div className="flex flex-col items-center justify-center text-center space-y-6 flex-1 my-auto">
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900">
          <img 
            src={currentSong?.coverUrl || '/app-icon.png'} 
            alt={currentSong?.title || 'Song cover'} 
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-2 max-w-lg px-4">
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight truncate leading-tight">
            {currentSong?.title || 'No Song Playing'}
          </h1>
          <p className="text-base sm:text-xl font-bold text-slate-400 truncate">
            {currentSong?.artist || 'Select a song to start'}
          </p>
        </div>
      </div>

      {/* BOTTOM CONTROLS: OVERSIZED BUTTONS */}
      <div className="space-y-6 max-w-xl mx-auto w-full z-20 pb-4">
        
        {/* Main 3 Playback Giant Touch Targets */}
        <div className="flex items-center justify-center gap-8 sm:gap-12">
          {/* Previous */}
          <button
            onClick={() => {
              import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact()).catch(() => {});
              playPrev();
            }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center shadow-xl transition-transform cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-8 h-8 fill-white" />
          </button>

          {/* Giant Play/Pause */}
          <button
            onClick={() => {
              import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact()).catch(() => {});
              togglePlayPause();
            }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#FA233B] hover:bg-[#d91e32] active:scale-95 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 transition-transform cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-12 h-12 fill-white" />
            ) : (
              <Play className="w-12 h-12 fill-white ml-1.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={() => {
              import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact()).catch(() => {});
              playNext();
            }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center shadow-xl transition-transform cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-8 h-8 fill-white" />
          </button>
        </div>

        {/* Secondary Car Quick Actions */}
        <div className="flex items-center justify-around max-w-sm mx-auto pt-2">
          {/* Favorite */}
          <button
            onClick={() => {
              if (currentSong) toggleLikeSong(currentSong.id);
            }}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/15 text-white active:scale-95 transition-transform cursor-pointer"
            title="Like Song"
          >
            <Heart className={`w-6 h-6 ${songLiked ? 'fill-[#FA233B] text-[#FA233B]' : 'text-white'}`} />
          </button>

          {/* Voice Search */}
          <button
            onClick={handleVoiceSearch}
            className={`p-4 rounded-2xl border active:scale-95 transition-all cursor-pointer ${
              isListeningVoice 
                ? 'bg-[#FA233B] text-white border-[#FA233B] animate-pulse shadow-lg shadow-red-500/30' 
                : 'bg-white/5 hover:bg-white/15 text-cyan-400 border-white/10'
            }`}
            title="Voice Search"
          >
            <Mic className="w-6 h-6" />
          </button>

          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/15 text-white active:scale-95 transition-transform cursor-pointer"
            title="Toggle Shuffle"
          >
            <Shuffle className={`w-6 h-6 ${shuffleMode !== 'OFF' ? 'text-[#FA233B]' : 'text-slate-400'}`} />
          </button>
        </div>

      </div>

    </div>
  );
}
