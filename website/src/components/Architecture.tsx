"use client";

import React, { useState } from "react";
import { Layers, Code2, Cpu, Database, Radio, Sparkles, FolderCode } from "lucide-react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const Architecture: React.FC = () => {
  const [selectedLayerId, setSelectedLayerId] = useState<string>("playback");

  const layers = [
    {
      id: "ui",
      name: "UI & Composition Layer",
      tech: "Jetpack Compose • Material 3 • Haze Shaders",
      status: "IMPLEMENTED" as const,
      icon: Sparkles,
      color: "from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-300",
      description:
        "Declarative, state-driven Android UI built with Compose BOM and custom GPU-accelerated Skia shaders for real-time translucent frosted glass and fluid animations at 120Hz.",
      files: [
        "app/src/main/java/com/music/raaga/ui/screens/NowPlayingScreen.kt",
        "app/src/main/java/com/music/raaga/ui/components/HazeFrostedGlass.kt",
        "app/src/main/java/com/music/raaga/ui/theme/ArtworkPalette.kt",
      ],
      responsibilities: [
        "Material 3 dynamic color extraction from album artwork",
        "Sub-millisecond word and syllable lyric highlighting canvas",
        "Edge-to-edge transparent navigation with hardware-accelerated blur",
        "Recomposition suppression via immutable state wrappers and throttle gates",
      ],
    },
    {
      id: "playback",
      name: "Playback & Audio Engine",
      tech: "Android Media3 • ExoPlayer • MediaSession",
      status: "IMPLEMENTED" as const,
      icon: Cpu,
      color: "from-red-500/20 to-orange-500/10 border-red-500/30 text-red-300",
      description:
        "Low-latency playback architecture decoupling audio decoding from UI lifecycles through a persistent Android foreground media session service.",
      files: [
        "app/src/main/java/com/music/raaga/playback/PlaybackService.kt",
        "app/src/main/java/com/music/raaga/playback/audio/PrecisionAudioSink.kt",
        "app/src/main/java/com/music/raaga/playback/audio/FloatDspChain.kt",
      ],
      responsibilities: [
        "True 0–12 second gapless crossfade with custom sinusoidal curves",
        "32-bit float software DSP chain with 10-band equalizer and volume leveling",
        "System audio focus negotiation, Bluetooth sink tracker, and auto-pause on headphone unplug",
        "Multi-source stream resolver falling back to YouTube audio when lossless sources are unreachable",
      ],
    },
    {
      id: "data",
      name: "Data & Persistence Layer",
      tech: "Room SQLite • OkHttp • Supabase Sync",
      status: "IMPLEMENTED" as const,
      icon: Database,
      color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300",
      description:
        "Local-first reactive database with cloud account synchronization, intelligent metadata caching, and download job orchestration.",
      files: [
        "app/src/main/java/com/music/raaga/download/Downloads.kt",
        "app/src/main/java/com/music/raaga/data/local/RaagaDatabase.kt",
        "app/src/main/java/com/music/raaga/data/remote/SupabaseClient.kt",
      ],
      responsibilities: [
        "Chunked background audio and artwork download manager with retry backoff",
        "Embedded ID3 metadata tagging for local storage interoperability",
        "Encrypted credential and session token persistence via Android KeyStore",
        "Last.fm and ListenBrainz scrobble submission with offline caching",
      ],
    },
    {
      id: "realtime",
      name: "Real-Time Jam Layer",
      tech: "Go Server • WebSockets • NTP Time Anchoring",
      status: "IMPLEMENTED" as const,
      icon: Radio,
      color: "from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-300",
      description:
        "Lightweight Go party hub coordinating real-time synchronized playback and queue mutations across up to 5 devices simultaneously.",
      files: [
        "backend/main.go",
        "backend/party/party.go",
        "backend/clock/clock.go",
        "backend/protocol/messages.go",
      ],
      responsibilities: [
        "Monotonic server clock tracking with zero NTP stepping",
        "Millisecond-level time anchoring calculating playhead locally per device",
        "Low-bandwidth delta queue mutations (Append, Move, Remove)",
        "Automatic membership re-claim upon socket drops with 45s grace period",
      ],
    },
    {
      id: "native",
      name: "Native Audio Analysis Layer",
      tech: "C++ • CMake • Android NDK 27",
      status: "IMPLEMENTED" as const,
      icon: Code2,
      color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300",
      description:
        "High-performance native C++ algorithms executing spectral analysis, Mel-frequency spectrogram extraction, and tempo beat detection.",
      files: [
        "native/analyzer/audio_analysis.cpp",
        "native/analyzer/mel_spectrogram.cpp",
        "native/analyzer/tempo_analysis.cpp",
        "native/analyzer/resampler.cpp",
      ],
      responsibilities: [
        "Direct PCM audio buffer resampling to normalized float arrays",
        "Short-Time Fourier Transform (STFT) for Mel-frequency spectrogram calculation",
        "Dynamic autocorrelation tempo detection and beat-grid estimation",
        "Vocal energy spectrogram isolation for lyric synchronization assist",
      ],
    },
  ];

  const activeLayer = layers.find((l) => l.id === selectedLayerId) || layers[0];

  return (
    <section id="architecture" className="relative py-28 border-t border-white/[0.06] bg-[#030509]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
              System Architecture
            </span>
            <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Under the interface.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            RaagaX is structured as a layered system where UI components remain completely
            isolated from playback state, cloud network failures never interrupt local audio,
            and native C++ handles high-throughput audio computation.
          </p>
        </div>

        {/* 5-Layer Stack Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Layer Selector Stack (Left Column) */}
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest block mb-2">
              Select Architecture Layer to Inspect:
            </span>

            {layers.map((layer) => {
              const Icon = layer.icon;
              const isSelected = selectedLayerId === layer.id;
              return (
                <button
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? `bg-gradient-to-r ${layer.color} shadow-lg scale-[1.02]`
                      : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{layer.name}</h4>
                      <p className="text-[11px] font-mono text-zinc-400">{layer.tech}</p>
                    </div>
                  </div>
                  <FeatureStatusBadge status={layer.status} size="sm" />
                </button>
              );
            })}
          </div>

          {/* Layer Deep-Dive Inspector (Right Column) */}
          <div className="lg:col-span-7">
            <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">{activeLayer.name}</h3>
                  <p className="text-xs font-mono text-red-400 mt-1">{activeLayer.tech}</p>
                </div>
                <FeatureStatusBadge status={activeLayer.status} size="md" />
              </div>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                {activeLayer.description}
              </p>

              {/* Responsibilities List */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-mono uppercase text-zinc-400 tracking-wider block">
                  Core Responsibilities &amp; Implementation Details:
                </span>
                <div className="space-y-2">
                  {activeLayer.responsibilities.map((resp, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <span>{resp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Code File Verification */}
              <div className="pt-4 border-t border-white/[0.08] space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <FolderCode className="w-4 h-4 text-zinc-500" />
                  <span>Representative Repository Code Files:</span>
                </div>
                <div className="p-3 rounded-xl bg-black/50 border border-white/[0.08] space-y-1 font-mono text-[11px] text-zinc-300">
                  {activeLayer.files.map((file, i) => (
                    <div key={i} className="truncate">
                      <span className="text-zinc-600">file:///</span>
                      <span className="text-red-300">{file}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
