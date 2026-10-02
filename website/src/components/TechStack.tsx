"use client";

import React from "react";
import { Smartphone, PlayCircle, Server, Database, Code2, Wrench } from "lucide-react";

export const TechStack: React.FC = () => {
  const groups = [
    {
      title: "GROUP 01 — ANDROID",
      icon: Smartphone,
      color: "border-red-500/30 text-red-400",
      items: [
        { name: "Kotlin 2.0+", desc: "Coroutines, StateFlow, Serialization" },
        { name: "Jetpack Compose", desc: "Declarative UI with Compose BOM 2024" },
        { name: "Material 3", desc: "Dynamic color & expressive components" },
        { name: "Android SDK (API 26–36)", desc: "Backwards-compatible modern runtime" },
      ],
    },
    {
      title: "GROUP 02 — PLAYBACK",
      icon: PlayCircle,
      color: "border-purple-500/30 text-purple-400",
      items: [
        { name: "Android Media3", desc: "Modern unified media architecture" },
        { name: "ExoPlayer 1.4+", desc: "DASH/HLS/Progressive stream engine" },
        { name: "MediaSession", desc: "Foreground service & system controls" },
        { name: "Custom Float DSP", desc: "Gapless crossfade & 10-band EQ" },
      ],
    },
    {
      title: "GROUP 03 — BACKEND",
      icon: Server,
      color: "border-emerald-500/30 text-emerald-400",
      items: [
        { name: "Go (Golang) 1.22", desc: "Low-overhead concurrency runtime" },
        { name: "WebSocket Hub", desc: "Sub-50ms full-duplex client streams" },
        { name: "In-Memory Store", desc: "Zero-latency party rooms & tokens" },
        { name: "REST Endpoints", desc: "Healthz & monotonic time bootstrapping" },
      ],
    },
    {
      title: "GROUP 04 — DATA",
      icon: Database,
      color: "border-cyan-500/30 text-cyan-400",
      items: [
        { name: "Room SQLite", desc: "Encrypted offline tracks & playlists" },
        { name: "OkHttp 4 & Retrofit", desc: "HTTP/2 connection pooling & cache" },
        { name: "Supabase Cloud", desc: "User sync & remote metadata backup" },
        { name: "Coil3", desc: "Hardware-accelerated bitmap caching" },
      ],
    },
    {
      title: "GROUP 05 — NATIVE",
      icon: Code2,
      color: "border-amber-500/30 text-amber-400",
      items: [
        { name: "Modern C++ (C++17)", desc: "STFT, Mel spectrograms, tempo lag" },
        { name: "CMake 3.22.1", desc: "Native build orchestration" },
        { name: "Android NDK 27", desc: "Direct ARM NEON SIMD acceleration" },
        { name: "JNI Zero-Copy", desc: "Direct byte buffer bridging" },
      ],
    },
    {
      title: "GROUP 06 — BUILD",
      icon: Wrench,
      color: "border-blue-500/30 text-blue-400",
      items: [
        { name: "Gradle 8.7+", desc: "Incremental modularized build daemon" },
        { name: "Kotlin DSL", desc: "Type-safe build scripts (build.gradle.kts)" },
        { name: "R8 Proguard", desc: "Aggressive dead-code elimination & minification" },
        { name: "GitHub Actions CI", desc: "Automated test suites & APK release tagging" },
      ],
    },
  ];

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#030509]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-semibold">
              Production Technology Matrix
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            An engineered stack from metal to UI.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            Every technology in RaagaX was picked for reliability, determinism, and performance.
            No superficial wrapper frameworks — true native code at every tier.
          </p>
        </div>

        {/* 6 Technology Group Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <div
                key={group.title}
                className="p-7 rounded-3xl glass-panel border border-white/[0.08] hover:border-white/[0.16] transition-all space-y-5"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <span className="text-xs font-mono font-bold text-zinc-400">
                    {group.title}
                  </span>
                  <div className={`p-2 rounded-xl bg-white/[0.04] border ${group.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div key={item.name} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-xs font-bold font-mono text-white block">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        {item.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
