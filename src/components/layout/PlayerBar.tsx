'use client';

import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Sparkles,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Mic2,
  ListMusic,
  Disc3,
  Moon,
  Heart,
  Download,
  Maximize2,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceSelector } from '@/components/providers/DeviceSyncProvider';
import { SeekBar } from '@/components/player/SeekBar';

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function PlayerBar() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffleMode,
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
    toggleSleepTimerModal,
  } = usePlayerStore();

  const isLiked = mounted && currentSong ? likedSongIds.includes(currentSong.id) : false;
  const isDownloaded = mounted && currentSong ? downloadedSongIds.includes(currentSong.id) : false;

  if (!mounted) {
    return (
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 z-40 h-20 bg-[#090a0f]/90 backdrop-blur-3xl border-t border-white/10 px-6 items-center justify-between text-white select-none shadow-[0_-10px_35px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3.5 w-72 flex-shrink-0">
          <div className="flex items-center gap-2.5 text-slate-400 text-xs font-bold">
            <Disc3 className="w-4 h-4 text-[#fa233b] animate-spin" style={{ animationDuration: '8s' }} /> Select a track to play
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-1.5 max-w-xl w-full mx-4">
          <div className="flex items-center gap-4">
            <button className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <Shuffle className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-300 rounded-lg">
              <SkipBack className="w-4 h-4 fill-current" />
            </button>
            <button className="w-10 h-10 rounded-full red-glow-btn text-white flex items-center justify-center">
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </button>
            <button className="p-1.5 text-slate-300 rounded-lg">
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
            <button className="p-1.5 text-slate-400 rounded-lg">
              <Repeat className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 w-72 justify-end" />
      </div>
    );
  }


  return (
    <div className="hidden md:flex fixed bottom-0 left-0 right-0 z-40 h-20 bg-[#090a0f]/90 backdrop-blur-3xl border-t border-white/10 px-6 items-center justify-between text-white select-none shadow-[0_-10px_35px_rgba(0,0,0,0.6)]">
      {/* Left: Active Song Info */}
      <div className="flex items-center gap-3.5 w-72 flex-shrink-0">
        {currentSong ? (
          <>
            <div
              onClick={togglePlayerExpanded}
              className="relative w-12 h-12 rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-white/10 cursor-pointer group flex-shrink-0"
            >
              <img src={(currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')) ? currentSong.coverUrl : '/app-icon.png'} alt={currentSong.title} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="overflow-hidden text-left min-w-0 flex-1">
              <h4
                onClick={togglePlayerExpanded}
                className="text-xs font-black text-white truncate hover:text-[#fa233b] cursor-pointer transition-colors leading-tight tracking-tight"
              >
                {currentSong.title}
              </h4>
              <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5 font-medium">{currentSong.artist}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] font-mono bg-[#fa233b]/20 text-[#fa233b] px-1.5 py-0.5 rounded-full font-bold border border-[#fa233b]/30">
                  {currentSong.audioQuality || '320kbps MP3'}
                </span>
                <button onClick={() => toggleLikeSong(currentSong.id)} title="Like Song" className="p-0.5 text-slate-400 hover:text-[#fa233b] transition-transform hover:scale-110">
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'text-[#fa233b] fill-[#fa233b]' : ''}`} />
                </button>
                <button 
                  onClick={async () => {
                    toggleDownloadSong(currentSong.id);
                    const { exportSongToDevice } = await import('@/lib/downloadHelper');
                    await exportSongToDevice(currentSong);
                    usePlayerStore.getState().setToastMessage(`Downloading "${currentSong.title}" to local storage...`);
                  }} 
                  title="Download to Local Storage" 
                  className="p-0.5 text-slate-400 hover:text-emerald-400 transition-transform hover:scale-110"
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloaded ? 'text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 text-slate-400 text-xs font-bold">
            <Disc3 className="w-4 h-4 text-[#fa233b] animate-spin" style={{ animationDuration: '8s' }} /> Select a track to play
          </div>
        )}
      </div>

      {/* Center: Controls & Timeline */}
      <div className="flex flex-col items-center justify-center gap-1.5 max-w-xl w-full mx-4">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleShuffle}
            className={`p-1.5 rounded-lg transition-all ${
              shuffleMode !== 'OFF' ? 'text-[#fa233b] bg-[#fa233b]/10' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={`Shuffle: ${shuffleMode}`}
          >
            {shuffleMode === 'SMART' ? (
              <div className="relative">
                <Shuffle className="w-4 h-4" />
                <Sparkles className="w-2 h-2 absolute -top-1 -right-1 text-yellow-400" />
              </div>
            ) : (
              <Shuffle className="w-4 h-4" />
            )}
          </button>
          <button onClick={playPrev} className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all active:scale-90">
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full red-glow-btn text-white flex items-center justify-center cursor-pointer active:scale-95"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          <button onClick={playNext} className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all active:scale-90">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={cycleRepeatMode}
            className={`p-1.5 rounded-lg transition-all ${
              repeatMode !== 'off' ? 'text-[#fa233b] bg-[#fa233b]/10' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Timeline Bar */}
        {currentSong && (
          <div className="w-full flex items-center gap-3 max-w-md">
            <span className="text-[10px] font-mono text-slate-400 font-bold min-w-[32px] text-right">{formatTime(currentTime)}</span>
            <SeekBar className="w-full flex-1" height="h-1" thumbSize="w-3 h-3" />
            <span className="text-[10px] font-mono text-slate-400 font-bold min-w-[32px]">{formatTime(duration)}</span>
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
  );
}
