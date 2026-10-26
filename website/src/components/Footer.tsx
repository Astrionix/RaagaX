"use client";

import React from "react";
import Image from "next/image";
import { Globe, Heart, Shield, Terminal } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";

export const Footer: React.FC = () => {
  return (
    <footer className="relative border-t border-white/[0.08] bg-[#020306] text-zinc-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Brand Info (Left) */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-black/60 border border-white/20 p-1 shadow-[0_0_15px_rgba(239,68,68,0.3),inset_0_1px_1px_0_rgba(255,255,255,0.4)]">
                <Image
                  src="/app_icon.png"
                  alt="Raaga Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">
                {RAAGAX_CONFIG.appName}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full liquid-glass-pill text-zinc-200">
                {RAAGAX_CONFIG.versionName}
              </span>
            </div>

            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              <span className="text-white font-medium">Your Music. Without Limits.</span> An independent, bit-perfect music playback platform for Android and Desktop built around immersive listening, synchronized lyrics, lossless FLAC streams, and real-time audio engineering.
            </p>

            <div className="pt-2 text-xs font-mono text-zinc-500">
              Engineered by <strong className="text-zinc-300 font-semibold">{RAAGAX_CONFIG.authorName}</strong> ({RAAGAX_CONFIG.authorHandle})
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-mono text-white uppercase tracking-wider font-semibold">
              Project Navigation
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <a href="#top" className="hover:text-white transition-colors">Overview</a>
              </li>
              <li>
                <a href="#music-discovery" className="hover:text-white transition-colors">Music Catalog</a>
              </li>
              <li>
                <a href="#desktop" className="hover:text-white transition-colors">Desktop App</a>
              </li>
              <li>
                <a href="#download" className="hover:text-white transition-colors">Downloads</a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                >
                  <span>Web Player</span>
                  <span className="text-[10px] text-emerald-400/70">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* External & Distribution Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-mono text-white uppercase tracking-wider font-semibold">
              Distribution &amp; Downloads
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <a
                  href={RAAGAX_CONFIG.apkDownloadUrl}
                  download="raaga-v1.9.8-arm64-v8a.apk"
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Download APK ({RAAGAX_CONFIG.versionName})
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.tv.directApkUrl}
                  download
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Android TV APK ({RAAGAX_CONFIG.tv.version})
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.desktop.windows.setupExe}
                  className="hover:text-white transition-colors"
                >
                  Windows Setup (.exe)
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.desktop.macOS.arm64Dmg}
                  className="hover:text-white transition-colors"
                >
                  macOS Package (.dmg)
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.desktop.linux.appImage}
                  className="hover:text-white transition-colors"
                >
                  Linux Edition (.AppImage)
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>web.raaga.me (Web Player)</span>
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.liveDomainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>raaga.me</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Legal Notice & Third-Party Disclaimer */}
        <div className="pt-8 border-t border-white/[0.06] space-y-3 text-[11px] font-mono text-zinc-500 leading-relaxed">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Shield className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider">Independent Research &amp; Disclaimer Notice</span>
          </div>
          <p>
            Raaga is an independent, community-driven third-party audio player and client. It is <strong>not</strong> affiliated with, endorsed by, or connected to Google LLC, YouTube Music, Deezer, Apple Inc., Spotify AB, or Telegram in any way.
          </p>
          <p>
            Raaga does not host, upload, or store copyrighted music files. It operates strictly as an interface to scan local device storage or stream media directly from public-facing or user-authenticated APIs. Built under the GNU General Public License v3.0 (GPLv3).
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 text-zinc-600">
            <span>© 2026 Chandra Reddy ({RAAGAX_CONFIG.authorHandle}). All rights reserved.</span>
            <span>Raaga Architecture Portfolio • {RAAGAX_CONFIG.versionName} (Code {RAAGAX_CONFIG.versionCode})</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
