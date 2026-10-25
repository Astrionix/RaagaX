"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, Menu, X, Star, Layers, Monitor } from "lucide-react";
import { RAAGAX_CONFIG } from "@/config/release";
import { AllApksModal } from "./AllApksModal";

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAllApks, setShowAllApks] = useState(false);
  const [desktopDownload, setDesktopDownload] = useState<{ name: string; url: string; fileName: string }>({
    name: "Windows",
    url: RAAGAX_CONFIG.desktop.windows.setupExe,
    fileName: "Raaga-1.9.8-windows-setup.exe",
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";
    if (/Macintosh|MacIntel|Mac OS X/i.test(ua) || /Mac/i.test(platform)) {
      setDesktopDownload({
        name: "macOS",
        url: RAAGAX_CONFIG.desktop.macOS.arm64Dmg,
        fileName: "Raaga-1.9.8-macos-arm64.dmg",
      });
    } else if ((/Linux/i.test(ua) || /Linux/i.test(platform)) && !/Android/i.test(ua)) {
      setDesktopDownload({
        name: "Linux",
        url: RAAGAX_CONFIG.desktop.linux.appImage,
        fileName: "Raaga-1.9.8-linux-x86_64.AppImage",
      });
    } else {
      setDesktopDownload({
        name: "Windows",
        url: RAAGAX_CONFIG.desktop.windows.setupExe,
        fileName: "Raaga-1.9.8-windows-setup.exe",
      });
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Overview", href: "#top" },
    { name: "Catalog", href: "#music-discovery" },
    { name: "Desktop", href: "#desktop" },
    { name: "Download", href: "#download" },
  ];

  return (
    <>
      <AllApksModal isOpen={showAllApks} onClose={() => setShowAllApks(false)} />

      <header
        id="top"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "liquid-glass-dock"
            : "bg-transparent border-b border-transparent pt-2"
        }`}
      >
        <div className="page-container flex items-center justify-between h-14 sm:h-16">
          
          {/* Left: Brand Logo & Title */}
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
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.14] text-white/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] hidden sm:inline">
                {RAAGAX_CONFIG.versionName}
              </span>
            </div>
          </Link>

          {/* Center: Desktop Navigation Links (Responsive) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/[0.09] active:scale-[0.97] transition-all duration-160"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Right: Quick Download & Architecture Selector Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <a
              href={desktopDownload.url}
              download={desktopDownload.fileName}
              title={`Download Raaga Desktop for ${desktopDownload.name}`}
              aria-label={`Download Raaga Desktop for ${desktopDownload.name}`}
              className="liquid-glass-pill size-8 sm:size-9 grid place-items-center rounded-full text-white/90 hover:text-white cursor-pointer btn-press"
            >
              <ArrowDownToLine className="w-4 h-4 text-white/90 hover:text-white" />
            </a>

            <button
              onClick={() => setShowAllApks(true)}
              className="liquid-glass-pill h-8 sm:h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full text-xs font-semibold text-white/90 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-red-400" />
              <span>All APKs</span>
            </button>

            <a
              href={RAAGAX_CONFIG.directApkUrl}
              download="raaga-v1.9.8-arm64-v8a.apk"
              aria-label="Download Raaga ARM64-v8a APK"
              className="btn-press h-8 sm:h-9 inline-flex items-center gap-1.5 px-4 rounded-full text-xs font-semibold text-black bg-white hover:bg-white/95 shadow-[0_0_20px_rgba(255,255,255,0.28),inset_0_1px_1px_0_rgba(255,255,255,0.8)] cursor-pointer"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Download APK</span>
            </a>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] lg:hidden transition-colors btn-press"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>

        {/* Mobile/Tablet Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden liquid-glass-dock border-b border-white/[0.12] px-5 py-5 space-y-2 animate-in fade-in duration-200">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.09] active:scale-[0.98] transition-all duration-160"
              >
                {link.name}
              </a>
            ))}
            
            <div className="pt-4 border-t border-white/10 space-y-2">
              <a
                href={desktopDownload.url}
                download={desktopDownload.fileName}
                aria-label={`Download Raaga Desktop for ${desktopDownload.name}`}
                className="liquid-glass-pill w-full h-10 inline-flex items-center justify-center gap-2 rounded-full text-xs font-semibold text-white/90"
              >
                <Monitor className="w-4 h-4 text-blue-400" />
                <span>Download Desktop for {desktopDownload.name}</span>
              </a>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowAllApks(true);
                }}
                className="liquid-glass-pill w-full h-10 inline-flex items-center justify-center gap-2 rounded-full text-xs font-semibold text-white/90"
              >
                <Layers className="w-4 h-4 text-red-400" />
                <span>Browse All APKs (Universal, ARM64, v7a)</span>
              </button>

              <a
                href={RAAGAX_CONFIG.directApkUrl}
                download="raaga-v1.9.8-arm64-v8a.apk"
                aria-label="Download Raaga ARM64-v8a APK"
                className="btn-press w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-white text-xs font-semibold text-black shadow-[0_0_20px_rgba(255,255,255,0.25)]"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Get APK (v1.9.8)</span>
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
