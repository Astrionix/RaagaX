"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Mic2,
  ListMusic,
  Volume2,
  VolumeX,
  Sliders,
  Cast,
  ListPlus,
  Share2,
  Sparkles,
  Moon,
  Gauge,
  Check,
  Activity,
  Layers,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import { formatTime, getOptimalArtwork } from "@/lib/utils";
import { getMeshGradient } from "@/lib/color/mesh-gradient";
import { extractPaletteFromImage } from "@/lib/color/extract-palette";
import MeshGradientBackdrop from "./MeshGradientBackdrop";
import SyncedLyricsView from "./SyncedLyricsView";
import QueueDrawer from "./QueueDrawer";

export default function NowPlayingModal() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    isNowPlayingOpen,
    setNowPlayingOpen,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    next,
    prev,
    toggleShuffle,
    toggleRepeat,
    setEqualizerOpen,
    setConnectModalOpen,
    openPlaylistPicker,
    playbackSpeed,
    setPlaybackSpeed,
    sleepTimerEndsAt,
    setSleepTimer,
    canvasUrl,
    canvasActive,
    setCanvasActive,
    setNerdStatsOpen,
  } = usePlayerStore();

  const { isLiked, toggleLike } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"controls" | "lyrics" | "queue">("controls");
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isHoveringArt, setIsHoveringArt] = useState(false);

  if (!isNowPlayingOpen || !currentSong) return null;

  const liked = isLiked(currentSong.videoId);
  const effectiveTime = isSeeking ? seekVal : currentTime;
  const progressPercent = duration > 0 ? (effectiveTime / duration) * 100 : 0;
  const defaultGradient = getMeshGradient(`${currentSong.title}-${currentSong.artist}`);
  const artworkUrl = getOptimalArtwork(currentSong.thumbnailUrl, 720);
  const [activeGradient, setActiveGradient] = useState(defaultGradient);

  useEffect(() => {
    let cancelled = false;
    if (artworkUrl) {
      extractPaletteFromImage(artworkUrl, defaultGradient.primaryColor).then((pal) => {
        if (!cancelled) setActiveGradient(pal);
      });
    } else {
      setActiveGradient(defaultGradient);
    }
    return () => {
      cancelled = true;
    };
  }, [artworkUrl, defaultGradient.primaryColor]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSeeking(true);
    setSeekVal(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    setIsSeeking(false);
    seek(seekVal);
  };

  // Artwork scale state modeled after Raaga Android NowPlayingScreen.kt:
  // ARTWORK_EXPANDED_SCALE (1.0) when playing,
  // ARTWORK_PAUSE_SHRINK_SCALE (0.88) when paused,
  // ARTWORK_DRAG_SHRINK_SCALE (0.93) when seeking
  const artworkScaleClass = isSeeking
    ? "scale-[0.93]"
    : isPlaying
    ? "scale-100"
    : "scale-[0.88]";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070709] text-white select-none overflow-hidden animate-in fade-in duration-300">
      {/* 1. Dynamic Organic Mesh Gradient Backdrop (replicates Raaga Android MeshGradient.kt) */}
      <MeshGradientBackdrop
        palette={activeGradient}
        artworkUrl={artworkUrl}
        isPlaying={isPlaying}
      />

      {/* 2. Top Header Bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-black/20 backdrop-blur-md">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-raaga-red to-raaga-pink flex items-center justify-center shadow-[0_2px_12px_rgba(250,45,72,0.4)]">
            <span className="font-black text-white text-base tracking-tighter">R</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">RAAGA</span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/10">
                Expanded Player
              </span>
            </div>
          </div>
        </div>

        {/* Center Playing Indicator */}
        <div className="hidden sm:flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Playing from YouTube Music
          </span>
          <span className="text-xs font-semibold text-white/90 truncate max-w-sm">
            {currentSong.albumName || currentSong.title}
          </span>
        </div>

        {/* Right Tools & Minimize Button */}
        <div className="flex items-center gap-2">
          {/* Equalizer (DSP) */}
          <button
            onClick={() => setEqualizerOpen(true)}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="Audio Hardware Equalizer"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Raaga Connect (Cast) */}
          <button
            onClick={() => setConnectModalOpen(true)}
            className="p-2 text-neutral-400 hover:text-raaga-cyan hover:bg-white/10 rounded-xl transition"
            title="Raaga Connect"
          >
            <Cast className="w-4 h-4" />
          </button>

          {/* Stats for Nerds */}
          <button
            onClick={() => setNerdStatsOpen(true)}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition"
            title="Stats for Nerds (Audio Bitrate & Engine)"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Sleep Timer Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSleepMenu(!showSleepMenu)}
              className={`p-2 rounded-xl transition ${
                sleepTimerEndsAt
                  ? "text-raaga-cyan bg-raaga-cyan/15"
                  : "text-neutral-400 hover:text-white hover:bg-white/10"
              }`}
              title="Sleep Timer"
            >
              <Moon className="w-4 h-4" />
            </button>

            {showSleepMenu && (
              <div className="absolute right-0 top-11 z-30 w-44 rounded-2xl liquid-glass border border-white/15 p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-1">
                  Sleep Timer
                </div>
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setSleepTimer(mins);
                      setShowSleepMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/10 rounded-lg flex items-center justify-between"
                  >
                    <span>{mins} minutes</span>
                    {sleepTimerEndsAt &&
                      Math.round((sleepTimerEndsAt - Date.now()) / 60000) === mins && (
                        <Check className="w-3.5 h-3.5 text-raaga-cyan" />
                      )}
                  </button>
                ))}
                {sleepTimerEndsAt && (
                  <button
                    onClick={() => {
                      setSleepTimer(null);
                      setShowSleepMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-raaga-red hover:bg-raaga-red/10 rounded-lg font-medium border-t border-white/10 mt-1 pt-2"
                  >
                    Turn off timer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Playback Speed Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className={`p-2 rounded-xl transition ${
                playbackSpeed !== 1.0
                  ? "text-raaga-red bg-raaga-red/15"
                  : "text-neutral-400 hover:text-white hover:bg-white/10"
              }`}
              title={`Playback Speed: ${playbackSpeed}x`}
            >
              <Gauge className="w-4 h-4" />
            </button>

            {showSpeedMenu && (
              <div className="absolute right-0 top-11 z-30 w-36 rounded-2xl liquid-glass border border-white/15 p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-1">
                  Speed
                </div>
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center justify-between transition ${
                      playbackSpeed === speed
                        ? "bg-white text-black font-bold"
                        : "text-neutral-200 hover:bg-white/10"
                    }`}
                  >
                    <span>{speed}x</span>
                    {playbackSpeed === speed && <Check className="w-3.5 h-3.5 text-black" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Minimize Button */}
          <button
            onClick={() => setNowPlayingOpen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition text-xs font-semibold shadow-sm ml-1"
            title="Minimize to Floating Player (↓)"
          >
            <ChevronDown className="w-4 h-4" />
            <span className="hidden sm:inline">Minimize</span>
          </button>
        </div>
      </header>

      {/* 3. Main Stage Layout */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 sm:p-10 max-w-6xl mx-auto w-full flex items-center justify-center no-scrollbar">
        {/* ================= Wide Desktop Two-Column Layout (lg+) ================= */}
        <div className="hidden lg:grid grid-cols-2 gap-12 xl:gap-16 w-full items-center">
          {/* Left Column: Sleeve Artwork with Breathing Scale & 3D Lighting */}
          <div className="flex flex-col items-center justify-center">
            <div
              onMouseEnter={() => setIsHoveringArt(true)}
              onMouseLeave={() => setIsHoveringArt(false)}
              className="relative w-full max-w-[440px] aspect-square flex items-center justify-center group"
            >
              {/* Dynamic Ambient Halo Glow behind artwork (breathing with isPlaying state) */}
              <div
                className={`absolute -inset-6 rounded-[36px] blur-3xl transition-all duration-700 pointer-events-none -z-10 ${
                  isPlaying
                    ? "opacity-55 animate-pulse-glow"
                    : "opacity-20 scale-95"
                }`}
                style={{
                  background: `radial-gradient(circle at center, ${activeGradient.primaryColor}CC 0%, ${activeGradient.secondaryColor}80 50%, transparent 80%)`,
                }}
              />

              {/* Main Artwork Sleeve Container with smooth Cubic Bezier scale animation */}
              <div
                className={`relative w-full h-full rounded-[28px] overflow-hidden bg-neutral-900 border border-white/20 transition-all duration-500 ease-[cubic-bezier(0.215,0.61,0.355,1)] transform ${artworkScaleClass} ${
                  isPlaying
                    ? "shadow-[0_28px_80px_rgba(0,0,0,0.88)]"
                    : "shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
                } ${isHoveringArt ? "scale-[1.02] -translate-y-1" : ""}`}
              >
                {canvasActive && canvasUrl ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={canvasUrl}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <img
                    src={artworkUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}

                {/* Artwork vs Spotify Canvas Mode Pill */}
                {canvasUrl && (
                  <div className="absolute top-3.5 right-3.5 z-20 flex items-center bg-black/60 backdrop-blur-md rounded-full p-0.5 border border-white/20 text-[10px] font-semibold shadow-lg">
                    <button
                      onClick={() => setCanvasActive(false)}
                      className={`px-3 py-1 rounded-full transition ${
                        !canvasActive
                          ? "bg-white text-black shadow-md font-bold"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Art
                    </button>
                    <button
                      onClick={() => setCanvasActive(true)}
                      className={`px-3 py-1 rounded-full transition ${
                        canvasActive
                          ? "bg-raaga-cyan text-black shadow-md font-bold"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Canvas
                    </button>
                  </div>
                )}

                {/* 4-Light Diagonal Specular Sheen (matching Liquid Glass design) */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.14] via-transparent to-transparent pointer-events-none rounded-[inherit]" />
              </div>
            </div>

            {/* Quick action buttons beneath artwork */}
            <div className="flex items-center gap-3 mt-7">
              <button
                onClick={() => toggleLike(currentSong)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition ${
                  liked
                    ? "bg-raaga-red/20 text-raaga-red border-raaga-red/40 shadow-[0_0_15px_rgba(250,45,72,0.3)]"
                    : "bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10"
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-raaga-red" : ""}`} />
                <span className="text-xs font-semibold">{liked ? "Liked" : "Like"}</span>
              </button>

              <button
                onClick={() => openPlaylistPicker(currentSong)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 text-xs font-semibold transition"
              >
                <ListPlus className="w-4 h-4" />
                <span>Add to Playlist</span>
              </button>

              <button
                onClick={() =>
                  navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentSong.videoId}`)
                }
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 text-xs font-semibold transition"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Right Column: Liquid Glass Panel Deck (Controls / Lyrics / Queue) */}
          <div className="flex flex-col h-[520px] liquid-glass-sidebar border border-white/15 rounded-[28px] p-7 shadow-2xl overflow-hidden relative">
            {/* Specular Reflection Sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

            {/* Tab Selector Pill Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 shrink-0 relative z-10">
              <div className="flex items-center gap-2 bg-white/[0.06] p-1 rounded-full border border-white/10">
                <button
                  onClick={() => setActiveTab("controls")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    activeTab === "controls"
                      ? "bg-white text-black shadow-md font-bold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Controls
                </button>
                <button
                  onClick={() => setActiveTab("lyrics")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    activeTab === "lyrics"
                      ? "bg-white text-black shadow-md font-bold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Mic2 className="w-3.5 h-3.5" />
                  <span>Lyrics</span>
                </button>
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    activeTab === "queue"
                      ? "bg-white text-black shadow-md font-bold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue</span>
                </button>
              </div>

              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-raaga-red/20 text-raaga-red border border-raaga-red/30">
                Hi-Res Audio
              </span>
            </div>

            {/* Tab 1: Controls & Metadata */}
            {activeTab === "controls" && (
              <div className="flex-1 flex flex-col justify-between pt-6 space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div>
                  <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight line-clamp-2 leading-tight">
                    {currentSong.title}
                  </h2>
                  <p className="text-base text-neutral-300 font-medium mt-1">
                    {currentSong.artist}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {currentSong.albumName ? `${currentSong.albumName} • ` : ""}
                    {currentSong.playbackSource || "YouTube Music"}
                  </p>
                </div>

                {/* Progress Timeline Scrubber */}
                <div className="space-y-2">
                  <div className="relative flex items-center group cursor-pointer">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.5}
                      value={isSeeking ? seekVal : currentTime}
                      onChange={handleSeekChange}
                      onMouseUp={handleSeekCommit}
                      onTouchEnd={handleSeekCommit}
                      className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-raaga-red group-hover:h-2 transition-all"
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-neutral-400">
                    <span>{formatTime(effectiveTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Primary Transport Controls */}
                <div className="flex items-center justify-center gap-6">
                  {/* Shuffle */}
                  <button
                    onClick={toggleShuffle}
                    className={`p-2.5 rounded-full transition ${
                      isShuffled
                        ? "text-raaga-red bg-raaga-red/15"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Shuffle"
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>

                  {/* Previous */}
                  <button
                    onClick={prev}
                    className="p-3 text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition active:scale-95"
                    title="Previous Track (←)"
                  >
                    <SkipBack className="w-6 h-6 fill-current" />
                  </button>

                  {/* Play / Pause button with subtle pulse ripple */}
                  <button
                    onClick={togglePlay}
                    className="relative w-16 h-16 rounded-full bg-white hover:bg-neutral-100 text-black flex items-center justify-center shadow-[0_6px_28px_rgba(255,255,255,0.4)] transition hover:scale-105 active:scale-95 shrink-0 group"
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  >
                    {isPlaying && (
                      <span className="absolute -inset-1 rounded-full bg-white/20 animate-ping opacity-25 pointer-events-none" />
                    )}
                    {isPlaying ? (
                      <Pause className="w-7 h-7 fill-black" />
                    ) : (
                      <Play className="w-7 h-7 fill-black ml-1" />
                    )}
                  </button>

                  {/* Next */}
                  <button
                    onClick={next}
                    className="p-3 text-neutral-200 hover:text-white hover:bg-white/10 rounded-full transition active:scale-95"
                    title="Next Track (→)"
                  >
                    <SkipForward className="w-6 h-6 fill-current" />
                  </button>

                  {/* Repeat */}
                  <button
                    onClick={toggleRepeat}
                    className={`p-2.5 rounded-full transition ${
                      repeatMode !== "OFF"
                        ? "text-raaga-red bg-raaga-red/15"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title={`Repeat: ${repeatMode}`}
                  >
                    {repeatMode === "ONE" ? (
                      <Repeat1 className="w-5 h-5" />
                    ) : (
                      <Repeat className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Bottom Volume Slider */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 text-neutral-400 hover:text-white transition"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-raaga-red" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:h-1.5 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Synced Lyrics View with Syllable/Word Sweep */}
            {activeTab === "lyrics" && (
              <div className="flex-1 overflow-y-auto no-scrollbar pt-2 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <SyncedLyricsView />
              </div>
            )}

            {/* Tab 3: Live Queue View */}
            {activeTab === "queue" && (
              <div className="flex-1 overflow-y-auto no-scrollbar pt-2 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <QueueDrawer />
              </div>
            )}
          </div>
        </div>

        {/* ================= Narrow Screen / Tablet Layout (<lg) ================= */}
        <div className="flex flex-col lg:hidden items-center justify-center w-full max-w-sm space-y-6">
          {/* Animated Artwork with breathing scale */}
          <div
            className={`relative w-64 h-64 rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/20 transition-all duration-500 ease-[cubic-bezier(0.215,0.61,0.355,1)] transform ${artworkScaleClass}`}
          >
            <img
              src={artworkUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="w-full text-center space-y-1">
            <h2 className="text-xl font-bold text-white truncate">
              {currentSong.title}
            </h2>
            <p className="text-sm text-neutral-400 truncate">
              {currentSong.artist}
            </p>
          </div>

          <div className="w-full space-y-1.5">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={isSeeking ? seekVal : currentTime}
              onChange={handleSeekChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-raaga-red"
            />
            <div className="flex justify-between text-[11px] font-mono text-neutral-400">
              <span>{formatTime(effectiveTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5">
            <button onClick={prev} className="p-2 text-white">
              <SkipBack className="w-6 h-6 fill-current" />
            </button>
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-black" />
              ) : (
                <Play className="w-6 h-6 fill-black ml-0.5" />
              )}
            </button>
            <button onClick={next} className="p-2 text-white">
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
