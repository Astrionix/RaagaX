'use client';

import React, { useEffect, useRef } from 'react';

interface ParticleDriftCanvasProps {
  triggerKey: string | number;
  durationMs?: number;
  particleColor?: string;
  glowColor?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
}

export function ParticleDriftCanvas({
  triggerKey,
  durationMs = 540,
  particleColor = 'rgba(255, 255, 255, 0.9)',
  glowColor = 'rgba(160, 200, 255, 0.45)',
}: ParticleDriftCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Check if user has requested reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    const height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    // Spawn 32-48 glowing particles around the vertical center (active lyric line area)
    const particles: Particle[] = [];
    const count = 38;
    const centerY = height * 0.45;

    for (let i = 0; i < count; i++) {
      const startX = width * 0.15 + Math.random() * (width * 0.7);
      const startY = centerY + (Math.random() - 0.5) * 120;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.2;

      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6, // slight upward float
        size: 1.5 + Math.random() * 2.5,
        alpha: 0,
        maxAlpha: 0.6 + Math.random() * 0.4,
        life: 0,
        maxLife: durationMs,
      });
    }

    let startTime = performance.now();
    let animId: number;

    const render = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed > durationMs) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life = elapsed;

        // Fade in first 20%, fade out last 40%
        const progress = elapsed / durationMs;
        if (progress < 0.2) {
          p.alpha = (progress / 0.2) * p.maxAlpha;
        } else if (progress > 0.6) {
          p.alpha = (1 - (progress - 0.6) / 0.4) * p.maxAlpha;
        } else {
          p.alpha = p.maxAlpha;
        }

        // Draw soft double halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glowColor.replace(/[\d.]+\)$/, `${p.alpha * 0.35})`);
        ctx.fill();

        // Draw glowing particle core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColor.replace(/[\d.]+\)$/, `${p.alpha})`);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [triggerKey, durationMs, particleColor, glowColor]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
    />
  );
}
