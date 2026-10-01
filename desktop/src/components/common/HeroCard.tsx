"use client";

import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { ShelfItem } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import { getOptimalArtwork } from "@/lib/utils";

interface HeroCardProps {
  item: ShelfItem;
}

export default function HeroCard({ item }: HeroCardProps) {
  const { playSong } = usePlayerStore();

  const handlePlay = () => {
    if (item.videoId) {
      playSong({
        videoId: item.videoId,
        title: item.title,
        artist: item.subtitle,
        thumbnailUrl: item.thumbnailUrl,
        playbackSource: "Spotlight Track",
      });
    }
  };

  return (
    <div className="relative overflow-hidden liquid-glass-card p-5 sm:p-6 rounded-[22px] border border-white/[0.1] hover:border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.6)] group select-none transition-all duration-300">
      {/* Specular Glare Sheen Reflection */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 relative z-10">
        {/* Artwork */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-[18px] overflow-hidden bg-neutral-900 shadow-xl shrink-0 border border-white/10 group-hover:border-white/20 transition-all">
          <img
            src={getOptimalArtwork(item.thumbnailUrl, 360)}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/[0.08] pointer-events-none rounded-[inherit]" />
        </div>

        {/* Content Info & Play Button */}
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-raaga-red/20 text-raaga-red border border-raaga-red/35 shadow-[0_0_12px_rgba(250,45,72,0.25)] flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Spotlight</span>
            </span>
            <span className="text-xs text-neutral-400">• YouTube Music</span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight truncate">
            {item.title}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 truncate font-medium">
            {item.subtitle}
          </p>

          <div className="pt-2 flex items-center gap-3">
            {item.videoId && (
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-raaga-red hover:bg-raaga-redDark text-white font-semibold text-xs shadow-[0_4px_16px_rgba(250,45,72,0.45)] transition-all hover:scale-[1.02] active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                <span>Play Now</span>
              </button>
            )}

            <Link
              href="/explore?tab=trending"
              className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 hover:text-white font-medium text-xs border border-white/[0.08] hover:border-white/20 transition-all"
            >
              Explore Charts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
