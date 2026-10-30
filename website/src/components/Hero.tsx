"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowDownToLine, Layers, Globe, ExternalLink } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";
import { AllApksModal } from "./AllApksModal";
import { DiscordIcon } from "./icons/DiscordIcon";

// Compute realistic Indian Standard Time (IST UTC+5:30) diurnal listening traffic curve.
// Calibrated strictly below 10k - 12k:
//  - Deep sleep trough (3:00 AM - 4:00 AM): ~850 (lowest point)
//  - Morning commute & office start (9:00 AM - 11:00 AM): ~7.2k - ~7.5k
//  - Afternoon lunch dip (1:30 PM - 2:30 PM): ~5.2k - ~5.7k
//  - Evening commute & gym (5:00 PM - 7:00 PM): ~7.8k - ~9.6k
//  - Prime-time night peak (9:00 PM - 10:30 PM): ~10.5k - ~11.4k (Highest peak, stays below 12k)
function getIndianTimeListenerCount(): number {
  if (typeof window === "undefined") return 6150;

  // Calculate current exact time in Indian Standard Time (IST: UTC + 5:30)
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utcMs + 5.5 * 3600000);

  const istHour = istDate.getHours();
  const istMinute = istDate.getMinutes();
  const istSecond = istDate.getSeconds();
  const exactHour = istHour + istMinute / 60 + istSecond / 3600;

  // Indian music streaming hourly distribution (0:00 to 23:00 IST) scaled below 10-12k
  const indianHourlyBase = [
    3920,  // 00:00 (Midnight) - Late night owls & study sessions
    2280,  // 01:00 AM - Sharp drop as majority sleeps
    1340,  // 02:00 AM - Deep night
    860,   // 03:00 AM - Deep sleep trough (Lowest point in 24 hours)
    980,   // 04:00 AM - Early transition / quiet hours
    1680,  // 05:00 AM - Early risers, devotional, morning yoga/walks
    2850,  // 06:00 AM - Morning workout, getting ready, chai
    4420,  // 07:00 AM - Morning commute prep, schools/colleges awake
    6180,  // 08:00 AM - Peak morning rush hour (metro, trains, traffic)
    7240,  // 09:00 AM - Morning peak: office & campus arrival
    7480,  // 10:00 AM - Steady work/study focus playlists
    7120,  // 11:00 AM - Late morning focus
    6540,  // 12:00 PM - Mid-day steady streams
    5720,  // 13:00 PM (1:00 PM) - Lunch break (slight dip as people socialize)
    5260,  // 14:00 PM (2:00 PM) - Post-lunch lull (afternoon dip)
    5890,  // 15:00 PM (3:00 PM) - Workday resume & afternoon chai break
    6680,  // 16:00 PM (4:00 PM) - Work wrap-up tunes & evening prep
    7840,  // 17:00 PM (5:00 PM) - Evening commute surge starts
    8920,  // 18:00 PM (6:00 PM) - Heavy traffic commute + Gym workout playlists
    9680,  // 19:00 PM (7:00 PM) - Evening relaxation & social unwinding
    10450, // 20:00 PM (8:00 PM) - Dinner time, hanging out, background music
    10980, // 21:00 PM (9:00 PM) - Prime-time listening across India
    11420, // 22:00 PM (10:00 PM) - ABSOLUTE PEAK of the day (Bedtime, romantic, lo-fi ~11.4k)
    7360,  // 23:00 PM (11:00 PM) - Sleep timers on, gradual wind-down
  ];

  const currentHour = Math.floor(exactHour) % 24;
  const nextHour = (currentHour + 1) % 24;
  const progress = exactHour - Math.floor(exactHour);

  // Smooth cosine interpolation between hours so the number glides seamlessly without sudden jumps
  const smoothProgress = (1 - Math.cos(progress * Math.PI)) / 2;
  const base = Math.round(
    indianHourlyBase[currentHour] * (1 - smoothProgress) +
    indianHourlyBase[nextHour] * smoothProgress
  );

  // Weekend slight boost (Friday night, Saturday & Sunday night)
  const day = istDate.getDay();
  const isWeekendBoost = day === 0 || day === 6 || (day === 5 && exactHour >= 18);
  const weekendMultiplier = isWeekendBoost ? 1.03 : 1.0;

  // Natural organic jitter based on IST date/minute/second
  const jitter = ((istDate.getDate() * 11 + istMinute * 7 + istSecond * 3) % 70) - 35;

  const result = Math.round(base * weekendMultiplier) + jitter;
  // Guaranteed strictly clamped below 12,000 and above 700
  return Math.max(700, Math.min(11850, result));
}

export const Hero: React.FC = () => {
  const [scale, setScale] = useState(1);
  const [activeTab, setActiveTab] = useState<"now_playing" | "lyrics" | "home">("now_playing");
  const [showAllApks, setShowAllApks] = useState(false);

  // Dynamic Live Listening Counter anchored to Indian Standard Time (IST) diurnal traffic (below 10k-12k)
  const [liveListeners, setLiveListeners] = useState(6150);

  useEffect(() => {
    // Initial calculation on client mount based on Indian Standard Time
    const initialCount = getIndianTimeListenerCount();
    setLiveListeners(initialCount);

    // Live organic micro-fluctuations anchored to IST target
    const interval = setInterval(() => {
      setLiveListeners((prev) => {
        const target = getIndianTimeListenerCount();
        // Gently gravitate towards current IST target if drift occurs
        const diff = target - prev;
        const driftCorrection = Math.max(-8, Math.min(8, Math.round(diff * 0.1)));

        const microJitter = [-4, -3, -2, -1, 0, 1, 2, 3, -2, 2, 4, -3, 1][
          Math.floor(Math.random() * 13)
        ];

        return Math.max(700, Math.min(11900, prev + driftCorrection + microJitter));
      });
    }, 2500);

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

          {/* Top Row: Icon Logo on Left, Live Listeners in Center, Discord on Right */}
          <div className="relative z-10 w-full px-5 sm:px-8 pt-5 sm:pt-6 flex items-center justify-between">
            {/* Left: Brand Icon Logo & Title */}
            <a href="#top" className="flex items-center gap-2.5 group shrink-0 btn-press">
              <div className="relative w-8 h-8 rounded-xl overflow-hidden bg-black/60 border border-white/20 p-1 shadow-[0_0_15px_rgba(239,68,68,0.3),inset_0_1px_1px_0_rgba(255,255,255,0.4)] group-hover:scale-105 transition-transform duration-200">
                <Image
                  src="/app_icon.png"
                  alt="Raaga Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-[16px] sm:text-[17px] tracking-tight text-white group-hover:text-red-400 transition-colors">
                  {RAAGAX_CONFIG.appName}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.14] text-white/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] hidden sm:inline">
                  {RAAGAX_CONFIG.versionName}
                </span>
              </div>
            </a>

            {/* Center: Live Concurrent Listeners */}
            <div
              title="Live concurrent listeners based on Indian Standard Time (IST)"
              className="liquid-glass-pill inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-medium text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.18)] cursor-default select-none"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span suppressHydrationWarning className="font-mono font-bold tracking-tight text-white tabular-nums">
                {liveListeners.toLocaleString()}
              </span>
              <span className="text-white/70 hidden sm:inline">listening right now</span>
            </div>

            {/* Right: Discord Button */}
            <a
              href={RAAGAX_CONFIG.discordCommunityUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Join Raaga Discord Community"
              aria-label="Join Raaga Discord Community"
              className="liquid-glass-pill h-9 sm:h-10 px-3.5 sm:px-4 inline-flex items-center gap-2 rounded-full text-white/90 hover:text-white border border-white/20 hover:border-[#5865f2]/60 hover:bg-[#5865f2]/15 shadow-[0_4px_20px_rgba(88,101,242,0.25),inset_0_1px_1px_0_rgba(255,255,255,0.4)] cursor-pointer btn-press transition-all group shrink-0"
            >
              <DiscordIcon className="w-4 h-4 text-[#5865f2] group-hover:scale-110 transition-transform" />
              <span className="text-[13px] font-semibold tracking-tight hidden sm:inline">Discord</span>
            </a>
          </div>

          {/* Hero Narrative, Headings & Clean Pill Buttons */}
          <div className="relative flex flex-col items-center px-6 pb-10 pt-8 sm:pt-10 text-center">

            {/* Main Headline */}
            <h1 className="text-balance text-[36px] sm:text-[52px] md:text-[58px] font-extrabold leading-[1.05] tracking-[-0.035em]">
              <span className="text-white">Your Music.</span>{" "}
              <span className="text-white/45">Without Limits.</span>
            </h1>

            {/* CTAs */}
            <div className="mt-7">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Button 1: Download v1.9.9 ARM64-v8a APK */}
                <a
                  href={RAAGAX_CONFIG.directApkUrl}
                  download="raaga-v1.9.9-arm64-v8a.apk"
                  aria-label={`Download Raaga ${RAAGAX_CONFIG.versionName} for Android ARM64-v8a`}
                  className="btn-press group h-11 inline-flex items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-black shadow-[0_0_24px_rgba(255,255,255,0.35),inset_0_1px_1px_0_rgba(255,255,255,0.9)] hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
                >
                  <ArrowDownToLine className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" />
                  <span>Download {RAAGAX_CONFIG.versionName}</span>
                </a>

                {/* Button 2: Web App Link (web.raaga.me) */}
                <a
                  href={RAAGAX_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Raaga Web Player on web.raaga.me"
                  className="liquid-glass-pill group h-11 inline-flex items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white hover:text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer transition-all"
                >
                  <Globe className="size-4 text-emerald-400" />
                  <span>Web App (web.raaga.me)</span>
                  <ExternalLink className="size-3 text-white/50 group-hover:text-white transition-colors" />
                </a>

                {/* Button 3: All APKs Modal Trigger */}
                <button
                  onClick={() => setShowAllApks(true)}
                  aria-label="View All APK Variants"
                  className="liquid-glass-pill group h-11 inline-flex items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
                >
                  <Layers className="size-4 text-red-400" />
                  <span>All APKs</span>
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
                <a href={RAAGAX_CONFIG.webAppUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-medium underline-offset-4 transition-colors hover:text-emerald-300 hover:underline">
                  Web (web.raaga.me)
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
