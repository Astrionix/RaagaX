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
      label: "Home",
      desc: "Dynamic recommendations and personalized mood carousels",
      icon: Compass,
      status: "IMPLEMENTED" as const,
      details: "Jetpack Compose lazy grids with hardware-accelerated image caching using Coil3 and material surface shaders.",
    },
    {
      id: 1,
      label: "Search",
      desc: "Fast unified catalog querying across providers",
      icon: Search,
      status: "IMPLEMENTED" as const,
      details: "Debounced multi-source query pipeline with instant phonetic and fuzzy song, album, and artist matching.",
    },
    {
      id: 2,
      label: "Album",
      desc: "High-resolution artwork & full track listings",
      icon: Disc,
      status: "IMPLEMENTED" as const,
      details: "Lossless FLAC/ALAC availability checks with full metadata preservation and batch queue operations.",
    },
    {
      id: 3,
      label: "Now Playing",
      desc: "Immersive mesh gradient backdrop with custom controls",
      icon: PlayCircle,
      status: "IMPLEMENTED" as const,
      details: "Real-time color extraction from album art into a 60fps GPU-accelerated backdrop, Media3 session, and gapless crossfade.",
    },
    {
      id: 4,
      label: "Lyrics",
      desc: "Word and syllable synchronized karaoke engine",
      icon: AlignLeft,
      status: "IMPLEMENTED" as const,
      details: "High-precision word-level timing parser resolving across LRCLIB, Musixmatch, Kugou, and Genius.",
    },
    {
      id: 5,
      label: "Library",
      desc: "Offline downloads & scanned local device audio",
      icon: Library,
      status: "IMPLEMENTED" as const,
      details: "Encrypted SQLite/Room local store with automatic ID3 tag injection and network-aware background downloader.",
    },
    {
      id: 6,
      label: "Listen Together",
      desc: "Synchronized group playback via server-time anchors",
      icon: Users,
      status: "IMPLEMENTED" as const,
      details: "Go-powered WebSocket cluster synchronizing up to 5 devices within milliseconds using NTP-style clock offset estimation.",
    },
  ];

  return (
    <section className="relative py-24 border-t border-white/[0.06] bg-[#04060a]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4 mb-16">
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
              The Architecture of Experience
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Not just another music player.
          </h2>

          <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed">
            RaagaX was built as a complete playback experience — from audio delivery
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
                
                {/* Left Device: Home & Curated Feed */}
                <div className="relative w-1/2 max-w-[240px] rounded-[36px] p-2 bg-gradient-to-b from-zinc-800/90 to-black border border-white/20 shadow-2xl transition-transform duration-500 group-hover:-translate-y-1">
                  <div className="liquid-specular-top" />
                  {/* Speaker & Camera Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-black ring-1 ring-zinc-700 z-10" />
                  <div className="rounded-[28px] overflow-hidden aspect-[1220/2712] bg-zinc-950 border border-white/10">
                    <Image
                      src="/screenshots/home.png"
                      alt="RaagaX Listen Now Screen"
                      width={1220}
                      height={2712}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-[10px] font-mono text-zinc-400">01 • Listen Now</span>
                  </div>
                </div>

                {/* Right Device: Now Playing & Lossless AAC */}
                <div className="relative w-1/2 max-w-[240px] rounded-[36px] p-2 bg-gradient-to-b from-zinc-800/90 to-black border border-white/20 shadow-2xl transition-transform duration-500 group-hover:translate-y-1">
                  <div className="liquid-specular-top" />
                  {/* Speaker & Camera Notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-black ring-1 ring-zinc-700 z-10" />
                  <div className="rounded-[28px] overflow-hidden aspect-[1220/2712] bg-zinc-950 border border-white/10">
                    <Image
                      src="/screenshots/now_playing.png"
                      alt="RaagaX Now Playing Screen"
                      width={1220}
                      height={2712}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-[10px] font-mono text-red-400 font-semibold">02 • Now Playing</span>
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
