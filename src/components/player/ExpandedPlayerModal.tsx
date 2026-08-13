'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, ChevronDown, Heart, Download, Play, Pause, SkipBack, SkipForward, 
  Disc3, Mic2, Music, Tv, RefreshCw, ExternalLink, Shuffle, Repeat, Repeat1, 
  ListMusic, Settings2, MonitorSmartphone, Check, MoreHorizontal, Share2, 
  User, Disc, ListPlus, Radio, Sparkles
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceSelector } from '@/components/providers/DeviceSyncProvider';
import { AudioSettingsDrawer } from './AudioSettingsDrawer';
import { MediaHandoffManager } from '@/lib/playback/MediaHandoffManager';
import { SeekBar } from './SeekBar';

export function ExpandedPlayerModal() {
  const {
    isPlayerExpanded,
    togglePlayerExpanded,
    activeRenderer,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrev,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    toggleDownloadSong,
    toggleSettingsModal,
    toggleLyrics,
    toggleQueue,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    queue,
    queueIndex,
    addToQueue,
    setActiveTab,
    setToastMessage,
    isActiveDevice,
    activeDeviceId,
    remoteDeviceName,
    onlineDevices,
    toggleDeviceModal,
    setSelectedArtistId,
    setSelectedAlbumId,
    networkMode,
  } = usePlayerStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visualTime, setVisualTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    if (!isPlayerExpanded || isSeeking) return;
    let frame: number;
    const tick = () => {
      const engine = require('@/lib/playback/PlaybackEngine').PlaybackEngine.getInstance();
      if (engine.isPlayingLocally()) {
        setVisualTime(engine.getCanonicalPositionMs() / 1000);
      } else {
        setVisualTime(currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlayerExpanded, isSeeking, currentTime]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleCloseModal = () => {
    togglePlayerExpanded();
  };

  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    if (deltaY > 100 && Math.abs(deltaY) > Math.abs(deltaX)) {
      togglePlayerExpanded();
    } else if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) playNext();
      else playPrev();
    }

    touchStartY.current = null;
    touchStartX.current = null;
  };

  if (!isPlayerExpanded || !currentSong) return null;

  const isLiked = likedSongIds.includes(currentSong.id);
  const isDownloaded = downloadedSongIds.includes(currentSong.id);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    usePlayerStore.getState().setCurrentTime(targetTime);
    usePlayerStore.getState().setSeekTarget(targetTime);
    const audioEl = document.querySelector('audio');
    if (audioEl) audioEl.currentTime = targetTime;
  };

  const nextSongInQueue = queue[queueIndex + 1] || null;
  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const activeName = !isActiveDevice 
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') 
    : 'This Web Browser';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#0a0c10]/95 backdrop-blur-2xl p-4 sm:p-6 md:p-8 flex flex-col text-white select-none animate-in slide-in-from-bottom duration-300 overflow-hidden"
    >
      {/* Dynamic Ambient Background Art Glow - Apple/Spotify Dark Style */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none blur-[140px] scale-[1.3] transition-all duration-1000 saturate-[180%] mix-blend-screen"
        style={{
          backgroundImage: `url(${currentSong.coverUrl || '/app-icon.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Top Header Bar - Spotify Inspired */}
      <div className="relative z-10 flex items-center justify-between w-full pt-1 pb-2 sm:pb-4 max-w-6xl mx-auto flex-shrink-0">
        <button 
          onClick={handleCloseModal}
          className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors relative z-10"
          title="Minimize modal"
        >
          <ChevronDown className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 px-2 sm:px-4 w-full max-w-[45%] sm:max-w-[50%] pointer-events-none">
          <p className="text-[9px] sm:text-[10px] text-white/70 font-bold uppercase tracking-wider mb-0.5">
            PLAYING FROM ALBUM
          </p>
          <h3 className="text-xs sm:text-sm font-extrabold text-white truncate tracking-tight">
            {currentSong.album || currentSong.genre || 'Hot Hits Telugu'}
          </h3>
        </div>

        {/* Top Right Utilities */}
        <div className="flex items-center justify-end flex-shrink-0 relative z-10">
          {/* 3 Dots Options Button & Popover */}
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="p-2 -mr-2 text-white hover:bg-white/10 rounded-full transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Laptop / Desktop Dropdown Menu */}
            {isMenuOpen && (
              <div 
                className="hidden sm:block absolute right-0 top-full mt-2 w-64 bg-[#141416]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 shadow-2xl z-[250] text-xs text-white select-none animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => {
                    toggleLikeSong(currentSong.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-slate-400'}`} />
                    <span className="font-bold">{isLiked ? 'Remove from Liked Songs' : 'Save to your Liked Songs'}</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    addToQueue(currentSong);
                    setToastMessage('Added to queue');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ListPlus className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Add to queue</span>
                  </div>
                </button>

                <div className="h-px bg-white/10 my-1" />

                <button 
                  onClick={() => {
                    if (currentSong.artistId) setSelectedArtistId(currentSong.artistId);
                    else setSelectedArtistId(currentSong.artist);
                    setActiveTab('artist');
                    togglePlayerExpanded();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Go to artist</span>
                  </div>
                  <span className="text-slate-400">‣</span>
                </button>

                <button 
                  onClick={() => {
                    if (currentSong.albumId) setSelectedAlbumId(currentSong.albumId);
                    else setSelectedAlbumId(currentSong.album);
                    setActiveTab('album');
                    togglePlayerExpanded();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Disc className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Go to album</span>
                  </div>
                  <span className="text-slate-400">‣</span>
                </button>

                <div className="h-px bg-white/10 my-1" />

                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setToastMessage('Song link copied to clipboard!');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Share</span>
                  </div>
                  <span className="text-slate-400">‣</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={toggleSettingsModal}
            className="hidden sm:block p-2.5 ml-2 rounded-2xl surface-card border border-white/10 text-slate-300 hover:text-white hover:scale-105 transition-transform"
            title="Audio Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Content Section (Flexible to fit screen without scroll) */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-between w-full max-w-5xl mx-auto py-1 sm:py-4">
        
        {/* Cover Artwork */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full py-2 sm:py-6 overflow-hidden">
          <div
            className="relative rounded-[8%] sm:rounded-2xl overflow-hidden shadow-2xl border border-white/5"
            style={{
              width: 'min(42vh, 92vw, 480px)',
              height: 'min(42vh, 92vw, 480px)',
              flexShrink: 0,
            }}
          >
            <img
              src={currentSong.coverUrl || '/app-icon.png'}
              alt={currentSong.title}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              className={`w-full h-full object-cover transition-all duration-700 ${isPlaying ? 'scale-[1.02]' : 'scale-100'}`}
            />
          </div>
        </div>

        {/* Bottom Player Controls Area (Tightly Packed) */}
        <div className="flex-shrink-0 flex flex-col gap-3 sm:gap-6 w-full">
          {/* Track Meta & Like Button Row (Spotify Style) */}
          <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto w-full px-1 sm:px-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug truncate">
                {currentSong.title}
              </h1>
              <p className="text-sm sm:text-base font-semibold text-white/70 truncate mt-0.5 sm:mt-1">
                {currentSong.artist}
              </p>
            </div>

            <button
              onClick={() => toggleLikeSong(currentSong.id)}
              className="p-2 sm:p-3 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              title="Save to Liked Songs"
            >
              <Heart className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${isLiked ? 'fill-[#1ed760] text-[#1ed760]' : 'text-white/70 hover:text-white'}`} />
            </button>
          </div>

        {/* Timeline Seekbar - Spotify Inspired */}
        <div className="max-w-4xl mx-auto w-full space-y-1 sm:space-y-2 px-1 sm:px-2">
          <SeekBar 
            height="h-1 sm:h-1.5"
            thumbSize="w-3 h-3"
            activeColor="bg-white group-hover:bg-[#1ed760]"
          />
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-white/60 font-semibold px-0.5">
            <span>{formatTime(visualTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Player Controls Row - Spotify Iconic Circular White Play Button */}
        <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-8 max-w-4xl mx-auto w-full px-1">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors relative hover:scale-110 active:scale-95 ${
              shuffleMode !== 'OFF' ? 'text-[#1ed760]' : 'text-white/70 hover:text-white'
            }`}
            title={`Shuffle: ${shuffleMode}`}
          >
            {shuffleMode === 'SMART' ? (
              <div className="relative">
                <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
                <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-400" />
              </div>
            ) : (
              <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
            {shuffleMode !== 'OFF' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1ed760]" />}
          </button>

          <button
            onClick={playPrev}
            className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Previous Track"
          >
            <SkipBack className="w-7 h-7 sm:w-9 sm:h-9 fill-current" />
          </button>

          {/* Spotify Iconic Circular White Play Button with Pulse/Glow */}
          <button
            onClick={togglePlayPause}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all cursor-pointer ${isPlaying ? 'shadow-[0_0_20px_rgba(255,255,255,0.3)]' : ''}`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-black text-black" />
            ) : (
              <Play className="w-7 h-7 fill-black text-black ml-1" />
            )}
          </button>

          <button
            onClick={playNext}
            className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Next Track"
          >
            <SkipForward className="w-7 h-7 sm:w-9 sm:h-9 fill-current" />
          </button>

          <button
            onClick={cycleRepeatMode}
            className={`p-2 transition-colors relative ${
              repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-white/70 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />}
            {repeatMode !== 'off' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1ed760]" />}
          </button>
        </div>

        {/* Bottom Utility Actions Row */}
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-1 sm:px-2 pb-2">
          <DeviceSelector variant="icon" align="left" />

          {/* Hidden on mobile, visible on laptop */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => {
                togglePlayerExpanded();
                toggleLyrics();
              }}
              className="px-5 py-3 rounded-2xl bg-white text-slate-900 font-extrabold text-xs flex items-center gap-2 hover:bg-slate-200 transition-colors shadow-lg"
            >
              <Mic2 className="w-4 h-4 text-[#1ed760]" /> Synced Lyrics
            </button>

            <button
              onClick={() => toggleDownloadSong(currentSong.id)}
              className="p-3 rounded-2xl surface-card border border-white/15 hover:border-[#1ed760] transition-colors"
              title="Download Song"
            >
              <Download className={`w-5 h-5 ${isDownloaded ? 'text-[#1ed760]' : 'text-white/70'}`} />
            </button>

            <button
              onClick={toggleQueue}
              className="p-3 rounded-2xl surface-card border border-white/15 hover:border-white/40 transition-colors"
              title="Open Queue"
            >
              <ListMusic className="w-5 h-5 text-white/70 hover:text-white" />
            </button>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setToastMessage('Link copied!');
            }}
            className="p-2 text-white/70 hover:text-white transition-colors block sm:hidden"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>

      {/* Mobile Spotify Full-Screen 3-Dots Overlay Sheet */}
      {isMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-[300] bg-[#0a0c10]/98 backdrop-blur-3xl flex flex-col p-4 animate-in fade-in duration-200 text-white select-none h-[100dvh] overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-none space-y-6 pb-6 scrollbar-hide">
            {/* Album Thumbnail & Song Header */}
            <div className="flex flex-col items-center justify-center pt-8 text-center px-4">
              <img 
                src={currentSong.coverUrl || '/app-icon.png'} 
                alt={currentSong.title}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg object-cover shadow-2xl mb-4 border border-white/5"
              />
              <h3 className="text-xl font-black text-white max-w-xs leading-tight">{currentSong.title}</h3>
              <p className="text-sm font-medium text-white/70 max-w-xs mt-1">{currentSong.artist}</p>
            </div>

            {/* Menu Items List (Matching Spotify Mobile Screenshot) */}
            <div className="px-2">
              <button 
                onClick={() => {
                  toggleLikeSong(currentSong.id);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 py-4 text-base font-bold hover:text-[#1ed760] transition-colors border-b border-white/5"
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-[#1ed760] text-[#1ed760]' : 'text-white'}`} />
                <span>{isLiked ? 'Remove Like' : 'Like'}</span>
              </button>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setToastMessage('Song link copied to clipboard!');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 py-4 text-base font-bold hover:text-white transition-colors border-b border-white/5"
              >
                <Share2 className="w-6 h-6 text-white" />
                <span>Share</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab('home');
                  togglePlayerExpanded();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 py-4 text-base font-bold hover:text-white transition-colors border-b border-white/5"
              >
                <Music className="w-6 h-6 text-white" />
                <span>View track</span>
              </button>

              <button 
                onClick={() => {
                  if (currentSong.artistId) setSelectedArtistId(currentSong.artistId);
                  else setSelectedArtistId(currentSong.artist);
                  setActiveTab('artist');
                  togglePlayerExpanded();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 py-4 text-base font-bold hover:text-white transition-colors border-b border-white/5"
              >
                <User className="w-6 h-6 text-white" />
                <span>View artist</span>
              </button>

              <button 
                onClick={() => {
                  if (currentSong.albumId) setSelectedAlbumId(currentSong.albumId);
                  else setSelectedAlbumId(currentSong.album);
                  setActiveTab('album');
                  togglePlayerExpanded();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-4 py-4 text-base font-bold hover:text-white transition-colors"
              >
                <Disc className="w-6 h-6 text-white" />
                <span>View album</span>
              </button>
            </div>
          </div>

          {/* Bottom Close Button */}
          <div className="pt-2 pb-4 text-center">
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="py-3 px-8 text-base font-black text-white hover:text-white/70 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Spotify Signature Green Active Device Bar (Very Bottom) */}
      <div 
        onClick={toggleDeviceModal}
        className="relative z-10 -mx-4 sm:-mx-6 md:-mx-8 -mb-4 sm:-mb-6 md:-mb-8 bg-[#1ed760] text-black px-4 py-2.5 flex items-center justify-between font-bold text-xs cursor-pointer hover:bg-[#1fdf64] transition-colors shadow-lg mt-4"
      >
        <div className="flex items-center gap-2 max-w-xl truncate">
          <MonitorSmartphone className="w-4 h-4 animate-pulse flex-shrink-0" />
          <span className="truncate">
            Playing on {activeName}
          </span>
        </div>
        <span className="text-[11px] font-black uppercase tracking-wider opacity-90 flex-shrink-0">
          RaagaX Connect ↗
        </span>
      </div>

      <AudioSettingsDrawer />
    </div>
  );
}


