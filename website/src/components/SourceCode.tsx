"use client";

import React from "react";
import { ExternalLink, GitFork, Star, Code, Terminal, Layers } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "@/config/release";

export const SourceCode: React.FC = () => {
  return (
    <section className="relative py-24 border-t border-white/[0.06] bg-[#030509]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-semibold">
              Open Source Repository
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Everything starts with the code.
          </h2>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            Inspect the complete Kotlin, Go, and C++ source code. Built under the GNU General
            Public License v3.0, ensuring transparency, reproducibility, and freedom of research.
          </p>
        </div>

        {/* GitHub Repository Card */}
        <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-white/[0.1] shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white">
                <GithubIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                  <span>Astrionix</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-red-400">RaagaX</span>
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  Modern Android music streaming and playback platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">
                GPL-3.0 License
              </span>
            </div>
          </div>

          {/* Repo Description & Language Composition */}
          <div className="space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed font-sans">
              Contains the complete native Android Jetpack Compose client, ExoPlayer Media3 audio pipeline,
              Go WebSocket jam server, C++ spectral audio analysis routines, and CMake compilation scripts.
            </p>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="text-[11px] font-mono text-zinc-500 uppercase block">Language Composition:</span>
              <div className="flex items-center gap-1.5 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full w-[70%]" title="Kotlin" />
                <div className="bg-cyan-500 h-full w-[16%]" title="Go" />
                <div className="bg-amber-500 h-full w-[10%]" title="C++" />
                <div className="bg-blue-500 h-full w-[4%]" title="CMake / Gradle" />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400 pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Kotlin (Jetpack Compose)</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Go (WebSocket Party Hub)</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> C++ (STFT / Mel Analyzer)</span>
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={RAAGAX_CONFIG.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 transition-all"
            >
              <GithubIcon className="w-4 h-4" />
              <span>View Repository</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>

            <a
              href="#architecture"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all"
            >
              <Layers className="w-4 h-4 text-red-400" />
              <span>View Architecture</span>
            </a>

            <a
              href={RAAGAX_CONFIG.releaseNotesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all"
            >
              <span>View Releases</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          </div>

        </div>

      </div>
    </section>
  );
};
