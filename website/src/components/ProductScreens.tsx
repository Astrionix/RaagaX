"use client";

import React, { useState } from "react";
import Image from "next/image";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import { ChevronLeft, ChevronRight, Smartphone } from "lucide-react";

export const ProductScreens: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const screens = [
    {
      num: "01",
      title: "Home / Listen Now",
      tag: "IMPLEMENTED" as const,
      desc: "Curated playlists, recent releases, dynamic mood carousels, and quick resume triggers over a reactive Compose LazyColumn.",
      preview: "/screenshots/home.png",
      highlight: "Material 3 LazyColumn with floating Liquid Glass navigation bar",
      meta: "Jetpack Compose • 120Hz Fluid Scroll",
    },
    {
      num: "02",
      title: "Now Playing",
      tag: "IMPLEMENTED" as const,
      desc: "Dynamic cover art mesh backdrop with custom glass transport controls, real-time seek bar, and AAC 44.1 kHz Stereo lossless audio badge.",
      preview: "/screenshots/now_playing.png",
      highlight: "Palette extraction with Android 12+ RenderEffect backdrop blur",
      meta: "Media3 ExoPlayer • 24-bit Flac/AAC",
    },
    {
      num: "03",
      title: "Synchronized Lyrics",
      tag: "IMPLEMENTED" as const,
      desc: "Syllable and line-synchronized Apple-Music-style karaoke text, Romanized translations, and manual timing offset calibration.",
      preview: "/screenshots/lyrics.png",
      highlight: "LRCLIB, Musixmatch, and Kugou KRC multi-source resolver",
      meta: "Real-time Millisecond Interpolation",
    },
    {
      num: "04",
      title: "Search & Categorized Discovery",
      tag: "IMPLEMENTED" as const,
      desc: "Instant fuzzy and phonetic query engine searching across Songs, Videos, Albums, Artists, and Playlists with debounced flows.",
      preview: "/screenshots/search_results.png",
      highlight: "Debounced query flow with automated search history caching",
      meta: "Instant Response • SQLite Cache",
    },
    {
      num: "05",
      title: "New Drops & Top Charts",
      tag: "IMPLEMENTED" as const,
      desc: "Daily featured drops, top 10 trending hits, regional charts, and new album premiere showcases.",
      preview: "/screenshots/explore_new.png",
      highlight: "Multi-category layout with adaptive chip filtering",
      meta: "JioSaavn API • Trending Algorithmic Feeds",
    },
    {
      num: "06",
      title: "Personal Library & WebDAV",
      tag: "IMPLEMENTED" as const,
      desc: "Locally downloaded songs, offline playback, listening stats (1,355+ minutes), personal playlists, and WebDAV remote server connection.",
      preview: "/screenshots/library.png",
      highlight: "Encrypted Room SQLite store with auto ID3 metadata tagging",
      meta: "Offline Storage • WebDAV Streaming",
    },
    {
      num: "07",
      title: "Liquid Glass System Architecture",
      tag: "IMPLEMENTED" as const,
      desc: "Real refracting glass on the floating nav bar, full-screen cover art, legacy mesh gradients, and animated cover art controls.",
      preview: "/screenshots/settings_liquid_glass.png",
      highlight: "GPU RenderEffect shader sampling backdrop with Haze library",
      meta: "Android 12+ GPU Shader • 0 dropped frames",
    },
    {
      num: "08",
      title: "Lossless Audio DSP & Settings",
      tag: "IMPLEMENTED" as const,
      desc: "Bitrate quality governors, Wi-Fi and Cellular lossless profiles, Dolby Atmos immersion toggle, and ~35 MB high-fidelity track caching.",
      preview: "/screenshots/screen_settings_full.png",
      highlight: "Per-network audio streaming ceilings and high-resolution DAC output",
      meta: "Lossless Wi-Fi/LTE • Dolby Atmos Support",
    },
    {
      num: "09",
      title: "Multi-Account & Cloud Sync",
      tag: "IMPLEMENTED" as const,
      desc: "Seamless account switching, multi-profile preferences, cloud backup, and cross-device session synchronization.",
      preview: "/screenshots/screen_avatar_tap.png",
      highlight: "OAuth2 authentication with cloud profile persistence",
      meta: "Instant Account Switching • Cloud Sync",
    },
    {
      num: "10",
      title: "Liquid Glass Audio Output (v1.9.7)",
      tag: "IMPLEMENTED" as const,
      desc: "Instant audio router sheet available from both Home and expanded player. Dynamic frosted refraction with real-time Bluetooth, USB DAC, and internal speaker routing.",
      preview: "/screenshots/now_playing.png",
      highlight: "Real-time audio device enumeration with dynamic specular refraction",
      meta: "v1.9.7 Feature • Android & Desktop",
    },
  ];

  const current = screens[selectedIdx];

  return (
    <section id="screens" className="relative py-28 border-t border-white/[0.06] bg-[#04060a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
                Application Gallery
              </span>
              <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                100% Real Device Screenshots
              </span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Real Device Interface Gallery.
            </h2>

            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              Captured directly via ADB from physical Android hardware running the production release APK.
              Explore the real application interface across core user flows.
            </p>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIdx((prev) => (prev > 0 ? prev - 1 : screens.length - 1))}
              className="p-3 rounded-2xl liquid-glass hover:bg-white/[0.12] text-white border border-white/20 active:scale-95 transition-all shadow-lg"
              aria-label="Previous Screen"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSelectedIdx((prev) => (prev < screens.length - 1 ? prev + 1 : 0))}
              className="p-3 rounded-2xl liquid-glass hover:bg-white/[0.12] text-white border border-white/20 active:scale-95 transition-all shadow-lg"
              aria-label="Next Screen"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Featured Screen Showcase Card */}
        <div className="p-8 sm:p-10 rounded-3xl liquid-glass border border-white/[0.16] shadow-2xl relative overflow-hidden">
          <div className="liquid-specular-top" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Visual Frame: Real Device Mockup */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-[290px] sm:max-w-[310px] group">
                {/* Phone Exterior Chassis */}
                <div className="relative rounded-[44px] p-3 bg-gradient-to-b from-zinc-800/90 via-zinc-900/95 to-black border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                  <div className="liquid-specular-top" />
                  
                  {/* Punch Hole Camera & Speaker */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                    <div className="w-10 h-1 rounded-full bg-zinc-700/60" />
                    <div className="w-3 h-3 rounded-full bg-black ring-1 ring-zinc-700 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-cyan-950" />
                    </div>
                  </div>

                  {/* Inner Screen Display */}
                  <div className="relative rounded-[34px] overflow-hidden bg-black aspect-[1220/2712] border border-white/10 shadow-inner">
                    <Image
                      src={current.preview}
                      alt={`RaagaX ${current.title} Screen Capture via ADB`}
                      width={1220}
                      height={2712}
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Screen Details */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-zinc-500 font-bold">
                  SCREEN {current.num} / {String(screens.length).padStart(2, "0")}
                </span>
                <FeatureStatusBadge status={current.tag} size="sm" />
              </div>

              <h3 className="text-3xl font-extrabold text-white tracking-tight">
                {current.title}
              </h3>

              <p className="text-base text-zinc-300 leading-relaxed">
                {current.desc}
              </p>

              {/* Engineering Highlights */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl liquid-glass border border-white/[0.12] text-xs font-mono space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Engineering Architecture</span>
                  <p className="text-zinc-100">{current.highlight}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono flex items-center justify-between text-zinc-400">
                  <span>Stack Tag:</span>
                  <span className="text-red-400 font-medium">{current.meta}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Horizontal Screen Selector Strip */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {screens.map((sc, i) => (
            <button
              key={sc.num}
              onClick={() => setSelectedIdx(i)}
              className={`p-3 rounded-2xl border text-center transition-all ${
                selectedIdx === i
                  ? "liquid-glass bg-red-500/25 border-red-500/60 text-white font-bold shadow-lg shadow-red-500/20 scale-[1.02]"
                  : "liquid-glass-subtle text-zinc-400 hover:text-white hover:border-white/20"
              }`}
            >
              <span className="block text-[10px] font-mono text-zinc-400">{sc.num}</span>
              <span className="text-xs truncate block font-medium mt-0.5">{sc.title}</span>
            </button>
          ))}
        </div>

      </div>
    </section>
  );
};
