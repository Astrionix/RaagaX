'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { haptics } from '@/lib/haptics/HapticEngine';

export type ColorPreset =
  | 'amber'
  | 'heavy-rotation'
  | 'purple'
  | 'essentials'
  | 'crimson'
  | 'get-up'
  | 'teal'
  | 'chill'
  | 'ruby'
  | 'cyber'
  | 'emerald'
  | 'ocean'
  | 'midnight-red'
  | 'pink-glass'
  | 'white-red'
  | 'soft-glass';

export interface LiquidRedCardProps {
  id: string;
  badge?: string;
  badgeIcon?: React.ReactNode;
  title: string;
  description?: string;
  artists?: string;
  trackCount?: string;
  seed?: number;
  colorPreset?: ColorPreset;
  customColors?: [string, string, string, string, string];
  isPlaying?: boolean;
  isActive?: boolean;
  onPlayClick?: () => void;
  className?: string;
}

const PALETTES: Record<string, {
  colors: [string, string, string, string, string];
  fallbackCss: string;
  pillBorder: string;
  fallbackArtists: string;
}> = {
  // 1. Heavy Rotation — Warm Amber Gold & Tangerine
  amber: {
    colors: ['#2A0E00', '#7C2D12', '#C2410C', '#EA580C', '#F59E0B'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F59E0B 0%, #EA580C 25%, transparent 60%), linear-gradient(135deg, #2A0E00 0%, #7C2D12 40%, #C2410C 70%, #F59E0B 100%)',
    pillBorder: 'border-amber-400/40 text-amber-200',
    fallbackArtists: 'S.S. Thaman, Yazin Nizar, G.V. Prakash Kumar, Banjaare and more',
  },
  'heavy-rotation': {
    colors: ['#2A0E00', '#7C2D12', '#C2410C', '#EA580C', '#F59E0B'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F59E0B 0%, #EA580C 25%, transparent 60%), linear-gradient(135deg, #2A0E00 0%, #7C2D12 40%, #C2410C 70%, #F59E0B 100%)',
    pillBorder: 'border-amber-400/40 text-amber-200',
    fallbackArtists: 'S.S. Thaman, Yazin Nizar, G.V. Prakash Kumar, Banjaare and more',
  },
  'midnight-red': {
    colors: ['#2A0E00', '#7C2D12', '#C2410C', '#EA580C', '#F59E0B'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F59E0B 0%, #EA580C 25%, transparent 60%), linear-gradient(135deg, #2A0E00 0%, #7C2D12 40%, #C2410C 70%, #F59E0B 100%)',
    pillBorder: 'border-amber-400/40 text-amber-200',
    fallbackArtists: 'S.S. Thaman, Yazin Nizar, G.V. Prakash Kumar, Banjaare and more',
  },

  // 2. Your Essentials — Royal Indigo & Electric Violet
  purple: {
    colors: ['#0F0728', '#2E1065', '#5B21B6', '#7C3AED', '#C026D3'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #C026D3 0%, #7C3AED 25%, transparent 60%), linear-gradient(135deg, #0F0728 0%, #2E1065 40%, #5B21B6 70%, #C026D3 100%)',
    pillBorder: 'border-purple-400/40 text-purple-200',
    fallbackArtists: 'Sid Sriram, Guru Randhawa, Anuj Gurwara, Jonita Gandhi and more',
  },
  essentials: {
    colors: ['#0F0728', '#2E1065', '#5B21B6', '#7C3AED', '#C026D3'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #C026D3 0%, #7C3AED 25%, transparent 60%), linear-gradient(135deg, #0F0728 0%, #2E1065 40%, #5B21B6 70%, #C026D3 100%)',
    pillBorder: 'border-purple-400/40 text-purple-200',
    fallbackArtists: 'Sid Sriram, Guru Randhawa, Anuj Gurwara, Jonita Gandhi and more',
  },
  'pink-glass': {
    colors: ['#0F0728', '#2E1065', '#5B21B6', '#7C3AED', '#C026D3'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #C026D3 0%, #7C3AED 25%, transparent 60%), linear-gradient(135deg, #0F0728 0%, #2E1065 40%, #5B21B6 70%, #C026D3 100%)',
    pillBorder: 'border-purple-400/40 text-purple-200',
    fallbackArtists: 'Sid Sriram, Guru Randhawa, Anuj Gurwara, Jonita Gandhi and more',
  },
  cyber: {
    colors: ['#0F0728', '#2E1065', '#5B21B6', '#7C3AED', '#C026D3'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #C026D3 0%, #7C3AED 25%, transparent 60%), linear-gradient(135deg, #0F0728 0%, #2E1065 40%, #5B21B6 70%, #C026D3 100%)',
    pillBorder: 'border-purple-400/40 text-purple-200',
    fallbackArtists: 'Sid Sriram, Guru Randhawa, Anuj Gurwara, Jonita Gandhi and more',
  },

  // 3. Get Up! — Fiery Crimson Scarlet & Flame Orange
  crimson: {
    colors: ['#1C0305', '#7F1D1D', '#B91C1C', '#DC2626', '#F97316'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F97316 0%, #DC2626 25%, transparent 60%), linear-gradient(135deg, #1C0305 0%, #7F1D1D 40%, #DC2626 70%, #F97316 100%)',
    pillBorder: 'border-red-400/40 text-red-200',
    fallbackArtists: 'Spice, Nippandab, M3 sai, Gokulan Sembiyan, Aditya and more',
  },
  'get-up': {
    colors: ['#1C0305', '#7F1D1D', '#B91C1C', '#DC2626', '#F97316'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F97316 0%, #DC2626 25%, transparent 60%), linear-gradient(135deg, #1C0305 0%, #7F1D1D 40%, #DC2626 70%, #F97316 100%)',
    pillBorder: 'border-red-400/40 text-red-200',
    fallbackArtists: 'Spice, Nippandab, M3 sai, Gokulan Sembiyan, Aditya and more',
  },
  ruby: {
    colors: ['#1C0305', '#7F1D1D', '#B91C1C', '#DC2626', '#F97316'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F97316 0%, #DC2626 25%, transparent 60%), linear-gradient(135deg, #1C0305 0%, #7F1D1D 40%, #DC2626 70%, #F97316 100%)',
    pillBorder: 'border-red-400/40 text-red-200',
    fallbackArtists: 'Spice, Nippandab, M3 sai, Gokulan Sembiyan, Aditya and more',
  },
  'white-red': {
    colors: ['#1C0305', '#7F1D1D', '#B91C1C', '#DC2626', '#F97316'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #F97316 0%, #DC2626 25%, transparent 60%), linear-gradient(135deg, #1C0305 0%, #7F1D1D 40%, #DC2626 70%, #F97316 100%)',
    pillBorder: 'border-red-400/40 text-red-200',
    fallbackArtists: 'Spice, Nippandab, M3 sai, Gokulan Sembiyan, Aditya and more',
  },

  // 4. Chill — Emerald & Deep Ocean Teal
  teal: {
    colors: ['#021B17', '#064E3B', '#0D9488', '#10B981', '#06B6D4'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #06B6D4 0%, #10B981 25%, transparent 60%), linear-gradient(135deg, #021B17 0%, #064E3B 40%, #0D9488 70%, #06B6D4 100%)',
    pillBorder: 'border-teal-400/40 text-teal-200',
    fallbackArtists: 'Raghav Chaitanya, Anuv Jain, Prateek Kuhad, Aditya Rikhari and more',
  },
  chill: {
    colors: ['#021B17', '#064E3B', '#0D9488', '#10B981', '#06B6D4'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #06B6D4 0%, #10B981 25%, transparent 60%), linear-gradient(135deg, #021B17 0%, #064E3B 40%, #0D9488 70%, #06B6D4 100%)',
    pillBorder: 'border-teal-400/40 text-teal-200',
    fallbackArtists: 'Raghav Chaitanya, Anuv Jain, Prateek Kuhad, Aditya Rikhari and more',
  },
  emerald: {
    colors: ['#021B17', '#064E3B', '#0D9488', '#10B981', '#06B6D4'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #06B6D4 0%, #10B981 25%, transparent 60%), linear-gradient(135deg, #021B17 0%, #064E3B 40%, #0D9488 70%, #06B6D4 100%)',
    pillBorder: 'border-emerald-400/40 text-emerald-200',
    fallbackArtists: 'Raghav Chaitanya, Anuv Jain, Prateek Kuhad, Aditya Rikhari and more',
  },
  ocean: {
    colors: ['#021B17', '#064E3B', '#0D9488', '#10B981', '#06B6D4'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #06B6D4 0%, #10B981 25%, transparent 60%), linear-gradient(135deg, #021B17 0%, #064E3B 40%, #0D9488 70%, #06B6D4 100%)',
    pillBorder: 'border-cyan-400/40 text-cyan-200',
    fallbackArtists: 'Raghav Chaitanya, Anuv Jain, Prateek Kuhad, Aditya Rikhari and more',
  },
  'soft-glass': {
    colors: ['#021B17', '#064E3B', '#0D9488', '#10B981', '#06B6D4'],
    fallbackCss: 'radial-gradient(circle at 85% 20%, #06B6D4 0%, #10B981 25%, transparent 60%), linear-gradient(135deg, #021B17 0%, #064E3B 40%, #0D9488 70%, #06B6D4 100%)',
    pillBorder: 'border-teal-400/40 text-teal-200',
    fallbackArtists: 'Raghav Chaitanya, Anuv Jain, Prateek Kuhad, Aditya Rikhari and more',
  },
};

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
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
uniform vec3 u_color5;

void main() {
  vec2 uv = vUv;
  
  // Virtual time driven by clock and unique card seed
  float t = u_time * 0.26 + u_seed * 2.15;
  
  // Diagonal plane direction (~45 deg diagonal, propagating across the card)
  const float angle = 0.785398;
  vec2 dir = vec2(cos(angle), sin(angle));
  
  // Linear coordinate along the planar propagation axis
  float planeCoord = dot(uv, dir);
  
  // Interactive mouse offset along the propagation plane
  float mouseProj = dot(u_mouse, dir);
  float mouseShift = (mouseProj - planeCoord) * 0.22 * u_hover;

  // Real-time radial interactive ripple from mouse cursor
  float mouseDist = length(uv - u_mouse);
  float mouseRipple = sin(mouseDist * 16.0 - t * 4.0) * exp(-mouseDist * 4.0) * 0.35 * u_hover;

  // ── Planar 3D Wave Harmonics ──
  float wave1 = sin((planeCoord * 3.6 - t * 0.75) + mouseShift + mouseRipple) * 0.5 + 0.5;
  float wave2 = sin(planeCoord * 5.8 - t * 1.05 + 1.25) * 0.5 + 0.5;
  float wave3 = sin(planeCoord * 2.2 - t * 0.45 + 0.60) * 0.5 + 0.5;
  
  // Combined smooth planar liquid field
  float planarField = wave1 * 0.45 + wave2 * 0.30 + wave3 * 0.25;

  // Dynamic Motion Color Gradient Composition: Color 1 -> Color 2 -> Color 3 -> Color 4 -> Color 5
  vec3 col = mix(u_color1, u_color2, smoothstep(0.0, 0.32, planarField));
  col = mix(col, u_color3, smoothstep(0.25, 0.58, planarField));
  col = mix(col, u_color4, smoothstep(0.50, 0.82, planarField));
  col = mix(col, u_color5, smoothstep(0.75, 1.0, planarField) * 0.95);

  // Planar crest sheen
  float crest = pow(wave1 * wave2, 1.75);
  col += u_color4 * crest * 0.35;

  // ── Planar Luminous Diagonal White Highlight ──
  float sweepCycle = sin(t * 0.38) * 0.42 + 0.56;
  float highlightPos = planeCoord - sweepCycle + (u_mouse.x * 0.16 - 0.08) * u_hover;
  float whiteBeam = exp(-pow(highlightPos * 4.8, 2.0));

  // Strictly clip white highlight inside: fade to zero well before boundary
  float edgeFadeX = smoothstep(0.02, 0.16, uv.x) * smoothstep(0.98, 0.84, uv.x);
  float edgeFadeY = smoothstep(0.02, 0.16, uv.y) * smoothstep(0.98, 0.84, uv.y);
  float highlightBoundaryClip = edgeFadeX * edgeFadeY;
  whiteBeam *= highlightBoundaryClip;

  float topCornerGlow = exp(-length(uv - vec2(0.86, 0.20)) * 4.0) * 0.45 * highlightBoundaryClip;

  vec3 whiteLight = mix(vec3(1.0, 0.9, 0.95), vec3(1.0), clamp(whiteBeam * 1.25, 0.0, 1.0));
  col += whiteLight * (whiteBeam * 0.65 + topCornerGlow * 0.35 + whiteBeam * u_hover * 0.35);

  // Subtle pulsing ambient glow
  float pulse = 0.95 + 0.05 * sin(t * 1.4 + u_seed * 2.0);
  col *= pulse;

  // Inner border rim accent
  vec2 dEdge = min(uv, 1.0 - uv);
  float minEdgeDist = min(dEdge.x, dEdge.y);
  float innerRim = smoothstep(0.0, 0.03, minEdgeDist) * smoothstep(0.06, 0.03, minEdgeDist);
  col += u_color4 * innerRim * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function LiquidRedMotionCard({
  id,
  badge,
  badgeIcon,
  title,
  description,
  artists,
  trackCount,
  seed = 1,
  colorPreset = 'amber',
  customColors,
  isPlaying = false,
  isActive = false,
  onPlayClick,
  className = '',
}: LiquidRedCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const palette = PALETTES[colorPreset] || PALETTES.amber;
  const activeColors = customColors || palette.colors;
  const displayArtists = artists || description || palette.fallbackArtists;

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
      console.warn('[LiquidMotionCard] WebGL fallback to CSS gradient:', e);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(container.clientWidth || 300, container.clientHeight || 200) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_hover: { value: 0.0 },
      u_seed: { value: seed },
      u_color1: { value: new THREE.Color(activeColors[0]) },
      u_color2: { value: new THREE.Color(activeColors[1]) },
      u_color3: { value: new THREE.Color(activeColors[2]) },
      u_color4: { value: new THREE.Color(activeColors[3]) },
      u_color5: { value: new THREE.Color(activeColors[4]) },
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
      const height = container.clientHeight || 200;
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

      // Smooth mouse lerp for natural fluid inertia
      mouseCurrentRef.current.x += (mouseTargetRef.current.x - mouseCurrentRef.current.x) * 0.12;
      mouseCurrentRef.current.y += (mouseTargetRef.current.y - mouseCurrentRef.current.y) * 0.12;
      mouseCurrentRef.current.hover += (mouseTargetRef.current.hover - mouseCurrentRef.current.hover) * 0.14;

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
  }, [seed, colorPreset, activeColors]);

  // Update uniforms when palette changes
  useEffect(() => {
    if (threeRef.current.material) {
      const u = threeRef.current.material.uniforms;
      u.u_color1.value.set(activeColors[0]);
      u.u_color2.value.set(activeColors[1]);
      u.u_color3.value.set(activeColors[2]);
      u.u_color4.value.set(activeColors[3]);
      u.u_color5.value.set(activeColors[4]);
    }
  }, [activeColors]);

  // Pointer move & 3D tilt calculation
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    mouseTargetRef.current.x = nx;
    mouseTargetRef.current.y = 1.0 - ny; // flip for WebGL UV coords
    mouseTargetRef.current.hover = 1.0;

    // Smooth physical 3D card tilt
    const tiltX = (ny - 0.5) * -10;
    const tiltY = (nx - 0.5) * 10;
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
          isHovered ? 'translateY(-4px) scale3d(1.02, 1.02, 1.02)' : 'translateY(0px) scale3d(1, 1, 1)'
        }`,
        transformStyle: 'preserve-3d',
        borderRadius: '20px',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
      className={`group relative rounded-[20px] overflow-hidden cursor-pointer select-none transition-all duration-300 ease-out will-change-transform border border-white/15 hover:border-white/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.30),0_12px_28px_rgba(0,0,0,0.7)] hover:shadow-[inset_0_1px_2px_0_rgba(255,255,255,0.50),0_18px_40px_rgba(0,0,0,0.85)] min-h-[160px] sm:min-h-[185px] lg:min-h-[200px] flex flex-col justify-between p-3.5 sm:p-4 ${className}`}
    >
      {/* ── 1. 3D WEBGL FLUID LIQUID MOTION MESH CANVAS ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0 rounded-[20px]"
        style={{
          borderRadius: '20px',
          overflow: 'hidden',
          background: palette.fallbackCss,
        }}
      />

      {/* ── 2. GLOSS SPECULAR LIGHT SWEEP OVERLAY ── */}
      <div
        className="absolute inset-0 pointer-events-none z-1 rounded-[20px] transition-opacity duration-300"
        style={{
          borderRadius: '20px',
          background:
            'linear-gradient(120deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 30%, transparent 60%)',
          opacity: isHovered ? 0.9 : 0.6,
        }}
      />

      {/* ── 3. TOP ROW: RAAGAX BADGE + MIX TYPE PILL ── */}
      <div
        className="relative z-10 flex items-center justify-between w-full"
        style={{ transform: 'translateZ(22px)' }}
      >
        {/* Left: Mix Type Pill (e.g. ON REPEAT, ESSENTIALS, HIGH ENERGY, CHILL) */}
        {badge && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/20 backdrop-blur-md shadow-sm">
            {badgeIcon && <span className="text-white/90 flex-shrink-0 scale-90">{badgeIcon}</span>}
            <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-white/90">
              {badge}
            </span>
          </div>
        )}

        {/* Right: Modern RaagaX Brand Indicator */}
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/35 border border-white/15 backdrop-blur-md shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FA233B] animate-pulse" />
          <span className="text-[9px] font-black tracking-widest uppercase font-mono text-white/90">
            RaagaX
          </span>
        </div>
      </div>

      {/* ── 4. CENTER: BIG BOLD ICONIC TITLE + HOVER PLAY BUTTON ── */}
      <div
        className="relative z-10 my-auto text-center flex flex-col items-center justify-center px-1 py-1 sm:py-2"
        style={{ transform: 'translateZ(30px)' }}
      >
        <h3 className="text-lg sm:text-xl lg:text-[22px] font-black text-white tracking-tight leading-[1.12] drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] select-none">
          {title}
        </h3>

        {/* Floating Circular Glass Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptics.mediumImpact();
            onPlayClick?.();
          }}
          className={`mt-1.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 border flex-shrink-0 cursor-pointer shadow-lg ${
            isActive && isPlaying
              ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.9)] scale-105'
              : isHovered
              ? 'bg-white text-black border-white shadow-[0_4px_16px_rgba(0,0,0,0.5)] scale-100 opacity-100'
              : 'bg-white/20 border-white/40 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
          }`}
          aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
          title={isActive && isPlaying ? 'Pause' : 'Play'}
        >
          {isActive && isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-black stroke-none" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current stroke-none ml-0.5" />
          )}
        </button>
      </div>

      {/* ── 5. BOTTOM ROW: LIST OF ARTISTS (RaagaX Dynamic Style) ── */}
      <div
        className="relative z-10 w-full pt-1 flex items-end justify-between gap-2"
        style={{ transform: 'translateZ(20px)' }}
      >
        <p className="text-[10px] sm:text-[11px] text-white/85 font-medium line-clamp-1 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] select-none flex-1">
          {displayArtists}
        </p>

        {trackCount && (
          <span className="flex-shrink-0 text-[8.5px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-md bg-black/40 border border-white/10 text-white/70">
            {trackCount}
          </span>
        )}
      </div>
    </div>
  );
}

export const LiquidMotionCard = LiquidRedMotionCard;
