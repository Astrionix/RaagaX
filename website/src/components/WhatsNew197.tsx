"use client";

import React from "react";
import { 
  Volume2, 
  Monitor, 
  Sparkles, 
  Radio, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  Maximize2, 
  RefreshCw 
} from "lucide-react";
import { RAAGAX_CONFIG, V197_CHANGELOG } from "@/config/release";

export const WhatsNew197: React.FC = () => {
  return (
    <section className="relative py-20 border-t border-white/[0.08] bg-[#04060a]/90 overflow-hidden">
      {/* Background Ambient Ambient Orbs */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[350px] bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" style={{ animationDuration: "8s" }} />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[350px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-mono font-semibold">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span>LATEST RELEASE • VERSION 1.9.7</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              What&apos;s New in v1.9.7
            </h2>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Engineered with the new Liquid Glass Audio Output Sheet across both mobile &amp; desktop, 
              work area taskbar preservation, silent in-app OTA updates, and real-time live telemetry cleanup.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#download"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Get v1.9.7 Update</span>
            </a>
            <a
              href={RAAGAX_CONFIG.releaseNotesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 font-semibold text-xs border border-white/10 flex items-center gap-1.5 transition-colors"
            >
              <span>GitHub Tag</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 4 Core Highlight Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Liquid Glass Audio Output Sheet */}
          <div className="p-6 rounded-2xl glass-panel border border-red-500/30 hover:border-red-500/50 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none -z-10 group-hover:scale-150 transition-transform" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
                  <Volume2 className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold uppercase">
                  Liquid Glass
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors">
                Audio Output Sheet
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Frosted refractive liquid glass audio router accessible on both Home and expanded player. Route audio on-the-fly to Bluetooth, USB DACs, Speakers, and Headsets.
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Android &amp; Desktop</span>
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live</span>
            </div>
          </div>

          {/* Card 2: Windows Taskbar & macOS Dock Preservation */}
          <div className="p-6 rounded-2xl glass-panel border border-blue-500/30 hover:border-blue-500/50 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none -z-10 group-hover:scale-150 transition-transform" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  <Maximize2 className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold uppercase">
                  Desktop OS
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                Taskbar &amp; Dock Work Area
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Desktop window frames now preserve the Windows 10/11 taskbar and macOS Dock bounds, guaranteeing system taskbars are never blocked or obscured.
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Windows &amp; macOS</span>
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live</span>
            </div>
          </div>

          {/* Card 3: In-App Background Silent OTA Updates */}
          <div className="p-6 rounded-2xl glass-panel border border-emerald-500/30 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -z-10 group-hover:scale-150 transition-transform" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                  OTA Engine
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                Cross-Platform In-App Updates
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Background update verification for Android APKs, Windows (.exe setup &amp; zip), macOS DMG, and Linux (AppImage/deb/rpm) with seamless auto-relaunch.
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>All 4 Platforms</span>
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live</span>
            </div>
          </div>

          {/* Card 4: Real-time Telemetry & Stale Session Cleaning */}
          <div className="p-6 rounded-2xl glass-panel border border-purple-500/30 hover:border-purple-500/50 transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none -z-10 group-hover:scale-150 transition-transform" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
                  <Radio className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
                  Supabase Live
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">
                Real-Time Telemetry &amp; Pruning
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Graceful player lifecycle teardown on app exit prevents ghost sessions in Supabase. Admin dashboard prunes sessions older than 15m automatically.
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Live Telemetry Hub</span>
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live</span>
            </div>
          </div>
        </div>

        {/* Quick Platform Direct Download Strip */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-400">v1.9.7 Direct Downloads:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={RAAGAX_CONFIG.directApkUrl}
              download
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-xs font-mono font-medium border border-white/[0.08] transition-colors"
            >
              Android Universal APK
            </a>
            <a
              href={RAAGAX_CONFIG.desktop.windows.setupExe}
              download
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-xs font-mono font-medium border border-white/[0.08] transition-colors"
            >
              Windows Setup (.exe)
            </a>
            <a
              href={RAAGAX_CONFIG.desktop.macOS.arm64Dmg}
              download
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-xs font-mono font-medium border border-white/[0.08] transition-colors"
            >
              macOS Apple Silicon (.dmg)
            </a>
            <a
              href={RAAGAX_CONFIG.desktop.linux.appImage}
              download
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-xs font-mono font-medium border border-white/[0.08] transition-colors"
            >
              Linux AppImage
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
