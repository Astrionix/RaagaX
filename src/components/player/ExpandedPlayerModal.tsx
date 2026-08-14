'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, ChevronDown, Heart, Download, Play, Pause, SkipBack, SkipForward, 
  Disc3, Mic2, Music, Tv, RefreshCw, ExternalLink, Shuffle, Repeat, Repeat1, 
  ListMusic, Settings2, MonitorSmartphone, Check, MoreHorizontal, Share2, 
  User, Disc, ListPlus, Radio, Sparkles, FolderPlus, Ban, Plus
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { DeviceSelector } from '@/components/providers/DeviceSyncProvider';
import { AudioSettingsDrawer } from './AudioSettingsDrawer';
import { MediaHandoffManager } from '@/lib/playback/MediaHandoffManager';
import { useLyricsStore } from '@/context/useLyricsStore';
import { SeekBar } from './SeekBar';

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'lyrics'>('art');
  const { status: lyricsStatus, type: lyricsType, lines: lyricsLines, currentLineIndex: lyricsIndex } = useLyricsStore();
  const modalLyricsScrollRef = useRef<HTMLDivElement>(null);

  const {
    isPlayerExpanded,
    togglePlayerExpanded,
    activeRenderer,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    setCurrentTime,
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
    setCreatePlaylistModalOpen,
    networkMode,
    cloudDownloadedSongIds = [],
  } = usePlayerStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visualTime, setVisualTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Pre-load lyrics for current track
  useEffect(() => {
    if (currentSong?.id) {
      import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
        LyricsEngine.getInstance().loadTrack(currentSong.id);
      });
    }
  }, [currentSong?.id]);

  // Auto-scroll lyrics smoothly when active line changes in lyrics view
  useEffect(() => {
    if (viewMode !== 'lyrics' || lyricsIndex < 0 || lyricsLines.length === 0) return;
    const activeEl = document.getElementById(`modal-lyric-line-${lyricsIndex}`);
    if (activeEl && modalLyricsScrollRef.current) {
      const container = modalLyricsScrollRef.current;
      const targetScrollTop = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
      container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
    }
  }, [lyricsIndex, viewMode, lyricsLines]);

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
  const isCloudRecorded = (cloudDownloadedSongIds || []).includes(currentSong.id);

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
      className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#0a0c10]/95 backdrop-blur-2xl p-4 sm:p-6 md:p-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col text-white select-none animate-in slide-in-from-bottom duration-300 overflow-hidden"
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

      {/* Top Header Bar - Spotify Inspired (High Z-Index so popover menu floats cleanly above album artwork) */}
      <div className="relative z-50 flex items-center justify-between w-full pt-1 pb-2 sm:pb-4 max-w-6xl mx-auto flex-shrink-0">
        <button 
          onClick={handleCloseModal}
          className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors relative z-10"
          title="Minimize modal"
        >
          <ChevronDown className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        <div 
          onClick={() => {
            const albumTarget = currentSong.albumId || currentSong.album;
            if (albumTarget) {
              setSelectedAlbumId(albumTarget);
              setActiveTab('album');
              handleCloseModal();
            }
          }}
          className={`absolute left-1/2 -translate-x-1/2 text-center min-w-0 px-2 sm:px-4 w-full max-w-[45%] sm:max-w-[50%] ${
            (currentSong.albumId || currentSong.album) ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'pointer-events-none'
          }`}
          title={currentSong.album ? `Go to album: ${currentSong.album}` : undefined}
        >
          <p className="text-[9px] sm:text-[10px] text-white/70 font-bold uppercase tracking-wider mb-0.5">
            PLAYING FROM ALBUM
          </p>
          <h3 className="text-xs sm:text-sm font-extrabold text-white truncate tracking-tight underline-offset-2 hover:underline">
            {currentSong.album || currentSong.genre || 'Hot Hits Telugu'}
          </h3>
        </div>

        {/* Top Right Utilities */}
        <div className="flex items-center justify-end gap-1 flex-shrink-0 relative z-50">
          {/* 3 Dots Options Button & Popover */}
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Context Dropdown Menu (Universal Popover - Elevated Z-Index) */}
            {isMenuOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-64 bg-[#141416]/98 backdrop-blur-3xl border border-white/20 rounded-2xl p-2 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-[999] text-xs text-white select-none animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => {
                    toggleLikeSong(currentSong.id);
                    setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to your Liked Songs');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#F20D18] text-[#F20D18]' : 'text-slate-400'}`} />
                    <span className="font-bold">{isLiked ? 'Remove from Liked Songs' : 'Save to your Liked Songs'}</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    addToQueue(currentSong);
                    setToastMessage(`Added "${currentSong.title}" to queue`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ListPlus className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Add to queue</span>
                  </div>
                </button>

                <div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylists(!showPlaylists);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderPlus className="w-4 h-4 text-slate-400" />
                      <span className="font-bold">Add to playlist</span>
                    </div>
                    <span className={`text-slate-400 text-xs transition-transform ${showPlaylists ? 'rotate-90' : ''}`}>▸</span>
                  </button>

                  {showPlaylists && (
                    <div className="my-1 ml-4 pl-3 border-l border-white/10 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => {
                          setCreatePlaylistModalOpen(true);
                          setIsMenuOpen(false);
                          setShowPlaylists(false);
                        }}
                        className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-[#F20D18] hover:bg-white/5 font-bold flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> New playlist
                      </button>

                      {playlists && playlists.length > 0 ? (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={async () => {
                              await addSongToPlaylist(pl.id, currentSong);
                              setToastMessage(`Added "${currentSong.title}" to ${pl.title}`);
                              setIsMenuOpen(false);
                              setShowPlaylists(false);
                            }}
                            className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-white/5 truncate font-medium block"
                          >
                            {pl.title}
                          </button>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-500 py-1 px-2 italic">No playlists yet</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/10 my-1" />

                <button 
                  onClick={() => {
                    const artistTarget = currentSong.artistId || currentSong.artist;
                    if (artistTarget) setSelectedArtistId(artistTarget);
                    setActiveTab('artist');
                    handleCloseModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Go to artist</span>
                  </div>
                  <span className="text-slate-400 text-xs">▸</span>
                </button>

                <button 
                  onClick={() => {
                    const albumTarget = currentSong.albumId || currentSong.album;
                    if (albumTarget) setSelectedAlbumId(albumTarget);
                    setActiveTab('album');
                    handleCloseModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Disc className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Go to album</span>
                  </div>
                  <span className="text-slate-400 text-xs">▸</span>
                </button>

                <div className="h-px bg-white/10 my-1" />

                {/* 3-State Download: 
                    1. Cloud ❌, Local ❌ -> Save for Offline Listening
                    2. Cloud ✅, Local ✅ -> Downloaded ✓ (Remove from device)
                    3. Cloud ✅, Local ❌ -> Download Again ↓ (Restore to device)
                */}
                <button 
                  onClick={async () => {
                    const { useDownloadStore } = await import('@/context/useDownloadStore');
                    if (isDownloaded) {
                      await useDownloadStore.getState().removeDownload(currentSong.id);
                      setToastMessage(`Removed "${currentSong.title}" from offline storage`);
                    } else {
                      await useDownloadStore.getState().saveForOffline(currentSong);
                      setToastMessage(isCloudRecorded ? `Restoring "${currentSong.title}" to device...` : `Saving "${currentSong.title}" for offline playback...`);
                    }
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Download className={`w-4 h-4 ${
                      isDownloaded 
                        ? 'text-emerald-400' 
                        : isCloudRecorded 
                          ? 'text-sky-400' 
                          : 'text-slate-400'
                    }`} />
                    <span className={`font-bold ${isCloudRecorded && !isDownloaded ? 'text-sky-400' : ''}`}>
                      {isDownloaded 
                        ? 'Downloaded ✓ (Remove)' 
                        : isCloudRecorded 
                          ? 'Download Again ↓ (Restore)' 
                          : 'Save for Offline Listening'}
                    </span>
                  </div>
                </button>

                {/* Mode B: Export Standalone MP3 */}
                <button 
                  onClick={async () => {
                    const { useDownloadStore } = await import('@/context/useDownloadStore');
                    await useDownloadStore.getState().exportSong(currentSong);
                    setToastMessage(`Exporting "${currentSong.title}" MP3 to device...`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-sky-400 rotate-[-45deg]" />
                    <span className="font-bold">Export MP3 to Device</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#song=${currentSong.id}` : '';
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      navigator.share({
                        title: currentSong.title,
                        text: `Listen to "${currentSong.title}" by ${currentSong.artist} on RaagaX`,
                        url: shareUrl || window.location.href,
                      }).catch(() => {});
                    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(shareUrl || window.location.href);
                      setToastMessage('Song link copied to clipboard!');
                    }
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Share2 className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">Share</span>
                  </div>
                  <span className="text-slate-400 text-xs">↗</span>
                </button>

                <button 
                  onClick={() => {
                    playNext();
                    setToastMessage(`Won't recommend "${currentSong.title}" again`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors text-red-400"
                >
                  <div className="flex items-center gap-3">
                    <Ban className="w-4 h-4 text-red-400" />
                    <span className="font-bold">Don't play this song</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Audio Settings / Equalizer Button */}
          <button
            onClick={toggleSettingsModal}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            title="Audio Settings & Equalizer"
          >
            <Settings2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Center Content Section (Flexible to fit screen without scroll) */}
      <div className="relative z-0 flex-1 min-h-0 flex flex-col justify-between w-full max-w-5xl mx-auto py-1 sm:py-4">
        
        {viewMode === 'art' ? (
          /* Cover Artwork */
          <div 
            onClick={() => setViewMode('lyrics')}
            className="flex-1 min-h-0 flex flex-col items-center justify-center w-full py-2 sm:py-6 overflow-hidden cursor-pointer group"
            title="Tap to view live synced lyrics"
          >
            <div
              className="relative rounded-[8%] sm:rounded-2xl overflow-hidden shadow-2xl border border-white/5 group-hover:scale-[1.01] transition-all"
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
        ) : (
          /* Fullscreen Synced Lyrics Live Mode */
          <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col relative overflow-hidden py-1 sm:py-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                <Mic2 className="w-4 h-4 text-[#FA233B]" /> Live Synced Lyrics
              </div>
              <button 
                onClick={() => setViewMode('art')}
                className="text-xs font-bold text-white/70 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
              >
                Show Album Art
              </button>
            </div>
            <div 
              ref={modalLyricsScrollRef}
              className="flex-1 overflow-y-auto scrollbar-hide py-16 px-4 space-y-4 sm:space-y-6 flex flex-col items-start"
            >
              {lyricsStatus === 'loading' && (
                <div className="w-full flex flex-col items-center justify-center py-16 text-white/60 gap-3">
                  <div className="w-6 h-6 border-2 border-red-500/30 border-t-[#FA233B] rounded-full animate-spin" />
                  <p className="text-sm font-semibold">Syncing lyrics...</p>
                </div>
              )}
              {lyricsStatus === 'unavailable' || lyricsLines.length === 0 ? (
                <div className="w-full text-center py-16 text-white/60">
                  <p className="text-lg font-bold text-white mb-1">Lyrics unavailable</p>
                  <p className="text-xs">No synced lyrics found for this song.</p>
                </div>
              ) : (
                lyricsLines.map((line, idx) => {
                  const isActive = idx === lyricsIndex;
                  const isPassed = idx < lyricsIndex;
                  return (
                    <div
                      key={line.id}
                      id={`modal-lyric-line-${idx}`}
                      onClick={() => {
                        if (line.startMs !== undefined && line.startMs >= 0) {
                          const sec = line.startMs / 1000;
                          usePlayerStore.getState().setCurrentTime(sec, true);
                          usePlayerStore.getState().setSeekTarget(sec);
                          import('@/lib/lyrics/LyricsEngine').then(({ LyricsEngine }) => {
                            LyricsEngine.getInstance().seek(line.startMs);
                          }).catch(() => {});
                        }
                      }}
                      className={`w-full text-left transition-all duration-300 transform origin-left cursor-pointer select-none leading-snug py-1
                        ${isActive 
                          ? 'text-2xl sm:text-4xl font-black text-[#FA233B] drop-shadow-[0_0_24px_rgba(250,35,59,0.85)] scale-[1.03]' 
                          : isPassed 
                            ? 'text-lg sm:text-2xl font-bold text-white/30 opacity-40 hover:opacity-75' 
                            : 'text-lg sm:text-2xl font-bold text-white/60 hover:text-white/95 opacity-70'}
                      `}
                    >
                      {line.text}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Bottom Player Controls Area (Tightly Packed) */}
        <div className="flex-shrink-0 flex flex-col gap-3 sm:gap-6 w-full">
          {/* Track Meta & Like Button Row (Spotify Style) */}
          <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto w-full px-1 sm:px-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug truncate">
                {currentSong.title}
              </h1>
              <p 
                onClick={() => {
                  const artistTarget = currentSong.artistId || currentSong.artist;
                  if (artistTarget) {
                    setSelectedArtistId(artistTarget);
                    setActiveTab('artist');
                    handleCloseModal();
                  }
                }}
                className="text-sm sm:text-base font-semibold text-white/70 truncate mt-0.5 sm:mt-1 cursor-pointer hover:text-white hover:underline transition-colors inline-block"
                title={`Go to artist: ${currentSong.artist}`}
              >
                {currentSong.artist}
              </p>
            </div>
            <button
              onClick={() => {
                toggleLikeSong(currentSong.id);
                setToastMessage(isLiked ? 'Removed from Liked Songs' : 'Saved to your Liked Songs');
              }}
              className="p-2 sm:p-3 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              title={isLiked ? "Remove from Liked Songs" : "Save to your Liked Songs"}
            >
              <Heart className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${isLiked ? 'fill-[#F20D18] text-[#F20D18]' : 'text-white/70 hover:text-white'}`} />
            </button>
          </div>

        {/* Timeline Seekbar */}
        <div className="max-w-4xl mx-auto w-full space-y-1 sm:space-y-2 px-1 sm:px-2">
          <SeekBar 
            height="h-1 sm:h-1.5"
            thumbSize="w-3 h-3"
            activeColor="bg-white group-hover:bg-[#F20D18]"
          />
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-white/60 font-semibold px-0.5">
            <span>{formatTime(visualTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Player Controls Row */}
        <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-8 max-w-4xl mx-auto w-full px-1">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors relative hover:scale-110 active:scale-95 ${
              shuffleMode !== 'OFF' ? 'text-[#F20D18]' : 'text-white/70 hover:text-white'
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
            {shuffleMode !== 'OFF' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#F20D18]" />}
          </button>

          <button
            onClick={() => {
              if (visualTime > 3) {
                setCurrentTime(0, true);
                usePlayerStore.setState({ seekTarget: 0 });
              } else {
                playPrev();
              }
            }}
            className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Previous Track"
          >
            <SkipBack className="w-7 h-7 sm:w-9 sm:h-9 fill-current" />
          </button>

          {/* Circular Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all cursor-pointer ${isPlaying ? 'shadow-[0_0_20px_rgba(242,13,24,0.4)]' : ''}`}
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
              repeatMode !== 'off' ? 'text-[#F20D18]' : 'text-white/70 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />}
            {repeatMode !== 'off' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#F20D18]" />}
          </button>
        </div>

        {/* Bottom Utility Actions Row */}
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-1 sm:px-2 pb-2">
          <DeviceSelector variant="icon" align="left" />

          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode(v => v === 'lyrics' ? 'art' : 'lyrics')}
              className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                viewMode === 'lyrics'
                  ? 'bg-[#FA233B] text-white shadow-red-500/30'
                  : 'bg-white text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Mic2 className={`w-4 h-4 ${viewMode === 'lyrics' ? 'text-white' : 'text-[#F20D18]'}`} /> 
              {viewMode === 'lyrics' ? 'Album Art' : 'Synced Lyrics'}
            </button>

            <button
              onClick={async () => {
                const { useDownloadStore } = await import('@/context/useDownloadStore');
                if (isDownloaded) {
                  await useDownloadStore.getState().removeDownload(currentSong.id);
                  setToastMessage(`Removed "${currentSong.title}" from offline storage`);
                } else {
                  await useDownloadStore.getState().saveForOffline(currentSong);
                  setToastMessage(isCloudRecorded ? `Restoring "${currentSong.title}" to device...` : `Saving "${currentSong.title}" for offline playback...`);
                }
              }}
              className={`p-2.5 rounded-2xl surface-card border transition-all ${
                isDownloaded 
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-sm' 
                  : isCloudRecorded
                    ? 'border-sky-500/50 text-sky-400 bg-sky-500/10 shadow-sm hover:scale-105'
                    : 'border-white/15 text-white/70 hover:text-white hover:border-[#F20D18]'
              }`}
              title={
                isDownloaded 
                  ? "Downloaded ✓ (Tap to remove from device)" 
                  : isCloudRecorded 
                    ? "Download Again ↓ (Restore to device)" 
                    : "Save for Offline Listening"
              }
            >
              <Download className={`w-4 h-4 ${
                isDownloaded 
                  ? 'text-emerald-400' 
                  : isCloudRecorded 
                    ? 'text-sky-400 animate-pulse' 
                    : 'text-white/70 hover:text-white'
              }`} />
            </button>

            <button
              onClick={toggleQueue}
              className="p-2.5 rounded-2xl surface-card border border-white/15 hover:border-white/40 transition-colors"
              title="Open Queue"
            >
              <ListMusic className="w-4 h-4 text-white/70 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* RaagaX Brand Crimson Active Device Bar (Very Bottom) */}
      <div 
        onClick={toggleDeviceModal}
        className="relative z-10 -mx-4 sm:-mx-6 md:-mx-8 -mb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#F20D18] text-white px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center justify-between font-bold text-xs cursor-pointer hover:bg-[#d90b15] transition-colors shadow-lg mt-3"
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


