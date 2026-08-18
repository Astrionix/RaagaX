'use client';

import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, 
  Download, CheckCircle2, ChevronDown, ChevronUp, Headphones, 
  Loader2, X, Bell, Disc3, Radio
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { SeekBar } from '@/components/player/SeekBar';
import { OptimizedImage } from '@/components/common/OptimizedImage';

interface NotificationBarPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationBarPlayerModal({ isOpen, onClose }: NotificationBarPlayerModalProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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
    toggleDeviceModal,
  } = usePlayerStore();

  const { tasks } = useDownloadStore();

  if (!isOpen || !currentSong) return null;

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

  return (
    <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-xl flex flex-col justify-start p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Top Navigation / Shade Handle */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between pt-2 pb-4 text-white">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#E50914]" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-300">
            Android Notification Shade
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close Shade"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Single Unified Media Notification Card ── */}
      <div className="w-full max-w-lg mx-auto rounded-3xl bg-[#12141c] border border-white/15 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] relative overflow-hidden transition-all duration-300">
        {/* Subtle Ambient Background Gradient */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl pointer-events-none scale-125"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* COLLAPSED NOTIFICATION VIEW                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {!isExpanded ? (
          <div className="relative z-10 space-y-3">
            {/* Header: App Name */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                <span className="text-white font-black tracking-wide">RaagaX</span>
                <span>• now</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Media Player</span>
            </div>

            {/* Content: Cover + Title + Mini Play/Pause */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow border border-white/15 flex-shrink-0">
                  <OptimizedImage
                    src={coverUrl}
                    alt={currentSong.title}
                    size="thumb"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate leading-tight">
                    {currentSong.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{currentSong.artist}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
                    playPrev();
                  }}
                  className="p-2 text-slate-300 hover:text-white cursor-pointer"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={() => {
                    import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact());
                    togglePlayPause();
                  }}
                  className="w-10 h-10 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-lg shadow-red-500/25 cursor-pointer active:scale-95 transition-transform"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
                    playNext();
                  }}
                  className="p-2 text-slate-300 hover:text-white cursor-pointer"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════════════ */
          /* EXPANDED NOTIFICATION VIEW                                           */
          /* ════════════════════════════════════════════════════════════════════ */
          <div className="relative z-10 space-y-4">
            {/* Header: App Name & Output Device Indicator */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E50914] animate-pulse" />
                <span className="text-white font-black tracking-wide">RaagaX</span>
                <span>• Live Playback</span>
              </div>

              <button
                onClick={toggleDeviceModal}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 transition-colors cursor-pointer"
              >
                <Headphones className="w-3 h-3 text-[#E50914]" />
                <span className="truncate max-w-[120px]">{currentOutputName}</span>
              </button>
            </div>

            {/* Middle Section: Artwork + Track Title & Waveform */}
            <div className="flex items-center gap-4">
              <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl border border-white/20 flex-shrink-0">
                <OptimizedImage
                  src={coverUrl}
                  alt={currentSong.title}
                  size="card"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-black text-white truncate leading-tight">
                  {currentSong.title}
                </h3>
                <p className="text-xs text-slate-400 font-medium truncate">
                  {currentSong.artist}
                </p>

                {/* Status Badge + Live Waveform */}
                <div className="flex items-center justify-between pt-1">
                  {isDownloaded ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Downloaded ✓
                    </span>
                  ) : isDownloading ? (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> {downloadPct}% Downloading
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">High Res Audio</span>
                  )}

                  {/* Animated Waveform */}
                  <div className="flex items-center gap-0.5 h-4">
                    <span className={`w-0.5 bg-[#E50914] rounded-full ${isPlaying ? 'h-3 animate-[pulse_0.4s_infinite_alternate]' : 'h-1 opacity-40'}`} />
                    <span className={`w-0.5 bg-white rounded-full ${isPlaying ? 'h-4 animate-[pulse_0.5s_infinite_alternate_0.1s]' : 'h-1 opacity-40'}`} />
                    <span className={`w-0.5 bg-[#E50914] rounded-full ${isPlaying ? 'h-2.5 animate-[pulse_0.45s_infinite_alternate_0.2s]' : 'h-1 opacity-40'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Timeline Progress */}
            <div className="space-y-1">
              <SeekBar height="h-[4px]" thumbSize="w-3 h-3" />
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* MediaStyle Action Buttons: Shuffle, Prev, Play/Pause, Next, Repeat */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  import('@/lib/haptics/HapticEngine').then(m => m.haptics.selectionTick());
                  toggleShuffle();
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${shuffleMode !== 'OFF' ? 'text-[#E50914] bg-[#E50914]/15' : 'text-slate-400 hover:text-white'}`}
                title={`Shuffle: ${shuffleMode !== 'OFF' ? 'On' : 'Off'}`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
                  playPrev();
                }}
                className="p-2 text-slate-300 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Previous track"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => {
                  import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact());
                  togglePlayPause();
                }}
                className="w-12 h-12 rounded-full red-glow-btn text-white flex items-center justify-center shadow-xl shadow-red-500/30 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
                  playNext();
                }}
                className="p-2 text-slate-300 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Next track"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => {
                  import('@/lib/haptics/HapticEngine').then(m => m.haptics.selectionTick());
                  cycleRepeatMode();
                }}
                className={`p-2 rounded-xl transition-all relative cursor-pointer ${repeatMode !== 'OFF' ? 'text-[#E50914] bg-[#E50914]/15' : 'text-slate-400 hover:text-white'}`}
                title={`Repeat: ${repeatMode}`}
              >
                <Repeat className="w-4 h-4" />
                {repeatMode === 'ONE' && (
                  <span className="absolute top-1 right-1 text-[8px] font-black text-[#E50914]">1</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
