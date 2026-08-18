'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, 
  Download, CheckCircle2, ChevronDown, Volume2, Sparkles, Disc3, 
  Loader2, Headphones, Smartphone, Radio, X, Check
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { useDynamicIslandCapabilityStore } from '@/context/useDynamicIslandCapabilityStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';

interface DynamicIslandPlayerProps {
  forceShow?: boolean;
}

export function DynamicIslandPlayer({ forceShow = false }: DynamicIslandPlayerProps) {
  const [mounted, setMounted] = useState(false);
  const [islandState, setIslandState] = useState<'collapsed' | 'expanded' | 'full'>('collapsed');
  const [activityHint, setActivityHint] = useState<string | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { isAvailable } = useDynamicIslandCapabilityStore();

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
    activeDeviceId,
    onlineDevices,
    deviceId,
    remoteDeviceName,
    isActiveDevice,
    togglePlayerExpanded,
    toggleDeviceModal,
  } = usePlayerStore();

  const { tasks } = useDownloadStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update activity hint on track changes
  useEffect(() => {
    if (!currentSong) return;
    setActivityHint(`Next: ${currentSong.title}`);
    const timer = setTimeout(() => setActivityHint(null), 3000);
    return () => clearTimeout(timer);
  }, [currentSong?.id]);

  // NEVER render on unsupported devices or if permission is not granted (unless forced in preview simulator)
  if (!mounted || !currentSong || (!isAvailable && !forceShow)) {
    return null;
  }

  const isLiked = likedSongIds.includes(currentSong.id);
  const isDownloaded = downloadedSongIds.includes(currentSong.id);
  const downloadTask = tasks[currentSong.id];
  const isDownloading = downloadTask && (downloadTask.status === 'DOWNLOADING' || downloadTask.status === 'QUEUED');
  const downloadPct = downloadTask?.progress || 0;

  const coverUrl = currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')
    ? currentSong.coverUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500')
    : '/app-icon.png';

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const localDeviceObj = onlineDevices.find((d) => d.id === deviceId);
  const currentOutputName = !isActiveDevice
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device')
    : (localDeviceObj?.name || 'This Phone');

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleIslandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
    if (islandState === 'collapsed') {
      setIslandState('expanded');
    } else if (islandState === 'expanded') {
      setIslandState('full');
    }
  };

  const handleTouchStart = () => {
    holdTimerRef.current = setTimeout(() => {
      import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact());
      setIslandState('full');
    }, 450);
  };

  const handleTouchEnd = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };

  return (
    <aside 
      aria-label="Dynamic Island Live Activity"
      className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[80] pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none"
    >
      {/* ── COLLAPSED ISLAND PILL ────────────────────────────────────────── */}
      {islandState === 'collapsed' && (
        <div
          role="region"
          aria-label="Dynamic Island Media Controls"
          onClick={handleIslandClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="group relative flex items-center justify-between gap-3.5 px-3.5 py-1.5 rounded-full bg-black/95 text-white border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all min-w-[210px] max-w-[310px] ring-1 ring-white/10"
        >
          {/* Ambient Inner Glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/10 via-purple-500/10 to-transparent pointer-events-none" />

          {/* Left: Animated Artwork / Download indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-900 border border-white/15">
              <img
                src={coverUrl}
                alt={currentSong.title}
                className={`w-full h-full object-cover ${isPlaying ? 'animate-spin' : ''}`}
                style={{ animationDuration: '6s' }}
              />
              {isDownloading && (
                <div className="absolute inset-0 bg-amber-500/80 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-white truncate block max-w-[130px] leading-tight">
                {currentSong.title}
              </span>
              <span className="text-[9px] text-slate-400 truncate block max-w-[130px]">
                {isDownloading ? `Downloading ${downloadPct}%` : activityHint || currentSong.artist}
              </span>
            </div>
          </div>

          {/* Right: Waveform visualizer / Download Pill */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDownloading ? (
              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-full">
                {downloadPct}%
              </span>
            ) : (
              <div className="flex items-end gap-[2px] h-3.5 px-1">
                {[0.6, 1.0, 0.4, 0.8, 0.5].map((scale, i) => (
                  <span
                    key={i}
                    className={`w-[2.5px] rounded-full bg-[#fa233b] transition-all duration-300 ${
                      isPlaying ? 'animate-pulse' : 'opacity-40'
                    }`}
                    style={{
                      height: isPlaying ? `${Math.max(4, scale * 14)}px` : '4px',
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPANDED ISLAND NOTCH ────────────────────────────────────────── */}
      {islandState === 'expanded' && (
        <div
          role="region"
          aria-label="Expanded Island Controls"
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col w-[360px] max-w-[92vw] rounded-[32px] bg-black/95 text-white border border-white/15 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        >
          {/* Top Row: Artwork + Track Details + Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div 
                onClick={() => {
                  setIslandState('collapsed');
                  togglePlayerExpanded();
                }}
                className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-lg bg-slate-900 border border-white/10 flex-shrink-0 cursor-pointer group"
              >
                <img
                  src={coverUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate leading-snug">
                  {currentSong.title}
                </h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                  {currentSong.artist}
                </p>
                {isDownloading && (
                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Downloading {downloadPct}%
                  </span>
                )}
              </div>
            </div>

            {/* Close / Minimize */}
            <button
              onClick={() => setIslandState('collapsed')}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              title="Minimize"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Middle: Progress Bar */}
          <div className="mt-3 space-y-1">
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden relative">
              <div
                className="bg-[#fa233b] h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 1)) * 100))}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
              <span>{formatTime(currentTime || 0)}</span>
              <span>{formatTime(duration || 0)}</span>
            </div>
          </div>

          {/* Bottom: Playback Controls */}
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleLikeSong(currentSong.id)}
                className={`p-2 rounded-full transition-colors ${
                  isLiked ? 'text-[#fa233b]' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-full transition-colors ${
                  shuffleMode !== 'OFF' ? 'text-[#fa233b]' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={playPrev}
                className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={togglePlayPause}
                className="w-10 h-10 rounded-full bg-[#fa233b] hover:bg-[#d91e32] text-white flex items-center justify-center shadow-lg shadow-red-500/25 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-white" />
                ) : (
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                )}
              </button>

              <button
                onClick={playNext}
                className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={cycleRepeatMode}
                className={`p-2 rounded-full transition-colors ${
                  repeatMode !== 'OFF' ? 'text-[#fa233b]' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIslandState('collapsed');
                  toggleDeviceModal();
                }}
                className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"
                title={`Output: ${currentOutputName}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL LIVE ACTIVITY CARD MODAL ────────────────────────────────── */}
      {islandState === 'full' && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col w-[380px] max-w-[94vw] rounded-[36px] bg-black/98 text-white border border-white/20 p-5 shadow-[0_25px_65px_rgba(0,0,0,0.95)] backdrop-blur-3xl animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fa233b] animate-ping" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                RaagaX Live Activity
              </span>
            </div>
            <button
              onClick={() => setIslandState('collapsed')}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hero Cover */}
          <div className="relative my-4 aspect-square rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-white/10">
            <img
              src={coverUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
            {isDownloading && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                <Download className="w-8 h-8 text-amber-400 animate-bounce mb-2" />
                <span className="text-sm font-bold text-white">Downloading Track</span>
                <span className="text-xs font-mono text-amber-400 mt-1">{downloadPct}% Complete</span>
              </div>
            )}
          </div>

          {/* Title & Artist */}
          <div className="text-center space-y-1 mb-3">
            <h3 className="text-base font-black text-white truncate">{currentSong.title}</h3>
            <p className="text-xs text-slate-400 truncate">{currentSong.artist}</p>
          </div>

          {/* Progress */}
          <div className="space-y-1.5">
            <SeekBar />
          </div>

          {/* Full Controls */}
          <div className="flex items-center justify-between mt-4 pt-2 border-t border-white/10">
            <button
              onClick={() => toggleLikeSong(currentSong.id)}
              className={`p-2.5 rounded-full transition-colors ${
                isLiked ? 'text-[#fa233b] bg-red-500/10' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={playPrev}
                className="p-2.5 text-slate-300 hover:text-white rounded-full active:scale-90 transition-all"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={togglePlayPause}
                className="w-12 h-12 rounded-full bg-[#fa233b] hover:bg-[#d91e32] text-white flex items-center justify-center shadow-xl shadow-red-500/30 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>

              <button
                onClick={playNext}
                className="p-2.5 text-slate-300 hover:text-white rounded-full active:scale-90 transition-all"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>

            <button
              onClick={() => {
                setIslandState('collapsed');
                togglePlayerExpanded();
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-colors"
            >
              Open App
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
