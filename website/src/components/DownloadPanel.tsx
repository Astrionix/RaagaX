"use client";

import React, { useState } from "react";
import {
  Download,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Laptop,
  Terminal,
  Sparkles,
} from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "../config/release";
import { FeatureStatusBadge } from "./FeatureStatusBadge";

type TabKey = "android" | "windows" | "macos" | "linux";

export const DownloadPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("android");
  const [copied, setCopied] = useState(false);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="download" className="relative py-16 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Glass Download Card */}
        <div className="relative rounded-3xl glass-panel p-8 sm:p-10 border border-white/[0.12] shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Platform Tab Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold">
                  Official Distributions
                </span>
                <FeatureStatusBadge status="IMPLEMENTED" size="sm" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1">
                Download RaagaX
              </h2>
            </div>

            {/* Platform Selection Pills */}
            <div className="flex flex-wrap items-center gap-2 bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.06]">
              <button
                onClick={() => setActiveTab("android")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "android"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md scale-105"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android APK ({RAAGAX_CONFIG.versionName})</span>
              </button>

              <button
                onClick={() => setActiveTab("windows")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "windows"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md scale-105"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Windows ({RAAGAX_CONFIG.desktop.version})</span>
              </button>

              <button
                onClick={() => setActiveTab("macos")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "macos"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md scale-105"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>macOS</span>
              </button>

              <button
                onClick={() => setActiveTab("linux")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "linux"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md scale-105"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Linux</span>
              </button>
            </div>
          </div>

          {/* TAB 1: ANDROID APK (ORIGINAL UNTOUCHED CORE SPEC) */}
          {activeTab === "android" && (
            <div className="pt-8 flex flex-col md:flex-row md:items-start justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Mobile Client • Verified Production Build</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  RaagaX for Android
                </h3>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                  Download the latest Android build and experience the application yourself.
                  Engineered with hardware-accelerated shaders, gapless playback, native audio analysis, and Raaga Connect cross-device sync.
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

              {/* Action Column */}
              <div className="flex flex-col gap-3 min-w-[260px]">
                <a
                  href={RAAGAX_CONFIG.directApkUrl}
                  download
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] active:scale-95 transition-all text-center"
                >
                  <Download className="w-5 h-5" />
                  <span>Direct Download APK ({RAAGAX_CONFIG.versionName})</span>
                </a>

                <a
                  href={RAAGAX_CONFIG.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
                >
                  <span>View GitHub Release Notes</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={RAAGAX_CONFIG.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-white/[0.03] border border-white/[0.06] transition-all"
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  <span>View Full Source Code</span>
                </a>

                <button
                  onClick={() => copyLink(RAAGAX_CONFIG.apkDownloadUrl)}
                  className="inline-flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Link Copied to Clipboard" : "Copy Direct Download URL"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WINDOWS DESKTOP */}
          {activeTab === "windows" && (
            <div className="pt-8 flex flex-col md:flex-row md:items-start justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span>Desktop Edition • Windows 10 & 11 (64-bit)</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  RaagaX for Windows
                </h3>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                  Standalone desktop application powered by Compose Multiplatform and FFmpeg. Features Windows SMTC media keys, hardware audio decoding, and live background in-app OTA updates.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Desktop Version</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">{RAAGAX_CONFIG.desktop.version}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Architecture</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">x86_64 (64-bit)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Installer Size</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">{RAAGAX_CONFIG.desktop.windows.size}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Runtime</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">Embedded JRE 21</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Audio Engine</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">FFmpeg 7.1 Natives</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">OTA Updates</span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> In-App Auto Update
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[260px]">
                <a
                  href={RAAGAX_CONFIG.desktop.windows.setupExe}
                  download
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] active:scale-95 transition-all text-center"
                >
                  <Download className="w-5 h-5" />
                  <span>Download Installer (.exe)</span>
                </a>

                <a
                  href={RAAGAX_CONFIG.desktop.windows.portableZip}
                  download
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Portable (.zip)</span>
                </a>

                <a
                  href={RAAGAX_CONFIG.desktop.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-white/[0.03] border border-white/[0.06] transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View v1.9.4 Release on GitHub</span>
                </a>

                <button
                  onClick={() => copyLink(RAAGAX_CONFIG.desktop.windows.setupExe)}
                  className="inline-flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Link Copied to Clipboard" : "Copy Installer Link"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: macOS */}
          {activeTab === "macos" && (
            <div className="pt-8 flex flex-col md:flex-row md:items-start justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span>macOS Desktop • Apple Silicon & Intel</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  RaagaX for macOS
                </h3>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                  Smooth Metal-accelerated desktop player for macOS. Includes native system menu integration, CoreAudio playback, and Listen Together sync.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">macOS Target</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">macOS 12+</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Apple Silicon</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">Native ARM64</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Package Type</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">Standard .dmg</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Graphics API</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">Apple Metal</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Package Size</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">{RAAGAX_CONFIG.desktop.macOS.size}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Release Tag</span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-400">
                      {RAAGAX_CONFIG.desktop.version}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[260px]">
                <a
                  href={RAAGAX_CONFIG.desktop.macOS.arm64Dmg}
                  download
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] active:scale-95 transition-all text-center"
                >
                  <Download className="w-5 h-5" />
                  <span>Apple Silicon DMG (M1-M4)</span>
                </a>

                <a
                  href={RAAGAX_CONFIG.desktop.macOS.x64Dmg}
                  download
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Intel Mac DMG (x86_64)</span>
                </a>

                <a
                  href={RAAGAX_CONFIG.desktop.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-white/[0.03] border border-white/[0.06] transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View GitHub Release</span>
                </a>
              </div>
            </div>
          )}

          {/* TAB 4: LINUX */}
          {activeTab === "linux" && (
            <div className="pt-8 flex flex-col md:flex-row md:items-start justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span>Linux Desktop • Universal Distros</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  RaagaX for Linux
                </h3>
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                  Fully integrated Linux desktop edition with MPRIS D-Bus player controls, PipeWire / PulseAudio playback, and zero external dependency setup.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Compatibility</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">glibc 2.31+</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Architecture</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">x86_64 / amd64</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Media Control</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">MPRIS D-Bus</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Display Server</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">Wayland & X11</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Audio System</span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-200">PipeWire / Pulse</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="block text-[11px] text-zinc-500 font-mono">Release Tag</span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-400">
                      {RAAGAX_CONFIG.desktop.version}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[260px]">
                <a
                  href={RAAGAX_CONFIG.desktop.linux.appImage}
                  download
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] active:scale-95 transition-all text-center"
                >
                  <Download className="w-5 h-5" />
                  <span>Download AppImage</span>
                </a>

                <div className="flex gap-2">
                  <a
                    href={RAAGAX_CONFIG.desktop.linux.deb}
                    download
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Debian/Ubuntu (.deb)</span>
                  </a>
                  <a
                    href={RAAGAX_CONFIG.desktop.linux.rpm}
                    download
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Fedora (.rpm)</span>
                  </a>
                </div>

                <a
                  href={RAAGAX_CONFIG.desktop.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-white/[0.03] border border-white/[0.06] transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View GitHub Release</span>
                </a>
              </div>
            </div>
          )}

          {/* Subdued Installation Notice */}
          <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-start gap-2.5 text-zinc-500 text-xs">
            <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <p>
              {activeTab === "android" ? (
                <>
                  <strong className="text-zinc-400 font-medium">Installation Note:</strong> Android may ask you to allow installation from your browser or file manager when installing an APK outside Google Play. The APK is cryptographically signed with the official project release key.
                </>
              ) : activeTab === "windows" ? (
                <>
                  <strong className="text-zinc-400 font-medium">Windows Notice:</strong> If Windows Defender SmartScreen shows an unfamiliar publisher notice on newly published binaries, select &apos;More info&apos; → &apos;Run anyway&apos;. Built with Eclipse Adoptium JDK 21.
                </>
              ) : activeTab === "macos" ? (
                <>
                  <strong className="text-zinc-400 font-medium">macOS Notice:</strong> Open the DMG and drag RaagaX to Applications. If Gatekeeper prompts on first launch, right-click the app in Applications and select &apos;Open&apos;.
                </>
              ) : (
                <>
                  <strong className="text-zinc-400 font-medium">Linux Notice:</strong> For AppImage, run &apos;chmod +x Raaga-*.AppImage&apos; before running. Native DEB and RPM packages integrate directly into your desktop application menu.
                </>
              )}
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
