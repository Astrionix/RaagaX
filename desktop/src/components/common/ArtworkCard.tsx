"use client";

import { useState } from "react";
import { getOptimalArtwork } from "@/lib/utils";
import { Music2 } from "lucide-react";

export type ArtworkVariant =
  | "compact"   // 64x64
  | "standard"  // 160x160 / 180x180
  | "large"     // 300x300
  | "hero"      // 320x348
  | "player"    // min(42vw, 520px)
  | "square"    // 1:1 aspect
  | "landscape" // 16:9 video aspect
  | "poster"    // 2:3 vertical poster
  | "circle";   // 50% border radius artist

interface ArtworkCardProps {
  url?: string;
  alt: string;
  variant?: ArtworkVariant;
  className?: string;
  children?: React.ReactNode;
  fallbackIcon?: React.ReactNode;
}

export default function ArtworkCard({
  url,
  alt,
  variant = "square",
  className = "",
  children,
  fallbackIcon,
}: ArtworkCardProps) {
  const [hasError, setHasError] = useState(false);

  // Variant styling map
  const variantStyles: Record<ArtworkVariant, string> = {
    compact: "w-14 h-14 sm:w-16 sm:h-16 rounded-xl aspect-square",
    standard: "w-full aspect-square rounded-xl",
    large: "w-full max-w-[300px] aspect-square rounded-2xl",
    hero: "w-full max-w-[340px] aspect-[4/5] rounded-2xl",
    player: "w-full max-w-[min(42vw,480px)] aspect-square rounded-2xl shadow-2xl",
    square: "w-full aspect-square rounded-xl",
    landscape: "w-full aspect-video rounded-xl",
    poster: "w-full aspect-[2/3] rounded-xl",
    circle: "w-full aspect-square rounded-full",
  };

  const imageSizeMap: Record<ArtworkVariant, number> = {
    compact: 160,
    standard: 360,
    large: 640,
    hero: 720,
    player: 800,
    square: 480,
    landscape: 640,
    poster: 640,
    circle: 360,
  };

  const sizePx = imageSizeMap[variant] || 480;
  const optimizedUrl = url ? getOptimalArtwork(url, sizePx) : "";

  return (
    <div
      className={`relative overflow-hidden bg-[#16161C] shrink-0 select-none ${variantStyles[variant]} ${className}`}
    >
      {optimizedUrl && !hasError ? (
        <img
          src={optimizedUrl}
          alt={alt}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/5 text-neutral-500">
          {fallbackIcon || <Music2 className="w-8 h-8 opacity-40" />}
        </div>
      )}

      {/* Subtle specular sheen overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/[0.06] pointer-events-none rounded-[inherit]" />

      {/* Embedded children (hover overlays, badges, play button) */}
      {children}
    </div>
  );
}
