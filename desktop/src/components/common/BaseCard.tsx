"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  MoreVertical,
  ListPlus,
  Heart,
  Share2,
  ExternalLink,
} from "lucide-react";
import { ShelfItem, Song } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import ArtworkCard, { ArtworkVariant } from "./ArtworkCard";

interface BaseCardProps {
  item: ShelfItem;
  variant?: ArtworkVariant;
  badge?: string;
  durationText?: string;
  contextQueue?: Song[];
  shelfTitle?: string;
  href?: string;
  onClick?: () => void;
  subtitlePrefix?: string;
}

export default function BaseCard({
  item,
  variant = "square",
  badge,
  durationText,
  contextQueue,
  shelfTitle,
  href,
  onClick,
  subtitlePrefix,
}: BaseCardProps) {
  const {
    playSong,
    currentSong,
    isPlaying,
    togglePlay,
    addToQueue,
    playNext,
    openPlaylistPicker,
  } = usePlayerStore();
  const { isLiked, toggleLike } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const isCurrent = Boolean(item.videoId && currentSong?.videoId === item.videoId);
  const liked = item.videoId ? isLiked(item.videoId) : false;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (onClick) {
      onClick();
      return;
    }

    if (item.videoId) {
      if (isCurrent) {
        togglePlay();
        return;
      }
      const song: Song = {
        videoId: item.videoId,
        title: item.title,
        artist: item.subtitle,
        thumbnailUrl: item.thumbnailUrl,
        playbackSource: shelfTitle,
        isVideo: variant === "landscape" || item.subtitle?.toLowerCase().includes("video"),
      };
      playSong(song, contextQueue, shelfTitle);
    }
  };

  const toSong = (): Song => ({
    videoId: item.videoId || "",
    title: item.title,
    artist: item.subtitle,
    thumbnailUrl: item.thumbnailUrl,
    playbackSource: shelfTitle,
  });

  const cardBody = (
    <div className="group relative flex flex-col p-3 rounded-[18px] liquid-glass-card border border-white/[0.08] hover:border-white/20 transition-all duration-300 select-none cursor-pointer">
      {/* Specular glare sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

      {/* Artwork Container */}
      <ArtworkCard
        url={item.thumbnailUrl}
        alt={item.title}
        variant={variant}
      >
        {/* Hover circular play button */}
        <button
          onClick={handlePlay}
          className={`absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-raaga-red text-white flex items-center justify-center shadow-[0_4px_16px_rgba(250,45,72,0.5)] transition-all duration-200 ${
            isCurrent
              ? "opacity-100 scale-100"
              : "opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95"
          }`}
          title={isCurrent && isPlaying ? "Pause" : "Play"}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-4.5 h-4.5 fill-white" />
          ) : (
            <Play className="w-4.5 h-4.5 fill-white ml-0.5" />
          )}
        </button>

        {/* Badge / Type tag */}
        {badge && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow">
            {badge}
          </div>
        )}

        {/* Duration badge (especially for videos) */}
        {durationText && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-semibold text-white pointer-events-none group-hover:opacity-0 transition">
            {durationText}
          </div>
        )}

        {/* Active playing indicator */}
        {isCurrent && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-raaga-red text-white text-[10px] font-bold uppercase tracking-wider shadow">
            Playing
          </div>
        )}
      </ArtworkCard>

      {/* Title & Metadata */}
      <div className="mt-3 flex items-start justify-between gap-1 relative z-10">
        <div className="min-w-0 flex-1">
          <h4
            className={`text-sm font-semibold truncate ${
              isCurrent ? "text-raaga-red font-bold" : "text-neutral-100 group-hover:text-white"
            }`}
            title={item.title}
          >
            {item.title}
          </h4>
          <p
            className="text-xs text-neutral-400 group-hover:text-neutral-300 truncate mt-0.5"
            title={item.subtitle}
          >
            {subtitlePrefix ? `${subtitlePrefix} • ` : ""}
            {item.subtitle || "YouTube"}
          </p>
        </div>

        {/* Context Menu ⋮ */}
        {item.videoId && (
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 text-neutral-400 hover:text-white rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 bottom-full mb-2 z-40 w-44 liquid-glass-sidebar border border-white/15 rounded-xl shadow-2xl p-1.5 space-y-0.5 text-xs select-none backdrop-blur-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    handlePlay({ stopPropagation: () => {}, preventDefault: () => {} } as any);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play</span>
                </button>

                <button
                  onClick={() => {
                    playNext(toSong());
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Play Next</span>
                </button>

                <button
                  onClick={() => {
                    addToQueue(toSong());
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Add to Queue</span>
                </button>

                <button
                  onClick={() => {
                    openPlaylistPicker(toSong());
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Add to Playlist</span>
                </button>

                <button
                  onClick={() => {
                    toggleLike(toSong());
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <Heart className={`w-3.5 h-3.5 ${liked ? "text-raaga-red fill-raaga-red" : ""}`} />
                  <span>{liked ? "Unlike" : "Like"}</span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${item.videoId}`);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>

                <a
                  href={`https://www.youtube.com/watch?v=${item.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition text-left"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open on YouTube</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{cardBody}</Link>;
  }

  return <div onClick={handlePlay}>{cardBody}</div>;
}
