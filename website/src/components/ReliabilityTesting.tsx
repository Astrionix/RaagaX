"use client";

import React, { useState } from "react";
import { CheckCircle2, ShieldCheck, Cpu, Database, Radio, Laptop, Layers, Terminal } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";

export const ReliabilityTesting: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const testCategories = [
    { id: "all", name: "All Test Suites" },
    { id: "playback", name: "Playback & DSP" },
    { id: "queue", name: "Queue & Shuffle" },
    { id: "sync", name: "Party Sync & Jam" },
    { id: "crossdevice", name: "Cross-Device Specs" },
    { id: "storage", name: "Downloads & Offline" },
  ];

  const testSuites = [
    {
      category: "playback",
      name: "PrecisionAudioSinkTest.kt",
      suite: "Audio Pipeline",
      target: "Media3 DirectTrack audio sink zero-underrun verification",
    },
    {
      category: "playback",
      name: "FloatDspChainTest.kt",
      suite: "Audio DSP",
      target: "32-bit float equalizer bands, pre-amp clamping, and dynamic leveling",
    },
    {
      category: "sync",
      name: "party_test.go",
      suite: "Go Backend Hub",
      target: "Time-anchor drift calculations, monotonic clock assertions, and member token auth",
    },
    {
      category: "sync",
      name: "LocalJamHostServerTest.kt",
      suite: "Listen Together",
      target: "Local room creation, client join handshake, and heartbeat state reassertion",
    },
    {
      category: "queue",
      name: "PartyQueueMoveTest.kt",
      suite: "Queue Sync",
      target: "Deterministic resolution of concurrent queue delta operations across devices",
    },
    {
      category: "queue",
      name: "QueueShuffleTierTest.kt",
      suite: "Deterministic Queue",
      target: "Pseudo-random seed preservation across session restarts and handoffs",
    },
    {
      category: "storage",
      name: "OfflineDashTest.kt",
      suite: "Offline Engine",
      target: "Segmented media caching, atomic file writes, and corrupted stream recovery",
    },
    {
      category: "storage",
      name: "DownloadSessionTest.kt",
      suite: "Download Store",
      target: "Network state transitions (cellular vs Wi-Fi) and automatic download throttling",
    },
    {
      category: "crossdevice",
      name: "CD-001 Zero Autoplay",
      suite: "Cross-Device Spec",
      target: "Opening second device displays remote status without triggering audio playback",
    },
    {
      category: "crossdevice",
      name: "CD-002 Play Here Handoff",
      suite: "Cross-Device Spec",
      target: "Atomic lease transfer preserves playhead within 150ms drift tolerance",
    },
    {
      category: "crossdevice",
      name: "CD-008 Buffering Rollback",
      suite: "Cross-Device Spec",
      target: "8-second target buffer failure coordinator rolls back lease to source device",
    },
    {
      category: "sync",
      name: "WordSyncTest.kt",
      suite: "Lyrics Engine",
      target: "Sub-millisecond syllable interpolation and LRC time offset bounds checking",
    },
  ];

  const filteredTests =
    activeCategory === "all"
      ? testSuites
      : testSuites.filter((t) => t.category === activeCategory);

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#030509]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              Automated Test Suite &amp; Verification
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Built to survive real playback.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            Music playback apps fail under real conditions: phones enter battery doze mode,
            Bluetooth headphones disconnect, and cell towers drop WebSocket frames.
            RaagaX is backed by {RAAGAX_CONFIG.stats.unitTests}+ verified test suites and {RAAGAX_CONFIG.stats.acceptanceScenarios} formal cross-device acceptance specifications.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {testCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-all shrink-0 ${
                activeCategory === cat.id
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg"
                  : "bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Test Matrix Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => (
            <div
              key={test.name}
              className="p-5 rounded-2xl glass-panel border border-white/[0.08] hover:border-emerald-500/30 transition-all space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PASS
                </span>
                <span className="text-zinc-500">{test.suite}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white font-mono">{test.name}</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{test.target}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Representative Real-World Scenarios Box */}
        <div className="p-8 rounded-3xl glass-panel border border-white/[0.1] space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Representative Production Stress Scenarios</span>
            </h3>
            <span className="text-xs font-mono text-zinc-500">Zero Inverted State Guarantees</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-emerald-400 font-bold block">1. Remote Pause</span>
              <p className="text-zinc-400">Renderer receives and acknowledges pause state without rewinding playback buffer.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-emerald-400 font-bold block">2. Concurrent Queue Move</span>
              <p className="text-zinc-400">Multiple users reordering songs concurrently resolve deterministically against central epoch.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-emerald-400 font-bold block">3. Network Handover</span>
              <p className="text-zinc-400">Wi-Fi to LTE drop recovers via 45-second socket grace period without kicking user from party.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-emerald-400 font-bold block">4. Monotonic Clock Leap</span>
              <p className="text-zinc-400">Host OS NTP clock stepping does not perturb playback anchor or cause audio stutter.</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
