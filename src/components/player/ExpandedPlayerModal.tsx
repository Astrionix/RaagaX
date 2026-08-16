'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, ChevronDown, Heart, Download, Play, Pause, SkipBack, SkipForward, 
  Disc3, Mic2, Music, Tv, RefreshCw, ExternalLink, Shuffle, Repeat, Repeat1, 
  ListMusic, Settings2, MonitorSmartphone, Check, MoreHorizontal, Share2, 
  User, Disc, ListPlus, Radio, Sparkles, FolderPlus, Ban, Plus, Moon,
  Clock, Volume2, ShieldCheck, Loader2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { DeviceSelector } from '@/components/providers/DeviceSyncProvider';
import { AudioSettingsDrawer } from './AudioSettingsDrawer';
import { useLyricsStore } from '@/context/useLyricsStore';
import { SeekBar } from './SeekBar';
import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';

export function ExpandedPlayerModal() {
  const { playlists, addSongToPlaylist } = usePlaylistStore();
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [viewMode, setViewMode] = useState<'art' | 'lyrics'>('art');
  const { 
    status: lyricsStatus, 
    type: lyricsType, 
    lines: lyricsLines, 
    currentLineIndex: lyricsIndex,
    scriptMode,
    setScriptMode,
    hasTransliteration
  } = useLyricsStore();
  const modalLyricsScrollRef = useRef<HTMLDivElement>(null);

  const {
    isPlayerExpanded,
    togglePlayerExpanded,
    deviceId,
    volume,
    isMuted,
    setVolume,
    toggleMute,
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
    toggleSleepTimerModal,
    sleepTimerMinutes,
    sleepTimerEndsAt,
    setSleepTimer,
    setSelectedArtistId,
    setSelectedAlbumId,
    setCreatePlaylistModalOpen,
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

  // Live Position Tracking for UI Display
  useEffect(() => {
    if (!isPlayerExpanded || isSeeking) return;
    let frame: number;
    const tick = () => {
      const engine = PlaybackEngine.getInstance();
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

  const [liveTimerStr, setLiveTimerStr] = useState<string | null>(null);

  // Sleep Timer Countdown Display
  useEffect(() => {
    const { sleepTimerMode } = usePlayerStore.getState();
    if (!sleepTimerEndsAt && sleepTimerMode !== 'end_of_song' && sleepTimerMode !== 'end_of_queue') {
      setLiveTimerStr(null);
      return;
    }
    if (sleepTimerMode === 'end_of_song') {
      setLiveTimerStr('Song End');
      return;
    }
    if (sleepTimerMode === 'end_of_queue') {
      setLiveTimerStr('Queue End');
      return;
    }
    const updateCountdown = () => {
      const endsAt = usePlayerStore.getState().sleepTimerEndsAt;
      if (!endsAt) {
        setLiveTimerStr(null);
        return;
      }
      const diffSec = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      setLiveTimerStr(`${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt]);

  // Close context menu on outside click
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

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '--:--';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const localDeviceObj = onlineDevices.find((d) => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Device';
  const activeName = !isActiveDevice 
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') 
    : localDeviceName;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[100] w-full h-[100dvh] bg-[#06070a]/90 backdrop-blur-[50px] p-4 sm:p-6 md:p-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col text-white select-none animate-in slide-in-from-bottom duration-300 overflow-hidden"
    >
      {/* Rhythm Glass Dynamic Atmospheric Illumination */}
      <div
        className="absolute inset-0 opacity-45 pointer-events-none blur-[120px] scale-[1.3] transition-all duration-1000 saturate-[220%]"
        style={{
          backgroundImage: `url(${currentSong.coverUrl || '/app-icon.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Specular Highlight Sheen */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.07] via-transparent to-black/40 pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <div className="relative z-50 flex items-center justify-between w-full pt-1 pb-2 sm:pb-3 max-w-5xl mx-auto flex-shrink-0">
        {/* Left: Minimize Player */}
        <button 
          onClick={handleCloseModal}
          className="p-2.5 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95"
          title="Minimize player"
        >
          <ChevronDown className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        {/* Center: Playing From */}
        <div 
          onClick={() => {
            const albumTarget = currentSong.albumId || currentSong.album;
            if (albumTarget) {
              setSelectedAlbumId(albumTarget);
              setActiveTab('album');
              handleCloseModal();
            }
          }}
          className={`text-center min-w-0 px-3 max-w-[55%] ${
            (currentSong.albumId || currentSong.album) ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'pointer-events-none'
          }`}
          title={currentSong.album ? `Go to album: ${currentSong.album}` : undefined}
        >
          <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-0.5">
            PLAYING FROM
          </p>
          <h3 className="text-xs sm:text-sm font-extrabold text-white truncate tracking-tight">
            {currentSong.album || currentSong.genre || 'Trending Hits'}
          </h3>
        </div>

        {/* Right: Connect Device + More Options */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Prominent Connect Device Button */}
          <button
            onClick={toggleDeviceModal}
            className={`p-2.5 rounded-full transition-all flex items-center gap-1.5 active:scale-95 ${
              !isActiveDevice 
                ? 'bg-[#fa233b] text-white shadow-lg shadow-[#fa233b]/40 animate-pulse' 
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title="Connect to Device"
          >
            <MonitorSmartphone className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Context Dropdown Menu Trigger */}
          <div className="relative inline-block" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
              title="More options"
            >
              <MoreHorizontal className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>

            {/* Context Dropdown Popover */}
            {isMenuOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-64 bg-[#12131a]/98 backdrop-blur-3xl border border-white/15 rounded-2xl p-2 shadow-[0_25px_70px_rgba(0,0,0,0.95)] z-[999] text-xs text-white select-none animate-in fade-in zoom-in-95 duration-150"
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
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/60'}`} />
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
                    <ListPlus className="w-4 h-4 text-white/60" />
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
                      <FolderPlus className="w-4 h-4 text-white/60" />
                      <span className="font-bold">Add to playlist</span>
                    </div>
                    <span className={`text-white/40 text-xs transition-transform ${showPlaylists ? 'rotate-90' : ''}`}>▸</span>
                  </button>

                  {showPlaylists && (
                    <div className="my-1 ml-4 pl-3 border-l border-white/10 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-40 overflow-y-auto">
                      <button
                        onClick={() => {
                          setCreatePlaylistModalOpen(true);
                          setIsMenuOpen(false);
                          setShowPlaylists(false);
                        }}
                        className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-[#fa233b] hover:bg-white/5 font-bold flex items-center gap-2"
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
                            className="w-full text-left py-1.5 px-2 rounded-lg text-[11px] text-white/80 hover:text-white hover:bg-white/5 truncate font-medium block"
                          >
                            {pl.title}
                          </button>
                        ))
                      ) : (
                        <p className="text-[10px] text-white/40 py-1 px-2 italic">No playlists yet</p>
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
                    <User className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Go to artist</span>
                  </div>
                  <span className="text-white/40 text-xs">▸</span>
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
                    <Disc className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Go to album</span>
                  </div>
                  <span className="text-white/40 text-xs">▸</span>
                </button>

                <div className="h-px bg-white/10 my-1" />

                {/* Sleep Timer Option */}
                <button 
                  onClick={() => {
                    toggleSleepTimerModal();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold">Sleep Timer</span>
                  </div>
                  {liveTimerStr && <span className="text-[10px] text-indigo-400 font-mono font-bold">{liveTimerStr}</span>}
                </button>

                {/* Share Option */}
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
                    <Share2 className="w-4 h-4 text-white/60" />
                    <span className="font-bold">Share</span>
                  </div>
                  <span className="text-white/40 text-xs">↗</span>
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
        </div>
      </div>


      {/* CENTER VIEW: ALBUM ART OR LIVE SYNCED LYRICS */}
      <div className="relative z-0 flex-1 min-h-0 flex flex-col justify-between w-full max-w-4xl mx-auto py-1 sm:py-3">
        
        {viewMode === 'art' ? (
          /* Album Artwork Screen */
          <div 
            onClick={() => setViewMode('lyrics')}
            className="flex-1 min-h-0 flex flex-col items-center justify-center w-full py-2 overflow-hidden cursor-pointer group"
            title="Tap to switch to live synced lyrics"
          >
            <div
              className="relative rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)] border border-white/10 group-hover:scale-[1.02] transition-all duration-300"
              style={{
                width: 'min(38vh, 84vw, 360px)',
                height: 'min(38vh, 84vw, 360px)',
                flexShrink: 0,
              }}
            >
              <img
                src={(currentSong.coverUrl && !currentSong.coverUrl.includes('/null/') && !currentSong.coverUrl.includes('null/null')) ? currentSong.coverUrl : '/app-icon.png'}
                alt={currentSong.title}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                className={`w-full h-full object-cover transition-all duration-700 ${isPlaying ? 'scale-[1.03]' : 'scale-100'}`}
              />
            </div>
          </div>
        ) : (
          /* Fullscreen Synced Lyrics Live Mode */
          <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col relative overflow-hidden py-1 sm:py-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-white/10 relative">
              <div className="flex items-center gap-2 text-xs font-black text-white/90">
                <Mic2 className="w-4 h-4 text-[#fa233b]" /> Live Synced Lyrics
              </div>

              {/* Script Mode Switcher: Option A (Native) ↔ Option B (Transliteration) */}
              {hasTransliteration && (
                <div className="flex items-center p-0.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-bold">
                  <button
                    onClick={() => setScriptMode('native')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      scriptMode === 'native' 
                        ? 'bg-white/20 text-white shadow-sm font-black' 
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    ● Native
                  </button>
                  <button
                    onClick={() => setScriptMode('transliteration')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      scriptMode === 'transliteration' 
                        ? 'bg-white/20 text-white shadow-sm font-black' 
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    ● Transliteration
                  </button>
                </div>
              )}

              <button 
                onClick={() => setViewMode('art')}
                className="text-xs font-bold text-white/80 hover:text-white px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
              >
                Show Album Art
              </button>
            </div>
            
            <div 
              ref={modalLyricsScrollRef}
              className="flex-1 overflow-y-auto scrollbar-hide py-20 px-3 sm:px-4 space-y-6 sm:space-y-8 flex flex-col items-start"
            >
              {lyricsStatus === 'loading' && (
                <div className="w-full flex flex-col items-center justify-center py-16 text-white/60 gap-3">
                  <Loader2 className="w-6 h-6 text-[#fa233b] animate-spin" />
                  <p className="text-sm font-semibold">Syncing lyrics...</p>
                </div>
              )}
              {lyricsStatus === 'unavailable' || lyricsLines.length === 0 ? (
                <div className="w-full text-center py-16 text-white/60">
                  <p className="text-lg font-bold text-white mb-1">Lyrics unavailable</p>
                  <p className="text-xs">No synchronized lyrics found for this song.</p>
                </div>
              ) : (
                lyricsLines.map((line, idx) => {
                  const isActive = idx === lyricsIndex;
                  const isPassed = idx < lyricsIndex;
                  const displayContent = (scriptMode === 'transliteration' && line.romanizedText) 
                    ? line.romanizedText 
                    : (line.nativeText || line.text);

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
                          import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
                            ConnectManager.getInstance().dispatchPlaybackCommand('SEEK', { positionMs: line.startMs });
                          }).catch(() => {});
                        }
                      }}
                      className={`w-full text-left transition-all duration-300 transform origin-left cursor-pointer select-none leading-snug py-1
                        ${isActive 
                          ? 'text-2xl sm:text-4xl font-black text-[#fa233b] drop-shadow-[0_0_25px_rgba(250,35,59,0.85)] scale-[1.02]' 
                          : isPassed 
                            ? 'text-lg sm:text-2xl font-bold text-white/35 opacity-40 hover:opacity-75' 
                            : 'text-lg sm:text-2xl font-bold text-white/65 hover:text-white/95 opacity-70'}
                      `}
                    >
                      <div className="tracking-tight break-words">{displayContent}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* BOTTOM PLAYER CONTROLS SECTION */}
        <div className="flex-shrink-0 flex flex-col gap-3 sm:gap-5 w-full">
          
          {/* SONG TITLE & ARTIST ROW + ANIMATED HEART */}
          <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto w-full px-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug truncate">
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
                className="text-sm font-semibold text-white/60 truncate mt-0.5 cursor-pointer hover:text-white hover:underline transition-colors inline-block"
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
              className="p-2.5 rounded-full hover:bg-white/10 transition-transform active:scale-125 flex-shrink-0"
              title={isLiked ? "Remove from Liked Songs" : "Save to your Liked Songs"}
            >
              <Heart className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-200 ${isLiked ? 'fill-[#fa233b] text-[#fa233b]' : 'text-white/70 hover:text-white'}`} />
            </button>
          </div>

          {/* PROGRESS / SEEK BAR (INTERACTIVE SCRUBBER) */}
          <div className="max-w-4xl mx-auto w-full space-y-1 px-1">
            <SeekBar 
              height="h-1.5"
              thumbSize="w-3.5 h-3.5"
              activeColor="bg-[#fa233b]"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-white/50 font-bold px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(Number.isFinite(duration) && duration > 0 ? duration : (Number.isFinite(currentSong?.duration) && currentSong.duration > 0 ? currentSong.duration : -1))}</span>
            </div>
          </div>

          {/* MAIN 5-BUTTON PLAYBACK CONTROLS ROW */}
          <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-8 max-w-4xl mx-auto w-full px-1">
            
            {/* 1. Shuffle Button */}
            <button
              onClick={toggleShuffle}
              className={`p-2.5 transition-all relative hover:scale-110 active:scale-95 ${
                shuffleMode !== 'OFF' ? 'text-[#fa233b]' : 'text-white/60 hover:text-white'
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
              {shuffleMode !== 'OFF' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#fa233b]" />}
            </button>

            {/* 2. Previous Button */}
            <button
              onClick={() => {
                if (visualTime > 5) {
                  setCurrentTime(0, true);
                  usePlayerStore.setState({ seekTarget: 0 });
                } else {
                  playPrev();
                }
              }}
              className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
              title="Previous Track"
            >
              <SkipBack className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
            </button>

            {/* 3. Large Circular Glowing PLAY / PAUSE Button */}
            <button
              onClick={togglePlayPause}
              className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-tr from-[#fa233b] to-[#ff4d6d] text-white hover:scale-105 active:scale-95 flex items-center justify-center shadow-[0_0_30px_rgba(250,35,59,0.5)] transition-all cursor-pointer`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-white text-white" />
              ) : (
                <Play className="w-8 h-8 fill-white text-white ml-1" />
              )}
            </button>

            {/* 4. Next Button */}
            <button
              onClick={playNext}
              className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
              title="Next Track"
            >
              <SkipForward className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
            </button>

            {/* 5. Repeat Button */}
            <button
              onClick={cycleRepeatMode}
              className={`p-2.5 transition-all relative hover:scale-110 active:scale-95 ${
                repeatMode !== 'off' ? 'text-[#fa233b]' : 'text-white/60 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />}
              {repeatMode !== 'off' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#fa233b]" />}
            </button>
          </div>

          {/* PLAYER ACTION TOOLBAR ROW */}
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-1 pb-1 gap-2">
            
            {/* Left: Synced Lyrics Toggle Button */}
            <button
              onClick={() => setViewMode(v => v === 'lyrics' ? 'art' : 'lyrics')}
              className={`px-3.5 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0 ${
                viewMode === 'lyrics'
                  ? 'bg-[#fa233b] text-white shadow-[#fa233b]/30'
                  : 'bg-white/10 hover:bg-white/20 text-white/90'
              }`}
            >
              <Mic2 className={`w-4 h-4 ${viewMode === 'lyrics' ? 'text-white' : 'text-[#fa233b]'}`} /> 
              <span>{viewMode === 'lyrics' ? 'Album Art' : 'Lyrics'}</span>
            </button>

            {/* Middle: Integrated Volume Slider */}
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
              <button 
                onClick={toggleMute}
                className="text-white/60 hover:text-white transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#fa233b]" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#fa233b]"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Right Action Utilities: Download, Sleep Timer, Equalizer, Queue */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              
              {/* Offline Download Button (4-State) */}
              <button
                onClick={async () => {
                  if (isDownloaded) {
                    await useDownloadStore.getState().removeDownload(currentSong.id);
                    setToastMessage(`Removed "${currentSong.title}" from offline storage`);
                  } else {
                    await useDownloadStore.getState().saveForOffline(currentSong);
                    setToastMessage(isCloudRecorded ? `Restoring "${currentSong.title}" to device...` : `Saving "${currentSong.title}" for offline playback...`);
                  }
                }}
                className={`p-2.5 rounded-2xl border transition-all active:scale-95 ${
                  isDownloaded 
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10 shadow-sm' 
                    : isCloudRecorded
                      ? 'border-sky-500/50 text-sky-400 bg-sky-500/10 shadow-sm hover:scale-105'
                      : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-[#fa233b]'
                }`}
                title={
                  isDownloaded 
                    ? "Downloaded ✓ (Tap to remove)" 
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

              {/* 2. Sleep Timer Button (Inactive: icon / Active: glowing live countdown 🌙 27:45) */}
              <button
                onClick={toggleSleepTimerModal}
                className={`px-3 py-2.5 rounded-2xl border transition-all flex items-center gap-1.5 active:scale-95 ${
                  liveTimerStr 
                    ? 'border-[#fa233b]/60 text-[#fa233b] bg-[#fa233b]/15 shadow-[0_0_15px_rgba(250,35,59,0.3)]' 
                    : 'border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30'
                }`}
                title={liveTimerStr ? `Sleep Timer: ${liveTimerStr} remaining` : "Set Sleep Timer"}
              >
                <Moon className={`w-4 h-4 ${liveTimerStr ? 'text-[#fa233b] animate-pulse' : ''}`} />
                {liveTimerStr && <span className="font-mono text-xs font-black text-white">{liveTimerStr}</span>}
              </button>

              {/* Equalizer & Audio Settings Button */}
              <button
                onClick={toggleSettingsModal}
                className="p-2.5 rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-all active:scale-95"
                title="Equalizer & Audio Quality"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              {/* Queue Button */}
              <button
                onClick={toggleQueue}
                className="p-2.5 rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-all active:scale-95"
                title="Current Queue"
              >
                <ListMusic className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RAAGAX CONNECT ACTIVE DEVICE BOTTOM BAR */}
      <div 
        onClick={toggleDeviceModal}
        className="relative z-10 -mx-4 sm:-mx-6 md:-mx-8 -mb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-[#fa233b] text-white px-5 py-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] flex items-center justify-between font-black text-xs cursor-pointer hover:bg-[#d91533] transition-colors shadow-[0_-5px_20px_rgba(250,35,59,0.3)] mt-2"
      >
        <div className="flex items-center gap-2.5 max-w-xl truncate">
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
