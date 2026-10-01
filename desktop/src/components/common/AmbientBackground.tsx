"use client";

import { usePlayerStore } from "@/stores/player-store";
import { getMeshGradient } from "@/lib/color/mesh-gradient";
import { getOptimalArtwork } from "@/lib/utils";

export default function AmbientBackground() {
  const currentSong = usePlayerStore((state) => state.currentSong);

  const seed = currentSong
    ? `${currentSong.title}-${currentSong.artist}`
    : "raaga-liquid-glass";

  const palette = getMeshGradient(seed);
  const artworkUrl = currentSong?.thumbnailUrl
    ? getOptimalArtwork(currentSong.thumbnailUrl, 360)
    : null;

  return (
    <div
      className="fixed inset-0 pointer-events-none -z-20 overflow-hidden bg-[#070709] select-none transition-colors duration-1000"
      aria-hidden="true"
    >
      {/* 1. Underlying Dark Canvas */}
      <div className="absolute inset-0 bg-[#070709]" />

      {/* 2. Dynamic Blurred Artwork Ambient Orb */}
      {artworkUrl && (
        <div
          className="absolute -top-[15%] -left-[10%] w-[65vw] h-[65vw] max-w-[900px] max-h-[900px] rounded-full opacity-20 blur-[120px] transition-all duration-1000 transform -scale-x-100 mix-blend-screen animate-mesh-drift-1"
          style={{
            backgroundImage: `url(${artworkUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* 3. 4 Dynamic Harmonic Mesh Glow Points with organic drift */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full opacity-25 blur-[130px] transition-all duration-1000 animate-mesh-drift-1"
        style={{
          background: `radial-gradient(circle, ${palette.colors[0]} 0%, transparent 70%)`,
        }}
      />

      <div
        className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full opacity-20 blur-[130px] transition-all duration-1000 animate-mesh-drift-2"
        style={{
          background: `radial-gradient(circle, ${palette.colors[1]} 0%, transparent 70%)`,
        }}
      />

      <div
        className="absolute bottom-[-15%] left-[20%] w-[55vw] h-[45vw] max-w-[800px] max-h-[600px] rounded-full opacity-20 blur-[140px] transition-all duration-1000 animate-mesh-drift-3"
        style={{
          background: `radial-gradient(circle, ${palette.colors[2]} 0%, transparent 70%)`,
        }}
      />

      <div
        className="absolute bottom-0 right-[15%] w-[45vw] h-[45vw] max-w-[650px] max-h-[650px] rounded-full opacity-18 blur-[120px] transition-all duration-1000 animate-mesh-drift-4"
        style={{
          background: `radial-gradient(circle, ${palette.colors[3]} 0%, transparent 70%)`,
        }}
      />

      {/* 4. Fine Noise / Vignette / Soft Sheen to prevent banding */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,7,0.6)_100%)] pointer-events-none" />
    </div>
  );
}
