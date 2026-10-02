"use client";

import React, { useState } from "react";
import { Download, ExternalLink, CheckCircle2, ShieldCheck, Copy, Check } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "@/config/release";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

export const DownloadPanel: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyApkLink = () => {
    navigator.clipboard.writeText(RAAGAX_CONFIG.apkDownloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="download" className="relative py-16 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Glass Download Card */}
        <div className="relative rounded-3xl glass-panel p-8 sm:p-10 border border-white/[0.12] shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Subtle Ambient Crimson Corner Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            
            {/* Left Header & Details */}
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
                  Official Distribution
                </span>
                <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Try RaagaX
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                Download the latest Android build and experience the application yourself.
                Engineered with hardware-accelerated shaders, gapless playback, and native audio analysis.
              </p>

              {/* Technical Build Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="block text-[11px] text-zinc-500 font-mono">Latest Version</span>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-200">{RAAGAX_CONFIG.versionName}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="block text-[11px] text-zinc-500 font-mono">Android Version</span>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-200">8.0+ (API 26+)</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="block text-[11px] text-zinc-500 font-mono">Package Size</span>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-200">{RAAGAX_CONFIG.fileSize}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="block text-[11px] text-zinc-500 font-mono">Build Target</span>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-200">Android 15 (API 36)</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="block text-[11px] text-zinc-500 font-mono">NDK / C++ Toolchain</span>
                  <span className="text-xs sm:text-sm font-semibold text-zinc-200">NDK 27 / CMake</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="block text-[11px] text-zinc-500 font-mono">Binary Verification</span>
                  <span className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Signed Release
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Column */}
            <div className="flex flex-col gap-3 min-w-[260px]">
              {/* Primary APK Download Button */}
              <a
                href={RAAGAX_CONFIG.directApkUrl}
                download
                className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] active:scale-95 transition-all text-center"
              >
                <Download className="w-5 h-5" />
                <span>Direct Download APK ({RAAGAX_CONFIG.versionName})</span>
              </a>

              {/* Secondary: View Release */}
              <a
                href={RAAGAX_CONFIG.releaseNotesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
              >
                <span>View GitHub Release Notes</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Third: View Source */}
              <a
                href={RAAGAX_CONFIG.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-white/[0.03] border border-white/[0.06] transition-all"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>View Full Source Code</span>
              </a>

              {/* Direct Link Copy Button */}
              <button
                onClick={copyApkLink}
                className="inline-flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Link Copied to Clipboard" : "Copy Direct Download URL"}</span>
              </button>
            </div>

          </div>

          {/* Subdued Installation Notice */}
          <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-start gap-2.5 text-zinc-500 text-xs">
            <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-zinc-400 font-medium">Installation Note:</strong> Android may ask you to allow installation from your browser or file manager when installing an APK outside Google Play. The APK is cryptographically signed with the official project release key.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
