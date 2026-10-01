"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Cast, User } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { setConnectModalOpen, setAuthModalOpen } = usePlayerStore();
  const [searchInput, setSearchInput] = useState("");

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("desktop-global-search") as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        } else {
          router.push("/search");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    } else {
      router.push("/search");
    }
  };

  return (
    <header className="mx-3.5 mt-3.5 mb-2 h-[52px] px-4 flex items-center justify-between liquid-glass-topbar select-none shrink-0 z-20 relative">
      {/* Specular Sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

      {/* 1. Navigation Controls (Back & Forward) */}
      <div className="flex items-center gap-1.5 relative z-10">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08] transition"
          title="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => router.forward()}
          className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08] transition"
          title="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Global Search Pill */}
      <div className="flex-1 max-w-md mx-4 relative z-10">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="absolute left-3.5 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          <input
            id="desktop-global-search"
            type="text"
            placeholder="Search songs, artists, albums..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-8 pl-9 pr-11 rounded-full bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] border border-white/[0.09] focus:border-white/25 text-xs text-white placeholder-neutral-400 focus:outline-none transition-all"
          />
          <kbd className="absolute right-2.5 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/10 text-[9px] text-neutral-400 font-mono border border-white/5 pointer-events-none">
            ⌘K
          </kbd>
        </form>
      </div>

      {/* 3. Connect & Profile Buttons */}
      <div className="flex items-center gap-2 relative z-10">
        <button
          onClick={() => setConnectModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/20 text-xs font-medium text-neutral-300 hover:text-white transition"
          title="Raaga Connect"
        >
          <Cast className="w-3.5 h-3.5 text-raaga-cyan" />
          <span className="hidden sm:inline">Connect</span>
        </button>

        <button
          onClick={() => setAuthModalOpen(true)}
          className="p-0.5 rounded-full hover:ring-2 hover:ring-white/20 transition"
          title={user?.name || "Sign In"}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-raaga-red to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {user?.name?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
          </div>
        </button>
      </div>
    </header>
  );
}
