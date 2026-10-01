"use client";

import { useEffect, useState } from "react";
import { MeshGradientResult } from "@/lib/color/mesh-gradient";
import { extractPaletteFromImage } from "@/lib/color/extract-palette";

interface MeshGradientBackdropProps {
  palette: MeshGradientResult;
  artworkUrl?: string | null;
  isPlaying?: boolean;
}

export default function MeshGradientBackdrop({
  palette,
  artworkUrl,
  isPlaying = true,
}: MeshGradientBackdropProps) {
  const [activePalette, setActivePalette] = useState<MeshGradientResult>(palette);

  // Extract dynamic vibrant colors from album artwork if available
  useEffect(() => {
    let isCancelled = false;
    if (artworkUrl) {
      extractPaletteFromImage(artworkUrl, palette.primaryColor).then((extracted) => {
        if (!isCancelled) {
          setActivePalette(extracted);
        }
      });
    } else {
      setActivePalette(palette);
    }
    return () => {
      isCancelled = true;
    };
  }, [artworkUrl, palette]);

  const colors = activePalette.colors;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none bg-[#0a0a0f]"
      aria-hidden="true"
    >
      {/* 1. Base dark background */}
      <div className="absolute inset-0 bg-[#08080c]" />

      {/* 2. Vibrant Atmospheric Blurred Album Artwork Backdrop */}
      {artworkUrl && (
        <div
          className={`absolute -inset-20 bg-cover bg-center scale-125 blur-[65px] opacity-75 saturate-[1.65] brightness-[0.78] transition-all duration-1000 transform ${
            isPlaying ? "scale-130 animate-pulse-glow" : "scale-120"
          }`}
          style={{
            backgroundImage: `url(${artworkUrl})`,
          }}
        />
      )}

      {/* 3. Four Organic Animated Mesh Gradient Orbs (modeled after Raaga Android MeshGradient.kt) */}
      <div className="absolute inset-0 filter blur-[80px] sm:blur-[110px] opacity-80 transition-opacity duration-1000">
        {/* Orb 1: Anchor (20%, 25%), speed 1.0 */}
        <div
          className={`absolute w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full mix-blend-color-dodge transition-colors duration-1000 ${
            isPlaying ? "animate-mesh-drift-1" : ""
          }`}
          style={{
            top: "5%",
            left: "5%",
            background: `radial-gradient(circle, ${colors[0]}B3 0%, ${colors[0]}00 70%)`,
          }}
        />

        {/* Orb 2: Anchor (80%, 20%), speed -0.7 */}
        <div
          className={`absolute w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full mix-blend-color-dodge transition-colors duration-1000 ${
            isPlaying ? "animate-mesh-drift-2" : ""
          }`}
          style={{
            top: "2%",
            right: "2%",
            background: `radial-gradient(circle, ${colors[1]}A6 0%, ${colors[1]}00 70%)`,
          }}
        />

        {/* Orb 3: Anchor (75%, 80%), speed 0.85 */}
        <div
          className={`absolute w-[58vw] h-[58vw] max-w-[800px] max-h-[800px] rounded-full mix-blend-color-dodge transition-colors duration-1000 ${
            isPlaying ? "animate-mesh-drift-3" : ""
          }`}
          style={{
            bottom: "2%",
            right: "5%",
            background: `radial-gradient(circle, ${colors[2]}A6 0%, ${colors[2]}00 70%)`,
          }}
        />

        {/* Orb 4: Anchor (25%, 75%), speed -1.15 */}
        <div
          className={`absolute w-[52vw] h-[52vw] max-w-[720px] max-h-[720px] rounded-full mix-blend-color-dodge transition-colors duration-1000 ${
            isPlaying ? "animate-mesh-drift-4" : ""
          }`}
          style={{
            bottom: "5%",
            left: "8%",
            background: `radial-gradient(circle, ${colors[3]}99 0%, ${colors[3]}00 70%)`,
          }}
        />
      </div>

      {/* 4. Refined Luminous Glass Scrim (protects contrast while allowing vibrant colors to radiate) */}
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[16px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />
    </div>
  );
}
