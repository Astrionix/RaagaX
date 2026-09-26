'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FLUID_PALETTES, PaletteName } from './palettes';
import { fluidVertexShader, fluidFragmentShader } from './fluidShader';

export interface FluidArtworkProps {
  palette: PaletteName;
  seed: number;
  isHovered?: boolean;
  mousePos?: { x: number; y: number };
  className?: string;
}

export function FluidArtwork({
  palette,
  seed,
  isHovered = false,
  mousePos = { x: 0.5, y: 0.5 },
  className = '',
}: FluidArtworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paletteConfig = FLUID_PALETTES[palette] || FLUID_PALETTES['midnight-violet'];

  // Smooth lerped mouse positions for fluid damping
  const mouseTargetRef = useRef({ x: 0.5, y: 0.5, hover: 0.0 });
  const mouseCurrentRef = useRef({ x: 0.5, y: 0.5, hover: 0.0 });

  useEffect(() => {
    mouseTargetRef.current = {
      x: mousePos.x,
      y: 1.0 - mousePos.y, // WebGL coordinate flip
      hover: isHovered ? 1.0 : 0.0,
    };
  }, [mousePos, isHovered]);

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    } catch (e) {
      console.warn('[FluidArtwork] WebGL init fallback:', e);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: {
        value: new THREE.Vector2(container.clientWidth || 340, container.clientHeight || 260),
      },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_hover: { value: 0.0 },
      u_seed: { value: seed },
      u_color1: { value: paletteConfig.color1 },
      u_color2: { value: paletteConfig.color2 },
      u_color3: { value: paletteConfig.color3 },
      u_colorHighlight: { value: paletteConfig.rimColor },
      u_colorBg: { value: paletteConfig.colorBg },
    };

    // Full-bleed edge-to-edge quad plane (NO bubble, NO floating sphere)
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: fluidVertexShader,
      fragmentShader: fluidFragmentShader,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth || 340;
      const height = container.clientHeight || 260;
      renderer.setSize(width, height, false);
      uniforms.u_resolution.value.set(width, height);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    let animFrameId: number | null = null;
    let lastTime = performance.now();
    let virtualTime = seed * 40.0;

    const animate = (now: number) => {
      const dt = Math.min(now - lastTime, 48) * 0.001;
      lastTime = now;

      // Smooth spring lerping for liquid inertia
      mouseCurrentRef.current.x += (mouseTargetRef.current.x - mouseCurrentRef.current.x) * 0.04;
      mouseCurrentRef.current.y += (mouseTargetRef.current.y - mouseCurrentRef.current.y) * 0.04;
      mouseCurrentRef.current.hover += (mouseTargetRef.current.hover - mouseCurrentRef.current.hover) * 0.05;

      if (isVisible && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        virtualTime += dt;
        uniforms.u_time.value = virtualTime;
        uniforms.u_mouse.value.set(mouseCurrentRef.current.x, mouseCurrentRef.current.y);
        uniforms.u_hover.value = mouseCurrentRef.current.hover;
        renderer.render(scene, camera);
      }

      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      if (animFrameId) cancelAnimationFrame(animFrameId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [seed, paletteConfig]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{
        background: paletteConfig.fallbackCss,
        borderRadius: '32px',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        maskImage: 'radial-gradient(white, black)',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          borderRadius: '32px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
