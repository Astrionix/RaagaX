"use client";

import React, { useState } from "react";
import { 
  ArrowDownToLine, 
  Smartphone, 
  Monitor, 
  Cpu, 
  ShieldCheck, 
  X, 
  ExternalLink, 
  Layers, 
  Zap, 
  HardDrive,
  Tv
} from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";

interface AllApksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AllApksModal: React.FC<AllApksModalProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState<"all" | "android" | "tv" | "desktop">("all");

  if (!isOpen) return null;

  const androidBuilds = [
    {
      name: "Android ARM64-v8a APK",
      recommended: true,
      tag: "Modern 64-bit Phones (Recommended · v8a)",
      arch: "arm64-v8a (NDK 27 NEON SIMD)",
      size: "60.8 MB",
      url: "/apks/raaga-arm64-v8a.apk",
      requirements: "Android 8.0+ (64-bit v8a)",
      desc: "Optimized package tailored exclusively for 64-bit devices. Maximum audio DSP efficiency and smaller footprint.",
      icon: <Zap className="w-5 h-5 text-amber-400" />
    },
    {
      name: "Android Universal APK",
      recommended: false,
      tag: "All Architectures Bundle",
      arch: "universal (arm64, armeabi-v7a, x86_64)",
      size: "155 MB",
      url: "/apks/raaga-universal.apk",
      requirements: RAAGAX_CONFIG.minAndroid,
      desc: "Single package that runs natively on all Android smartphones, tablets, TV boxes, and car head units.",
      icon: <Smartphone className="w-5 h-5 text-red-400" />
    },
    {
      name: "Android armeabi-v7a APK",
      recommended: false,
      tag: "Legacy 32-bit Devices",
      arch: "armeabi-v7a (32-bit)",
      size: "51.6 MB",
      url: "/apks/raaga-armeabi-v7a.apk",
      requirements: "Android 8.0+ (32-bit legacy)",
      desc: "Compatible build for older budget smartphones and legacy in-dash car infotainment heads.",
      icon: <Cpu className="w-5 h-5 text-cyan-400" />
    },
    {
      name: "Android x86_64 APK",
      recommended: false,
      tag: "Chromebooks, WSA & Emulators",
      arch: "x86_64 (64-bit Intel/AMD)",
      size: "66.9 MB",
      url: "/apks/raaga-x86_64.apk",
      requirements: "Android 8.0+ (Intel/AMD)",
      desc: "Optimized build for ChromeOS Chromebooks, Windows Subsystem for Android, and Android emulators.",
      icon: <Monitor className="w-5 h-5 text-purple-400" />
    }
  ];

  const tvBuilds = [
    {
      name: "Android TV Universal APK",
      recommended: true,
      tag: "All Android TV & Google TV (Recommended)",
      arch: "universal (arm64, armeabi-v7a, x86_64)",
      size: "176.5 MB",
      url: RAAGAX_CONFIG.tv.universalApkUrl,
      requirements: RAAGAX_CONFIG.tv.minAndroid,
      desc: "Native Leanback UI optimized for 10-foot living room experience, full D-pad remote navigation, and immersive TV lyrics.",
      icon: <Tv className="w-5 h-5 text-red-400" />
    },
    {
      name: "Android TV ARM64-v8a APK",
      recommended: false,
      tag: "Modern Smart TVs & Nvidia Shield",
      arch: "arm64-v8a (64-bit TV)",
      size: "87.4 MB",
      url: RAAGAX_CONFIG.tv.arm64ApkUrl,
      requirements: "Android TV 8.0+ (64-bit)",
      desc: "Tuned for 64-bit TV chipsets like Nvidia Shield TV, Sony Bravia Google TV, and high-end streaming boxes.",
      icon: <Zap className="w-5 h-5 text-amber-400" />
    },
    {
      name: "Android TV armeabi-v7a APK",
      recommended: false,
      tag: "Amazon Fire TV Stick & 32-bit TV Boxes",
      arch: "armeabi-v7a (32-bit TV)",
      size: "78.9 MB",
      url: RAAGAX_CONFIG.tv.armeabiV7aApkUrl,
      requirements: "Fire OS 6+ / Android TV (32-bit)",
      desc: "High compatibility build for Fire TV Stick 4K, Fire TV Cube, Mi Box, and realme TV sticks.",
      icon: <Cpu className="w-5 h-5 text-cyan-400" />
    },
    {
      name: "Android TV x86_64 APK",
      recommended: false,
      tag: "Intel/AMD TV Emulators & HTPC",
      arch: "x86_64 (64-bit Intel/AMD)",
      size: "93.1 MB",
      url: RAAGAX_CONFIG.tv.x86_64ApkUrl,
      requirements: "Android TV x86_64",
      desc: "Optimized for Android TV x86_64 emulators, ChromeOS boxes, and living room mini PCs.",
      icon: <Monitor className="w-5 h-5 text-purple-400" />
    }
  ];

  const desktopBuilds = [
    {
      name: "Windows Setup (.exe)",
      tag: "Windows 10 / 11 (Installer)",
      arch: "x64 / 64-bit",
      size: RAAGAX_CONFIG.desktop.windows.size,
      url: RAAGAX_CONFIG.desktop.windows.setupExe,
      requirements: "Windows 10 / 11 64-bit",
      desc: "Standard installer with automatic start menu integration and desktop shortcuts.",
      icon: <Monitor className="w-5 h-5 text-blue-400" />
    },
    {
      name: "Windows Portable (.zip)",
      tag: "Windows Standalone (No Admin)",
      arch: "x64 Portable",
      size: "~290 MB",
      url: RAAGAX_CONFIG.desktop.windows.portableZip,
      requirements: "Windows 10 / 11 64-bit",
      desc: "Extract and run anywhere from a USB drive or local folder without installation.",
      icon: <HardDrive className="w-5 h-5 text-cyan-400" />
    },
    {
      name: "macOS Apple Silicon (.dmg)",
      tag: "macOS M1 / M2 / M3 / M4",
      arch: "arm64 native",
      size: RAAGAX_CONFIG.desktop.macOS.size,
      url: RAAGAX_CONFIG.desktop.macOS.arm64Dmg,
      requirements: "macOS 12 Monterey or newer",
      desc: "Native Apple Silicon build tuned for high efficiency on M-series chips.",
      icon: <Monitor className="w-5 h-5 text-pink-400" />
    },
    {
      name: "macOS Intel (.dmg)",
      tag: "macOS Intel 64-bit",
      arch: "x86_64",
      size: "~185 MB",
      url: RAAGAX_CONFIG.desktop.macOS.x64Dmg,
      requirements: "macOS 12 Monterey or newer",
      desc: "Optimized for older Intel-based MacBook Pro, iMac, and Mac mini computers.",
      icon: <Monitor className="w-5 h-5 text-purple-400" />
    },
    {
      name: "Linux AppImage",
      tag: "All Linux Distributions",
      arch: "x86_64 AppImage",
      size: RAAGAX_CONFIG.desktop.linux.size,
      url: RAAGAX_CONFIG.desktop.linux.appImage,
      requirements: "glibc 2.31+ (Ubuntu, Fedora, Arch, etc.)",
      desc: "Universal Linux executable. Just make executable (`chmod +x`) and launch directly.",
      icon: <Layers className="w-5 h-5 text-emerald-400" />
    },
    {
      name: "Linux DEB & RPM Packages",
      tag: "Debian, Ubuntu, Fedora",
      arch: ".deb & .rpm",
      size: "~150 MB",
      url: RAAGAX_CONFIG.desktop.linux.deb,
      requirements: "Debian/Ubuntu/Fedora",
      desc: "Native system packages for apt / dnf package manager installation.",
      icon: <Layers className="w-5 h-5 text-teal-400" />
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200">
      
      {/* Outer Modal Container */}
      <div className="liquid-glass-modal animate-modal-enter relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-8 text-left">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-[inset_0_1px_1px_0_rgba(239,68,68,0.3)]">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                All Raaga Downloads &amp; Packages
              </h3>
              <p className="text-xs text-white/50 font-mono">
                Version {RAAGAX_CONFIG.versionName} • Free &amp; Open Source (GPLv3)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="liquid-glass-pill w-9 h-9 rounded-full text-white flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="mt-5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: "all", label: "All Packages" },
            { id: "android", label: "Android Mobile APKs" },
            { id: "tv", label: "Android TV / Google TV" },
            { id: "desktop", label: "Desktop (Win, Mac, Linux)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`liquid-glass-pill px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer ${
                filter === tab.id
                  ? "bg-white text-black font-semibold shadow-[0_2px_12px_rgba(255,255,255,0.3)]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SECTION: ANDROID TV BUILDS */}
        {(filter === "all" || filter === "tv") && (
          <div className="mt-6 space-y-3">
            <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Tv className="w-3.5 h-3.5" />
              <span>Android TV &amp; Google TV APKs (Leanback 10-ft UI)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tvBuilds.map((build, i) => (
                <div
                  key={i}
                  className={`liquid-glass-card relative p-4 rounded-2xl ${
                    build.recommended
                      ? "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.18)]"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/[0.08]">
                        {build.icon}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{build.name}</span>
                          {build.recommended && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500 text-black font-bold">
                              RECOMMENDED FOR TV
                            </span>
                          )}
                        </h5>
                        <p className="text-[11px] font-mono text-white/50">{build.size} • {build.arch}</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-white/60 leading-relaxed">
                    {build.desc}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40">{build.requirements}</span>
                    <a
                      href={build.url}
                      download
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        build.recommended
                          ? "bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-md active:scale-95"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      }`}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download TV APK</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: ANDROID BUILDS */}
        {(filter === "all" || filter === "android") && (
          <div className="mt-6 space-y-3">
            <h4 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Smartphone &amp; Tablet APKs</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {androidBuilds.map((build, i) => (
                <div
                  key={i}
                  className={`liquid-glass-card relative p-4 rounded-2xl ${
                    build.recommended
                      ? "border-red-500/40 shadow-[0_0_24px_rgba(239,68,68,0.18)]"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/[0.08]">
                        {build.icon}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{build.name}</span>
                          {build.recommended && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">
                              RECOMMENDED
                            </span>
                          )}
                        </h5>
                        <p className="text-[11px] font-mono text-white/50">{build.size} • {build.arch}</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-white/60 leading-relaxed">
                    {build.desc}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40">{build.requirements}</span>
                    <a
                      href={build.url}
                      download
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        build.recommended
                          ? "bg-red-600 hover:bg-red-500 text-white shadow-md active:scale-95"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      }`}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download APK</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION: DESKTOP BUILDS */}
        {(filter === "all" || filter === "desktop") && (
          <div className="mt-8 space-y-3">
            <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop Applications (Compose Multiplatform)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {desktopBuilds.map((build, i) => (
                <div
                  key={i}
                  className="liquid-glass-card p-4 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/[0.08]">
                        {build.icon}
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-white">{build.name}</h5>
                        <p className="text-[11px] font-mono text-white/50">{build.size} • {build.arch}</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-white/60 leading-relaxed">
                    {build.desc}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40">{build.requirements}</span>
                    <a
                      href={build.url}
                      download
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Security & Checksum Banner */}
        <div className="mt-8 p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/50 font-mono">
          <div className="flex items-center gap-2 text-white/80">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Cryptographically signed release builds • Zero trackers • Exodus verified</span>
          </div>
          <a
            href={RAAGAX_CONFIG.releaseNotesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Official Release Notes &amp; SHA-256</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>

    </div>
  );
};
