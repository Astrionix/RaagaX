"use client";

import { useState } from "react";
import { Play, Pause, Heart, MoreVertical, ListPlus, Radio, Share2 } from "lucide-react";
import { Song } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import { getOptimalArtwork } from "@/lib/utils";

interface SongRowProps {
  song: Song;
  index?: number;
  contextQueue?: Song[];
  showAlbum?: boolean;
  sourceLabel?: string;
}

export default function SongRow({
  song,
  index,
  contextQueue,
  showAlbum = true,
  sourceLabel,
}: SongRowProps) {
  const { playSong, currentSong, isPlaying, addToQueue, playNext, openPlaylistPicker } = usePlayerStore();
  const { isLiked, toggleLike } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const isCurrent = currentSong?.videoId === song.videoId;
  const liked = isLiked(song.videoId);

  const handlePlay = () => {
    playSong(song, contextQueue, sourceLabel);
  };

  return (
    <div
      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 select-none ${
        isCurrent
          ? "liquid-glass-nav-active font-semibold shadow-md"
          : "text-neutral-300 hover:text-white hover:bg-white/[0.05] hover:backdrop-blur-md border border-transparent hover:border-white/[0.07]"
      }`}
    >
      {/* Left: Index / Play Button + Thumbnail + Title/Artist */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer" onClick={handlePlay}>
        {index !== undefined && (
          <div className="w-5 text-center text-xs font-mono text-neutral-500 group-hover:hidden">
            {isCurrent && isPlaying ? (
              <span className="flex items-center justify-center gap-0.5">
                <span className="w-0.5 h-3 bg-raaga-red animate-pulse" />
                <span className="w-0.5 h-4 bg-raaga-red animate-pulse delay-75" />
                <span className="w-0.5 h-2 bg-raaga-red animate-pulse delay-150" />
              </span>
            ) : (
              index + 1
            )}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          className={`w-5 text-center text-neutral-300 hover:text-white ${
            index !== undefined ? "hidden group-hover:block" : ""
          }`}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4 text-raaga-red fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <img
          src={getOptimalArtwork(song.thumbnailUrl, 160)}
          alt={song.title}
          className="w-10 h-10 rounded-lg object-cover bg-neutral-900 shrink-0"
          loading="lazy"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4
              className={`font-semibold text-sm truncate ${
                isCurrent ? "text-raaga-red font-bold" : "text-neutral-100 group-hover:text-white"
              }`}
            >
              {song.title}
            </h4>
            {song.sourceQuality && (
              <span className="shrink-0 text-[8px] font-extrabold uppercase px-1 rounded bg-raaga-red/20 text-raaga-red border border-raaga-red/30">
                {song.sourceQuality === "LOSSLESS" ? "320k" : "HD"}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 group-hover:text-neutral-300 truncate">
            {song.artist}
          </p>
        </div>
      </div>

      {/* Middle: Album Name */}
      {showAlbum && song.albumName && (
        <div className="hidden md:block w-1/3 px-4 truncate text-xs text-neutral-400 group-hover:text-neutral-300">
          {song.albumName}
        </div>
      )}

      {/* Right: Duration + Like + Kebab Menu */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => toggleLike(song)}
          className="p-1.5 text-neutral-400 hover:text-white transition opacity-0 group-hover:opacity-100 focus:opacity-100"
          title={liked ? "Remove from Liked" : "Like Song"}
        >
          <Heart
            className={`w-4 h-4 transition ${
              liked ? "text-raaga-red fill-raaga-red opacity-100" : ""
            }`}
          />
        </button>

        {song.durationText && (
          <span className="text-xs font-mono text-neutral-400 w-10 text-right">
            {song.durationText}
          </span>
        )}

        {/* Kebab Dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-30 w-48 bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-1 text-xs select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  playNext(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Play Next</span>
              </button>

              <button
                onClick={() => {
                  addToQueue(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </button>

              <button
                onClick={() => {
                  openPlaylistPicker(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Add to Playlist</span>
              </button>

              <button
                onClick={() => {
                  toggleLike(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>{liked ? "Unlike" : "Like"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
