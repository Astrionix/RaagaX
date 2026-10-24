"use client";

import React, { useState } from "react";
import { Disc, Headphones, Users, Award, ChevronLeft, ChevronRight } from "lucide-react";

interface ReplayCardData {
  category: string;
  title: string;
  stat: string;
  statSub: string;
  tag: string;
  gradient: string;
  accent: string;
  icon: React.ReactNode;
}

const REPLAY_CARDS: ReplayCardData[] = [
  {
    category: "LISTENING STATS",
    title: "Minutes Streamed",
    stat: "14,300 mins",
    statSub: "1,248 Plays · 2026",
    tag: "Top 1% Global Listener",
    gradient: "from-[#1f0b38] via-[#3a1052] to-[#7f1d1d]",
    accent: "#ec4899",
    icon: <Headphones className="w-5 h-5 text-pink-400" />
  },
  {
    category: "HEAVY ROTATION",
    title: "Top Artist",
    stat: "The Weeknd",
    statSub: "840 Plays · 42 Songs",
    tag: "After Hours & Dawn FM",
    gradient: "from-[#082f49] via-[#0c4a6e] to-[#1e3a8a]",
    accent: "#38bdf8",
    icon: <Award className="w-5 h-5 text-cyan-400" />
  },
  {
    category: "AUDIO FIDELITY",
    title: "Hi-Res Studio Master",
    stat: "24-bit / 96kHz",
    statSub: "Bit-Perfect C++ Oboe Audio",
    tag: "Zero-Clipping DSP Decimator",
    gradient: "from-[#2e1065] via-[#4c1d95] to-[#831843]",
    accent: "#a855f7",
    icon: <Disc className="w-5 h-5 text-purple-400" />
  },
  {
    category: "GO JAM HUB",
    title: "Listen Together",
    stat: "14 Rooms",
    statSub: "Real-time Zero Drift WebSocket",
    tag: "32 Friends Synced",
    gradient: "from-[#451a03] via-[#78350f] to-[#1c1917]",
    accent: "#f59e0b",
    icon: <Users className="w-5 h-5 text-amber-400" />
  }
];

export const ReplayShowcase: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const prevCard = () => {
    setActiveIndex((prev) => (prev === 0 ? REPLAY_CARDS.length - 1 : prev - 1));
  };

  const nextCard = () => {
    setActiveIndex((prev) => (prev === REPLAY_CARDS.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 50) nextCard();
    else if (diff < -50) prevCard();
    setTouchStart(null);
  };

  // Specular mouse tracking effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--spot-x", `${x}px`);
    e.currentTarget.style.setProperty("--spot-y", `${y}px`);
  };

  const getCardStyle = (index: number) => {
    const total = REPLAY_CARDS.length;
    let diff = (index - activeIndex) % total;
    if (diff < -total / 2) diff += total;
    if (diff > total / 2) diff -= total;

    if (diff === 0) {
      return {
        transform: "translate3d(0, 0, 0) scale(1) rotateY(0deg)",
        zIndex: 30,
        opacity: 1,
        filter: "brightness(1)",
        pointerEvents: "auto" as const,
      };
    } else if (diff === 1) {
      return {
        transform: "translate3d(48%, 0, -90px) scale(0.86) rotateY(-20deg)",
        zIndex: 20,
        opacity: 0.65,
        filter: "brightness(0.75)",
        pointerEvents: "auto" as const,
      };
    } else if (diff === -1) {
      return {
        transform: "translate3d(-48%, 0, -90px) scale(0.86) rotateY(20deg)",
        zIndex: 20,
        opacity: 0.65,
        filter: "brightness(0.75)",
        pointerEvents: "auto" as const,
      };
    } else {
      return {
        transform: "translate3d(0, 0, -220px) scale(0.72) rotateY(0deg)",
        zIndex: 10,
        opacity: 0,
        filter: "brightness(0.4)",
        pointerEvents: "none" as const,
      };
    }
  };

  return (
    <section id="replay-spotlight" className="page-container mt-16 sm:mt-24" aria-label="Raaga Replay">
      {/* Outer Enclosed Card with Hairline Glass Inset */}
      <div className="overflow-hidden rounded-[32px] sm:rounded-[36px] bg-[#08080a] pb-10 pt-12 shadow-[inset_0_0_0_0.8px_rgba(255,255,255,0.1)] sm:pt-14">
        
        {/* Section Header */}
        <div className="px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-mono text-white/70">
            <Award className="w-3.5 h-3.5 text-pink-400" />
            <span>Raaga Replay · Monthly &amp; Annual Wrapped</span>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-balance text-[13px] sm:text-[14px] leading-relaxed text-white/50">
            Replay counts every minute, song, artist, and album you play, and deals it out as holographic cards that are yours to keep and share.
          </p>
        </div>

        {/* 3D Carousel Stage with Side Arrows */}
        <div
          className="relative mt-8 px-4 sm:px-12 w-full flex flex-col items-center select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Side Arrow: Prev */}
          <button
            onClick={prevCard}
            aria-label="Previous Replay card"
            className="absolute left-2 sm:left-6 lg:left-10 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 backdrop-blur-md text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-[0_8px_24px_rgba(0,0,0,0.6)] cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Side Arrow: Next */}
          <button
            onClick={nextCard}
            aria-label="Next Replay card"
            className="absolute right-2 sm:right-6 lg:right-10 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 backdrop-blur-md text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-[0_8px_24px_rgba(0,0,0,0.6)] cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* 3D Stage with Perspective */}
          <div className="relative w-full max-w-4xl h-[280px] sm:h-[320px] md:h-[340px] flex items-center justify-center [perspective:1200px]">
            {REPLAY_CARDS.map((card, idx) => {
              const style = getCardStyle(idx);
              const isActive = idx === activeIndex;

              return (
                <div
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  onMouseMove={isActive ? handleMouseMove : undefined}
                  style={{
                    transform: style.transform,
                    zIndex: style.zIndex,
                    opacity: style.opacity,
                    filter: style.filter,
                    pointerEvents: style.pointerEvents,
                  }}
                  className={`group specular-card absolute w-[85%] sm:w-[70%] max-w-[460px] aspect-[1.586] overflow-hidden rounded-[26px] shadow-[0_16px_40px_rgba(0,0,0,0.7)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer border ${
                    isActive ? "border-white/30 shadow-[0_24px_50px_rgba(0,0,0,0.9)]" : "border-white/10"
                  }`}
                >
                  {/* Dynamic Blurred Mesh Backdrop */}
                  <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-90 transition-transform duration-700 ${
                        isActive ? "group-hover:scale-105" : ""
                      }`}
                    />
                    <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
                  </div>

                  {/* Holographic Specular Shine Overlay */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                      isActive ? "opacity-0 group-hover:opacity-100" : "opacity-0"
                    }`}
                    style={{
                      background:
                        "radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255, 255, 255, 0.32), transparent 70%)",
                    }}
                  />

                  {/* Card Content */}
                  <div className="relative flex h-full flex-col justify-between p-5 sm:p-7 text-white z-10">
                    {/* Card Top: Category and Icon */}
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[1.4px] text-white/70">
                        {card.category}
                      </p>
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15">
                        {card.icon}
                      </div>
                    </div>

                    {/* Card Center: Big Stat */}
                    <div>
                      <h3 className="text-[13px] sm:text-[14px] font-medium text-white/70">
                        {card.title}
                      </h3>
                      <p className="text-[26px] sm:text-[34px] font-extrabold tracking-tight text-white leading-tight mt-0.5">
                        {card.stat}
                      </p>
                      <p className="text-[11px] sm:text-[12px] font-mono text-white/60 mt-1 truncate">
                        {card.statSub}
                      </p>
                    </div>

                    {/* Card Bottom: Badge */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-[11px] sm:text-[12px]">
                      <span className="font-semibold text-white/90 truncate">
                        {card.tag}
                      </span>
                      <span className="font-mono text-white/40 shrink-0 ml-2">
                        Raaga 2026
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Indicator Dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {REPLAY_CARDS.map((card, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeIndex === idx ? "w-8 bg-white" : "w-2 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`View ${card.title}`}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
