"use client";

import React from "react";
import Image from "next/image";
import { Globe, Heart, Shield, Terminal } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "@/config/release";

export const Footer: React.FC = () => {
  return (
    <footer className="relative border-t border-white/[0.08] bg-[#020306] text-zinc-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Brand Info (Left) */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-red-600 to-purple-600">
                <Image
                  src="/app_icon.png"
                  alt="RaagaX Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover rounded-[10px]"
                />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">
                {RAAGAX_CONFIG.appName}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300">
                {RAAGAX_CONFIG.versionName}
              </span>
            </div>

            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              An independent Android music experience built around immersive playback,
              high-quality audio, synchronized lyrics, offline listening, real-time listening
              sessions, and cross-device control.
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
                <a href="#overview" className="hover:text-white transition-colors">Overview</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">Playback Features</a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-white transition-colors">System Architecture</a>
              </li>
              <li>
                <a href="#listen-together" className="hover:text-white transition-colors">Listen Together Engine</a>
              </li>
              <li>
                <a href="#engineering" className="hover:text-white transition-colors">Engineering Decisions</a>
              </li>
              <li>
                <a href="#screens" className="hover:text-white transition-colors">Screen Gallery</a>
              </li>
            </ul>
          </div>

          {/* External & Distribution Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-mono text-white uppercase tracking-wider font-semibold">
              Distribution &amp; Code
            </h4>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <a
                  href={RAAGAX_CONFIG.apkDownloadUrl}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Download APK ({RAAGAX_CONFIG.versionName})
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub Releases
                </a>
              </li>
              <li>
                <a
                  href={RAAGAX_CONFIG.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <GithubIcon className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
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
            RaagaX is an independent, community-driven third-party audio player and client. It is <strong>not</strong> affiliated with, endorsed by, or connected to Google LLC, YouTube Music, Deezer, Apple Inc., Spotify AB, or Telegram in any way.
          </p>
          <p>
            RaagaX does not host, upload, or store copyrighted music files. It operates strictly as an interface to scan local device storage or stream media directly from public-facing or user-authenticated APIs. Built under the GNU General Public License v3.0 (GPLv3).
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 text-zinc-600">
            <span>© 2026 Chandra Reddy ({RAAGAX_CONFIG.authorHandle}). All rights reserved.</span>
            <span>RaagaX Architecture Portfolio • {RAAGAX_CONFIG.versionName} (Code {RAAGAX_CONFIG.versionCode})</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
