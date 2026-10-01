"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { ShelfItem } from "@/types/music";
import { getOptimalArtwork } from "@/lib/utils";

interface ArtistCardProps {
  item: ShelfItem;
}

export default function ArtistCard({ item }: ArtistCardProps) {
  const href = item.browseId ? `/artist/${item.browseId}` : "#";

  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center text-center p-3.5 rounded-[18px] liquid-glass-card border border-white/[0.08] hover:border-white/20 transition-all duration-300 select-none overflow-hidden"
    >
      {/* Specular glare sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

      {/* Circular Artwork Container */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-neutral-900 shadow-md border border-white/10 group-hover:border-white/20 transition-all">
        <img
          src={getOptimalArtwork(item.thumbnailUrl, 360)}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Hover play button */}
        <div className="absolute right-2 bottom-2 w-10 h-10 rounded-full bg-raaga-red text-white flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
          <Play className="w-4 h-4 fill-white ml-0.5" />
        </div>
      </div>

      {/* Artist Name & Subtitle */}
      <div className="mt-3 w-full px-1">
        <h4 className="text-sm font-semibold text-neutral-100 group-hover:text-white truncate" title={item.title}>
          {item.title}
        </h4>
        <p className="text-xs text-neutral-400 group-hover:text-neutral-300 truncate mt-0.5">
          {item.subtitle || "Artist"}
        </p>
      </div>
    </Link>
  );
}
