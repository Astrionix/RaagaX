'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

export interface LiquidMotionBackgroundProps {
  /** Optional cover artwork URL for underlying anchor glow */
  artworkUrl?: string | null;
  /** Extracted color palette from ArtworkColorExtractor */
  palette?: ChameleonPalette | null;
  /** Whether audio is actively playing (adjusts liquid kinetic velocity) */
  isPlaying?: boolean;
  /** Optional blur intensity in pixels (defaults to 80px) */
  blurAmount?: number;
  /** Optional saturation multiplier (defaults to 220%) */
  saturateAmount?: number;
  /** Vignette intensity: 'subtle' | 'balanced' | 'deep' */
  vignetteIntensity?: 'subtle' | 'balanced' | 'deep';
  /** Motion speed multiplier (e.g. 0.35 for subtle home screen, 1.0 for player) */
  speedMultiplier?: number;
  /** Canvas opacity (e.g. 0.5 for subtle home screen, 1.0 for player) */
  canvasOpacity?: number;
  /** Whether to use a transparent container instead of solid #050a0e base */
  transparentBase?: boolean;
  /** Optional children to render in the top frosted-glass layer */
  children?: React.ReactNode;
  /** Additional CSS class names for the outer container */
  className?: string;
  /** Whether to show the underlying photo-blurred cover art layer */
  showCoverBackdrop?: boolean;
}

interface KineticNode {
  baseX: number;
  baseY: number;
  radius: number;
  speedX: number;
  speedY: number;
  phaseX: number;
  phaseY: number;
  harmonics: number;
  currentRgb: [number, number, number];
  targetRgb: [number, number, number];
  currentAlpha: number;
  targetAlpha: number;
}

function parseRgb(colorStr?: string): [number, number, number] | null {
  if (!colorStr) return null;
  const match = colorStr.match(/\d+/g);
  if (match && match.length >= 3) {
    return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
  }
  return null;
}

// Default luxury Apple Music ambient palette (Fire Amber, Electric Cyan, Deep Magenta, Twilight Indigo)
const DEFAULT_RGB_PALETTE: [number, number, number][] = [
  [255, 95, 30],   // Vibrant Amber / Coral
  [0, 190, 235],   // Electric Cyan
  [180, 35, 120],  // Deep Neon Magenta
  [25, 45, 95],    // Midnight Indigo
];

export function LiquidMotionBackground({
  artworkUrl,
  palette,
  isPlaying = true,
  blurAmount = 80,
  saturateAmount = 220,
  vignetteIntensity = 'balanced',
  speedMultiplier = 1.0,
  canvasOpacity = 1.0,
  transparentBase = false,
  children,
  className = '',
  showCoverBackdrop = true,
}: LiquidMotionBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [internalPalette, setInternalPalette] = useState<ChameleonPalette | null>(null);

  // Auto-extract palette from artworkUrl if explicit palette is not provided
  useEffect(() => {
    if (palette) {
      setInternalPalette(palette);
      return;
    }
    if (!artworkUrl || artworkUrl.includes('default-playlist-cover') || typeof window === 'undefined') {
      setInternalPalette(null);
      return;
    }
    let isMounted = true;
    ArtworkColorExtractor.getInstance()
      .extractPalette(artworkUrl)
      .then((p) => {
        if (isMounted) setInternalPalette(p);
      });
    return () => {
      isMounted = false;
    };
  }, [palette, artworkUrl]);

  const activePalette = palette || internalPalette;

  // Extract 4 target RGB nodes from palette
  const targetColors = useMemo<[number, number, number][]>(() => {
    if (activePalette?.rawRgb && activePalette.rawRgb.length >= 4) {
      return activePalette.rawRgb.slice(0, 4);
    }

    if (activePalette) {
      const p = parseRgb(activePalette.primary);
      const s = parseRgb(activePalette.secondary);
      const h = parseRgb(activePalette.highlight);
      const a = parseRgb(activePalette.accent);

      return [
        p || DEFAULT_RGB_PALETTE[0],
        s || DEFAULT_RGB_PALETTE[1],
        h || DEFAULT_RGB_PALETTE[2],
        a || DEFAULT_RGB_PALETTE[3],
      ];
    }

    return DEFAULT_RGB_PALETTE;
  }, [activePalette]);

  // Persistent reference to kinetic nodes to allow smooth color interpolation across track changes
  const nodesRef = useRef<KineticNode[]>([
    {
      baseX: 0.32,
      baseY: 0.28,
      radius: 0.52,
      speedX: 0.00075,
      speedY: 0.00062,
      phaseX: 0,
      phaseY: 1.2,
      harmonics: 0.45,
      currentRgb: [...DEFAULT_RGB_PALETTE[0]],
      targetRgb: [...DEFAULT_RGB_PALETTE[0]],
      currentAlpha: 0.85,
      targetAlpha: 0.85,
    },
    {
      baseX: 0.72,
      baseY: 0.35,
      radius: 0.46,
      speedX: 0.00055,
      speedY: 0.00078,
      phaseX: 2.4,
      phaseY: 0.8,
      harmonics: 0.38,
      currentRgb: [...DEFAULT_RGB_PALETTE[1]],
      targetRgb: [...DEFAULT_RGB_PALETTE[1]],
      currentAlpha: 0.80,
      targetAlpha: 0.80,
    },
    {
      baseX: 0.50,
      baseY: 0.72,
      radius: 0.56,
      speedX: 0.00068,
      speedY: 0.00050,
      phaseX: 4.1,
      phaseY: 3.2,
      harmonics: 0.52,
      currentRgb: [...DEFAULT_RGB_PALETTE[2]],
      targetRgb: [...DEFAULT_RGB_PALETTE[2]],
      currentAlpha: 0.90,
      targetAlpha: 0.90,
    },
    {
      baseX: 0.20,
      baseY: 0.80,
      radius: 0.40,
      speedX: 0.00085,
      speedY: 0.00065,
      phaseX: 1.5,
      phaseY: 4.8,
      harmonics: 0.60,
      currentRgb: [...DEFAULT_RGB_PALETTE[3]],
      targetRgb: [...DEFAULT_RGB_PALETTE[3]],
      currentAlpha: 0.75,
      targetAlpha: 0.75,
    },
  ]);

  // Update target RGBs when song palette shifts
  useEffect(() => {
    const nodes = nodesRef.current;
    targetColors.forEach((rgb, idx) => {
      if (nodes[idx]) {
        nodes[idx].targetRgb = [rgb[0], rgb[1], rgb[2]];
      }
    });
  }, [targetColors]);

  // Canvas liquid motion rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Maintain an internal resolution optimized for high-performance optical blur
    const updateCanvasResolution = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(360, Math.floor(rect.width * dpr * 0.5));
      const height = Math.max(360, Math.floor(rect.height * dpr * 0.5));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    updateCanvasResolution();
    window.addEventListener('resize', updateCanvasResolution);

    let currentVelocity = isPlayingRef.current ? 1.0 : 0.12;
    let virtualTime = performance.now();
    let lastRealTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(now - lastRealTime, 64);
      lastRealTime = now;

      // Smoothly accelerate or decelerate velocity based on playback state
      const targetVelocity = (isPlayingRef.current ? 1.0 : 0.12) * speedMultiplier;
      currentVelocity += (targetVelocity - currentVelocity) * 0.05;

      if (!prefersReducedMotion) {
        virtualTime += dt * currentVelocity;
      }

      const width = canvas.width;
      const height = canvas.height;
      const minDim = Math.min(width, height);

      // Deep base fill
      ctx.fillStyle = '#050a0e';
      ctx.fillRect(0, 0, width, height);

      // Apple Music Screen composite mode to mix overlapping luminous fluid color nodes
      ctx.globalCompositeOperation = 'screen';

      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Smoothly interpolate RGB colors towards song palette targets (lerp ~60 frames)
        node.currentRgb[0] += (node.targetRgb[0] - node.currentRgb[0]) * 0.04;
        node.currentRgb[1] += (node.targetRgb[1] - node.currentRgb[1]) * 0.04;
        node.currentRgb[2] += (node.targetRgb[2] - node.currentRgb[2]) * 0.04;
        node.currentAlpha += (node.targetAlpha - node.currentAlpha) * 0.04;

        // Lissajous multi-harmonic organic trajectories
        const waveX1 = Math.sin(virtualTime * node.speedX + node.phaseX);
        const waveX2 = Math.cos(virtualTime * node.speedX * node.harmonics + node.phaseY) * 0.5;
        const waveY1 = Math.cos(virtualTime * node.speedY + node.phaseY);
        const waveY2 = Math.sin(virtualTime * node.speedY * node.harmonics + node.phaseX) * 0.5;

        const cx = (node.baseX + (waveX1 + waveX2) * 0.18) * width;
        const cy = (node.baseY + (waveY1 + waveY2) * 0.18) * height;

        // Breathing radial radius
        const pulse = 1 + Math.sin(virtualTime * 0.00045 + node.phaseX) * 0.08;
        const radius = node.radius * minDim * pulse;

        const r = Math.round(node.currentRgb[0]);
        const g = Math.round(node.currentRgb[1]);
        const b = Math.round(node.currentRgb[2]);
        const a = node.currentAlpha;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`);
        grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${(a * 0.55).toFixed(2)})`);
        grad.addColorStop(0.80, `rgba(${r}, ${g}, ${b}, ${(a * 0.15).toFixed(2)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';

      animFrameId.current = requestAnimationFrame(render);
    };

    // Pause rendering loop if page is hidden to preserve battery and CPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animFrameId.current) {
          cancelAnimationFrame(animFrameId.current);
          animFrameId.current = null;
        }
      } else {
        lastRealTime = performance.now();
        if (!animFrameId.current) {
          animFrameId.current = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateCanvasResolution);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }
    };
  }, []);

  // Vignette mask configs
  const vignetteRadialOpacity =
    vignetteIntensity === 'subtle'
      ? 'rgba(5, 10, 14, 0.10) 0%, rgba(5, 10, 14, 0.45) 60%, rgba(5, 10, 14, 0.85) 100%'
      : vignetteIntensity === 'deep'
      ? 'rgba(5, 10, 14, 0.25) 0%, rgba(5, 10, 14, 0.70) 60%, rgba(5, 10, 14, 0.98) 100%'
      : 'rgba(5, 10, 14, 0.18) 0%, rgba(5, 10, 14, 0.58) 60%, rgba(5, 10, 14, 0.92) 100%';

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${transparentBase ? 'bg-transparent' : 'bg-[#050a0e]'} select-none ${className}`}
    >
      {/* ── 3. BASE LAYER: LIQUID 3D / MESH MOTION CANVAS (z-0) ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Layer 3A: Optional Underlying Scaled Photo-Blur for Natural Anchor Resonance */}
        {showCoverBackdrop && artworkUrl && (
          <div
            className="absolute inset-0 opacity-35 scale-125 pointer-events-none transition-all duration-1000 ease-out"
            style={{
              backgroundImage: `url(${artworkUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(60px) saturate(180%) brightness(0.55)',
            }}
          />
        )}

        {/* Layer 3B: Kinetic Mesh Motion Canvas with Bleed Edge & Optical Diffusion */}
        <canvas
          ref={canvasRef}
          id="motionCanvas"
          className="absolute pointer-events-none"
          style={{
            /* Inset bleed ensures CSS Gaussian blur does not clip at borders */
            top: '-70px',
            left: '-70px',
            right: '-70px',
            bottom: '-70px',
            width: 'calc(100% + 140px)',
            height: 'calc(100% + 140px)',
            filter: `blur(${blurAmount}px) saturate(${saturateAmount}%)`,
            opacity: canvasOpacity,
            transform: 'translateZ(0)',
            willChange: 'filter, transform, opacity',
          }}
        />
      </div>

      {/* ── 2. MID LAYER: CONTRAST DIMMING & VIGNETTE OVERLAY (z-10) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse at 50% 38%, ${vignetteRadialOpacity})`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-700"
        style={{
          background:
            'linear-gradient(180deg, rgba(6, 7, 10, 0.32) 0%, rgba(6, 7, 10, 0.12) 32%, rgba(6, 7, 10, 0.68) 75%, #06070a 100%)',
        }}
      />

      {/* Micro-grain noise texture scrim to eliminate 8-bit banding on dark gradients */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── 1. TOP LAYER: FROSTED GLASS UI OVERLAY (z-20) ── */}
      {children && (
        <div className="relative z-20 w-full h-full flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}
