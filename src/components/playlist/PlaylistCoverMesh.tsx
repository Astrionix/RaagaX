'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PlaylistVisualSpec } from '@/lib/playlist/playlistVisualGenerator';

interface PlaylistCoverMeshProps {
  spec: PlaylistVisualSpec;
  size?: 'small' | 'medium' | 'large' | 'hero';
  animated?: boolean;
  interactive?: boolean;
  className?: string;
}

export function PlaylistCoverMesh({
  spec,
  size = 'medium',
  animated = true,
  interactive = false,
  className = '',
}: PlaylistCoverMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Interactive mouse parallax drift (for large/hero sizes)
  const mouseRef = useRef({ targetX: 0, targetY: 0, currentX: 0, currentY: 0 });

  // 1. IntersectionObserver — halt rendering when scrolled out of view to preserve 100% GPU/battery
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2. Mouse parallax handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || (size !== 'large' && size !== 'hero')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseRef.current.targetX = nx * 0.12;
    mouseRef.current.targetY = ny * 0.12;
  };

  const handleMouseLeave = () => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  };

  // 3. Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Size-optimized internal buffer resolution
    const bufferDim =
      size === 'small' ? 84 : size === 'medium' ? 180 : size === 'large' ? 260 : 340;

    canvas.width = bufferDim;
    canvas.height = bufferDim;

    let virtualTime = spec.seed % 10000;
    let lastRealTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(now - lastRealTime, 64);
      lastRealTime = now;

      // Smooth mouse parallax lerp
      mouseRef.current.currentX += (mouseRef.current.targetX - mouseRef.current.currentX) * 0.08;
      mouseRef.current.currentY += (mouseRef.current.targetY - mouseRef.current.currentY) * 0.08;

      if (!prefersReducedMotion && animated) {
        virtualTime += dt * spec.animationSpeed;
      }

      const w = canvas.width;
      const h = canvas.height;
      const minDim = Math.min(w, h);

      // Deep atmospheric background
      ctx.fillStyle = spec.palette.darkBase;
      ctx.fillRect(0, 0, w, h);

      // Mix luminous blobs via screen blend
      ctx.globalCompositeOperation = 'screen';

      const nodes = spec.nodes;
      const mx = mouseRef.current.currentX;
      const my = mouseRef.current.currentY;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Smooth sinusoidal + Lissajous drift
        const waveX =
          Math.sin(virtualTime * node.speedX + node.phaseX) * 0.16 +
          Math.cos(virtualTime * node.speedX * node.harmonics + node.phaseY) * 0.08;
        const waveY =
          Math.cos(virtualTime * node.speedY + node.phaseY) * 0.16 +
          Math.sin(virtualTime * node.speedY * node.harmonics + node.phaseX) * 0.08;

        const cx = (node.baseX + waveX + mx * (i % 2 === 0 ? 1 : -1)) * w;
        const cy = (node.baseY + waveY + my * (i % 2 === 0 ? -1 : 1)) * h;

        // Subtle breathing scale pulse
        const pulse = 1 + Math.sin(virtualTime * 0.00035 + node.phaseX) * 0.08;
        const radius = node.radius * minDim * pulse * spec.intensity;

        const [r, g, b] = node.color;
        const a = node.alpha;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`);
        grad.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, ${(a * 0.55).toFixed(2)})`);
        grad.addColorStop(0.78, `rgba(${r}, ${g}, ${b}, ${(a * 0.15).toFixed(2)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // Halt loop if user has reduced motion or card is not visible
      if (isVisible && !prefersReducedMotion && animated) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    // Initial render
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [spec, size, animated, isVisible]);

  // CSS optical diffusion blur amount based on cover dimensions
  const blurPx =
    size === 'small' ? 24 : size === 'medium' ? 44 : size === 'large' ? 56 : 68;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ backgroundColor: spec.palette.darkBase }}
    >
      <canvas
        ref={canvasRef}
        className="absolute pointer-events-none"
        style={{
          top: '-25%',
          left: '-25%',
          width: '150%',
          height: '150%',
          filter: `blur(${blurPx}px) saturate(185%)`,
          transform: 'translateZ(0)',
          willChange: 'transform, filter',
        }}
      />
    </div>
  );
}
