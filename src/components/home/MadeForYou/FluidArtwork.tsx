'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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

// ── Inner R3F Mesh Component ──
function FluidMesh({
  palette,
  seed,
  isHovered = false,
  mousePos = { x: 0.5, y: 0.5 },
  isReducedMotion = false,
}: {
  palette: PaletteName;
  seed: number;
  isHovered?: boolean;
  mousePos?: { x: number; y: number };
  isReducedMotion?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const paletteConfig = useMemo(() => FLUID_PALETTES[palette] || FLUID_PALETTES.magenta, [palette]);

  // Create Uniforms object once
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uColor1: { value: paletteConfig.color1 },
      uColor2: { value: paletteConfig.color2 },
      uColor3: { value: paletteConfig.color3 },
      uColor4: { value: paletteConfig.color4 },
      uColorBg: { value: paletteConfig.colorBg },
      uRimColor: { value: paletteConfig.rimColor },
      uRoughness: { value: paletteConfig.roughness },
      uMetalness: { value: paletteConfig.metalness },
      uDisplacementScale: { value: paletteConfig.displacementScale },
      uNoiseFrequency: { value: paletteConfig.noiseFrequency },
    }),
    [paletteConfig, seed]
  );

  // Update static uniform values if palette changes
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uColor1.value = paletteConfig.color1;
    u.uColor2.value = paletteConfig.color2;
    u.uColor3.value = paletteConfig.color3;
    u.uColor4.value = paletteConfig.color4;
    u.uColorBg.value = paletteConfig.colorBg;
    u.uRimColor.value = paletteConfig.rimColor;
    u.uRoughness.value = paletteConfig.roughness;
    u.uMetalness.value = paletteConfig.metalness;
    u.uDisplacementScale.value = paletteConfig.displacementScale;
    u.uNoiseFrequency.value = paletteConfig.noiseFrequency;
  }, [paletteConfig]);

  // Smooth render loop animation without React state updates
  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;

    // Time advancement (paused if reduced motion)
    if (!isReducedMotion) {
      u.uTime.value += delta;
    }

    // Smooth spring lerping for mouse position
    u.uMouse.value.x = THREE.MathUtils.lerp(u.uMouse.value.x, mousePos.x, 0.08);
    u.uMouse.value.y = THREE.MathUtils.lerp(u.uMouse.value.y, mousePos.y, 0.08);

    // Smooth hover transition
    const targetHover = isHovered ? 1.0 : 0.0;
    u.uHover.value = THREE.MathUtils.lerp(u.uHover.value, targetHover, 0.08);

    // Subtle mesh tilt towards cursor
    if (meshRef.current) {
      const targetRotX = (mousePos.y - 0.5) * 0.15;
      const targetRotY = (mousePos.x - 0.5) * 0.15;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.05);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.05);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      {/* High precision sphere geometry for organic fluid morphing */}
      <icosahedronGeometry args={[1.5, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={fluidVertexShader}
        fragmentShader={fluidFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

// ── Outer Canvas & Viewport Observer Wrapper ──
export function FluidArtwork({
  palette,
  seed,
  isHovered = false,
  mousePos = { x: 0.5, y: 0.5 },
  className = '',
}: FluidArtworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(true);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // IntersectionObserver: Pause WebGL when card is out of view
  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 3.8], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop={isInView ? 'always' : 'never'}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        className="w-full h-full pointer-events-none"
      >
        <FluidMesh
          palette={palette}
          seed={seed}
          isHovered={isHovered}
          mousePos={mousePos}
          isReducedMotion={isReducedMotion}
        />
      </Canvas>
    </div>
  );
}
