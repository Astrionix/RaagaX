'use client';

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  Download,
  ListMusic,
  Mic2,
  Maximize2,
  Disc3,
  Tv,
  MonitorSmartphone
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceTransferPopover } from './DeviceTransferPopover';

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function BottomPlayer() {
  const [showDevices, setShowDevices] = React.useState(false);
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    likedSongIds,
    downloadedSongIds,
    togglePlayPause,
    playNext,
    playPrev,
    setCurrentTime,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleLikeSong,
    toggleDownloadSong,
    toggleLyrics,
    toggleQueue,
    togglePlayerExpanded,
    rightPanelMode,
    setRightPanelMode,
  } = usePlayerStore();

  if (!currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);
  const isDownloaded = downloadedSongIds.includes(currentSong.id);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.currentTime = newTime;
    }
  };

  return (
    <footer className="fixed bottom-3 left-3 sm:left-20 lg:left-64 right-3 z-40 h-18 rounded-2xl border border-red-900/40 shadow-2xl shadow-red-500/10 px-4 sm:px-6 flex items-center justify-between select-none backdrop-blur-2xl bg-[#07090E]/95 transition-all">
      {/* Left: Artwork & Track Metadata */}
      <div className="flex items-center gap-3.5 w-1/3 max-w-[260px]">
        <div
          onClick={togglePlayerExpanded}
          className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-red-900/40 cursor-pointer group flex-shrink-0"
        >
          <img
            src={currentSong.coverUrl}
            alt={currentSong.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="overflow-hidden">
          <h4
            onClick={togglePlayerExpanded}
            className="text-xs font-black text-white truncate hover:text-[#EF233C] cursor-pointer transition-colors leading-snug"
          >
            {currentSong.title}
          </h4>
          <p className="text-[11px] text-slate-400 truncate leading-snug mt-0.5 font-medium">
            {currentSong.artist}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] font-bold text-[#EF233C] uppercase tracking-wider">
              {currentSong.genre}
            </span>
            <span className="text-[8px] font-mono bg-black/80 text-[#EF233C] px-1.5 py-0.2 rounded font-bold border border-red-900/40">
              {currentSong.audioQuality || '24-bit FLAC'}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 ml-1">
          <button
            onClick={() => toggleLikeSong(currentSong.id)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            title="Like Song"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'text-[#EF233C] fill-[#EF233C]' : 'text-slate-400 hover:text-[#EF233C]'}`} />
          </button>
          <button
            onClick={() => toggleDownloadSong(currentSong.id)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            title="Download FLAC Offline"
          >
            <Download className={`w-4 h-4 ${isDownloaded ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`} />
          </button>
        </div>
      </div>

      {/* Center: Controls & Thicker Crimson Progress Bar */}
      <div className="flex flex-col items-center justify-center gap-1 w-2/4 max-w-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
              isShuffle ? 'text-[#EF233C]' : 'text-slate-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={playPrev}
            className="p-1.5 text-white hover:scale-110 hover:text-[#EF233C] transition-transform"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Larger Circular Crimson Play Button with Glow */}
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full crimson-glow-btn text-white flex items-center justify-center shadow-lg shadow-red-500/40 hover:scale-110 active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>

          <button
            onClick={playNext}
            className="p-1.5 text-white hover:scale-110 hover:text-[#EF233C] transition-transform"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={cycleRepeatMode}
            className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
              repeatMode !== 'off' ? 'text-[#EF233C]' : 'text-slate-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Thicker Progress Bar with Timestamps on Both Ends */}
        <div className="w-full flex items-center gap-2.5 px-2">
          <span className="text-[10px] font-mono text-slate-400 w-9 text-right font-medium">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-red-950/60 rounded-full appearance-none cursor-pointer accent-[#EF233C] hover:h-2 transition-all shadow-inner border border-red-900/30"
          />
          <span className="text-[10px] font-mono text-slate-400 w-9 font-medium">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Volume & Panel Shortcuts */}
      <div className="flex items-center gap-3 w-1/3 justify-end">
        <div className="hidden sm:flex items-center gap-2">
          <button onClick={toggleMute} className="text-slate-400 hover:text-[#EF233C] transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-[#EF233C]" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 sm:w-20 h-1 bg-red-950/60 rounded-full appearance-none cursor-pointer accent-[#EF233C]"
          />
        </div>

        <div className="flex items-center gap-1.5 border-l border-red-900/30 pl-3 relative">
          <button
            onClick={() => {
              const isDesktop = window.innerWidth >= 1280;
              if (isDesktop) {
                setRightPanelMode(rightPanelMode === 'devices' ? 'queue' : 'devices');
                setShowDevices(false);
              } else {
                setShowDevices(!showDevices);
              }
            }}
            className={`p-1.5 rounded-lg transition-colors ${showDevices || rightPanelMode === 'devices' ? 'text-[#EF233C] bg-[#EF233C]/10' : 'text-slate-400 hover:text-[#EF233C] hover:bg-white/5'}`}
            title="Connect to a device"
          >
            <MonitorSmartphone className="w-4 h-4" />
          </button>
          {showDevices && (
            <div className="xl:hidden">
              <DeviceTransferPopover onClose={() => setShowDevices(false)} />
            </div>
          )}

          <button
            onClick={toggleLyrics}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#EF233C] hover:bg-white/5 transition-colors"
            title="Synced Lyrics"
          >
            <Mic2 className="w-4 h-4" />
          </button>
          <button
            onClick={toggleQueue}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#EF233C] hover:bg-white/5 transition-colors"
            title="Play Queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlayerExpanded}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#EF233C] hover:bg-white/5 transition-colors flex items-center gap-1"
            title="3D Vinyl & Video Mode"
          >
            <Tv className="w-4 h-4 text-[#EF233C]" />
          </button>
          <button
            onClick={togglePlayerExpanded}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#EF233C] hover:bg-white/5 transition-colors"
            title="3D Vinyl View"
          >
            <Disc3 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
