"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { RAAGAX_CONFIG } from "@/config/release";
import { DiscordIcon } from "./icons/DiscordIcon";

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      id="top"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#04060a]/80 backdrop-blur-md border-b border-white/[0.06] py-2.5 sm:py-3 shadow-xl shadow-black/50"
          : "bg-transparent py-3 sm:py-4"
      }`}
    >
      <div className="w-full px-4 sm:px-8 lg:px-10 flex items-center justify-between">
        
        {/* Left Corner: Brand Logo & Title */}
        <Link href="#top" className="flex items-center gap-2.5 group shrink-0 btn-press">
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.14] text-white/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
              {RAAGAX_CONFIG.versionName}
            </span>
          </div>
        </Link>

        {/* Right Corner: Discord Button */}
        <a
          href={RAAGAX_CONFIG.discordCommunityUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Join Raaga Discord Community"
          aria-label="Join Raaga Discord Community"
          className="liquid-glass-pill h-9 sm:h-10 px-3.5 sm:px-4 inline-flex items-center gap-2 rounded-full text-white/90 hover:text-white border border-white/20 hover:border-[#5865f2]/60 hover:bg-[#5865f2]/15 shadow-[0_4px_20px_rgba(88,101,242,0.25),inset_0_1px_1px_0_rgba(255,255,255,0.4)] cursor-pointer btn-press transition-all group ml-auto"
        >
          <DiscordIcon className="w-4 h-4 text-[#5865f2] group-hover:scale-110 transition-transform" />
          <span className="text-[13px] font-semibold tracking-tight">Discord</span>
        </a>

      </div>
    </header>
  );
};
