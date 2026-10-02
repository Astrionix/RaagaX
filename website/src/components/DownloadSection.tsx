"use client";

import React from "react";
import { Download, ShieldCheck, ArrowRight } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "@/config/release";

export const DownloadSection: React.FC = () => {
  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#04060a] overflow-hidden">
      {/* Background Ambient Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] ambient-glow-crimson pointer-events-none opacity-50 blur-3xl -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
        
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <span>Ready for Sideloading</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Experience RaagaX.
          </h2>

          <p className="text-base sm:text-xl text-zinc-400 leading-relaxed">
            Download the Android build and explore the project for yourself.
            Engineered with modern Jetpack Compose, native C++ audio analysis, and sub-second Listen Together synchronization.
          </p>
        </div>

        {/* Big Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={RAAGAX_CONFIG.directApkUrl}
            download
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-9 py-4 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_35px_rgba(239,68,68,0.5)] hover:shadow-[0_0_50px_rgba(239,68,68,0.7)] active:scale-95 transition-all"
          >
            <Download className="w-5 h-5" />
            <span>Direct APK Download ({RAAGAX_CONFIG.versionName})</span>
          </a>

          <a
            href={RAAGAX_CONFIG.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-semibold text-zinc-300 hover:text-white glass-panel hover:bg-white/[0.08] transition-all"
          >
            <GithubIcon className="w-5 h-5" />
            <span>View Source on GitHub</span>
          </a>
        </div>

        {/* Technical Release Details Row */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Signed Release Build (Code {RAAGAX_CONFIG.versionCode})
          </span>
          <span>•</span>
          <span>Requires Android 8.0+ (Oreo, API 26+)</span>
          <span>•</span>
          <span>Size: {RAAGAX_CONFIG.fileSize}</span>
          <span>•</span>
          <span>NDK 27 / CMake 3.22</span>
        </div>

      </div>
    </section>
  );
};
