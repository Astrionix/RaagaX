'use client';

import React from 'react';

export type GlassLevel = 1 | 2 | 3 | 4;

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: GlassLevel;
  interactive?: boolean;
  shape?: 'rounded' | 'pill' | 'circle' | 'square';
  specular?: boolean;
  /** Optional artwork-derived rgba color to tint the glass subtly (e.g. 'rgba(140,28,48,0.12)') */
  refractionColor?: string;
  /** Optional ambient glow color rendered below the surface */
  glowColor?: string;
  children?: React.ReactNode;
}

/**
 * RaagaX 3D Liquid Glass Material System
 *
 * Renders a physically layered transparent glass surface with:
 *   Layer 1: backdrop-blur background diffusion
 *   Layer 2: transparent glass tint
 *   Layer 3: subtle artwork color refraction
 *   Layer 4: thin bright specular top edge
 *   Layer 5: soft inner shadow at base
 *   Layer 6: ambient outer shadow
 *   Layer 7: micro diagonal specular streak
 *
 * Glass Levels:
 *   1 — Very subtle: navigation bar, strip filters
 *   2 — Medium:      MiniPlayer, context pills, like/more buttons
 *   3 — Strong:      floating controls, action sheets, prev/next
 *   4 — Hero:        3D water-drop Play/Pause (white glass sphere)
 */
export function LiquidGlass({
  level = 2,
  interactive = false,
  shape = 'rounded',
  specular = true,
  refractionColor,
  glowColor,
  className = '',
  style = {},
  children,
  ...props
}: LiquidGlassProps) {
  // ── Shape ────────────────────────────────────────────────────────────────────
  const shapeClass = {
    rounded: 'rounded-[22px]',
    pill: 'rounded-full',
    circle: 'rounded-full',
    square: 'rounded-2xl',
  }[shape];

  // ── Glass level base styles ───────────────────────────────────────────────────
  // Each level stacks: backdrop-blur + bg tint + border + outer shadow
  const levelBase: Record<GlassLevel, string> = {
    1: [
      'bg-black/35',
      'backdrop-blur-md',
      'border border-white/[0.09]',
      'shadow-[0_4px_20px_rgba(0,0,0,0.45),inset_0_0_0_0.5px_rgba(255,255,255,0.06)]',
    ].join(' '),

    2: [
      'bg-[#0E0F18]/72',
      'backdrop-blur-xl',
      'border border-white/[0.12]',
      'shadow-[0_8px_30px_rgba(0,0,0,0.60),inset_0_0_0_0.5px_rgba(255,255,255,0.08)]',
    ].join(' '),

    3: [
      'bg-[#141520]/80',
      'backdrop-blur-2xl',
      'border border-white/[0.16]',
      'shadow-[0_12px_40px_rgba(0,0,0,0.75),inset_0_0_0_0.5px_rgba(255,255,255,0.10)]',
    ].join(' '),

    4: [
      'bg-gradient-to-b from-white/92 to-white/78',
      'backdrop-blur-3xl',
      'border border-white/50',
      // Outer glow gives the "sphere floating in space" effect
      'shadow-[0_12px_36px_rgba(255,255,255,0.22),0_4px_14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.90)]',
    ].join(' '),
  };

  // ── Interactive touch physics ────────────────────────────────────────────────
  const interactiveClass = interactive
    ? 'cursor-pointer select-none transition-[transform,box-shadow] duration-150 ease-out active:scale-[0.95] active:brightness-[0.92]'
    : '';

  // ── Custom shadow override for glow ──────────────────────────────────────────
  const shadowOverride = glowColor
    ? { boxShadow: `0 0 32px ${glowColor}, 0 8px 28px rgba(0,0,0,0.65)` }
    : {};

  return (
    <div
      className={`relative overflow-hidden ${shapeClass} ${levelBase[level]} ${interactiveClass} ${className}`}
      style={{ ...style, ...shadowOverride }}
      {...props}
    >
      {/* ── Layer 3: Artwork color refraction tint ─────────────────────────── */}
      {refractionColor && level !== 4 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: refractionColor }}
          aria-hidden="true"
        />
      )}

      {/* ── Layer 4: Specular top-edge highlight ────────────────────────────── */}
      {specular && (
        <div
          className={`absolute top-0 left-0 right-0 pointer-events-none ${
            level === 4
              ? 'h-[42%] bg-gradient-to-b from-white/70 via-white/25 to-transparent rounded-t-full blur-[1.5px]'
              : 'h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent'
          }`}
          aria-hidden="true"
        />
      )}

      {/* ── Layer 5: Soft inner shadow at bottom (physical depth) ───────────── */}
      {level !== 4 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[35%] bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-inherit"
          aria-hidden="true"
        />
      )}

      {/* ── Level 4 extra: Lower convex shadow on sphere ────────────────────── */}
      {level === 4 && (
        <div
          className="absolute bottom-0 left-[10%] right-[10%] h-[28%] bg-gradient-to-t from-black/22 to-transparent pointer-events-none rounded-b-full"
          aria-hidden="true"
        />
      )}

      {/* ── Layer 7: Micro diagonal specular streak (very subtle) ───────────── */}
      {specular && level !== 4 && (
        <div
          className="absolute top-0 left-0 w-[45%] h-[60%] pointer-events-none opacity-[0.035] rotate-12 -translate-x-2 -translate-y-2"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
