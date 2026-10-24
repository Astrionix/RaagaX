"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Cpu, Share2, Layers, CheckCircle2, Terminal, Code2, ArrowUpRight, Sparkles } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";

export const EngineeringBento: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"cpp" | "go" | "shaders" | "tests">("cpp");

  return (
    <section id="engineering" className="page-container mt-16 sm:mt-24" aria-labelledby="engineering-specs-title">
      
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs font-mono text-white/70 mb-3">
          <Terminal className="w-3.5 h-3.5 text-red-400" />
          <span>Full-Stack Engineering Deep-Dive</span>
        </div>
        <h2 id="engineering-specs-title" className="text-[26px] sm:text-[34px] font-bold text-white tracking-tight">
          Under the Interface: Engineered Beyond the Surface.
        </h2>
        <p className="mt-2 text-[14px] sm:text-[15px] leading-relaxed text-white/50 text-balance">
          Raaga is not just a UI skin. It is powered by high-performance C++ NDK audio signal processing, a concurrent Go WebSocket Jam Hub, and custom GPU shaders.
        </p>

        {/* Tab Buttons */}
        <div className="mt-8 inline-flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/10 max-w-full overflow-x-auto no-scrollbar">
          {[
            { id: "cpp", label: "C++ Audio DSP", icon: <Cpu className="w-3.5 h-3.5" /> },
            { id: "go", label: "Go Jam Hub (WebSocket)", icon: <Share2 className="w-3.5 h-3.5" /> },
            { id: "shaders", label: "Liquid Glass GPU Shaders", icon: <Layers className="w-3.5 h-3.5" /> },
            { id: "tests", label: "Test Suite (84 Tests)", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white/15 text-white shadow-sm border border-white/20"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bento Grid Presentation */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 max-w-5xl mx-auto">
        
        {/* TAB 1: C++ NDK OBOE AUDIO DSP */}
        {activeTab === "cpp" && (
          <>
            {/* Primary Bento Card */}
            <div className="md:col-span-8 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-mono">
                    NDK {RAAGAX_CONFIG.ndkVersion} • CMake {RAAGAX_CONFIG.cmakeVersion}
                  </span>
                  <span className="text-xs font-mono text-white/40">Sub-5ms Latency</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Bit-Perfect Oboe Audio &amp; DSD Decimator
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Native C++ audio pipeline bypassing Android OpenSL ES limitations. Implements high-order FIR decimation filtering for direct stream digital (DSD) to PCM conversion with zero clipping, dynamic sample rate matching, and 24-bit studio depth.
                </p>

                {/* Code Snippet Box */}
                <div className="mt-5 rounded-2xl bg-black/60 p-4 border border-white/10 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <p className="text-white/40">// jni.cpp - Real-time PCM decimation &amp; Oboe stream</p>
                  <p className="text-red-400">oboe::AudioStreamBuilder <span className="text-white">builder;</span></p>
                  <p className="text-white">builder.<span className="text-cyan-400">setPerformanceMode</span>(oboe::PerformanceMode::LowLatency)</p>
                  <p className="text-white">       .<span className="text-cyan-400">setSharingMode</span>(oboe::SharingMode::Exclusive)</p>
                  <p className="text-white">       .<span className="text-cyan-400">setFormat</span>(oboe::AudioFormat::Float);</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
                <span>Output: AAudio / Oboe Exclusive</span>
                <span className="text-emerald-400">Status: Bit-Perfect</span>
              </div>
            </div>

            {/* Side Metric Card */}
            <div className="md:col-span-4 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Spectral Analysis
                </h4>
                <div className="text-4xl font-extrabold text-white">4.2ms</div>
                <p className="text-xs text-white/50 mt-1">Total audio buffer round-trip latency</p>

                <div className="mt-5 space-y-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                    <p className="font-semibold text-white">Direct Stream Digital</p>
                    <p className="text-[11px] text-white/50">DSD64 / DSD128 decimation &amp; 32-bit depth</p>
                  </div>
                </div>

                {/* Real Hardware Screen Capture of Lossless DSP Settings */}
                <div className="mt-4 rounded-2xl overflow-hidden border border-white/15 bg-black/60 relative h-48 group shadow-inner">
                  <Image
                    src="/images/mobile/mobile_screen_settings_full.png"
                    alt="Real Lossless DSP & Bitrate Governors on Hardware"
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-2 right-2 text-[10px] font-mono text-zinc-300 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center justify-between">
                    <span>Lossless DSP Quality</span>
                    <span className="text-emerald-400 font-bold">24-bit FLAC</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 text-xs text-white/40 font-mono flex items-center justify-between">
                <span>Engineered in Android NDK</span>
                <span className="text-red-400">CMake 3.22.1</span>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: GO JAM HUB WEBSOCKET SERVER */}
        {activeTab === "go" && (
          <>
            <div className="md:col-span-8 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                    Go 1.23 • Gorilla WebSocket • Concurrent Hub
                  </span>
                  <span className="text-xs font-mono text-white/40">Zero Drift Sync</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Go Jam Hub: Real-Time Listening Parties
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Dedicated distributed server running in Go. Synchronizes play, pause, seek, and track queue across unlimited peers with sub-20ms NTP-aligned time offsets. Handles client heartbeats and auto-prunes stale ghost sessions gracefully.
                </p>

                <div className="mt-5 rounded-2xl bg-black/60 p-4 border border-white/10 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <p className="text-white/40">// hub.go - Event loop broadcasting synchronized playback</p>
                  <p className="text-emerald-400">type <span className="text-white">BroadcastMessage</span> struct &#123;</p>
                  <p className="text-white">    TrackId   <span className="text-cyan-400">string</span> `json:"track_id"`</p>
                  <p className="text-white">    OffsetMs  <span className="text-cyan-400">int64</span>  `json:"offset_ms"`</p>
                  <p className="text-white">    ServerNtp <span className="text-cyan-400">int64</span>  `json:"server_ntp"`</p>
                  <p className="text-white">&#125;</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
                <span>Protocol: Binary WebSocket + JSON</span>
                <span className="text-emerald-400">Up to 32 Listeners/Room</span>
              </div>
            </div>

            <div className="md:col-span-4 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Sync Accuracy
                </h4>
                <div className="text-4xl font-extrabold text-white">&lt;15ms</div>
                <p className="text-xs text-white/50 mt-1">Cross-device playback offset tolerance</p>

                <div className="mt-6 space-y-3">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                    <p className="font-semibold text-white">Dynamic Session Pruning</p>
                    <p className="text-[11px] text-white/50">Stale rooms auto-garbage collected</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                    <p className="font-semibold text-white">Low Memory Footprint</p>
                    <p className="text-[11px] text-white/50">&lt;18MB RAM under 500 connections</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40 font-mono">
                Goroutines &amp; Channels
              </div>
            </div>
          </>
        )}

        {/* TAB 3: LIQUID GLASS GPU SHADERS */}
        {activeTab === "shaders" && (
          <>
            <div className="md:col-span-8 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-mono">
                    AGSL • Skia • RenderEffect GPU Haze
                  </span>
                  <span className="text-xs font-mono text-white/40">120 FPS Fluidity</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Liquid Glass: Real-Time Refraction &amp; Saturation
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Custom Android Graphics Shading Language (AGSL) pipeline on Android 13+ (API 33+). Simulates light refraction through curved optical surfaces with dynamic chromatic dispersion, real-time specular highlights, and color boosting.
                </p>

                <div className="mt-5 rounded-2xl bg-black/60 p-4 border border-white/10 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <p className="text-white/40">// LiquidGlass.agsl - GPU Fragment Shader</p>
                  <p className="text-purple-400">half4 <span className="text-white">main(float2 coord) &#123;</span></p>
                  <p className="text-white">    float2 distorted = coord + <span className="text-cyan-400">refractVector</span>(coord, 1.45);</p>
                  <p className="text-white">    half4 color = <span className="text-pink-400">content</span>.eval(distorted);</p>
                  <p className="text-white">    return <span className="text-cyan-400">saturateHighlight</span>(color, 1.8);</p>
                  <p className="text-white">&#125;</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
                <span>Hardware Accelerated: Vulkan / OpenGL ES 3.2</span>
                <span className="text-emerald-400">Zero CPU Overhead</span>
              </div>
            </div>

            <div className="md:col-span-4 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Rendering Performance
                </h4>
                <div className="text-4xl font-extrabold text-white">120 Hz</div>
                <p className="text-xs text-white/50 mt-1">Locked refresh rate on high-end AMOLEDs</p>

                <div className="mt-5 space-y-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                    <p className="font-semibold text-white">Dynamic Saturation</p>
                    <p className="text-[11px] text-white/50">180% color boost under frosted glass</p>
                  </div>
                </div>

                {/* Real Hardware Screen Capture of Liquid Glass AGSL Shaders */}
                <div className="mt-4 rounded-2xl overflow-hidden border border-purple-500/20 bg-black/60 relative h-48 group shadow-inner">
                  <Image
                    src="/images/mobile/mobile_settings_liquid_glass.png"
                    alt="Real Liquid Glass AGSL Shader on Hardware"
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-2 right-2 text-[10px] font-mono text-purple-200 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-purple-500/30 flex items-center justify-between">
                    <span>AGSL Liquid Glass</span>
                    <span className="text-purple-400 font-bold">120 FPS</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 text-xs text-white/40 font-mono flex items-center justify-between">
                <span>Compose graphicsLayer</span>
                <span className="text-purple-400">Android 13+</span>
              </div>
            </div>
          </>
        )}

        {/* TAB 4: RELIABILITY & TEST MATRIX */}
        {activeTab === "tests" && (
          <>
            <div className="md:col-span-8 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-mono">
                    CI / CD Verified • R8 ProGuard Minified
                  </span>
                  <span className="text-xs font-mono text-emerald-400">100% Passing</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  84 Automated Unit Tests &amp; 30 Acceptance Scenarios
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Rigorous test matrix ensuring rock-solid playback stability. Covers Media3 background service lifecycle, intermittent network dropouts, audio focus changes during incoming phone calls, and OTA update verifications.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-white/80">ExoPlayer Queue Management (24 tests)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-white/80">Audio Output Device Switching (18 tests)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-white/80">WebSocket Reconnection &amp; Jitter (22 tests)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-white/80">C++ Buffer Overflow Guard (20 tests)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
                <span>JUnit 5 • Mockk • Turbine • Robolectric</span>
                <span className="text-emerald-400">All 84 Passing</span>
              </div>
            </div>

            <div className="md:col-span-4 rounded-3xl bg-[#0c0d12] p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Total Test Coverage
                </h4>
                <div className="text-4xl font-extrabold text-white">84 / 84</div>
                <p className="text-xs text-white/50 mt-1">Passing with zero flaky assertions</p>

                <div className="mt-6 space-y-3">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                    <p className="font-semibold text-white">APK File Size</p>
                    <p className="text-[11px] text-white/50">{RAAGAX_CONFIG.fileSize} (R8 minified + NDK stripped)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
                    <p className="font-semibold text-white">Zero Trackers</p>
                    <p className="text-[11px] text-white/50">Verified clean by Exodus Privacy</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40 font-mono">
                GNU General Public License v3.0
              </div>
            </div>
          </>
        )}

      </div>

    </section>
  );
};
