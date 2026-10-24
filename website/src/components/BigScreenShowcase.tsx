"use client";

import React, { useState } from "react";
import Image from "next/image";
import { 
  Monitor, 
  Laptop, 
  Tv, 
  Download, 
  Cast, 
  Sliders, 
  Radio, 
  Layers, 
  CheckCircle2, 
  Cpu, 
  Volume2, 
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";
import { AllApksModal } from "./AllApksModal";

interface DesktopScreenTab {
  id: "main" | "lyrics" | "player";
  label: string;
  badge: string;
  sub: string;
  image: string;
  description: string;
}

const DESKTOP_SCREENS: DesktopScreenTab[] = [
  {
    id: "main",
    label: "Main App & Library",
    badge: "Compose Multiplatform",
    sub: "Recents, Explore & Sidebars",
    image: "/images/desktop/desktop_main.png",
    description: "Full desktop dashboard featuring unified search, offline library, recent plays, album carousels, and persistent playback controls.",
  },
  {
    id: "lyrics",
    label: "Live Synced Lyrics",
    badge: "Apple Music Style",
    sub: "Character-by-Character Glow",
    image: "/images/desktop/desktop_lyrics.png",
    description: "Immersive big-screen lyrics experience with character-level synced karaoke typography powered by lrc.red and dynamic ambient backdrop blur.",
  },
  {
    id: "player",
    label: "Audiophile Now Playing",
    badge: "Studio Master FLAC",
    sub: "24-bit 44.1 kHz • 2116 kbps",
    image: "/images/desktop/desktop_player.png",
    description: "Expanded player view showcasing high-resolution album artwork, audio format metadata, precise timeline scrubbing, and audio routing.",
  },
];

export const BigScreenShowcase: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAllApks, setShowAllApks] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % DESKTOP_SCREENS.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + DESKTOP_SCREENS.length) % DESKTOP_SCREENS.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 45) nextSlide();
    else if (diff < -45) prevSlide();
    setTouchStart(null);
  };

  const currentScreen = DESKTOP_SCREENS[currentIndex] || DESKTOP_SCREENS[0];

  return (
    <>
      <AllApksModal isOpen={showAllApks} onClose={() => setShowAllApks(false)} />

      <section id="desktop" className="page-container mt-20 sm:mt-28" aria-labelledby="desktop-heading">
        {/* Outer Dark Obsidian Shell with Hairline Inset Border */}
        <div className="relative isolate overflow-hidden rounded-[32px] sm:rounded-[40px] bg-[#070605] p-5 sm:p-10 md:p-14 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
          
          {/* Dynamic Mesh Blob matching 'On The Floor' artwork tone */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div
              className="absolute rounded-full"
              style={{
                width: "900px",
                height: "600px",
                left: "20%",
                top: "10%",
                background: "radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, rgba(239, 68, 68, 0.08) 40%, transparent 70%)",
                filter: "blur(100px)",
              }}
            />
          </div>

          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="liquid-glass-pill inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-white/90 mb-3">
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
              <span>Compose Multiplatform Desktop &amp; Living Room</span>
            </div>
            <h2 id="desktop-heading" className="text-[26px] sm:text-[38px] md:text-[44px] font-extrabold text-white tracking-tight leading-[1.1]">
              Now on the big screen &amp; desktop.
            </h2>
            <p className="mt-3 text-[14px] sm:text-[16px] leading-relaxed text-white/60 text-balance">
              Experience Raaga natively on Windows, macOS, and Linux. Built with Skia hardware acceleration, bit-perfect DAC audio passthrough, and synchronized lyrics on ultra-wide displays.
            </p>
          </div>

          {/* Premium Desktop Monitor Frame with Smooth Slide Transformation & Side Prev/Next */}
          <div className="mt-8 sm:mt-12 max-w-5xl mx-auto relative group">
            
            {/* Side Prev Navigation Button */}
            <button
              onClick={prevSlide}
              aria-label="Previous desktop screen"
              className="liquid-glass-pill absolute -left-3 sm:-left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Side Next Navigation Button */}
            <button
              onClick={nextSlide}
              aria-label="Next desktop screen"
              className="liquid-glass-pill absolute -right-3 sm:-right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="relative rounded-2xl sm:rounded-3xl bg-[#131316] p-2 sm:p-3 border border-white/15 shadow-[0_30px_100px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.12)] select-none"
            >
              
              {/* Window Chrome Titlebar */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-xl rounded-t-xl sm:rounded-t-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                {/* Traffic Lights */}
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm" />
                </div>

                {/* Center Title Pill */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-[12px] font-medium text-white/90">
                    Raaga Desktop — {currentScreen.label}
                  </span>
                  <span className="hidden sm:inline text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-500/30">
                    {RAAGAX_CONFIG.versionName}
                  </span>
                </div>

                {/* Right Status Indicator & Slide Dots */}
                <div className="flex items-center gap-3 text-[11px] font-mono text-white/50">
                  <span className="hidden md:inline px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70">
                    {currentScreen.sub}
                  </span>
                  {/* Minimal Slide Indicator Dots */}
                  <div className="flex items-center gap-1.5">
                    {DESKTOP_SCREENS.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        aria-label={`Jump to slide ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentIndex === idx ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/30 hover:bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Display Viewport with Smooth Sliding Transformation (Zero cropping, 100% complete view) */}
              <div className="relative w-full rounded-b-xl sm:rounded-b-2xl overflow-hidden bg-[#0c0c0e]">
                <div 
                  className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                  {DESKTOP_SCREENS.map((screen, idx) => (
                    <div key={screen.id} className="min-w-full w-full shrink-0">
                      <Image
                        src={screen.image}
                        alt={`Raaga Desktop - ${screen.label}`}
                        width={1672}
                        height={941}
                        priority={idx === 0}
                        className="w-full h-auto block select-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Description of Currently Selected View */}
            <p className="mt-4 text-center text-xs sm:text-sm text-white/50 max-w-2xl mx-auto min-h-[36px] transition-all">
              {currentScreen.description}
            </p>
          </div>

          {/* Desktop Engineering Highlights Bento */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="liquid-glass-card p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3.5 shadow-[inset_0_1px_1px_0_rgba(6,182,212,0.3)]">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Direct Skia 2D Rendering</h4>
              <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
                Rendered with Compose Multiplatform on top of Skia, DirectX 12, Metal, and Vulkan. Silky 120Hz smooth scrolling without Electron memory bloat.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="liquid-glass-card p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3.5 shadow-[inset_0_1px_1px_0_rgba(168,85,247,0.3)]">
                <Volume2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Bit-Perfect Audio Passthrough</h4>
              <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
                Exclusive hardware access via WASAPI Exclusive on Windows, CoreAudio integer stream on macOS, and bit-perfect PipeWire/ALSA on Linux.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="liquid-glass-card p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5 shadow-[inset_0_1px_1px_0_rgba(16,185,129,0.3)]">
                <Tv className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Full-Screen Living Room Mode</h4>
              <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
                Launch full-screen synchronized lyrics or cast directly to your Google Cast TV, Chromecast Audio, or Nest Hub directly from your laptop.
              </p>
            </div>
          </div>

          {/* Desktop Direct Download Buttons Matrix */}
          <div className="mt-12 pt-8 border-t border-white/[0.08] max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-cyan-400" />
                  <span>Download Raaga for your computer</span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Universal installer packages with silent background OTA update verification.
                </p>
              </div>

              <button
                onClick={() => setShowAllApks(true)}
                className="liquid-glass-pill px-4 py-2 rounded-full text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-red-400" />
                <span>All Desktop &amp; Mobile Builds</span>
              </button>
            </div>

            {/* Quick Download Buttons */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Windows */}
              <a
                href={RAAGAX_CONFIG.desktop.windows.setupExe}
                download
                className="liquid-glass-card group p-4 rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">Windows 10 / 11</p>
                    <p className="text-[10px] font-mono text-white/50">Setup .exe • {RAAGAX_CONFIG.desktop.windows.size}</p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" />
              </a>

              {/* macOS */}
              <a
                href={RAAGAX_CONFIG.desktop.macOS.arm64Dmg}
                download
                className="liquid-glass-card group p-4 rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-pink-400 transition-colors">macOS Apple Silicon</p>
                    <p className="text-[10px] font-mono text-white/50">Universal DMG • {RAAGAX_CONFIG.desktop.macOS.size}</p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" />
              </a>

              {/* Linux */}
              <a
                href={RAAGAX_CONFIG.desktop.linux.appImage}
                download
                className="liquid-glass-card group p-4 rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Linux AppImage</p>
                    <p className="text-[10px] font-mono text-white/50">Standalone • {RAAGAX_CONFIG.desktop.linux.size}</p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" />
              </a>
            </div>
          </div>

        </div>
      </section>
    </>
  );
};
