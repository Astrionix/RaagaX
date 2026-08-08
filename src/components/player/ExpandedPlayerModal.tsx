'use client';

import React from 'react';
import { X, Heart, Download, Share2, Play, Pause, SkipBack, SkipForward, Disc3, Mic2, Music, UserCheck, Tv, RefreshCw, ExternalLink } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import dynamic from 'next/dynamic';

const VinylRecordScene = dynamic(() => import('../3d/VinylRecordScene').then(m => m.VinylRecordScene), { ssr: false });
const Equalizer3D = dynamic(() => import('../3d/Equalizer3D').then(m => m.Equalizer3D), { ssr: false });

export function ExpandedPlayerModal() {
  const {
    isPlayerExpanded,
    togglePlayerExpanded,
    isVideoModeActive,
    setVideoModeActive,
    currentSong,
    isPlaying,
    currentTime,
    togglePlayPause,
    setIsPlaying,
    playNext,
    playPrev,
    likedSongIds,
    toggleLikeSong,
    downloadedSongIds,
    toggleDownloadSong,
    toggleLyrics,
  } = usePlayerStore();

  const [isVideoMode, setIsVideoMode] = React.useState(false);
  const [candidateVideoIds, setCandidateVideoIds] = React.useState<string[]>([]);
  const [videoIndex, setVideoIndex] = React.useState<number>(0);

  const handleSwitchToVideoMode = () => {
    setIsVideoMode(true);
    setVideoModeActive(true);
    setIsPlaying(false);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.pause();
    }
  };

  const handleSwitchToAudioMode = () => {
    setIsVideoMode(false);
    setVideoModeActive(false);
    setIsPlaying(true);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.play().catch(() => {});
    }
  };

  const handleCloseModal = () => {
    setVideoModeActive(false);
    togglePlayerExpanded();
  };

  React.useEffect(() => {
    if (isPlayerExpanded && isVideoModeActive) {
      setIsVideoMode(true);
      setIsPlaying(false);
      const audioEl = document.querySelector('audio');
      if (audioEl) audioEl.pause();
    }
  }, [isPlayerExpanded, isVideoModeActive]);

  React.useEffect(() => {
    if (!currentSong || !isVideoMode) return;

    let isSubscribed = true;
    const fetchVideoId = async () => {
      try {
        const query = `${currentSong.title} ${currentSong.artist} official video`;
        const res = await fetch(`/api/youtube-video?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (isSubscribed && data.videoIds && data.videoIds.length > 0) {
          setCandidateVideoIds(data.videoIds);
          setVideoIndex(0);
        }
      } catch (err) {
        console.warn('Could not resolve YouTube video ID:', err);
      }
    };

    fetchVideoId();
    return () => {
      isSubscribed = false;
    };
  }, [currentSong?.id, isVideoMode]);

  const touchStartY = React.useRef<number | null>(null);
  const touchStartX = React.useRef<number | null>(null);

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

  const startSeconds = Math.floor(currentTime || 0);
  const activeVideoId = candidateVideoIds[videoIndex] || null;
  const youtubeSearchQuery = encodeURIComponent(`${currentSong.title} ${currentSong.artist} official video`);

  const youtubeEmbedUrl = activeVideoId
    ? `https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&rel=0&start=${startSeconds}`
    : `https://www.youtube-nocookie.com/embed?listType=search&list=${youtubeSearchQuery}&autoplay=1`;

  const youtubeDirectUrl = activeVideoId
    ? `https://www.youtube.com/watch?v=${activeVideoId}&t=${startSeconds}s`
    : `https://www.youtube.com/results?search_query=${youtubeSearchQuery}`;

  const handleNextCandidate = () => {
    if (candidateVideoIds.length > 1) {
      setVideoIndex((prev) => (prev + 1) % candidateVideoIds.length);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[100] w-full h-full bg-[#0A0B0E]/98 backdrop-blur-3xl p-4 sm:p-6 md:p-12 overflow-y-auto animate-in slide-in-from-bottom duration-300 flex flex-col justify-between text-white select-none"
    >
      {/* Dynamic Ambient Background Art Glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none blur-3xl scale-125 transition-all duration-1000"
        style={{
          backgroundImage: `url(${currentSong.coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl crimson-gradient flex items-center justify-center shadow-lg flex-shrink-0">
            <Disc3 className="w-4 h-4 sm:w-6 sm:h-6 text-white animate-spin" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-base font-black text-white truncate">
              {isVideoMode ? 'Video Mode' : 'Now Playing'}
            </h2>
            <p className="text-[10px] sm:text-xs text-[#EF233C] font-semibold uppercase tracking-wider truncate">
              {isVideoMode ? '🎬 YouTube Video' : '🎧 Lossless Audio'}
            </p>
          </div>
        </div>

        {/* Dual Mode Switcher & Close */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center p-0.5 sm:p-1 rounded-xl sm:rounded-2xl surface-card border border-white/10 text-[10px] sm:text-xs font-bold">
            <button
              onClick={handleSwitchToAudioMode}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1 transition-all ${
                !isVideoMode ? 'bg-[#EF233C] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Music className="w-3 h-3" /> Audio
            </button>
            <button
              onClick={handleSwitchToVideoMode}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1 transition-all ${
                isVideoMode ? 'bg-[#EF233C] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3 h-3" /> Video
            </button>
          </div>

          <button
            onClick={handleCloseModal}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl surface-card border border-white/10 text-slate-300 hover:text-white hover:scale-105 transition-transform"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main Grid: 3D Vinyl Scene / YouTube Video Player + Track Meta */}
      <div className="my-4 sm:my-8 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 items-center max-w-6xl mx-auto w-full">
        {/* Left Column: Dual Player Visual (YouTube Iframe Video or 3D Vinyl) */}
        <div className="space-y-3">
          {isVideoMode ? (
            <div className="space-y-2.5">
              <div className="relative aspect-video w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black">
                <iframe
                  key={youtubeEmbedUrl}
                  src={youtubeEmbedUrl}
                  title={`${currentSong.title} Official Music Video`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                {candidateVideoIds.length > 1 && (
                  <button
                    onClick={handleNextCandidate}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold inline-flex items-center gap-1 transition-colors"
                    title="Switch to alternate video upload"
                  >
                    <RefreshCw className="w-3 h-3 text-[#EF233C]" /> Alt Video ({videoIndex + 1}/{candidateVideoIds.length})
                  </button>
                )}
                <a
                  href={youtubeDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-[#EF233C]/20 hover:bg-[#EF233C]/30 text-[#EF233C] font-extrabold border border-[#EF233C]/40 inline-flex items-center gap-1 transition-colors ml-auto"
                >
                  <ExternalLink className="w-3 h-3" /> Open in YouTube ↗
                </a>
              </div>
            </div>
          ) : (
            <>
              <VinylRecordScene coverUrl={currentSong.coverUrl} isPlaying={isPlaying} />
              <Equalizer3D isPlaying={isPlaying} />
            </>
          )}
        </div>

        {/* Right Column: Song Details, Lyrics Button & Credits */}
        <div className="space-y-4 sm:space-y-6">
          <div className="space-y-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-[#EF233C]/20 text-[#EF233C] text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border border-[#EF233C]/30">
              {currentSong.genre} • {currentSong.releaseYear}
            </span>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-snug">
              {currentSong.title}
            </h1>
            <p className="text-sm sm:text-lg font-bold text-slate-300">{currentSong.artist}</p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Album: {currentSong.album}</p>
          </div>

          {/* Credits Box (Collapsible on small screens) */}
          <div className="hidden sm:block p-4 sm:p-5 rounded-2xl surface-card border border-white/10 space-y-2 text-xs text-slate-300">
            <h4 className="font-extrabold text-white uppercase tracking-wider">Production Credits</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <span className="text-slate-400">Composer:</span>
                <p className="font-bold text-white truncate">{currentSong.credits?.composer || currentSong.artist}</p>
              </div>
              <div>
                <span className="text-slate-400">Lyricist:</span>
                <p className="font-bold text-white truncate">{currentSong.credits?.lyricist || 'RaagaX Catalog'}</p>
              </div>
              <div>
                <span className="text-slate-400">Singers:</span>
                <p className="font-bold text-white truncate">{currentSong.credits?.singers.join(', ') || currentSong.artist}</p>
              </div>
              <div>
                <span className="text-slate-400">Record Label:</span>
                <p className="font-bold text-white truncate">{currentSong.credits?.label || 'Sony / Aditya Music'}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={togglePlayPause}
              className="px-8 py-3.5 rounded-2xl crimson-gradient text-white font-extrabold text-sm flex items-center gap-2.5 crimson-glow hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              onClick={() => (isVideoMode ? handleSwitchToAudioMode() : handleSwitchToVideoMode())}
              className="px-5 py-3.5 rounded-2xl surface-card border border-white/15 text-white font-bold text-xs flex items-center gap-2 hover:border-[#EF233C] transition-colors"
            >
              <Tv className="w-4 h-4 text-[#EF233C]" /> {isVideoMode ? 'Switch to 3D Audio' : 'Watch Video'}
            </button>

            <button
              onClick={() => toggleLikeSong(currentSong.id)}
              className="p-3.5 rounded-2xl surface-card border border-white/15 hover:border-red-400 transition-colors"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-red-500' : 'text-slate-400'}`} />
            </button>

            <button
              onClick={() => toggleDownloadSong(currentSong.id)}
              className="p-3.5 rounded-2xl surface-card border border-white/15 hover:border-emerald-500 transition-colors"
            >
              <Download className={`w-5 h-5 ${isDownloaded ? 'text-emerald-500' : 'text-slate-400'}`} />
            </button>

            <button
              onClick={() => {
                togglePlayerExpanded();
                toggleLyrics();
              }}
              className="px-5 py-3.5 rounded-2xl bg-white text-slate-900 font-extrabold text-xs flex items-center gap-2 hover:bg-slate-200 transition-colors"
            >
              <Mic2 className="w-4 h-4 text-[#EF233C]" /> Synced Lyrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
