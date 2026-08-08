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
  Mic2,
  ListMusic,
  Disc3,
  Settings,
  Moon,
  Heart,
  Download,
  Maximize2,
  MonitorSmartphone
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function Navbar() {
  const {
    currentSong,
    queue,
    playSong,
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
    toggleSettingsModal,
    toggleSleepTimerModal,
    rightPanelMode,
    setRightPanelMode,
  } = usePlayerStore();



  const isLiked = currentSong ? likedSongIds.includes(currentSong.id) : false;
  const isDownloaded = currentSong ? downloadedSongIds.includes(currentSong.id) : false;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.currentTime = newTime;
    }
  };

  return (
    <header className="h-16 fixed top-0 left-0 right-0 z-40 px-4 flex items-center justify-between border-b border-white/10 bg-[#0B0D13]/95 backdrop-blur-2xl text-white select-none shadow-xl">
      {/* Mobile Top Brand Bar (md:hidden) */}
      <div className="md:hidden flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#EF233C] flex items-center justify-center shadow-md">
            <Disc3 className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white">RaagaX Music</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleSettingsModal} className="p-1.5 text-slate-300 hover:text-white" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Left: Active Song Artwork & Details (Desktop Only) */}
      <div className="hidden md:flex items-center gap-3 w-64 flex-shrink-0 pl-4">
        {currentSong ? (
          <>
            <div
              onClick={togglePlayerExpanded}
              className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md border border-white/10 cursor-pointer group flex-shrink-0"
            >
              <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="overflow-hidden text-left">
              <h4
                onClick={togglePlayerExpanded}
                className="text-xs font-black text-white truncate hover:text-[#EF233C] cursor-pointer transition-colors leading-tight"
              >
                {currentSong.title}
              </h4>
              <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5 font-medium">{currentSong.artist}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[8px] font-mono bg-[#EF233C]/20 text-[#EF233C] px-1 py-0.2 rounded font-bold border border-[#EF233C]/30">
                  {currentSong.audioQuality || '24-bit FLAC'}
                </span>
                <button onClick={() => toggleLikeSong(currentSong.id)} title="Like Song" className="p-0.5 text-slate-400 hover:text-[#EF233C]">
                  <Heart className={`w-3 h-3 ${isLiked ? 'text-[#EF233C] fill-[#EF233C]' : ''}`} />
                </button>
                <button onClick={() => toggleDownloadSong(currentSong.id)} title="Download Offline" className="p-0.5 text-slate-400 hover:text-emerald-400">
                  <Download className={`w-3 h-3 ${isDownloaded ? 'text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-xs font-extrabold">
            <Disc3 className="w-4 h-4 text-[#EF233C]" /> RaagaX Studio Engine
          </div>
        )}
      </div>

      {/* Center: Playback Controls & Timeline LCD (Desktop Only) */}
      <div className="hidden md:flex flex-col items-center justify-center gap-1 max-w-xl w-full mx-2">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleShuffle}
            className={`p-1 rounded transition-colors ${
              isShuffle ? 'text-[#EF233C]' : 'text-slate-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={playPrev} className="p-1 text-slate-300 hover:text-white transition-colors">
            <SkipBack className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-7 h-7 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-lg shadow-red-500/20 hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
          </button>

          <button onClick={playNext} className="p-1 text-slate-300 hover:text-white transition-colors">
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </button>
          <button
            onClick={cycleRepeatMode}
            className={`p-1 rounded transition-colors ${
              repeatMode !== 'off' ? 'text-[#EF233C]' : 'text-slate-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Central LCD Bar with Timeline */}
        {currentSong && (
          <div className="w-full flex items-center gap-2 max-w-md">
            <span className="text-[9px] font-mono text-slate-400 font-semibold min-w-[28px] text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#EF233C] hover:h-1.5 transition-all"
            />
            <span className="text-[9px] font-mono text-slate-400 font-semibold min-w-[28px]">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Right Tools & Modals Bar (Desktop Only) */}
      <div className="hidden md:flex items-center gap-1.5">
        <button
          onClick={() => setRightPanelMode(rightPanelMode === 'devices' ? 'queue' : 'devices')}
          className={`p-1.5 rounded-lg transition-colors mr-1 ${rightPanelMode === 'devices' ? 'text-[#EF233C] bg-[#EF233C]/10' : 'text-slate-400 hover:text-white'}`}
          title="Connect to a device"
        >
          <MonitorSmartphone className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1.5 mr-1">
          <button onClick={toggleMute} className="text-slate-400 hover:text-white">
            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-[#EF233C]" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#EF233C]"
          />
        </div>

        <button onClick={toggleLyrics} className="p-1.5 text-slate-400 hover:text-[#EF233C]" title="Lyrics">
          <Mic2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggleQueue} className="p-1.5 text-slate-400 hover:text-[#EF233C]" title="Queue">
          <ListMusic className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggleSleepTimerModal} className="p-1.5 text-slate-400 hover:text-[#EF233C]" title="Sleep Timer">
          <Moon className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggleSettingsModal} className="p-1.5 text-slate-400 hover:text-[#EF233C]" title="Settings">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
