'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, 
  Download, CheckCircle2, ChevronUp, Flashlight, Camera, 
  Headphones, Loader2, Sparkles, X, Disc3, ShieldCheck
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { AndroidPlaybackPlayerCard } from '@/components/player/AndroidPlaybackPlayerCard';

interface LockScreenPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LockScreenPlayerModal({ isOpen, onClose }: LockScreenPlayerModalProps) {
  const [timeStr, setTimeStr] = useState('9:41');
  const [dateStr, setDateStr] = useState('Wednesday, 19 August');
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrev,
    toggleShuffle,
    shuffleMode,
    repeatMode,
    cycleRepeatMode,
    likedSongIds,
    downloadedSongIds,
    toggleLikeSong,
  } = usePlayerStore();

  const { tasks } = useDownloadStore();

  // Real-time Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTimeStr(`${hours}:${minutes}`);

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      setDateStr(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);
  const isDownloaded = downloadedSongIds.includes(currentSong.id);
  const downloadTask = tasks[currentSong.id];
  const isDownloading = downloadTask && (downloadTask.status === 'DOWNLOADING' || downloadTask.status === 'QUEUED');
  const downloadPct = downloadTask?.progress || 0;

  const coverUrl = currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  const currentOutputName = 'This Phone';

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Swipe up to unlock handler
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY === null) return;
    const deltaY = e.touches[0].clientY - dragStartY;
    if (deltaY < 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset < -100) {
      import('@/lib/haptics/HapticEngine').then(m => m.haptics.successNotification());
      onClose();
    }
    setDragStartY(null);
    setDragOffset(0);
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateY(${dragOffset}px)` }}
      className="fixed inset-0 z-[100] bg-[#000000] text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden animate-in fade-in duration-300"
    >
      {/* ── Cinematic Ambient Illumination Wallpaper ── */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-125 pointer-events-none transition-all duration-700"
        style={{ backgroundImage: `url(${coverUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/95 pointer-events-none" />

      {/* Top Header: Pro Status & Close Button */}
      <div className="relative z-10 flex items-center justify-between w-full pt-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#E50914] animate-ping" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
            RaagaX Lock Screen
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Dismiss Lock Screen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Top Center: Large Lock Screen Clock & Date ── */}
      <div className="relative z-10 text-center space-y-1 my-auto">
        <h1 className="text-6xl sm:text-8xl font-thin tracking-tight text-white/95 font-sans drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
          {timeStr}
        </h1>
        <p className="text-sm sm:text-base font-semibold text-slate-300 uppercase tracking-wider drop-shadow-md">
          {dateStr}
        </p>
      </div>

      {/* ── Center / Bottom: Premium 3D Glass Android Playback Media Player Card ── */}
      <div className="relative z-10 w-full max-w-md mx-auto my-auto">
        <AndroidPlaybackPlayerCard />
      </div>

      {/* ── Bottom Shortcuts & Swipe Indicator ── */}
      <div className="relative z-10 w-full max-w-md mx-auto space-y-4 pt-2">
        <div className="flex items-center justify-between px-4">
          {/* Flashlight Shortcut */}
          <button
            onClick={() => {
              import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
              setIsFlashlightOn(!isFlashlightOn);
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              isFlashlightOn 
                ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.8)]' 
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            }`}
            title="Flashlight"
          >
            <Flashlight className="w-5 h-5" />
          </button>

          {/* Camera Shortcut */}
          <button
            onClick={() => {
              import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
              onClose();
            }}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer"
            title="Camera"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Swipe Up To Unlock Bar */}
        <div 
          onClick={onClose}
          className="flex flex-col items-center gap-1 text-center cursor-pointer group"
        >
          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white animate-bounce" />
          <span className="text-[11px] font-bold text-slate-400 group-hover:text-white uppercase tracking-widest transition-colors">
            Swipe up to unlock
          </span>
          <div className="w-32 h-1 rounded-full bg-white/40 group-hover:bg-white transition-colors mt-1" />
        </div>
      </div>
    </div>
  );
}
