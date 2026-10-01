"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  Mic2,
  Volume2,
  VolumeX,
  Maximize2,
  Cast,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import { formatTime, getOptimalArtwork } from "@/lib/utils";
import { getMeshGradient } from "@/lib/color/mesh-gradient";

export default function BottomPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    next,
    prev,
    toggleShuffle,
    toggleRepeat,
    setNowPlayingOpen,
    isLyricsOpen,
    setLyricsOpen,
    isQueueOpen,
    setQueueOpen,
    setConnectModalOpen,
    canvasUrl,
  } = usePlayerStore();

  const { isLiked, toggleLike } = useAuthStore();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);
  const [volumeHovered, setVolumeHovered] = useState(false);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.videoId);
  const effectiveTime = isSeeking ? seekVal : currentTime;
  const progressPercent =
    duration > 0 ? (effectiveTime / duration) * 100 : 0;

  const gradient = getMeshGradient(`${currentSong.title}-${currentSong.artist}`);

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = newProgress * duration;
    seek(targetTime);
  };

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(920px,calc(100%-48px))] max-w-[calc(100%-24px)] select-none pointer-events-auto">
      {/* 1. Album-art-derived Ambient Glow Halo behind the pill */}
      <div
        className="absolute -inset-1.5 rounded-full opacity-40 blur-2xl pointer-events-none transition-all duration-700 -z-10"
        style={{
          background: `radial-gradient(ellipse at center, ${gradient.primaryColor}80 0%, ${gradient.secondaryColor}40 50%, transparent 80%)`,
        }}
      />

      {/* 2. Main Floating Liquid Glass Pill Container */}
      <div className="relative h-[68px] liquid-glass-pill px-4 flex items-center justify-between gap-3 overflow-hidden group/player">
        {/* Specular Glare Reflection Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.08] via-transparent to-transparent pointer-events-none rounded-full" />

        {/* ================= Left: [ART] Track Info + Like ================= */}
        <div className="flex items-center gap-3 min-w-0 w-[220px] lg:w-[260px] shrink-0 relative z-10">
          <button
            onClick={() => setNowPlayingOpen(true)}
            className="relative w-11 h-11 rounded-full overflow-hidden bg-neutral-900 shrink-0 group/art shadow-md ring-1 ring-white/10"
            title="Expand Fullscreen Player"
          >
            <img
              src={getOptimalArtwork(currentSong.thumbnailUrl, 160)}
              alt={currentSong.title}
              className="w-full h-full object-cover group-hover/art:scale-110 transition duration-300"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 flex items-center justify-center transition">
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </div>
          </button>

          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={() => setNowPlayingOpen(true)}
          >
            <h4
              className="text-xs font-semibold text-white truncate hover:underline leading-tight"
              title={currentSong.title}
            >
              {currentSong.title}
            </h4>
            <p
              className="text-[11px] text-neutral-400 truncate mt-0.5 leading-tight"
              title={currentSong.artist}
            >
              {currentSong.artist}
            </p>
          </div>

          <button
            onClick={() => toggleLike(currentSong)}
            className="p-1.5 text-neutral-400 hover:text-white transition shrink-0"
            title={liked ? "Remove from Liked" : "Save to Liked"}
          >
            <Heart
              className={`w-4 h-4 transition ${
                liked ? "text-raaga-red fill-raaga-red scale-110" : "text-neutral-400"
              }`}
            />
          </button>
        </div>

        {/* ================= Center: Playback Controls (🔀 ↶ ▶ ↷ 🔁) ================= */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 sm:gap-3.5 justify-center z-10">
          {/* Shuffle (🔀) */}
          <button
            onClick={toggleShuffle}
            className={`p-1.5 rounded-full transition ${
              isShuffled ? "text-raaga-red bg-raaga-red/15" : "text-neutral-400 hover:text-white"
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          {/* Previous (←) */}
          <button
            onClick={prev}
            className="p-1.5 text-neutral-300 hover:text-white transition active:scale-95"
            title="Previous (←)"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Main Play / Pause (Space) */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white hover:bg-neutral-100 text-black flex items-center justify-center shadow-lg transition hover:scale-105 active:scale-95 shrink-0"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black" />
            ) : (
              <Play className="w-4 h-4 fill-black ml-0.5" />
            )}
          </button>

          {/* Next (→) */}
          <button
            onClick={next}
            className="p-1.5 text-neutral-300 hover:text-white transition active:scale-95"
            title="Next (→)"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Repeat (🔁) */}
          <button
            onClick={toggleRepeat}
            className={`p-1.5 rounded-full transition ${
              repeatMode !== "OFF" ? "text-raaga-red bg-raaga-red/15" : "text-neutral-400 hover:text-white"
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === "ONE" ? (
              <Repeat1 className="w-3.5 h-3.5" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* ================= Right: Secondary Tools & Volume & Expand ================= */}
        <div className="flex items-center gap-1 sm:gap-2 justify-end w-[220px] lg:w-[260px] shrink-0 relative z-10">
          {/* Lyrics (♪) */}
          <button
            onClick={() => setLyricsOpen(!isLyricsOpen)}
            className={`p-1.5 rounded-full transition ${
              isLyricsOpen ? "text-raaga-red bg-raaga-red/15" : "text-neutral-400 hover:text-white"
            }`}
            title="Lyrics"
          >
            <Mic2 className="w-3.5 h-3.5" />
          </button>

          {/* Queue (☷) */}
          <button
            onClick={() => setQueueOpen(!isQueueOpen)}
            className={`p-1.5 rounded-full transition ${
              isQueueOpen ? "text-raaga-cyan bg-raaga-cyan/15" : "text-neutral-400 hover:text-white"
            }`}
            title="Queue"
          >
            <ListMusic className="w-3.5 h-3.5" />
          </button>

          {/* Connect (◉) */}
          <button
            onClick={() => setConnectModalOpen(true)}
            className="p-1.5 text-neutral-400 hover:text-raaga-cyan rounded-full transition"
            title="Raaga Connect"
          >
            <Cast className="w-3.5 h-3.5" />
          </button>

          {/* Volume (🔊 ━━━) */}
          <div
            className="flex items-center gap-1.5"
            onMouseEnter={() => setVolumeHovered(true)}
            onMouseLeave={() => setVolumeHovered(false)}
          >
            <button
              onClick={toggleMute}
              className="p-1 text-neutral-400 hover:text-white transition shrink-0"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-raaga-red" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="w-14 sm:w-18 hidden md:flex items-center">
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

          {/* Mini Progress / Time Display */}
          <span className="hidden 2xl:inline-block text-[10px] font-mono text-neutral-400 shrink-0 px-0.5">
            {formatTime(effectiveTime)} / {formatTime(duration)}
          </span>

          {/* Expand Fullscreen Button (↗) */}
          <button
            onClick={() => setNowPlayingOpen(true)}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition ml-0.5"
            title="Expand Player Overlay"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ================= 3. Progress Bar Integrated into the Bottom Edge of the Pill ================= */}
        <div
          onClick={handleSeekClick}
          className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.08] hover:h-2 cursor-pointer transition-all duration-200 z-20 group/bar"
          title="Click to seek"
        >
          {/* Active Played Fill with ambient glow */}
          <div
            className="h-full bg-gradient-to-r from-raaga-pink to-raaga-red relative transition-[width] duration-150"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Scrubber thumb on hover */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </div>
  );
}
