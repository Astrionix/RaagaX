"use client";

import React, { useState } from "react";
import { 
  Laptop, Smartphone, ArrowRight, CheckCircle2, 
  ShieldAlert, RefreshCw, FileText, ChevronRight, Lock
} from "lucide-react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const CrossDevice: React.FC = () => {
  const [handoffStep, setHandoffStep] = useState<number>(0);
  const [isHandoffRunning, setIsHandoffRunning] = useState(false);
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0);

  const handoffSteps = [
    { name: "PREPARE", desc: "Laptop loads audio URL into memory" },
    { name: "LOAD", desc: "MediaCodec pipeline pre-buffers track" },
    { name: "SEEK", desc: "Target seek position aligned to 02:31" },
    { name: "COMMIT", desc: "Server Lease RPC locks active renderer" },
    { name: "START", desc: "Laptop hardware AudioSink begins output" },
    { name: "ACK", desc: "Laptop broadcasts completion token to mesh" },
    { name: "TRANSFER", desc: "Phone relinquishes lease and pauses audio" },
  ];

  const triggerHandoff = () => {
    setIsHandoffRunning(true);
    setHandoffStep(0);
    const interval = setInterval(() => {
      setHandoffStep((prev) => {
        if (prev >= handoffSteps.length - 1) {
          clearInterval(interval);
          setIsHandoffRunning(false);
          return prev;
        }
        return prev + 1;
      });
    }, 450);
  };

  const sampleScenarios = [
    {
      id: "CD-001",
      title: "Phone plays, Laptop opens",
      outcome: "Laptop displays 'Playing on Phone' in paused state. Zero audio plays on laptop (Zero Autoplay Rule).",
    },
    {
      id: "CD-002",
      title: "Phone plays, Laptop taps 'Play Here'",
      outcome: "Laptop prepares audio, acquires lease, begins playback at current position. Phone relinquishes and pauses.",
    },
    {
      id: "CD-003",
      title: "Laptop playing, Phone taps Pause",
      outcome: "Remote PAUSE command dispatched → Laptop pauses → ACK broadcast → Phone UI updates synchronously.",
    },
    {
      id: "CD-008",
      title: "Target device buffering fails",
      outcome: "8-second timeout triggers rollback coordinator → Phone retains lease and audio continues uninterrupted.",
    },
    {
      id: "CD-011",
      title: "Simultaneous 'Play Here' on 2 devices",
      outcome: "Server serializes requests via atomic lease revision; exactly one lease committed; zero dual-playback.",
    },
    {
      id: "CD-026",
      title: "Bluetooth disconnect on active renderer",
      outcome: "Audio safely halts on active renderer; session pause state propagated across observer devices.",
    },
  ];

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#04060a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Cross-Device Playback Subsystem
            </span>
            <FeatureStatusBadge status="PLANNED / SPECIFICATION" size="sm" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Move the music, not the session.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            A comprehensive architectural specification and 30-scenario test harness
            governing multi-device session discovery, remote control, and atomic playback
            handoff without audio stutter or duplicate playback.
          </p>
        </div>

        {/* Interactive Handoff Flow Diagram */}
        <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>The 4-Phase Atomic Handoff Transaction</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Zero audio interruption • Fallback rollback timeout: 8s
              </p>
            </div>

            <button
              onClick={triggerHandoff}
              disabled={isHandoffRunning}
              className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isHandoffRunning ? "animate-spin" : ""}`} />
              <span>Simulate &ldquo;Play Here&rdquo; Handoff</span>
            </button>
          </div>

          {/* Device State Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Phone (Source) */}
            <div className={`p-6 rounded-2xl border transition-all ${
              handoffStep >= 6 
                ? "bg-white/[0.02] border-white/[0.08] opacity-60" 
                : "bg-red-500/10 border-red-500/30 shadow-lg"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-zinc-400">SOURCE DEVICE</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  handoffStep >= 6 ? "bg-zinc-800 text-zinc-400" : "bg-red-500/20 text-red-300 font-bold"
                }`}>
                  {handoffStep >= 6 ? "PAUSED (LEASE RELINQUISHED)" : "ACTIVE RENDERER (02:31)"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Smartphone className="w-8 h-8 text-red-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">Google Pixel 9 Pro</h4>
                  <p className="text-xs text-zinc-400 font-mono">Playing: Ethereal Echoes</p>
                </div>
              </div>
            </div>

            {/* Laptop (Target) */}
            <div className={`p-6 rounded-2xl border transition-all ${
              handoffStep >= 4 
                ? "bg-cyan-500/10 border-cyan-500/40 shadow-xl shadow-cyan-500/10" 
                : "bg-white/[0.02] border-white/[0.08]"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-zinc-400">TARGET DEVICE</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  handoffStep >= 4 ? "bg-cyan-500/20 text-cyan-300 font-bold" : "bg-zinc-800 text-zinc-400"
                }`}>
                  {handoffStep >= 4 ? "ACTIVE RENDERER (02:31)" : "IDLE CONTROLLER"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Laptop className="w-8 h-8 text-cyan-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">MacBook Pro M-Series</h4>
                  <p className="text-xs text-zinc-400 font-mono">Status: Ready to acquire lease</p>
                </div>
              </div>
            </div>

          </div>

          {/* Transaction Steps Progress */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase block">Transaction Step Sequence:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {handoffSteps.map((step, idx) => {
                const isActive = handoffStep === idx;
                const isPassed = handoffStep > idx;
                return (
                  <div
                    key={step.name}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isActive
                        ? "bg-cyan-500/20 border-cyan-400 text-white font-bold shadow-lg"
                        : isPassed
                        ? "bg-white/[0.04] border-white/[0.1] text-zinc-300"
                        : "bg-white/[0.01] border-white/[0.04] text-zinc-600"
                    }`}
                  >
                    <span className="block text-xs font-mono">{idx + 1}. {step.name}</span>
                    <span className="text-[9px] text-zinc-400 truncate block mt-0.5">{step.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master Architectural Hard Rules Callout */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Rule 1: Zero Autoplay on Device Open</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Rule 4: Single Active Audio Renderer</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Rule 8: Failed Handoff Rollback</span>
            </div>
          </div>
        </div>

        {/* 30 Acceptance Test Scenarios Matrix Explorer */}
        <div className="p-8 rounded-3xl glass-panel border border-white/[0.1] space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-400" />
              <h3 className="text-lg font-bold text-white">Cross-Device Acceptance Test Matrix</h3>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              30 Formally Specified Scenarios (CD-001 to CD-030)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {sampleScenarios.map((sc, idx) => (
              <div
                key={sc.id}
                onClick={() => setSelectedScenarioIdx(idx)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedScenarioIdx === idx
                    ? "bg-cyan-500/10 border-cyan-500/40 shadow-lg text-white"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="font-bold text-cyan-400">{sc.id}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-2">{sc.title}</h4>
                <p className="text-xs text-zinc-400 leading-relaxed font-mono">{sc.outcome}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
