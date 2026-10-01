"use client";

import { X, Sparkles, Music2, ShieldCheck, Heart, Radio, Sliders } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import Link from "next/link";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const liquidGlassMode = useSettingsStore((s) => s.liquidGlassMode) || "dark";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 rounded-[24px] liquid-glass-sidebar border border-white/20 shadow-[0_24px_64px_rgba(0,0,0,0.85)] text-white select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Glare Reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.08] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-raaga-red to-raaga-pink flex items-center justify-center shadow-[0_4px_20px_rgba(250,45,72,0.45)]">
            <span className="font-black text-white text-2xl tracking-tighter">R</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">RAAGA</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-raaga-red/20 text-raaga-red border border-raaga-red/30">
                Desktop
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 font-medium">
              Version 1.0.0 • Liquid Glass ({liquidGlassMode}) powered by ybouane/liquidglass
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-neutral-300 leading-relaxed mb-4">
          Raaga Desktop delivers a native desktop audio experience built on an authentic
          Liquid Glass design system powered by the <strong>ybouane/liquidglass</strong> WebGL shader
          architecture (Normal, Dark, and Frosted profiles) with real YouTube Music playback,
          lossless audio streams, and real-time synchronized karaoke lyrics.
        </p>

        {/* Key Features Pill Badges */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Link
            href="/settings?tab=appearance"
            onClick={onClose}
            className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-raaga-red shrink-0" />
            <span className="text-[11px] font-medium text-neutral-200 capitalize">
              Glass: {liquidGlassMode}
            </span>
          </Link>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <Music2 className="w-3.5 h-3.5 text-raaga-cyan shrink-0" />
            <span className="text-[11px] font-medium text-neutral-200">YouTube Music Engine</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-medium text-neutral-200">Synced Karaoke</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[11px] font-medium text-neutral-200">Lossless 320k Audio</span>
          </div>
        </div>

        {/* Keyboard Shortcuts Tips */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 mb-5 text-[11px]">
          <div className="flex justify-between text-neutral-400">
            <span>Play / Pause</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Space</kbd>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Next Track / Previous Track</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">→ / ←</kbd>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Global Search</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">⌘K</kbd>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-[11px] text-neutral-400">
          <span>Crafted with <Heart className="w-3 h-3 text-raaga-red inline fill-current mx-0.5" /> by Astrionix</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
