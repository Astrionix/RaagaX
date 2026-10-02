"use client";

import React, { useState } from "react";
import { Code2, Binary, Cpu, ArrowRight, Check, Activity, Sliders } from "lucide-react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import { RAAGAX_CONFIG } from "@/config/release";

export const NativeAudio: React.FC = () => {
  const [activeStep, setActiveStep] = useState(2); // Mel Spectrogram

  const pipelineStages = [
    {
      id: 0,
      title: "Audio Ingestion",
      file: "resampler.cpp",
      desc: "Interleaved 16/24-bit PCM buffer extraction and conversion into linear floating-point arrays.",
    },
    {
      id: 1,
      title: "Resampling",
      file: "resampler.cpp",
      desc: "Band-limited Sinc/linear resampler normalizing audio rates to standard 22,050Hz or 44,100Hz analysis targets.",
    },
    {
      id: 2,
      title: "Spectral Analysis",
      file: "audio_analysis.cpp",
      desc: "Short-Time Fourier Transform (STFT) with Hanning windowing generating frequency bin energy tensors.",
    },
    {
      id: 3,
      title: "Mel Spectrogram",
      file: "mel_spectrogram.cpp",
      desc: "Logarithmic triangular filter bank projection mapping raw Hz bins into 128 psychoacoustic Mel bands.",
    },
    {
      id: 4,
      title: "Tempo Analysis",
      file: "tempo_analysis.cpp",
      desc: "Onset envelope calculation and autocorrelation lag peaks resolving track BPM and beat alignment grids.",
    },
    {
      id: 5,
      title: "Vocal Spectrogram",
      file: "vocal_spectrogram.cpp",
      desc: "Harmonic/percussive separation and mid-frequency isolation providing energy masks for lyric alignment.",
    },
  ];

  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#04060a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Native C++ Audio Engineering
            </span>
            <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Where Kotlin meets native audio.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            For computationally heavy audio analysis tasks such as beat tracking,
            spectral extraction, and tempo discovery, RaagaX bypasses JVM garbage collection
            overheads by compiling optimized C++ routines directly through CMake and Android NDK.
          </p>
        </div>

        {/* Visual Pipeline Interactive Flow */}
        <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Binary className="w-5 h-5 text-cyan-400" />
                <span>6-Stage Native C++ Audio Analysis Pipeline</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Compiled via Android NDK {RAAGAX_CONFIG.ndkVersion} • CMake {RAAGAX_CONFIG.cmakeVersion}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>native/analyzer/</span>
            </div>
          </div>

          {/* Pipeline Stages Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {pipelineStages.map((stage, idx) => (
              <button
                key={stage.id}
                onClick={() => setActiveStep(idx)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  activeStep === idx
                    ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span className="text-[10px] font-mono text-cyan-400 block mb-1">
                  STAGE 0{idx + 1}
                </span>
                <span className="text-xs font-bold block truncate text-white">{stage.title}</span>
                <span className="text-[10px] font-mono text-zinc-500 block truncate mt-1">{stage.file}</span>
              </button>
            ))}
          </div>

          {/* Active Stage Inspector Details */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold uppercase tracking-wider">
                Stage {activeStep + 1}: {pipelineStages[activeStep].title}
              </span>
              <span className="text-zinc-500">Source: native/analyzer/{pipelineStages[activeStep].file}</span>
            </div>
            <p className="text-sm text-zinc-300 font-sans leading-relaxed">
              {pipelineStages[activeStep].desc}
            </p>
          </div>

          {/* NDK / CMake Verification Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-xs font-bold text-white block">Zero Garbage Collection</span>
              <span className="text-[11px] text-zinc-400">Fixed-size scratch buffers allocated during song load</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-xs font-bold text-white block">SIMD &amp; Vectorization</span>
              <span className="text-[11px] text-zinc-400">Targeting ARM NEON registers on arm64-v8a devices</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-xs font-bold text-white block">JNI Bridge Boundary</span>
              <span className="text-[11px] text-zinc-400">Strict JNI boundary passing direct NIO ByteBuffers</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
