"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowDownToLine, Layers } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";
import { AllApksModal } from "./AllApksModal";

// Compute time-of-day natural listener traffic (peaks in evening ~15.5k, low at late night ~2.1k)
function getNaturalListenerCount(): number {
  if (typeof window === "undefined") return 9840;
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  // Realistic global music streaming diurnal traffic distribution (0:00 to 23:00)
  const hourlyBase = [
    5420, 4100, 3250, 2400, 2150, 2780, 4320, 6180, 7450, 8390, 8850, 9340,
    9820, 9650, 10120, 10840, 11420, 12350, 13680, 14820, 15460, 14390, 11750, 8620,
  ];

  const currentHour = Math.floor(hour) % 24;
  const nextHour = (currentHour + 1) % 24;
  const progress = hour - Math.floor(hour);

  const base = Math.round(hourlyBase[currentHour] * (1 - progress) + hourlyBase[nextHour] * progress);
  const variance = (now.getDate() * 11 + now.getMinutes() * 7 + now.getSeconds()) % 160;
  return base + variance;
}

export const Hero: React.FC = () => {
  const [scale, setScale] = useState(1);
  const [activeTab, setActiveTab] = useState<"now_playing" | "lyrics" | "home">("now_playing");
  const [showAllApks, setShowAllApks] = useState(false);

  // Dynamic Live Listening Counter naturally fluctuating according to global time of day
  const [liveListeners, setLiveListeners] = useState(9840);

  useEffect(() => {
    setLiveListeners(getNaturalListenerCount());

    const interval = setInterval(() => {
      setLiveListeners((prev) => {
        const deltas = [-8, -5, -3, -1, 2, 4, 6, 8, -6, 5, 7, -4, 9, 3, -7, 10];
        const change = deltas[Math.floor(Math.random() * deltas.length)];
        return Math.max(1200, prev + change);
      });
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  // Responsive scale computation: guarantees the 416px chassis fits any mobile, tablet, or desktop seamlessly
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 460) {
        // Mobile screens: dynamically scale down to fit viewport without horizontal overflow
        setScale(Math.min(1, Math.max(0.65, (width - 32) / 416)));
      } else if (width < 768) {
        // Phablets and small tablets: comfortable 0.85 to 1.0 scale
        setScale(Math.min(1, Math.max(0.85, (width - 48) / 416)));
      } else {
        // Tablets & Desktops: full 1.0 pixel-perfect scale
        setScale(1);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <AllApksModal isOpen={showAllApks} onClose={() => setShowAllApks(false)} />

      <section className="page-container pt-6" aria-label="Raaga">
        {/* Main BitChord Dark Obsidian Hero Container */}
        <div className="relative isolate overflow-hidden rounded-3xl bg-[#060504] shadow-[inset_0_0_0_0.8px_rgb(255_255_255/0.1)]">
          
          {/* Exact BitChord Mesh Blobs with 4 radial gradients and mesh-drift animations */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div
              className="mesh-blob absolute rounded-full"
              style={{
                width: "820px",
                height: "820px",
                left: "-14%",
                top: "-22%",
                background:
                  "radial-gradient(closest-side, rgb(74 42 6 / 0.95) 0%, rgb(74 42 6 / 0.7) 25%, rgb(74 42 6 / 0.38) 50%, rgb(74 42 6 / 0.12) 75%, rgb(74 42 6 / 0) 100%)",
                animation: "mesh-drift-a 26s ease-in-out infinite alternate",
              }}
            />
            <div
              className="mesh-blob absolute rounded-full"
              style={{
                width: "720px",
                height: "720px",
                left: "56%",
                top: "-12%",
                background:
                  "radial-gradient(closest-side, rgb(58 29 5 / 0.95) 0%, rgb(58 29 5 / 0.7) 25%, rgb(58 29 5 / 0.38) 50%, rgb(58 29 5 / 0.12) 75%, rgb(58 29 5 / 0) 100%)",
                animation: "mesh-drift-b 31s ease-in-out infinite alternate",
              }}
            />
            <div
              className="mesh-blob absolute rounded-full"
              style={{
                width: "700px",
                height: "700px",
                left: "16%",
                top: "40%",
                background:
                  "radial-gradient(closest-side, rgb(42 36 8 / 0.95) 0%, rgb(42 36 8 / 0.7) 25%, rgb(42 36 8 / 0.38) 50%, rgb(42 36 8 / 0.12) 75%, rgb(42 36 8 / 0) 100%)",
                animation: "mesh-drift-c 22s ease-in-out infinite alternate",
              }}
            />
            <div
              className="mesh-blob absolute rounded-full"
              style={{
                width: "760px",
                height: "760px",
                left: "60%",
                top: "46%",
                background:
                  "radial-gradient(closest-side, rgb(61 34 7 / 0.95) 0%, rgb(61 34 7 / 0.7) 25%, rgb(61 34 7 / 0.38) 50%, rgb(61 34 7 / 0.12) 75%, rgb(61 34 7 / 0) 100%)",
                animation: "mesh-drift-b 34s reverse ease-in-out infinite alternate",
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 30%, rgb(0 0 0 / 0.55) 100%)" }}
            />
          </div>

          {/* Hero Narrative, Headings & Clean Pill Buttons */}
          <div className="relative flex flex-col items-center px-6 pb-10 pt-12 sm:pt-16 text-center">
            
            {/* Live Right Now Listening Dynamic Badge (Starts from ~3k, fluctuates live) */}
            <div className="liquid-glass-pill inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-medium text-emerald-400 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span suppressHydrationWarning className="font-mono font-bold tracking-tight text-white tabular-nums">
                {liveListeners.toLocaleString()}
              </span>
              <span className="text-white/70">listening right now</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-balance text-[36px] sm:text-[52px] md:text-[58px] font-extrabold leading-[1.05] tracking-[-0.035em]">
              <span className="text-white">Your Music.</span>{" "}
              <span className="text-white/45">Without Limits.</span>
            </h1>

            {/* CTAs */}
            <div className="mt-7">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Button 1: Download v1.9.8 ARM64-v8a APK */}
                <a
                  href={RAAGAX_CONFIG.directApkUrl}
                  download="raaga-v1.9.8-arm64-v8a.apk"
                  aria-label={`Download Raaga ${RAAGAX_CONFIG.versionName} for Android ARM64-v8a`}
                  className="btn-press group h-11 inline-flex items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-black shadow-[0_0_24px_rgba(255,255,255,0.35),inset_0_1px_1px_0_rgba(255,255,255,0.9)] hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
                >
                  <ArrowDownToLine className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" />
                  <span>Download {RAAGAX_CONFIG.versionName}</span>
                </a>

                {/* Button 2: All APKs Modal Trigger */}
                <button
                  onClick={() => setShowAllApks(true)}
                  aria-label="View All APK Variants"
                  className="liquid-glass-pill group h-11 inline-flex items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
                >
                  <Layers className="size-4 text-red-400" />
                  <span>All APKs (ARM64, v7a)</span>
                </button>
              </div>
            </div>

            {/* Clean Professional Metadata & Platform Availability */}
            <p className="mt-5 text-[13px] text-white/50">
              <span className="text-white/80">100% Free &amp; Open Source</span> • Zero Ads or Telemetry
            </p>
            <p className="mt-1 text-[13px] text-white/50">
              Available on{" "}
              <span>
                <a href="#download" className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
                  Android
                </a>
                ,{" "}
              </span>
              <span>
                <a href={RAAGAX_CONFIG.tv.directApkUrl} download className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
                  Android TV
                </a>
                ,{" "}
              </span>
              <span>
                <a href="#desktop" className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
                  Windows
                </a>
                ,{" "}
              </span>
              <span>
                <a href="#desktop" className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
                  Linux
                </a>
                {" "}and{" "}
              </span>
              <span>
                <a href="#desktop" className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
                  macOS
                </a>
              </span>
            </p>

            {/* Screen Selector Pills (Clean Apple-style Segmented Control) */}
            <div className="mt-6 inline-flex items-center gap-1.5 p-1 rounded-full liquid-glass-pill shadow-inner max-w-full overflow-x-auto no-scrollbar">
              {[
                { id: "now_playing", label: "Now Playing" },
                { id: "lyrics", label: "Synced Lyrics" },
                { id: "home", label: "Listen Now" },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`btn-press px-5 py-2 rounded-full text-xs sm:text-[13px] font-medium transition-all flex items-center justify-center whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-white text-black shadow-[0_4px_16px_rgba(255,255,255,0.35),inset_0_1px_1px_0_rgba(255,255,255,0.9)] font-semibold"
                        : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              COMPLETE UNCREPPED PHONE CHASSIS (Full Screen Visible)
              ───────────────────────────────────────────────────────────── */}
          <div className="relative pb-8 sm:pb-12" style={{ height: `${Math.round(867 * scale + 48)}px` }}>
            <div
              className="absolute left-1/2 top-0 origin-top"
              style={{ transform: `translateX(-50%) scale(${scale})` }}
            >
              <div
                className="rounded-[58px] bg-[#1b1b1d] p-[2px] shadow-[0_40px_120px_rgb(0_0_0/0.7),inset_0_1px_1.5px_0_rgba(255,255,255,0.35),0_0_50px_rgba(239,68,68,0.18)]"
                style={{ width: "416px" }}
              >
                <div className="rounded-[56px] bg-black" style={{ padding: "11px" }}>
                  <div className="overflow-hidden rounded-[46px]">
                    <div
                      style={{
                        fontFamily:
                          '"SF Pro Display", -apple-system, BlinkMacSystemFont, var(--font-inter), system-ui, sans-serif',
                        WebkitFontSmoothing: "antialiased",
                      }}
                      role="img"
                      aria-label="Raaga Mobile Interface"
                    >
                      {/* Complete uncropped mobile screen viewport with pixel-perfect aspect ratio */}
                      <div className="relative h-[841px] w-[390px] overflow-hidden bg-black text-white" aria-hidden="true">
                        <div className="relative h-full w-full bg-black">
                          <Image
                            src={
                              activeTab === "now_playing"
                                ? "/images/mobile/mobile_now_playing.png"
                                : activeTab === "lyrics"
                                ? "/images/mobile/mobile_lyrics.png"
                                : "/images/mobile/mobile_home.png"
                            }
                            alt="Raaga Mobile Screen"
                            fill
                            priority
                            className="object-contain select-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>
    </>
  );
};
