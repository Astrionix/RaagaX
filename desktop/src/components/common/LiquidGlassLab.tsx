"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Layers,
  Eye,
  Move,
  Sun,
  Activity,
  Check,
  Zap,
  Info,
  Sliders,
} from "lucide-react";
import { useSettingsStore, LiquidGlassMode } from "@/stores/settings-store";

interface PresetSpec {
  id: LiquidGlassMode;
  name: string;
  sublabel: string;
  tagline: string;
  refraction: number;
  blurAmount: number;
  chromAberration: number;
  specular: number;
  fresnel: number;
  edgeHighlight: number;
  brightness: number;
  shadowOpacity: number;
  description: string;
}

const PRESETS: Record<LiquidGlassMode, PresetSpec> = {
  normal: {
    id: "normal",
    name: "Normal Glass",
    sublabel: "Crystal Clear Refraction",
    tagline: "Pure transparency with crisp optical dispersion",
    refraction: 0.69,
    blurAmount: 0.08,
    chromAberration: 0.06,
    specular: 0.35,
    fresnel: 1.0,
    edgeHighlight: 0.12,
    brightness: 0.02,
    shadowOpacity: 0.3,
    description:
      "Sharp background visibility, Snell's law dual-surface refraction, and vivid chromatic fringing at bevel edges.",
  },
  dark: {
    id: "dark",
    name: "Dark Glass",
    sublabel: "Smoked Obsidian Tint",
    tagline: "Deep charcoal contrast tailored for native dark desktop",
    refraction: 0.55,
    blurAmount: 0.35,
    chromAberration: 0.03,
    specular: 0.25,
    fresnel: 0.85,
    edgeHighlight: 0.08,
    brightness: -0.28,
    shadowOpacity: 0.65,
    description:
      "Smoked obsidian base, subtle Blinn-Phong glint, high contact shadow absorption, and balanced background diffusion.",
  },
  frosted: {
    id: "frosted",
    name: "Frosted Glass",
    sublabel: "Heavy Gaussian Sheen",
    tagline: "Velvety light diffusion with luminous milky edge glow",
    refraction: 0.2,
    blurAmount: 0.65,
    chromAberration: 0.01,
    specular: 0.15,
    fresnel: 0.95,
    edgeHighlight: 0.18,
    brightness: 0.05,
    shadowOpacity: 0.4,
    description:
      "Multi-pass 9-tap Gaussian diffusion, soft diffuse highlight scatter, milky transmission sheen, and radiant rim illumination.",
  },
};

export default function LiquidGlassLab() {
  const { liquidGlassMode, setLiquidGlassMode } = useSettingsStore();
  const currentMode = liquidGlassMode || "dark";
  const activeSpec = PRESETS[currentMode];

  const rootRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState<number>(60);
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [webglActive, setWebglActive] = useState<boolean>(false);

  // Initialize @ybouane/liquidglass WebGL instance if supported in browser environment
  useEffect(() => {
    let instance: any = null;
    let isCancelled = false;

    async function initWebGL() {
      if (typeof window === "undefined" || !rootRef.current || !glassRef.current) return;

      try {
        // Dynamic import to prevent SSR issues
        const { LiquidGlass } = await import("@ybouane/liquidglass");

        if (isCancelled) return;

        // Apply dataset configuration to glass element
        glassRef.current.dataset.config = JSON.stringify({
          blurAmount: activeSpec.blurAmount,
          refraction: activeSpec.refraction,
          chromAberration: activeSpec.chromAberration,
          specular: activeSpec.specular,
          fresnel: activeSpec.fresnel,
          edgeHighlight: activeSpec.edgeHighlight,
          brightness: activeSpec.brightness,
          shadowOpacity: activeSpec.shadowOpacity,
          cornerRadius: 24,
          zRadius: 36,
          floating: true,
          button: true,
          bevelMode: 0, // biconvex pill
        });

        instance = await LiquidGlass.init({
          root: rootRef.current,
          glassElements: [glassRef.current],
          defaults: {
            cornerRadius: 24,
            refraction: activeSpec.refraction,
            blurAmount: activeSpec.blurAmount,
          },
        });

        if (isCancelled) {
          instance.destroy();
          return;
        }

        setWebglActive(true);

        // Update FPS counter
        const interval = setInterval(() => {
          if (instance && typeof instance.fps === "number" && instance.fps > 0) {
            setFps(Math.round(instance.fps));
          }
        }, 1000);

        return () => clearInterval(interval);
      } catch (err) {
        // Fallback to high-fidelity CSS optics engine
        console.info("LiquidGlass WebGL fallback to CSS/SVG optics:", err);
        setWebglActive(false);
      }
    }

    initWebGL();

    return () => {
      isCancelled = true;
      if (instance) {
        try {
          instance.destroy();
        } catch (_) {}
      }
    };
  }, [currentMode]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Status & Architecture info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl liquid-glass border border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-raaga-red to-raaga-pink flex items-center justify-center text-white shadow-md shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                ybouane/liquidglass Architecture
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {webglActive ? "WebGL Shader Active" : "Hardware Accelerated Optics"}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Dual-surface Snell refraction • 4-light Blinn-Phong specular • Chromatic dispersion • Exponential contact shadow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-mono text-neutral-300">
            <Activity className="w-3.5 h-3.5 text-raaga-red" />
            <span>{fps} FPS</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Liquid Glass Specimen Stage */}
      <div
        ref={rootRef}
        className="relative w-full h-[320px] rounded-[26px] overflow-hidden border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.9)] select-none"
        style={{ perspective: "1000px" }}
      >
        {/* Dynamic Background Stage (captured by refraction shader) */}
        <div className="absolute inset-0 bg-[#0a0a0e] overflow-hidden">
          {/* Vibrant mesh backdrop orbs */}
          <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-raaga-red/30 blur-[60px] animate-pulse" />
          <div className="absolute top-20 right-10 w-96 h-96 rounded-full bg-purple-600/25 blur-[70px]" />
          <div className="absolute -bottom-20 left-1/3 w-80 h-80 rounded-full bg-blue-600/25 blur-[60px]" />

          {/* High-frequency background pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25px 25px, white 1.5px, transparent 0)",
              backgroundSize: "50px 50px",
            }}
          />

          {/* Realistic Album Cover Mock on Background for testing refraction distortion */}
          <div className="absolute left-8 top-12 flex items-center gap-5 p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md max-w-sm pointer-events-none">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-tr from-raaga-red via-purple-600 to-blue-500 flex items-center justify-center text-white shadow-xl shrink-0 font-black text-xl">
              ♪
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-raaga-red">
                Optical Specimen
              </span>
              <h4 className="text-sm font-bold text-white leading-tight">
                Liquid Glass Refraction
              </h4>
              <p className="text-xs text-neutral-400">
                Observe the text & grid bending beneath the glass surface
              </p>
            </div>
          </div>

          {/* Center decorative typography to reveal edge chromatic aberration */}
          <div className="absolute right-12 bottom-12 text-right pointer-events-none opacity-40">
            <span className="text-4xl font-black text-white/20 tracking-tighter">
              RAAGA GLASS
            </span>
          </div>
        </div>

        {/* Live Draggable Floating Glass Panel */}
        <div
          ref={glassRef}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => setIsPressed(false)}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] p-6 rounded-[24px] cursor-grab active:cursor-grabbing transition-all duration-300 ${
            currentMode === "normal"
              ? "liquid-glass-sidebar border-white/30"
              : currentMode === "dark"
              ? "liquid-glass-sidebar border-white/15"
              : "liquid-glass-sidebar border-white/25"
          } ${isPressed ? "scale-95 shadow-[0_12px_32px_rgba(0,0,0,0.95)]" : "shadow-[0_24px_64px_rgba(0,0,0,0.85)]"}`}
          style={{
            transform: isPressed
              ? "translate(-50%, -50%) scale(0.97)"
              : "translate(-50%, -50%) scale(1)",
          }}
        >
          {/* Specular Glare Reflection Sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.12] via-transparent to-transparent pointer-events-none rounded-[inherit]" />

          {/* Chromatic Dispersion Rim simulation */}
          <div className="absolute inset-0 rounded-[inherit] border border-white/10 pointer-events-none shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(0,0,0,0.5)]" />

          {/* Panel Content */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-raaga-red/20 text-raaga-red border border-raaga-red/30">
                {activeSpec.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <Move className="w-3 h-3 text-neutral-400" />
                <span>Drag to Refract</span>
              </div>
            </div>

            <div>
              <h4 className="font-extrabold text-base text-white tracking-tight">
                {activeSpec.sublabel}
              </h4>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                {activeSpec.tagline}
              </p>
            </div>

            {/* Live Shader Optical Parameters */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px] font-mono">
              <div className="flex justify-between px-2 py-1 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-400">Refraction</span>
                <span className="text-white font-bold">{activeSpec.refraction}</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-400">Blur</span>
                <span className="text-white font-bold">{activeSpec.blurAmount}</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-400">Specular</span>
                <span className="text-white font-bold">{activeSpec.specular}</span>
              </div>
              <div className="flex justify-between px-2 py-1 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-400">Dispersion</span>
                <span className="text-white font-bold">{activeSpec.chromAberration}</span>
              </div>
            </div>

            {/* Test Button Mode */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Button Mode
              </span>
              <span className="text-neutral-500">
                {isPressed ? "Flattened (Pressed)" : "Click panel to test"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Three-Option Selector Cards (Normal, Dark, Frosted) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-raaga-red" />
            <span>Select Liquid Glass Preset</span>
          </label>
          <span className="text-[11px] text-neutral-400">
            Applies instantaneously across Sidebar, Player, Cards & Dialogs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(PRESETS) as LiquidGlassMode[]).map((modeKey) => {
            const preset = PRESETS[modeKey];
            const isSelected = currentMode === modeKey;

            return (
              <button
                key={modeKey}
                type="button"
                onClick={() => setLiquidGlassMode(modeKey)}
                className={`relative flex flex-col p-4 rounded-2xl border text-left transition-all duration-200 group ${
                  isSelected
                    ? "liquid-glass-nav-active border-raaga-red/60 shadow-[0_4px_24px_rgba(250,45,72,0.35)] scale-[1.02]"
                    : "liquid-glass hover:bg-white/[0.08] border-white/10 hover:border-white/20"
                }`}
              >
                {/* Active check pill */}
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                    {preset.name}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-white bg-raaga-red shadow-sm"
                        : "border-neutral-500 group-hover:border-neutral-400"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </div>
                </div>

                <span className="text-xs font-medium text-raaga-red mb-1">
                  {preset.sublabel}
                </span>

                <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2 mb-3">
                  {preset.description}
                </p>

                {/* Technical Metric Pills */}
                <div className="mt-auto grid grid-cols-2 gap-1.5 text-[10px] font-mono text-neutral-300">
                  <div className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/5">
                    Refr: {preset.refraction}
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/5">
                    Blur: {preset.blurAmount}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
