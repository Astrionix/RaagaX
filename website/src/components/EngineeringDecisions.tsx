"use client";

import React from "react";
import { Lightbulb, Clock, ListMusic, Radio, Cpu, Code2 } from "lucide-react";

export const EngineeringDecisions: React.FC = () => {
  const decisions = [
    {
      num: "01",
      icon: Clock,
      title: "Why server-time anchors?",
      summary: "Broadcasting 'play now' creates audible drift across heterogeneous mobile networks.",
      explanation:
        "If a server commands five phones to 'play now', a packet arriving 40ms late on Wi-Fi and 300ms late on mobile data causes them to start a quarter-second apart. Re-sending packets only compounds drift. By transmitting a fixed position anchored to an authoritative server timestamp, every device calculates playhead = positionMs + (serverNow - anchorMs) locally and converges autonomously.",
    },
    {
      num: "02",
      icon: ListMusic,
      title: "Why separate queue state?",
      summary: "Queue mutations are low-frequency events that must not bloat recurring heartbeats.",
      explanation:
        "Playback position and active playback state must be refreshed frequently (every 5 seconds) to heal packet drops and clock drift. However, playlist queues can contain hundreds of tracks. Sending the entire track array with every heartbeat would consume substantial cellular data. Decoupling queue state into delta mutations (Append, Remove, Move) preserves network bandwidth.",
    },
    {
      num: "03",
      icon: Radio,
      title: "Why WebSockets over HTTP polling?",
      summary: "Real-time party sessions require continuous sub-50ms bidirectional interactivity.",
      explanation:
        "HTTP polling introduces connection handshake overheads, HTTP header tax, and unpredictable polling latency. A single persistent WebSocket connection per device enables instantaneous host command dispatch (seek, pause, skip) and deterministic NTP-style ping/pong round-trip time sampling.",
    },
    {
      num: "04",
      icon: Cpu,
      title: "Why Android Media3 / ExoPlayer?",
      summary: "First-class integration with Android OS media sessions and hardware audio sinks.",
      explanation:
        "Media3 provides seamless background audio execution within a proper foreground service, lockscreen transport controls, Android Auto compatibility, and hardware volume key interception. Its customizable AudioSink architecture enables zero-gap crossfades and 32-bit floating-point DSP chaining directly before DAC output.",
    },
    {
      num: "05",
      icon: Code2,
      title: "Why native C++ for audio analysis?",
      summary: "Intensive Fourier transforms require deterministic memory and SIMD vectorization.",
      explanation:
        "Computing Short-Time Fourier Transforms (STFT), 128-band Mel spectrograms, and autocorrelation tempo detection across thousands of PCM audio frames generates intense heap allocation pressure in the JVM. Compiling optimized C++ algorithms via CMake and NDK executes within pre-allocated scratch buffers with ARM NEON SIMD vectorization without triggering garbage collection pauses.",
    },
  ];

  return (
    <section id="engineering" className="relative py-28 border-t border-white/[0.06] bg-[#04060a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">
              Architectural Rationale
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Decisions behind the experience.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            Every layer in RaagaX was deliberately chosen to solve a concrete engineering problem —
            prioritizing deterministic playback, cellular efficiency, and real-world audio fidelity.
          </p>
        </div>

        {/* 5 Editorial Deep-Dive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decisions.map((dec, i) => {
            const Icon = dec.icon;
            return (
              <div
                key={dec.num}
                className={`p-8 rounded-3xl glass-panel border border-white/[0.08] hover:border-white/[0.18] transition-all duration-300 flex flex-col justify-between space-y-6 ${
                  i === 0 ? "lg:col-span-2 bg-gradient-to-br from-red-950/20 via-black/40 to-black/60 border-red-500/20" : ""
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-500 font-bold tracking-widest">
                      DECISION {dec.num}
                    </span>
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                      <Icon className="w-4 h-4 text-amber-400" />
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {dec.title}
                  </h3>

                  <p className="text-sm font-semibold text-zinc-200">
                    {dec.summary}
                  </p>

                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {dec.explanation}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                  Verified in active production repository
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
