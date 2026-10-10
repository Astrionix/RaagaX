"use client";

import React from "react";
import { Sparkles, Cpu, Server, Radio, Code2, Database, ShieldCheck, Check } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";

export const WhatIBuilt: React.FC = () => {
  const tiers = [
    {
      name: "Android & Desktop UI",
      icon: Sparkles,
      color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
      points: [
        "10 core screens in Jetpack Compose & Compose Multiplatform (Windows/Mac/Linux)",
        "Liquid Glass Audio Output Sheet with real-time routing on Home & Expanded Player",
        "Sub-millisecond word and syllable karaoke lyrics highlighting canvas",
      ],
    },
    {
      name: "Playback & DSP Engine",
      icon: Cpu,
      color: "text-red-400 border-red-500/30 bg-red-500/10",
      points: [
        "Android Media3 / ExoPlayer integration inside a persistent foreground service",
        "0–12s gapless crossfade with custom sinusoidal curve blending",
        "32-bit float software DSP chain with 10-band equalizer and volume leveling",
      ],
    },
    {
      name: "Go Distributed Backend",
      icon: Server,
      color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      points: [
        "High-throughput WebSocket party hub written in Go",
        "Monotonic server-time anchors ensuring zero NTP clock step disruptions",
        "In-memory party state with unguessable security tokens and 45s grace periods",
      ],
    },
    {
      name: "Real-Time Sync Protocol",
      icon: Radio,
      color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
      points: [
        "Autonomous playhead calculus: playhead = positionMs + (serverNow - anchorMs)",
        "NTP-style ping/pong offset estimation bounding latency drift over cellular",
        "5-second authoritative state heartbeats and delta queue mutation messages",
      ],
    },
    {
      name: "Native C++ Audio Analyzer",
      icon: Code2,
      color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
      points: [
        "SIMD-accelerated C++ routines compiled via CMake and Android NDK 27",
        "Short-Time Fourier Transforms and 128-band Mel spectrograms without GC pauses",
        "Autocorrelation tempo detection and beat-grid analysis",
      ],
    },
    {
      name: "Data, Storage & Verification",
      icon: Database,
      color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      points: [
        "Room SQLite local store with automatic ID3 tag injection for offline playback",
        "84 verified unit & integration test suites in Android and Go",
        "30 formal cross-device acceptance test specifications (CD-001 to CD-030)",
      ],
    },
  ];

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#030509]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
              Authorship &amp; Systems Ownership
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            I didn&rsquo;t just design the interface.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            RaagaX required working across multiple layers of the stack — from Android UI
            and media playback to real-time synchronization, backend services, offline storage,
            and native audio processing.
          </p>
        </div>

        {/* 6 Tiers of Implementation Ownership */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.name}
                className="p-7 rounded-3xl glass-panel border border-white/[0.08] hover:border-white/[0.16] transition-all space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${tier.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {tier.name}
                    </h3>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {tier.points.map((pt, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                  Built &amp; Maintained by {RAAGAX_CONFIG.authorName}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
