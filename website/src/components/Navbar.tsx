"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download, Menu, X, ExternalLink } from "lucide-react";
import { GithubIcon } from "./icons/GithubIcon";
import { RAAGAX_CONFIG } from "@/config/release";

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Overview", href: "#overview" },
    { name: "Features", href: "#features" },
    { name: "Architecture", href: "#architecture" },
    { name: "Listen Together", href: "#listen-together" },
    { name: "Engineering", href: "#engineering" },
    { name: "Screens", href: "#screens" },
    { name: "Download", href: "#download" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#04060a]/80 backdrop-blur-2xl saturate-180 border-b border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)]"
          : "bg-black/40 backdrop-blur-xl saturate-150 border-b border-white/[0.06]"
      }`}
    >
      {/* Liquid Glass Specular Top Highlight */}
      <div className="liquid-specular-top" />
      {/* Top Direct APK Download Announcement Bar */}
      <div className="bg-gradient-to-r from-red-950/80 via-rose-900/60 to-purple-950/80 border-b border-red-500/20 backdrop-blur-md px-4 py-1.5 text-center text-xs font-mono text-zinc-300 flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
        <span className="flex h-2 w-2 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <span className="text-[11px] sm:text-xs text-zinc-200">
          <strong>RaagaX {RAAGAX_CONFIG.versionName}</strong> is live for Android!
        </span>
        <a
          href={RAAGAX_CONFIG.directApkUrl}
          download
          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] transition-colors shadow-sm shrink-0"
        >
          <Download className="w-3 h-3" />
          <span>Direct APK Download</span>
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18">
          {/* Left: Brand Logo & Title */}
          <Link href="#" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-red-600 via-rose-500 to-purple-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full bg-[#070a12] rounded-[10px] flex items-center justify-center overflow-hidden">
                <Image
                  src="/app_icon.png"
                  alt="RaagaX Logo"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white group-hover:text-red-400 transition-colors">
                  {RAAGAX_CONFIG.appName}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] text-zinc-300">
                  {RAAGAX_CONFIG.versionName}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 tracking-wide hidden sm:inline">
                Android Music System
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Right Action: Mobile Menu Toggle Button */}
          <div className="flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] md:hidden transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#070a12]/95 backdrop-blur-2xl border-b border-white/[0.08] px-4 pt-3 pb-6 space-y-2">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-white/[0.08] transition-colors"
            >
              {link.name}
            </a>
          ))}
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
            <a
              href={RAAGAX_CONFIG.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-mono text-zinc-300 hover:text-white"
            >
              <GithubIcon className="w-4 h-4" />
              Astrionix / RaagaX
            </a>
            <a
              href={RAAGAX_CONFIG.releaseNotesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
            >
              Releases <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
