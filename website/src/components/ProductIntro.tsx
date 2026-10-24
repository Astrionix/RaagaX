"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ArrowRight, Compass, Search, Disc, PlayCircle, AlignLeft, Library, Users } from "lucide-react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const ProductIntro: React.FC = () => {
  const [activeStep, setActiveStep] = useState(3); // Default on "Now Playing"

  const flowSteps = [
    {
      id: 0,
      label: "Home / Listen Now",
      desc: "Curated playlists, recent drops, dynamic mood carousels & floating liquid glass nav bar",
      icon: Compass,
      status: "IMPLEMENTED" as const,
      details: "Jetpack Compose lazy grids with hardware-accelerated image caching using Coil3 and material surface shaders.",
      primaryScreen: "/images/mobile/mobile_home.png",
      primaryLabel: "01 • Listen Now Feed",
      secondaryScreen: "/images/mobile/mobile_explore_new.png",
      secondaryLabel: "02 • Curated Drops",
    },
    {
      id: 1,
      label: "Unified Search",
      desc: "Fast catalog querying across songs, videos, albums, and artists with cached history",
      icon: Search,
      status: "IMPLEMENTED" as const,
      details: "Debounced multi-source query pipeline with instant phonetic and fuzzy matching across YouTube Music.",
      primaryScreen: "/images/mobile/mobile_search_results.png",
      primaryLabel: "01 • Search Query Engine",
      secondaryScreen: "/images/mobile/mobile_now_playing.png",
      secondaryLabel: "02 • Direct Playback",
    },
    {
      id: 2,
      label: "Now Playing (Lossless FLAC)",
      desc: "Electric aura, custom glass controls & 24-bit FLAC badge",
      icon: PlayCircle,
      status: "IMPLEMENTED" as const,
      details: "FLAC 24-bit 44.1 kHz (2116 kbps) Bit-Perfect playback with live CMF Buds 2 audio device routing.",
      primaryScreen: "/images/mobile/mobile_now_playing.png",
      primaryLabel: "01 • Now Playing (2116 kbps)",
      secondaryScreen: "/images/mobile/mobile_lyrics.png",
      secondaryLabel: "02 • Synchronized Lyrics",
    },
    {
      id: 3,
      label: "Synchronized Lyrics",
      desc: "Apple Music style word-by-word karaoke typography with dynamic background blur",
      icon: AlignLeft,
      status: "IMPLEMENTED" as const,
      details: "High-precision word-level timing parser with real-time character highlighting.",
      primaryScreen: "/images/mobile/mobile_lyrics.png",
      primaryLabel: "01 • Real-time Karaoke",
      secondaryScreen: "/images/mobile/mobile_now_playing.png",
      secondaryLabel: "02 • Aura Player",
    },
    {
      id: 4,
      label: "Offline Library",
      desc: "Local SQLite database, downloaded FLACs & listening statistics (1,355+ mins)",
      icon: Library,
      status: "IMPLEMENTED" as const,
      details: "Encrypted Room SQLite store with automatic ID3 tagging, listening history statistics, and WebDAV sync.",
      primaryScreen: "/images/mobile/mobile_library.png",
      primaryLabel: "01 • Downloaded FLACs",
      secondaryScreen: "/images/mobile/mobile_home.png",
      secondaryLabel: "02 • Quick Resume",
    },
    {
      id: 5,
      label: "Lossless DSP & Shaders",
      desc: "Per-network quality governors and real AGSL optical refraction at 120 FPS",
      icon: Disc,
      status: "IMPLEMENTED" as const,
      details: "AGSL shader pipeline on Android 13+ simulating real glass refraction over album art at 120 FPS.",
      primaryScreen: "/images/mobile/mobile_settings_liquid_glass.png",
      primaryLabel: "01 • Liquid Glass AGSL",
      secondaryScreen: "/images/mobile/mobile_screen_settings_full.png",
      secondaryLabel: "02 • Lossless Bitrate DSP",
    },
    {
      id: 6,
      label: "Multi-Account & Cloud Sync",
      desc: "Instant profile switching, backup, and cross-device session synchronization",
      icon: Users,
      status: "IMPLEMENTED" as const,
      details: "Seamless account switching between personal profiles and cloud sync across all your Android & desktop devices.",
      primaryScreen: "/images/mobile/mobile_screen_avatar_tap.png",
      primaryLabel: "01 • Profile & Cloud Sync",
      secondaryScreen: "/images/mobile/mobile_now_playing.png",
      secondaryLabel: "02 • Synchronized Playhead",
    },
  ];

  return (
    <section id="experience" className="relative py-24 border-t border-white/[0.06] bg-[#04060a]/60" aria-labelledby="experience-title">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16">
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
              The Architecture of Experience
            </span>
          </div>
          
          <h2 id="experience-title" className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Not just another music player.
          </h2>

          <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed">
            Raaga was built as a complete playback experience — from audio delivery
            and media controls to synchronized lyrics, offline storage, real-time sessions,
            and device handoff.
          </p>
        </div>

        {/* Visual Composition: Dual Smartphone Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-16">
          
          {/* Dual Phone Showcase with Real ADB Screenshots */}
          <div className="lg:col-span-7">
            <div className="relative rounded-3xl overflow-hidden liquid-glass p-6 sm:p-8 border border-white/[0.18] shadow-[0_30px_70px_rgba(0,0,0,0.85)] group">
              <div className="liquid-specular-top" />
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/10 via-transparent to-red-500/10 pointer-events-none" />

              {/* Dual Phones Container */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 py-4">
                
                {/* Left Device */}
                <div className="relative w-1/2 max-w-[240px] rounded-[36px] p-2 bg-gradient-to-b from-zinc-800/90 to-black border border-white/20 shadow-2xl transition-transform duration-500 group-hover:-translate-y-1">
                  <div className="liquid-specular-top" />
                  {/* Speaker & Camera Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-black ring-1 ring-zinc-700 z-10" />
                  <div className="rounded-[28px] overflow-hidden aspect-[1220/2712] bg-zinc-950 border border-white/10">
                    <Image
                      src={flowSteps[activeStep].primaryScreen}
                      alt={flowSteps[activeStep].primaryLabel}
                      width={1220}
                      height={2712}
                      className="w-full h-full object-cover transition-all duration-300"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-[10px] font-mono text-zinc-400">{flowSteps[activeStep].primaryLabel}</span>
                  </div>
                </div>

                {/* Right Device */}
                <div className="relative w-1/2 max-w-[240px] rounded-[36px] p-2 bg-gradient-to-b from-zinc-800/90 to-black border border-white/20 shadow-2xl transition-transform duration-500 group-hover:translate-y-1">
                  <div className="liquid-specular-top" />
                  {/* Speaker & Camera Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-black ring-1 ring-zinc-700 z-10" />
                  <div className="rounded-[28px] overflow-hidden aspect-[1220/2712] bg-zinc-950 border border-white/10">
                    <Image
                      src={flowSteps[activeStep].secondaryScreen}
                      alt={flowSteps[activeStep].secondaryLabel}
                      width={1220}
                      height={2712}
                      className="w-full h-full object-cover transition-all duration-300"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-[10px] font-mono text-red-400 font-semibold">{flowSteps[activeStep].secondaryLabel}</span>
                  </div>
                </div>

              </div>

              {/* Liquid Glass Showcase Status Pill */}
              <div className="mt-4 p-3 rounded-xl liquid-glass border border-white/15 flex items-center justify-between text-xs backdrop-blur-3xl">
                <span className="font-mono text-zinc-300">Native Android 14+ Jetpack Compose</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verified on Hardware
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Flow Step Viewer */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-7 rounded-3xl liquid-glass border border-white/[0.16] shadow-2xl space-y-4 relative overflow-hidden">
              <div className="liquid-specular-top" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Playback Journey Stage {activeStep + 1} of {flowSteps.length}
                </span>
                <FeatureStatusBadge status={flowSteps[activeStep].status} size="sm" />
              </div>

              <div className="flex items-center gap-3">
                {React.createElement(flowSteps[activeStep].icon, {
                  className: "w-7 h-7 text-red-400",
                })}
                <h3 className="text-2xl font-bold text-white">
                  {flowSteps[activeStep].label}
                </h3>
              </div>

              <p className="text-sm font-medium text-zinc-300">
                {flowSteps[activeStep].desc}
              </p>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-300 leading-relaxed font-mono">
                {flowSteps[activeStep].details}
              </div>
            </div>

            {/* Quick Flow Navigator */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : flowSteps.length - 1))}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-all"
              >
                ← Previous Stage
              </button>
              <button
                onClick={() => setActiveStep((prev) => (prev < flowSteps.length - 1 ? prev + 1 : 0))}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-red-400 border border-red-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Next Stage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* Step-by-Step Flow Breadcrumb Bar */}
        <div className="p-4 rounded-2xl glass-panel-subtle border border-white/[0.08] overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max justify-between">
            {flowSteps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setActiveStep(idx)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-red-500/20 text-white border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-red-400" : "text-zinc-500"}`} />
                    <span>{step.label}</span>
                  </button>
                  {idx < flowSteps.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
