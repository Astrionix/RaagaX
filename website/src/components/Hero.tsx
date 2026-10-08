"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Download, ChevronDown, Sparkles, Play, Pause, Disc3, Radio, Monitor } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "@/config/release";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const Hero: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedScreen, setSelectedScreen] = useState<string>("/screenshots/now_playing.png");

  return (
    <section id="overview" className="relative min-h-screen pt-28 pb-20 md:pt-36 md:pb-28 flex flex-col justify-center overflow-hidden">
      {/* Background Liquid Ambient Morphing Lighting Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] ambient-glow-crimson ambient-liquid-orb pointer-events-none opacity-60 blur-3xl -z-10" />
      <div className="absolute top-1/3 left-1/4 w-[450px] h-[450px] ambient-glow-purple ambient-liquid-orb pointer-events-none opacity-45 blur-3xl -z-10" style={{ animationDelay: "-4s" }} />
      <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] ambient-glow-cyan ambient-liquid-orb pointer-events-none opacity-35 blur-3xl -z-10" style={{ animationDelay: "-8s" }} />

      {/* Grid Pattern Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none -z-10" 
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "64px 64px"
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Product Launch Storytelling */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-6 text-left">
            {/* Version & Production Status Pill */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.1] backdrop-blur-md shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  {RAAGAX_CONFIG.versionName} • Android 8.0+
                </span>
                <span className="text-zinc-600">|</span>
                <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
              </div>
            </div>

            {/* Instant Top APK Download Banner */}
            <div className="w-full p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-red-950/70 via-black/70 to-purple-950/70 border border-red-500/30 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div>
                  <span className="text-xs font-bold text-white block">Download Android APK Now</span>
                  <span className="text-[11px] text-zinc-400 font-mono">{RAAGAX_CONFIG.versionName} Signed • {RAAGAX_CONFIG.fileSize} • Android 8.0+</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={RAAGAX_CONFIG.directApkUrl}
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Direct Download</span>
                </a>
                <a
                  href={RAAGAX_CONFIG.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 font-medium text-xs border border-white/10 transition-colors"
                >
                  GitHub Release
                </a>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-none">
                RaagaX
              </h1>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-200">
                Music playback, engineered beyond the surface.
              </p>
            </div>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-xl">
              An independent Android music experience built around immersive playback,
              high-quality audio, synchronized lyrics, offline listening, real-time listening
              sessions, and cross-device control.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
              {/* Primary CTA (Mobile APK) */}
              <a
                href={RAAGAX_CONFIG.apkDownloadUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl text-base font-semibold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_30px_rgba(239,68,68,0.45)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] active:scale-95 transition-all"
              >
                <Download className="w-5 h-5" />
                <span>Download APK ({RAAGAX_CONFIG.versionName})</span>
              </a>

              {/* Desktop Apps CTA */}
              <a
                href="#download"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-zinc-200 hover:text-white glass-panel hover:bg-white/[0.08] border border-white/[0.1] transition-all"
              >
                <Monitor className="w-4 h-4 text-red-400" />
                <span>Desktop (Windows / Mac / Linux)</span>
              </a>

              {/* GitHub CTA */}
              <a
                href={RAAGAX_CONFIG.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-zinc-400 hover:text-white bg-transparent hover:bg-white/[0.04] transition-all"
              >
                <GithubIcon className="w-4 h-4" />
                <span>View on GitHub</span>
              </a>
            </div>

            {/* Third Subtle Action */}
            <a
              href="#engineering"
              className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-red-400 transition-colors pt-1"
            >
              <span>Explore the Engineering Architecture</span>
              <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
            </a>

            {/* Author / Engineering Spec Byline */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-purple-600 border border-white/20 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                CR
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-200">
                  Engineered by {RAAGAX_CONFIG.authorName} ({RAAGAX_CONFIG.authorHandle})
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Kotlin • Jetpack Compose • Media3 • Liquid Glass GPU Shader • Go Jam Hub
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual - Real ADB Device Showcase with Liquid Glass UI */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
            
            {/* Interactive Screen Selector Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl liquid-glass-pill mb-6 max-w-full overflow-x-auto scrollbar-none z-10 border border-white/20">
              {[
                { id: "/screenshots/now_playing.png", label: "Now Playing", badge: "AAC Hi-Fi" },
                { id: "/screenshots/lyrics.png", label: "Synced Lyrics", badge: "Karaoke" },
                { id: "/screenshots/home.png", label: "Listen Now", badge: "Glass Bar" },
                { id: "/screenshots/settings_liquid_glass.png", label: "Liquid Glass", badge: "GPU Haze" },
              ].map((tab) => {
                const isActive = (selectedScreen || "/screenshots/now_playing.png") === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedScreen(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? "bg-red-500/25 text-white border border-red-500/50 shadow-md shadow-red-500/20"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[9px] font-mono opacity-70 px-1.5 py-0.5 rounded bg-white/[0.08]">{tab.badge}</span>
                  </button>
                );
              })}
            </div>

            {/* Glowing Ambient Backdrop Halo */}
            <div className="absolute -inset-4 md:-inset-8 flex items-center justify-center pointer-events-none opacity-50 -z-10">
              <div className="w-[340px] h-[550px] bg-gradient-to-tr from-red-600/30 via-purple-600/20 to-cyan-500/20 rounded-[50px] blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
            </div>

            {/* Physical Android Device Frame with Real Screen Capture */}
            <div className="relative w-full max-w-[320px] sm:max-w-[340px] group">
              
              {/* Outer Phone Shell */}
              <div className="relative rounded-[48px] p-3.5 bg-gradient-to-b from-zinc-800/90 via-zinc-900/95 to-black border border-white/20 shadow-[0_30px_80px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
                <div className="liquid-specular-top" />

                {/* Top Camera Punch Hole & Speaker */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                  <div className="w-12 h-1 rounded-full bg-zinc-700/60" />
                  <div className="w-3.5 h-3.5 rounded-full bg-black ring-1 ring-zinc-700/80 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-950/80" />
                  </div>
                </div>

                {/* Inner Screen Bezel with Real ADB Screenshot */}
                <div className="relative rounded-[36px] overflow-hidden bg-black aspect-[1220/2712] border border-white/10 shadow-inner group">
                  <Image
                    src={selectedScreen || "/screenshots/now_playing.png"}
                    alt="RaagaX Real Android Screen Capture via ADB"
                    width={1220}
                    height={2712}
                    priority
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />

                  {/* Glass Specular Reflection Sheen */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent pointer-events-none" />
                </div>

                {/* Floating Liquid Glass Badge over device */}
                <div className="absolute -bottom-4 left-6 right-6 p-3 rounded-2xl liquid-glass border border-white/25 shadow-2xl flex items-center justify-between backdrop-blur-2xl">
                  <div className="liquid-specular-top" />
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                      <Disc3 className="w-4 h-4 animate-spin" style={{ animationDuration: "5s" }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white tracking-wide">Real Device Capture</p>
                      <p className="text-[9px] text-zinc-400 font-mono">1.5K AMOLED • 1220×2712</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>ADB LIVE</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
