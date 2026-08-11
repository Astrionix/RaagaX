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
  MonitorSmartphone,
  User,
  LogIn,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { DeviceSelector } from '@/components/providers/DeviceSyncProvider';

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function Navbar() {
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
    toggleSettingsModal,
    toggleSleepTimerModal,
    rightPanelMode,
    setRightPanelMode,
    setActiveTab,
  } = usePlayerStore();

  const { user, setAuthModalOpen } = useAuthStore();

  const isLiked = currentSong ? likedSongIds.includes(currentSong.id) : false;
  const isDownloaded = currentSong ? downloadedSongIds.includes(currentSong.id) : false;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime, true);
    usePlayerStore.setState({ seekTarget: newTime });
  };

  return (
    <>
      {/* Mobile Top Header (md:hidden) */}
      <header className="md:hidden h-14 fixed top-0 left-0 right-0 z-40 px-4 flex items-center justify-between bg-[#07090E]/90 backdrop-blur-md border-b border-white/5 text-white select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#fa233b] flex items-center justify-center shadow-md">
            <Disc3 className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <span className="font-black text-sm tracking-tight text-white">RAAGAX</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (user) {
                setActiveTab('profile');
              } else {
                setAuthModalOpen(true);
              }
            }} 
            className="p-1.5 text-slate-300 hover:text-white" 
            title="Profile"
          >
            {user ? (
              <div className="w-6 h-6 rounded-full bg-[#fa233b] text-white text-[10px] font-bold flex items-center justify-center">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            ) : (
              <LogIn className="w-4 h-4" />
            )}
          </button>
          <button onClick={toggleSettingsModal} className="p-1.5 text-slate-300 hover:text-white" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Desktop Persistent Bottom Mini Player (md:flex) */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 z-40 h-20 bg-[#0c0d12]/95 backdrop-blur-2xl border-t border-white/10 px-6 items-center justify-between text-white select-none shadow-2xl">
        
        {/* Left: Active Song Info */}
        <div className="flex items-center gap-3.5 w-72 flex-shrink-0">
          {currentSong ? (
            <>
              <div
                onClick={togglePlayerExpanded}
                className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer group flex-shrink-0"
              >
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="overflow-hidden text-left min-w-0 flex-1">
                <h4
                  onClick={togglePlayerExpanded}
                  className="text-xs font-black text-white truncate hover:text-[#fa233b] cursor-pointer transition-colors leading-tight"
                >
                  {currentSong.title}
                </h4>
                <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5 font-medium">{currentSong.artist}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] font-mono bg-[#fa233b]/20 text-[#fa233b] px-1.5 py-0.5 rounded font-bold border border-[#fa233b]/30">
                    {currentSong.audioQuality || '320kbps MP3'}
                  </span>
                  <button onClick={() => toggleLikeSong(currentSong.id)} title="Like Song" className="p-0.5 text-slate-400 hover:text-[#fa233b]">
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'text-[#fa233b] fill-[#fa233b]' : ''}`} />
                  </button>
                  <button onClick={() => toggleDownloadSong(currentSong.id)} title="Download Offline" className="p-0.5 text-slate-400 hover:text-emerald-400">
                    <Download className={`w-3.5 h-3.5 ${isDownloaded ? 'text-emerald-400' : ''}`} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 text-slate-400 text-xs font-bold">
              <Disc3 className="w-4 h-4 text-[#fa233b]" /> Select a track to play
            </div>
          )}
        </div>

        {/* Center: Controls & Timeline */}
        <div className="flex flex-col items-center justify-center gap-1.5 max-w-xl w-full mx-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleShuffle}
              className={`p-1 rounded-lg transition-colors ${
                isShuffle ? 'text-[#fa233b]' : 'text-slate-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={playPrev} className="p-1 text-slate-300 hover:text-white transition-colors">
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-full bg-[#fa233b] text-white flex items-center justify-center shadow-lg shadow-red-500/30 hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button onClick={playNext} className="p-1 text-slate-300 hover:text-white transition-colors">
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={cycleRepeatMode}
              className={`p-1 rounded-lg transition-colors ${
                repeatMode !== 'off' ? 'text-[#fa233b]' : 'text-slate-400 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Timeline Bar */}
          {currentSong && (
            <div className="w-full flex items-center gap-3 max-w-md">
              <span className="text-[10px] font-mono text-slate-400 font-semibold min-w-[32px] text-right">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#fa233b] hover:h-1.5 transition-all"
              />
              <span className="text-[10px] font-mono text-slate-400 font-semibold min-w-[32px]">{formatTime(duration)}</span>
            </div>
          )}
        </div>

        {/* Right Tools Bar */}
        <div className="flex items-center gap-2 w-72 justify-end">
          <DeviceSelector variant="icon" align="right" />

          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="p-1.5 text-slate-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-[#fa233b]" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#fa233b]"
            />
          </div>

          <button onClick={toggleLyrics} className="p-2 text-slate-400 hover:text-[#fa233b] hover:bg-white/5 rounded-xl" title="Lyrics">
            <Mic2 className="w-4 h-4" />
          </button>
          <button onClick={toggleQueue} className="p-2 text-slate-400 hover:text-[#fa233b] hover:bg-white/5 rounded-xl" title="Queue">
            <ListMusic className="w-4 h-4" />
          </button>
          <button onClick={toggleSleepTimerModal} className="p-2 text-slate-400 hover:text-[#fa233b] hover:bg-white/5 rounded-xl" title="Sleep Timer">
            <Moon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
