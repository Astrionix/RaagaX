"use client";

import React, { useState } from "react";
import { ArrowDownToLine, ShieldCheck, Monitor, Layers, Tv } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";
import { AllApksModal } from "./AllApksModal";

export const DownloadSection: React.FC = () => {
  const [showAllApks, setShowAllApks] = useState(false);

  return (
    <>
      <AllApksModal isOpen={showAllApks} onClose={() => setShowAllApks(false)} />

      <section id="download" className="page-container mt-16 sm:mt-24 mb-20 sm:mb-28" aria-labelledby="closing-title">
        <div className="relative isolate overflow-hidden rounded-[28px] sm:rounded-[36px] md:rounded-[44px] liquid-glass px-4 sm:px-8 py-12 sm:py-16 md:py-20 text-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_1.5px_0_rgba(255,255,255,0.4)]">
          
          {/* Ambient Subtle Mesh Background */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div 
              className="mesh-blob absolute rounded-full" 
              style={{
                width: "600px",
                height: "600px",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(closest-side, rgba(239, 68, 68, 0.25) 0%, rgba(147, 51, 234, 0.15) 40%, rgba(0, 0, 0, 0) 100%)",
              }} 
            />
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            <h2 id="closing-title" className="text-[28px] xs:text-[32px] sm:text-[42px] md:text-[46px] font-extrabold tracking-tight text-white leading-tight">
              A modern music client with clean aesthetics inspired by Apple Music.
            </h2>
            <p className="text-[13.5px] sm:text-[15px] md:text-[16px] text-white/50 leading-relaxed px-2">
              Free, GPLv3 open source, bit-perfect lossless playback, no ads, and no telemetry. Fully responsive across Android smartphones, tablets, Android TV, Google TV, Windows, macOS, and Linux.
            </p>

            {/* Action Button Row */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <a
                href={RAAGAX_CONFIG.directApkUrl}
                download="raaga-v1.9.9-arm64-v8a.apk"
                aria-label="Download Raaga ARM64-v8a Mobile APK"
                className="btn-press group h-11 sm:h-12 w-full xs:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-white px-6 sm:px-7 text-[13.5px] sm:text-[14px] font-semibold text-black shadow-[0_0_28px_rgba(255,255,255,0.35),inset_0_1px_1px_0_rgba(255,255,255,0.9)] hover:bg-white/95 cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />
                <span>Download Mobile APK</span>
              </a>

              <a
                href={RAAGAX_CONFIG.tv.directApkUrl}
                download
                className="liquid-glass-pill group h-11 sm:h-12 w-full xs:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 sm:px-6 text-[13.5px] sm:text-[14px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                <Tv className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
                <span>Download Android TV APK</span>
              </a>

              <button
                onClick={() => setShowAllApks(true)}
                className="liquid-glass-pill h-11 sm:h-12 w-full xs:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 sm:px-6 text-[13.5px] sm:text-[14px] font-semibold text-white/95 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-red-400" />
                <span>All APK Architectures</span>
              </button>

              <a
                href="#desktop"
                className="liquid-glass-pill h-11 sm:h-12 w-full xs:w-auto inline-flex items-center justify-center gap-2 rounded-full px-5 text-[13.5px] sm:text-[14px] font-semibold text-white/90 cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-white/70" />
                <span>Desktop Downloads</span>
              </a>
            </div>

            {/* Specs Footer line */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-mono text-white/40">
              <span className="flex items-center gap-1.5 text-white/60">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Signed Release Build (v1.9.9)
              </span>
              <span>•</span>
              <span>Mobile, Tablet &amp; Desktop</span>
              <span>•</span>
              <span>100% Free &amp; Open Source</span>
            </div>

          </div>

        </div>
      </section>
    </>
  );
};
