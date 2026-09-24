'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { haptics } from '@/lib/haptics/HapticEngine';

export interface LiquidRedCardProps {
  id: string;
  badge: string;
  badgeIcon: React.ReactNode;
  title: string;
  description: string;
  trackCount: string;
  seed: number;
  isPlaying?: boolean;
  isActive?: boolean;
  onPlayClick?: () => void;
  className?: string;
}

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_hover;
uniform float u_seed;

void main() {
  vec2 uv = vUv;
  
  // Virtual time driven by clock and unique card seed
  float t = u_time * 0.22 + u_seed * 2.15;
  
  // Diagonal plane direction (~45 deg diagonal, propagating across the card)
  const float angle = 0.785398; // 45 degrees
  vec2 dir = vec2(cos(angle), sin(angle));
  
  // Linear coordinate along the planar propagation axis
  float planeCoord = dot(uv, dir);
  
  // Interactive mouse offset along the propagation plane
  float mouseProj = dot(u_mouse, dir);
  float mouseShift = (mouseProj - planeCoord) * 0.12 * u_hover;

  // ── Planar Wave Harmonics (Pure linear planes, ZERO spirals) ──
  // Plane 1: Primary deep red / crimson liquid swell
  float wave1 = sin((planeCoord * 3.4 - t * 0.65) + mouseShift) * 0.5 + 0.5;
  
  // Plane 2: Secondary harmonic planar wave in the same direction
  float wave2 = sin(planeCoord * 5.6 - t * 0.90 + 1.25) * 0.5 + 0.5;
  
  // Plane 3: Broad ambient planar surge
  float wave3 = sin(planeCoord * 1.9 - t * 0.40 + 0.60) * 0.5 + 0.5;
  
  // Combined smooth planar liquid field
  float planarField = wave1 * 0.45 + wave2 * 0.30 + wave3 * 0.25;

  // Exact Requested Color Palette:
  vec3 cBlack     = vec3(0.020, 0.000, 0.000);  // #050000 Pure/Deep Black
  vec3 cBurgundy  = vec3(0.227, 0.000, 0.063);  // #3A0010 Deep Burgundy
  vec3 cDarkRose  = vec3(0.439, 0.000, 0.094);  // #700018 Dark Rose
  vec3 cCrimson   = vec3(0.663, 0.000, 0.176);  // #A9002D Crimson
  vec3 cRoseRed   = vec3(0.831, 0.078, 0.271);  // #D41445 Rose Red
  vec3 cVividRed  = vec3(1.000, 0.000, 0.000);  // #FF0000 Intense Pure Red / ANIRUDH look
  vec3 cWhite     = vec3(1.000, 1.000, 1.000);  // #FFFFFF Pure Luminous White
  vec3 cSoftPink  = vec3(1.000, 0.820, 0.863);  // #FFD1DC Light Pink Transition

  // Planar Color Composition: Deep Burgundy base -> Dark Rose -> Crimson -> Rose Red -> Vivid Red
  // Red color reaches all the way to the edges without being crushed to black!
  vec3 col = mix(cBurgundy, cDarkRose, smoothstep(0.0, 0.32, planarField));
  col = mix(col, cCrimson, smoothstep(0.25, 0.58, planarField));
  col = mix(col, cRoseRed, smoothstep(0.50, 0.82, planarField));
  col = mix(col, cVividRed, smoothstep(0.75, 1.0, planarField) * 0.95);

  // Planar crest sheen
  float crest = pow(wave1 * wave2, 1.75);
  col += cRoseRed * crest * 0.35;

  // ── Planar Luminous Diagonal White Highlight ──
  // Sweeps in a straight, razor-clean diagonal plane across the card surface
  float sweepCycle = sin(t * 0.35) * 0.42 + 0.56;
  float highlightPos = planeCoord - sweepCycle + (u_mouse.x * 0.10 - 0.05) * u_hover;
  float whiteBeam = exp(-pow(highlightPos * 4.8, 2.0)); // soft Gaussian beam

  // Strictly clip white highlight inside: fade to zero well before boundary
  float edgeFadeX = smoothstep(0.02, 0.16, uv.x) * smoothstep(0.98, 0.84, uv.x);
  float edgeFadeY = smoothstep(0.02, 0.16, uv.y) * smoothstep(0.98, 0.84, uv.y);
  float highlightBoundaryClip = edgeFadeX * edgeFadeY;
  whiteBeam *= highlightBoundaryClip;

  // Top-right subtle radial specular accent anchor
  float topCornerGlow = exp(-length(uv - vec2(0.86, 0.20)) * 4.0) * 0.45 * highlightBoundaryClip;

  vec3 whiteLight = mix(cSoftPink, cWhite, clamp(whiteBeam * 1.25, 0.0, 1.0));
  col += whiteLight * (whiteBeam * 0.65 + topCornerGlow * 0.35 + whiteBeam * u_hover * 0.25);

  // Subtle pulsing red ambient glow
  float pulse = 0.95 + 0.05 * sin(t * 1.4 + u_seed * 2.0);
  col *= pulse;

  // Subtle inner border rim accent (crisp luxury edge separation strictly inside card)
  vec2 dEdge = min(uv, 1.0 - uv);
  float minEdgeDist = min(dEdge.x, dEdge.y);
  float innerRim = smoothstep(0.0, 0.03, minEdgeDist) * smoothstep(0.06, 0.03, minEdgeDist);
  col += vec3(1.0, 0.25, 0.4) * innerRim * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function LiquidRedMotionCard({
  id,
  badge,
  badgeIcon,
  title,
  description,
  trackCount,
  seed,
  isPlaying = false,
  isActive = false,
  onPlayClick,
  className = '',
}: LiquidRedCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // WebGL & Three.js references
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.OrthographicCamera | null;
    material: THREE.ShaderMaterial | null;
    mesh: THREE.Mesh | null;
    animFrameId: number | null;
    isVisible: boolean;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    material: null,
    mesh: null,
    animFrameId: null,
    isVisible: true,
  });

  const mouseTargetRef = useRef({ x: 0.5, y: 0.5, hover: 0.0 });
  const mouseCurrentRef = useRef({ x: 0.5, y: 0.5, hover: 0.0 });

  // 1. IntersectionObserver — halt 3D render loop when card is scrolled off-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        threeRef.current.isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2. Initialize Three.js WebGL Liquid Shader
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch (e) {
      console.warn('[LiquidRedMotionCard] WebGL init fallback to CSS gradient:', e);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(container.clientWidth || 300, container.clientHeight || 220) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_hover: { value: 0.0 },
      u_seed: { value: seed },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    threeRef.current = {
      renderer,
      scene,
      camera,
      material,
      mesh,
      animFrameId: null,
      isVisible: true,
    };

    const resize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth || 300;
      const height = container.clientHeight || 220;
      renderer.setSize(width, height, false);
      uniforms.u_resolution.value.set(width, height);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let lastTime = performance.now();
    let virtualTime = seed * 1000.0;

    const animate = (now: number) => {
      const dt = Math.min(now - lastTime, 64) * 0.001;
      lastTime = now;

      // Smooth mouse lerp
      mouseCurrentRef.current.x += (mouseTargetRef.current.x - mouseCurrentRef.current.x) * 0.08;
      mouseCurrentRef.current.y += (mouseTargetRef.current.y - mouseCurrentRef.current.y) * 0.08;
      mouseCurrentRef.current.hover += (mouseTargetRef.current.hover - mouseCurrentRef.current.hover) * 0.09;

      if (threeRef.current.isVisible) {
        virtualTime += dt;
        uniforms.u_time.value = virtualTime;
        uniforms.u_mouse.value.set(mouseCurrentRef.current.x, mouseCurrentRef.current.y);
        uniforms.u_hover.value = mouseCurrentRef.current.hover;
        renderer.render(scene, camera);
      }

      threeRef.current.animFrameId = requestAnimationFrame(animate);
    };

    threeRef.current.animFrameId = requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      if (threeRef.current.animFrameId) {
        cancelAnimationFrame(threeRef.current.animFrameId);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [seed]);

  // 3. Pointer move & 3D tilt calculation
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    mouseTargetRef.current.x = nx;
    mouseTargetRef.current.y = 1.0 - ny; // flip for WebGL UV coordinates
    mouseTargetRef.current.hover = 1.0;

    // Subtle 3D card tilt (-5deg to +5deg)
    const tiltX = (ny - 0.5) * -7;
    const tiltY = (nx - 0.5) * 7;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    mouseTargetRef.current.hover = 0.0;
    setTilt({ x: 0, y: 0 });
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
    mouseTargetRef.current.hover = 1.0;
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={() => {
        haptics.mediumImpact();
        onPlayClick?.();
      }}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) ${
          isHovered ? 'translateY(-5px)' : 'translateY(0px)'
        }`,
        borderRadius: '24px',
        overflow: 'hidden',
        isolation: 'isolate',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        maskImage: 'radial-gradient(white, black)',
      }}
      className={`group relative rounded-[24px] overflow-hidden cursor-pointer select-none transition-all duration-300 ease-out will-change-transform border border-white/[0.14] hover:border-white/[0.28] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.30),inset_0_0_24px_0_rgba(212,20,69,0.35),0_12px_32px_rgba(0,0,0,0.85)] hover:shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.50),inset_0_0_32px_0_rgba(255,43,91,0.50),0_18px_45px_rgba(0,0,0,0.95)] min-h-[220px] flex flex-col justify-between p-4 sm:p-5 ${className}`}
    >
      {/* ── 1. 3D THREE.JS WEBGL LIQUID MOTION CANVAS (STRICTLY CLIPPED INSIDE) ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0 rounded-[24px]"
        style={{
          borderRadius: '24px',
          overflow: 'hidden',
          // Fallback CSS gradient if WebGL is unavailable
          background:
            'radial-gradient(circle at 85% 20%, #FFFFFF 0%, #FFD1DC 12%, transparent 42%), radial-gradient(circle at 25% 30%, #D41445 0%, #A9002D 35%, transparent 65%), radial-gradient(circle at 70% 75%, #F02B5B 0%, #700018 45%, transparent 75%), linear-gradient(135deg, #3A0010 0%, #700018 35%, #A9002D 65%, #FFFFFF 100%)',
        }}
      />

      {/* ── 2. GLOSS SPECULAR LIGHT SWEEP OVERLAY (Strictly clipped inside) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-1 rounded-[24px] transition-opacity duration-300"
        style={{
          borderRadius: '24px',
          background:
            'linear-gradient(120deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 30%, transparent 60%)',
          opacity: isHovered ? 0.9 : 0.6,
        }}
      />

      {/* ── 3. TOP ROW: BADGE + PLAY BUTTON ── */}
      <div className="relative z-10 flex items-start justify-between">
        {/* Glass-Outline Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/25 bg-black/40 hover:border-white/40 hover:bg-black/55 backdrop-blur-md transition-all shadow-sm">
          <span className="text-white flex-shrink-0">{badgeIcon}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white leading-none">
            {badge}
          </span>
        </div>

        {/* Translucent White Glass Circular Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.mediumImpact();
            onPlayClick?.();
          }}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 border ${
            isActive && isPlaying
              ? 'bg-white text-[#D41445] border-white shadow-[0_0_24px_rgba(255,255,255,0.85)] scale-105'
              : 'bg-white/10 hover:bg-white/25 border-white/35 hover:border-white/70 text-white shadow-[0_0_18px_rgba(255,0,0,0.35)] group-hover:scale-105 backdrop-blur-md'
          }`}
          aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
        >
          {isActive && isPlaying ? (
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#D41445] stroke-none" />
          ) : (
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white stroke-none ml-0.5" />
          )}
        </button>
      </div>

      {/* ── 4. BOTTOM CONTENT: TITLE, DESCRIPTION, TRACK COUNT ── */}
      <div className="relative z-10 pt-8 sm:pt-10 flex flex-col justify-end">
        {/* Internal bottom legibility scrim */}
        <div className="absolute -inset-x-5 -bottom-5 h-28 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none -z-1 rounded-b-[24px]" />

        <h3 className="text-[17px] sm:text-[19px] font-black text-white tracking-tight leading-tight mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          {title}
        </h3>
        <p className="text-[11px] sm:text-[12px] text-white/85 font-medium line-clamp-1 mb-3 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
          {description}
        </p>

        {/* Bottom Left Track Count Pill in Dark Translucent Glass */}
        <div className="flex items-center">
          <span className="h-6 px-2.5 flex items-center rounded-lg bg-black/65 border border-red-500/35 text-white font-mono text-[10px] font-bold tracking-wider uppercase backdrop-blur-md shadow-sm">
            {trackCount}
          </span>
        </div>
      </div>
    </div>
  );
}
