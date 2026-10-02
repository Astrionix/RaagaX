"use client";

import React from "react";
import { GitBranch, Milestone, ArrowRight } from "lucide-react";

export const DevelopmentJourney: React.FC = () => {
  const milestones = [
    {
      stage: "01",
      title: "Discovery & Audio Prototyping",
      desc: "Prototyped multi-source audio resolvers connecting JioSaavn catalog metadata and YouTube streaming fallbacks.",
    },
    {
      stage: "02",
      title: "UI Design System & Haze",
      desc: "Built edge-to-edge Material 3 design system in Jetpack Compose with custom Haze frosted-glass shaders.",
    },
    {
      stage: "03",
      title: "Media3 Playback Engine",
      desc: "Constructed foreground media session service with 0–12s gapless crossfade and 32-bit float DSP chain.",
    },
    {
      stage: "04",
      title: "Synchronized Lyrics Engine",
      desc: "Implemented sub-millisecond syllable and word-level karaoke parser supporting LRCLIB, Musixmatch, and Kugou.",
    },
    {
      stage: "05",
      title: "Offline Storage Architecture",
      desc: "Engineered segmented media downloader with ID3 tag injection and Room SQLite local database persistence.",
    },
    {
      stage: "06",
      title: "Listen Together (Go Hub)",
      desc: "Developed high-concurrency Go party hub with monotonic server-time anchors and NTP clock synchronization.",
    },
    {
      stage: "07",
      title: "Cross-Device Subsystem Spec",
      desc: "Authored formal 30-scenario acceptance test specification (CD-001 to CD-030) and 4-phase lease transfer coordinator.",
    },
    {
      stage: "08",
      title: "Native C++ Audio Analyzer",
      desc: "Integrated CMake and Android NDK 27 for SIMD-accelerated Mel spectrogram and tempo beat tracking.",
    },
    {
      stage: "09",
      title: "Comprehensive Test Harness",
      desc: "Validated 84 unit and integration test suites covering DSP sinks, queue shuffles, and party state regressions.",
    },
    {
      stage: "10",
      title: "120Hz Performance Hardening",
      desc: "Eliminated root Compose recompositions, throttled download StateFlow emissions, and optimized GPU shaders.",
    },
  ];

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#04060a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
              Engineering Milestones
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            The development journey.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            From the initial audio decoding experiments to a distributed WebSocket cluster
            and native C++ spectral analyzers — an iterative journey of systems engineering.
          </p>
        </div>

        {/* Milestone Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {milestones.map((m, idx) => (
            <div
              key={m.stage}
              className="p-5 rounded-2xl glass-panel border border-white/[0.08] hover:border-red-500/30 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <span className="text-xs font-mono text-red-400 font-bold block">
                  STAGE {m.stage}
                </span>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {m.title}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {m.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>Milestone {idx + 1}</span>
                {idx < milestones.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-600" />}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
