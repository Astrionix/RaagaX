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
import { getOptimalArtwork } from "@/lib/utils";

interface MusicCardProps {
  item: ShelfItem;
  contextQueue?: Song[];
  shelfTitle?: string;
  aspect?: "square" | "video";
}

export default function MusicCard({
  item,
  contextQueue,
  shelfTitle,
  aspect = "square",
}: MusicCardProps) {
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
  const isVideo = aspect === "video" || Boolean(item.videoId && item.subtitle?.toLowerCase().includes("video"));
  const liked = item.videoId ? isLiked(item.videoId) : false;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

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
        isVideo,
      };
      playSong(song, contextQueue, shelfTitle);
    }
  };

  const getHref = () => {
    if (!item.browseId) return "#";
    if (item.type === "ARTIST" || item.browseId.startsWith("UC")) {
      return `/artist/${item.browseId}`;
    }
    if (item.type === "ALBUM" || item.browseId.startsWith("MPRE")) {
      return `/album/${item.browseId}`;
    }
    return `/playlist/${item.browseId}`;
  };

  const toSong = (): Song => ({
    videoId: item.videoId || "",
    title: item.title,
    artist: item.subtitle,
    thumbnailUrl: item.thumbnailUrl,
    playbackSource: shelfTitle,
  });

  const cardInner = (
    <div className="group relative flex flex-col p-3 rounded-2xl bg-[#18181D] hover:bg-[#202026] border border-white/[0.06] hover:border-white/15 transition-all duration-200 select-none cursor-pointer">
      {/* Artwork container */}
      <div
        className={`relative w-full ${
          isVideo ? "aspect-video" : "aspect-square"
        } rounded-xl overflow-hidden bg-neutral-900 shadow-md shrink-0`}
      >
        <img
          src={getOptimalArtwork(item.thumbnailUrl, 480)}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />

        {/* Hover circular play button */}
        <button
          onClick={handlePlay}
          className={`absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-raaga-red text-white flex items-center justify-center shadow-[0_4px_16px_rgba(250,45,72,0.5)] transition-all duration-200 ${
            isCurrent
              ? "opacity-100 scale-100"
              : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95"
          }`}
          title={isCurrent && isPlaying ? "Pause" : "Play"}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-5 h-5 fill-white" />
          ) : (
            <Play className="w-5 h-5 fill-white ml-0.5" />
          )}
        </button>

        {/* Playing Badge */}
        {isCurrent && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-raaga-red text-white text-[10px] font-bold uppercase tracking-wider shadow">
            Playing
          </div>
        )}
      </div>

      {/* Info: Fixed height with ellipsis */}
      <div className="mt-3 flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <h4
            className={`text-sm font-semibold truncate ${
              isCurrent ? "text-raaga-red font-bold" : "text-neutral-100 group-hover:text-white"
            }`}
            title={item.title}
          >
            {item.title}
          </h4>
          <p className="text-xs text-neutral-400 group-hover:text-neutral-300 truncate mt-0.5" title={item.subtitle}>
            {item.subtitle || "YouTube"}
          </p>
        </div>

        {/* Kebab Context Menu */}
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
                className="absolute right-0 bottom-full mb-2 z-40 w-44 bg-[#1C1C22] border border-white/10 rounded-xl shadow-2xl p-1 space-y-0.5 text-xs select-none backdrop-blur-xl"
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

  if (item.browseId) {
    return <Link href={getHref()}>{cardInner}</Link>;
  }

  return <div onClick={handlePlay}>{cardInner}</div>;
}
