"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Play, Pause, Sliders, Volume2, Cpu, Music2, 
  ArrowRight, Download, Check, Sparkles, Activity, 
  Layers, HardDrive, RefreshCw
} from "lucide-react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const FeatureShowcase: React.FC = () => {
  // Feature 01: Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(4);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Feature 02: Stats for Nerds toggle
  const [showStatsForNerds, setShowStatsForNerds] = useState(false);

  // Feature 03: Lyrics active word index
  const lyricWords = ["I", "can", "feel", "the", "music", "in", "my", "veins"];
  const [activeWordIdx, setActiveWordIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % lyricWords.length);
    }, 650);
    return () => clearInterval(interval);
  }, [lyricWords.length]);

  // Feature 04: Dynamic Artwork Palettes
  const artworkPalettes = [
    {
      name: "Crimson Velvet",
      album: "Neon Odyssey",
      artist: "Astral Drift",
      primaryColor: "#ef4444",
      gradient: "from-red-950 via-[#160b13] to-[#05070c]",
      glowColor: "rgba(239, 68, 68, 0.4)",
      borderColor: "border-red-500/40",
    },
    {
      name: "Electric Violet",
      album: "Midnight Synth",
      artist: "Cyber Echo",
      primaryColor: "#8b5cf6",
      gradient: "from-purple-950 via-[#130b1e] to-[#05070c]",
      glowColor: "rgba(139, 92, 246, 0.4)",
      borderColor: "border-purple-500/40",
    },
    {
      name: "Cyan Resonance",
      album: "Oceanic Frequency",
      artist: "Subsurface",
      primaryColor: "#06b6d4",
      gradient: "from-cyan-950 via-[#06151c] to-[#05070c]",
      glowColor: "rgba(6, 182, 212, 0.4)",
      borderColor: "border-cyan-500/40",
    },
  ];
  const [activePaletteIdx, setActivePaletteIdx] = useState(0);
  const activePalette = artworkPalettes[activePaletteIdx];

  // Feature 05: Offline Download Simulation
  const [downloadStep, setDownloadStep] = useState<"idle" | "downloading" | "downloaded">("downloaded");
  const triggerDownloadSim = () => {
    setDownloadStep("downloading");
    setTimeout(() => {
      setDownloadStep("downloaded");
    }, 1800);
  };

  return (
    <section id="features" className="relative py-28 border-t border-white/[0.06] space-y-36">
      
      {/* ─────────────────────────────────────────────────────────────
          FEATURE 01: IMMERSIVE PLAYBACK
          ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text Column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
                Feature 01 — Playback Architecture
              </span>
              <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Playback is the product.
            </h2>

            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              Built around Android Media3 with a playback architecture designed to remain
              reliable beyond the foreground UI. Background execution operates within a
              first-class Android foreground service, integrating with system media controls,
              Bluetooth audio sinks, and system audio managers.
            </p>

            {/* Playback Capabilities Badges */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <span className="text-xs font-bold text-white block">Gapless Playback</span>
                <span className="text-[11px] text-zinc-400">Zero silence between consecutive tracks</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <span className="text-xs font-bold text-white block">True Crossfade</span>
                <span className="text-[11px] text-zinc-400">Configurable 0–12s curve blending</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <span className="text-xs font-bold text-white block">Skip Silence & Speed</span>
                <span className="text-[11px] text-zinc-400">0.5x to 2.0x pitch-neutral playback</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <span className="text-xs font-bold text-white block">Equalizer & Sleep Timer</span>
                <span className="text-[11px] text-zinc-400">System equalizer & track-end auto-stop</span>
              </div>
            </div>
          </div>

          {/* Interactive Player Console */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase text-zinc-300">Media3 Foreground Engine</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  ACTIVE SESSION
                </span>
              </div>

              {/* Track Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                  <Music2 className="w-8 h-8" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-bold text-white truncate">Resonance of Infinity</h4>
                  <p className="text-xs text-zinc-400 truncate">Astrionix Masterworks • Session ID: #9042</p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">ExoPlayer 1.4.1 • AudioSink: DirectTrack</p>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="space-y-1.5">
                <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-red-500 to-rose-400 h-full w-2/3 rounded-full relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md" />
                  </div>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>02:44</span>
                  <span>04:12</span>
                </div>
              </div>

              {/* Interactive Knobs: Crossfade & Speed */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Crossfade</span>
                    <span className="font-mono text-red-400">{crossfadeSeconds}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    value={crossfadeSeconds}
                    onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Speed</span>
                    <span className="font-mono text-red-400">{playbackSpeed.toFixed(1)}x</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
                          playbackSpeed === speed
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-white/[0.04] text-zinc-400 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transport Controls */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-500 font-mono">Volume Normalization: On</span>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-semibold flex items-center gap-2 border border-white/10 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{isPlaying ? "Pause Engine" : "Resume Engine"}</span>
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 02: HIGH-FIDELITY AUDIO & STATS FOR NERDS
          ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Visual / Stats Column */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-mono uppercase text-zinc-300">Audio Pipeline Monitor</span>
                </div>
                <button
                  onClick={() => setShowStatsForNerds(!showStatsForNerds)}
                  className="text-xs font-mono px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 border border-white/10 transition-colors"
                >
                  {showStatsForNerds ? "Hide Details" : "Toggle Stats for Nerds"}
                </button>
              </div>

              {/* Audio Metrics Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-[10px] text-zinc-500 font-mono block">Codec</span>
                  <span className="text-sm font-bold text-white font-mono">FLAC</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-[10px] text-zinc-500 font-mono block">Bit Depth</span>
                  <span className="text-sm font-bold text-purple-400 font-mono">24-bit</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-[10px] text-zinc-500 font-mono block">Sample Rate</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">96 kHz</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <span className="text-[10px] text-zinc-500 font-mono block">Channels</span>
                  <span className="text-sm font-bold text-white font-mono">Stereo (2.0)</span>
                </div>
              </div>

              {/* Audio Pipeline Flow Diagram */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-3">
                <span className="text-[11px] font-mono text-zinc-400 block uppercase">Signal Path Flow</span>
                <div className="flex items-center justify-between text-xs font-mono text-zinc-300 flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08]">Source Stream</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">Float DSP Chain</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08]">Media3 Sink</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">AudioTrack Hardware</span>
                </div>
              </div>

              {/* Stats for Nerds Console Modal/Drawer */}
              {showStatsForNerds && (
                <div className="p-4 rounded-2xl bg-zinc-950/90 border border-purple-500/30 font-mono text-xs text-zinc-300 space-y-1.5 animate-fadeIn">
                  <div className="flex justify-between"><span className="text-zinc-500">Audio Decoder:</span><span>c2.android.flac.decoder</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Buffer Size:</span><span>65536 bytes (DirectBytePool)</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Underrun Count:</span><span className="text-emerald-400">0</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Latency Estimate:</span><span>28ms (Low-latency sink)</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Source Stream URL:</span><span className="truncate max-w-[200px] text-zinc-400">https://stream.internal/flac_lossless</span></div>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 font-mono">
                * Note: Quality metrics reflect active source resolution. Fallbacks dynamically negotiate to 320kbps AAC/Opus when FLAC is unavailable.
              </p>
            </div>
          </div>

          {/* Text Column */}
          <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-purple-400 font-semibold">
                Feature 02 — High-Fidelity Audio
              </span>
              <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Built for serious listening.
            </h2>

            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              RaagaX supports pluggable sources capable of delivering lossless audio streams
              (FLAC / ALAC) with YouTube Music as an automatic fallback. An integrated 32-bit float
              DSP chain handles volume leveling, dynamic range control, and equalizer filtering
              before passing directly to the hardware AudioSink.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-purple-400 mt-1 shrink-0" />
                <p className="text-sm text-zinc-300">
                  <strong className="text-white">Truthful Audio Metrics:</strong> Displays actual decoded bit depth and sample rates rather than arbitrary marketing promises.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-purple-400 mt-1 shrink-0" />
                <p className="text-sm text-zinc-300">
                  <strong className="text-white">Per-Network Quality Governor:</strong> Configurable bit-rate ceilings for Wi-Fi vs. Mobile data to conserve bandwidth.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 03: SYNCHRONIZED LYRICS
          ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text Column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                Feature 03 — Syllable Engine
              </span>
              <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Every word has a moment.
            </h2>

            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              RaagaX supports synchronized lyrics with word/syllable-level highlighting
              from multiple sources. The lyric engine resolves across LRCLIB, Musixmatch,
              Kugou, and Genius, anchoring timings directly to the playback clock.
            </p>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-400 font-mono space-y-2">
              <div className="text-zinc-300 font-semibold">Multiple Provider Ingestion:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>• LRCLIB (LRC format)</div>
                <div>• Musixmatch (RichSync)</div>
                <div>• Kugou (KRC syllable parser)</div>
                <div>• Genius (Annotations fallback)</div>
              </div>
            </div>
            
            <p className="text-xs text-zinc-500 font-mono">
              * Note: Word-level highlighting is rendered when syllable-level timing metadata is supplied by providers.
            </p>
          </div>

          {/* Interactive Karaoke Illuminator with Real Screen Preview */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-6 sm:p-8 rounded-3xl liquid-glass border border-white/[0.14] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[300px]">
              <div className="liquid-specular-top" />
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
                <Sparkles className="w-3 h-3" />
                <span>KARAOKE ENGINE</span>
              </div>

              <div className="space-y-6">
                <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                  Live Word-Level Sync Demonstration
                </p>

                {/* Animated Glowing Lyric Line */}
                <div className="flex flex-wrap gap-x-3 gap-y-2 text-3xl sm:text-4xl font-bold tracking-tight">
                  {lyricWords.map((word, idx) => {
                    const isCurrent = idx === activeWordIdx;
                    const isPast = idx < activeWordIdx;
                    return (
                      <span
                        key={idx}
                        className={`transition-all duration-300 ${
                          isCurrent
                            ? "text-cyan-300 scale-110 drop-shadow-[0_0_18px_rgba(6,182,212,0.9)]"
                            : isPast
                            ? "text-white"
                            : "text-zinc-600"
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>Current Syllable Offset: +120ms</span>
                  <span className="text-cyan-400">60 FPS Compose Shader</span>
                </div>
              </div>
            </div>

            {/* Real Screenshot Preview Banner */}
            <div className="p-3 rounded-2xl liquid-glass border border-white/[0.1] flex items-center gap-4">
              <div className="w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 relative">
                <Image
                  src="/screenshots/lyrics.png"
                  alt="Real Android Lyrics Screen"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-xs space-y-0.5">
                <span className="font-semibold text-white block">Real Device Screen Capture</span>
                <span className="text-zinc-400 text-[11px]">Physical Xiaomi POCO F6 hardware running word-synced lyrics with Romanized script translation.</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 04: DYNAMIC ARTWORK PALETTE EXTRACTION
          ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Interactive Artwork Switcher Canvas */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div
              className={`p-8 rounded-3xl border ${activePalette.borderColor} shadow-2xl transition-all duration-700 bg-gradient-to-b ${activePalette.gradient} relative overflow-hidden`}
              style={{
                boxShadow: `0 25px 60px -15px ${activePalette.glowColor}`,
              }}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white/80 uppercase tracking-wider">
                    Artwork Palette Extractor
                  </span>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full border text-white font-medium"
                    style={{ backgroundColor: `${activePalette.primaryColor}33`, borderColor: activePalette.primaryColor }}
                  >
                    {activePalette.name}
                  </span>
                </div>

                {/* Simulated Music Card */}
                <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/10 space-y-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-xl transition-colors duration-500"
                      style={{ backgroundColor: activePalette.primaryColor }}
                    >
                      ♪
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">{activePalette.album}</h4>
                      <p className="text-sm text-zinc-300">{activePalette.artist}</p>
                    </div>
                  </div>

                  {/* Dynamic Mesh Palette Swatches */}
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[10px] font-mono text-zinc-400">Extracted Dominant Hues (Material 3 Dynamic Theming):</span>
                    <div className="flex gap-2">
                      <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: activePalette.primaryColor }} />
                      <div className="h-6 flex-1 rounded-lg bg-white/20" />
                      <div className="h-6 flex-1 rounded-lg bg-black/50" />
                    </div>
                  </div>
                </div>

                {/* Palette Selectors */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-mono text-zinc-400 block">Click to test palette switch:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {artworkPalettes.map((item, idx) => (
                      <button
                        key={item.name}
                        onClick={() => setActivePaletteIdx(idx)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          activePaletteIdx === idx
                            ? "bg-white/20 border-white text-white shadow-lg"
                            : "bg-black/30 border-white/10 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Column */}
          <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-rose-400 font-semibold">
                Feature 04 — Dynamic Theming
              </span>
              <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              The interface listens to the artwork.
            </h2>

            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              When a track begins playing, RaagaX extracts dominant harmonic colors
              from the album cover and recalculates the ambient backdrop in real time.
              Using hardware-accelerated shaders, the entire screen breathes with the tone
              of the music.
            </p>

            {/* Architecture Pipeline */}
            <div className="p-4 rounded-2xl glass-panel-subtle border border-white/[0.08] space-y-2 text-xs font-mono text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="text-red-400">1.</span> Album Artwork Bitmap Ingestion
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-400">2.</span> Android Palette Color Extraction & Tone Clamping
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-400">3.</span> Dynamic Material 3 Surface Palette Generation
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-400">4.</span> Skia / Haze RenderEffect GPU Mesh Shader
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FEATURE 05: OFFLINE MUSIC & DOWNLOADS
          ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text Column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                Feature 05 — Offline Architecture
              </span>
              <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Your library, even offline.
            </h2>

            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              RaagaX provides an offline storage pipeline with full metadata preservation.
              Songs, album art, synchronized lyrics, and ID3 tags are persisted to device
              storage for instant, zero-latency local playback.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <span className="text-xs font-bold text-white block">Embedded Metadata</span>
                <span className="text-[11px] text-zinc-400">Artist, title, album, and embedded cover art</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <span className="text-xs font-bold text-white block">Local Device Scanner</span>
                <span className="text-[11px] text-zinc-400">Seamless integration of existing local audio</span>
              </div>
            </div>
          </div>

          {/* Interactive Download Pipeline Animation */}
          <div className="lg:col-span-6">
            <div className="p-8 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-zinc-300">Local Download Transaction</span>
                </div>
                <button
                  onClick={triggerDownloadSim}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${downloadStep === "downloading" ? "animate-spin" : ""}`} />
                  <span>Simulate Download</span>
                </button>
              </div>

              {/* Download Packaging Stages */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-zinc-300">1. Audio Payload (Opus/FLAC)</span>
                  <span className="text-emerald-400">✓ Cached (12.4 MB)</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-zinc-300">2. Embedded High-Res Artwork</span>
                  <span className="text-emerald-400">✓ Injected (1400x1400)</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-zinc-300">3. Synced LRC / Word Timings</span>
                  <span className="text-emerald-400">✓ Bundled</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <span className="text-zinc-300">4. Room SQLite Catalog Entry</span>
                  <span className="text-emerald-400">✓ Indexed</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Ready for zero-network playback with full offline queue support.</span>
              </div>
            </div>

            {/* Real Library Screenshot Preview Banner */}
            <div className="mt-4 p-3 rounded-2xl liquid-glass border border-white/[0.1] flex items-center gap-4">
              <div className="w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 relative">
                <Image
                  src="/screenshots/library.png"
                  alt="Real Android Library Screen"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-xs space-y-0.5">
                <span className="font-semibold text-white block">Real Device Library & Downloads Capture</span>
                <span className="text-zinc-400 text-[11px]">Local database with 1,355+ minutes tracked, offline downloaded FLACs, and WebDAV server connections.</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </section>
  );
};
