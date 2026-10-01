"use client";

import React, { ReactNode } from "react";

interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
  variant?: "surface" | "card" | "dock" | "button" | "pill" | "subtle";
  intensity?: "low" | "medium" | "high";
  glow?: boolean;
  interactive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export function LiquidGlassFilters() {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
      <defs>
        {/* Subtle chromatic lens distortion for refractive edges */}
        <filter id="liquid-refract" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04 0.04"
            numOctaves="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
        </filter>

        {/* Specular edge caustic highlight */}
        <filter id="liquid-specular">
          <feSpecularLighting
            surfaceScale="2"
            specularConstant="1.2"
            specularExponent="20"
            lightingColor="#ffffff"
            result="specular"
          >
            <fePointLight x="-50" y="-100" z="300" />
          </feSpecularLighting>
          <feComposite in="SourceGraphic" in2="specular" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
  );
}

export default function LiquidGlass({
  children,
  className = "",
  variant = "surface",
  intensity = "medium",
  glow = false,
  interactive = false,
  onClick,
  style,
}: LiquidGlassProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "dock":
        return "bg-black/60 backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_1px_rgba(0,0,0,0.4)]";
      case "card":
        return "bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl border border-white/[0.12] hover:border-white/25 shadow-[0_15px_35px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]";
      case "button":
        return "bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-xl border border-white/25 hover:border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.35)]";
      case "pill":
        return "bg-white/[0.07] backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] rounded-full";
      case "subtle":
        return "bg-black/40 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]";
      case "surface":
      default:
        return "bg-gradient-to-br from-neutral-900/80 via-neutral-950/70 to-black/85 backdrop-blur-3xl border border-white/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.22)]";
    }
  };

  const glowEffect = glow
    ? "relative before:absolute before:-inset-0.5 before:bg-gradient-to-r before:from-raaga-red/30 before:to-purple-600/30 before:rounded-[inherit] before:blur-xl before:-z-10"
    : "";

  const interactiveEffect = interactive
    ? "hover:translate-y-[-2px] hover:shadow-[0_25px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.35)] transition-all duration-300 cursor-pointer"
    : "transition-all duration-300";

  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative ${getVariantStyles()} ${glowEffect} ${interactiveEffect} ${className}`}
    >
      {/* Specular Glare Reflection Sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none rounded-[inherit]" />
      
      {/* Content */}
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

export function LiquidGlassButton({
  children,
  onClick,
  className = "",
  active = false,
  title,
  icon,
}: {
  children?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  active?: boolean;
  title?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative group flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl font-semibold text-xs transition-all duration-200 backdrop-blur-xl border ${
        active
          ? "bg-raaga-red/90 text-white border-raaga-red/50 shadow-[0_0_20px_rgba(250,45,72,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-[1.02]"
          : "bg-white/[0.08] hover:bg-white/[0.15] text-white/90 hover:text-white border-white/20 hover:border-white/35 shadow-[0_8px_20px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:scale-[1.02] active:scale-95"
      } ${className}`}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition" />
      {icon}
      {children}
    </button>
  );
}
