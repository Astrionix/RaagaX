"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Sparkles,
  Library,
  Heart,
  History,
  ListMusic,
  Plus,
  Settings,
  Disc,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import CreatePlaylistModal from "@/components/playlist/CreatePlaylistModal";

export default function Sidebar() {
  const pathname = usePathname();
  const { playlists, likedSongIds } = useAuthStore();
  const [isCompact, setIsCompact] = useState(false);
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Core minimal navigation (Strictly Home, Search, New, Library)
  const primaryNav = [
    { name: "Home", href: "/", icon: Home },
    { name: "Search", href: "/search", icon: Search },
    { name: "New", href: "/new", icon: Sparkles },
    { name: "Library", href: "/library", icon: Library },
  ];

  // Your Music section
  const yourMusicNav = [
    { name: "Liked Songs", href: "/liked", icon: Heart, count: likedSongIds.length },
    { name: "History", href: "/history", icon: History },
  ];

  // Adaptive scroll collapse with hysteresis:
  // scrollY > 120px -> compact (72px)
  // scrollY < 60px -> expanded (236px)
  useEffect(() => {
    const scrollContainer = document.getElementById("main-content-viewport");
    if (!scrollContainer) return;

    let lastScrollY = 0;
    const handleScroll = () => {
      const scrollY = scrollContainer.scrollTop;
      lastScrollY = scrollY;

      // Only apply auto scroll collapse if user hasn't explicitly locked manual toggle
      if (manualOverride !== null) return;

      if (scrollY > 120) {
        setIsCompact(true);
      } else if (scrollY < 60) {
        setIsCompact(false);
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [manualOverride]);

  const effectiveCompact = manualOverride !== null ? manualOverride : isCompact;

  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    const baseHref = href.split("?")[0];
    return pathname.startsWith(baseHref);
  };

  return (
    <>
      <aside
        className={`hidden md:flex flex-col h-[calc(100vh-1.75rem)] my-3.5 ml-3.5 shrink-0 select-none z-30 transition-all duration-300 ease-out relative liquid-glass-sidebar ${
          effectiveCompact ? "w-[72px]" : "w-[228px] lg:w-[238px]"
        }`}
      >
        {/* Specular Glare Reflection Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.06] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

        {/* 1. Brand Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 relative z-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 min-w-0 group"
            title="Raaga Desktop"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-raaga-red to-raaga-pink flex items-center justify-center shadow-[0_2px_12px_rgba(250,45,72,0.4)] shrink-0 transition-transform group-hover:scale-105">
              <span className="font-black text-white text-base tracking-tighter">R</span>
            </div>

            <div
              className={`flex items-center gap-1.5 min-w-0 transition-all duration-200 overflow-hidden ${
                effectiveCompact
                  ? "w-0 opacity-0 pointer-events-none"
                  : "w-auto opacity-100"
              }`}
            >
              <span className="font-bold text-sm tracking-tight text-white">RAAGA</span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/10">
                Desktop
              </span>
            </div>
          </Link>

          {/* Toggle compact manual button */}
          <button
            onClick={() => setManualOverride(effectiveCompact ? false : true)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition"
            title={effectiveCompact ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <div className="w-3.5 h-3.5 flex flex-col justify-between items-center py-0.5">
              <span
                className={`h-0.5 bg-neutral-400 rounded transition-all ${
                  effectiveCompact ? "w-3.5" : "w-2.5 self-start"
                }`}
              />
              <span className="h-0.5 w-3.5 bg-neutral-400 rounded" />
              <span
                className={`h-0.5 bg-neutral-400 rounded transition-all ${
                  effectiveCompact ? "w-3.5" : "w-2 self-start"
                }`}
              />
            </div>
          </button>
        </div>

        {/* 2. Scrollable Navigation Content */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4 no-scrollbar relative z-10">
          {/* Primary Navigation: Home, Search, New, Library */}
          <div className="space-y-1">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              return (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                      active
                        ? "liquid-glass-nav-active font-semibold shadow-md"
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                    } ${effectiveCompact ? "justify-center px-2" : ""}`}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-colors" />
                    <span
                      className={`truncate transition-all duration-200 ${
                        effectiveCompact ? "hidden" : "inline-block"
                      }`}
                    >
                      {item.name}
                    </span>
                  </Link>

                  {/* Section 7: Compact Liquid Glass Hover Tooltip */}
                  {effectiveCompact && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 rounded-xl liquid-glass-sidebar border border-white/20 text-xs font-bold text-white whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 z-50">
                      {item.name}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#141418] border-l border-b border-white/15" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* YOUR MUSIC Section: Liked Songs, History */}
          <div className="space-y-1">
            {!effectiveCompact && (
              <div className="px-3 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 animate-in fade-in duration-200">
                Your Music
              </div>
            )}
            {yourMusicNav.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              return (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                      active
                        ? "liquid-glass-nav-active font-semibold shadow-md"
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                    } ${effectiveCompact ? "justify-center px-2" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          item.name === "Liked Songs" && item.count !== undefined && item.count > 0 && !active
                            ? "text-raaga-red"
                            : ""
                        }`}
                      />
                      <span
                        className={`truncate transition-all duration-200 ${
                          effectiveCompact ? "hidden" : "inline-block"
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>

                    {!effectiveCompact && item.count !== undefined && item.count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-neutral-300 font-mono">
                        {item.count}
                      </span>
                    )}
                  </Link>

                  {/* Compact Hover Tooltip */}
                  {effectiveCompact && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 rounded-xl liquid-glass-sidebar border border-white/20 text-xs font-bold text-white whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 z-50">
                      {item.name}
                      {item.count !== undefined && item.count > 0 && ` (${item.count})`}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#141418] border-l border-b border-white/15" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PLAYLISTS Section: Dynamic User Playlists + New Playlist */}
          <div className="space-y-1">
            {!effectiveCompact && (
              <div className="px-3 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                <span>Playlists</span>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="p-1 hover:text-white text-neutral-400 rounded transition"
                  title="Create New Playlist"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Dynamic user-created playlists */}
            {playlists.map((playlist) => {
              const active = pathname === `/playlist/${playlist.id}`;
              return (
                <div key={playlist.id} className="relative group">
                  <Link
                    href={`/playlist/${playlist.id}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                      active
                        ? "liquid-glass-nav-active font-semibold shadow-md"
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                    } ${effectiveCompact ? "justify-center px-2" : ""}`}
                  >
                    <Disc className="w-4 h-4 shrink-0 text-neutral-400 group-hover:text-white" />
                    <span
                      className={`truncate transition-all duration-200 ${
                        effectiveCompact ? "hidden" : "inline-block"
                      }`}
                    >
                      {playlist.name}
                    </span>
                  </Link>

                  {/* Compact Hover Tooltip */}
                  {effectiveCompact && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 rounded-xl liquid-glass-sidebar border border-white/20 text-xs font-bold text-white whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 z-50">
                      {playlist.name}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#141418] border-l border-b border-white/15" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Clean '+ New Playlist' button */}
            <div className="relative group pt-0.5">
              <button
                onClick={() => setCreateModalOpen(true)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-dashed border-white/10 hover:border-white/25 transition-all duration-200 ${
                  effectiveCompact ? "justify-center px-2" : ""
                }`}
                title="New Playlist"
              >
                <Plus className="w-4 h-4 shrink-0 text-raaga-red" />
                <span
                  className={`truncate transition-all duration-200 ${
                    effectiveCompact ? "hidden" : "inline-block"
                  }`}
                >
                  New Playlist
                </span>
              </button>

              {/* Compact Hover Tooltip */}
              {effectiveCompact && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 rounded-xl liquid-glass-sidebar border border-white/20 text-xs font-bold text-white whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 z-50">
                  New Playlist
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#141418] border-l border-b border-white/15" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Bottom Navigation: Settings */}
        <div className="p-2.5 pt-2 border-t border-white/[0.08] relative z-10">
          <div className="relative group">
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                pathname === "/settings"
                  ? "liquid-glass-nav-active font-semibold shadow-md"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
              } ${effectiveCompact ? "justify-center px-2" : ""}`}
            >
              <Settings className="w-4 h-4 shrink-0 text-neutral-400 group-hover:text-white" />
              <span
                className={`truncate transition-all duration-200 ${
                  effectiveCompact ? "hidden" : "inline-block"
                }`}
              >
                Settings
              </span>
            </Link>

            {/* Compact Hover Tooltip */}
            {effectiveCompact && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 px-3 py-1.5 rounded-xl liquid-glass-sidebar border border-white/20 text-xs font-bold text-white whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 z-50">
                Settings
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#141418] border-l border-b border-white/15" />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Modal for creating a new user playlist */}
      <CreatePlaylistModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  );
}
