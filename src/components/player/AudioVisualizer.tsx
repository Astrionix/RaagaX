'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';

interface AudioVisualizerProps {
  barCount?: number;
  height?: number;
  accentColor?: string;
  className?: string;
  variant?: 'bars' | 'waves' | 'particles';
}

export function AudioVisualizer({
  barCount = 24,
  height = 48,
  accentColor = '#FA233B',
  className = '',
  variant = 'bars',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      if (isPlayingRef.current) {
        phase += 0.08;
      }

      if (variant === 'bars') {
        const gap = 4;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2, (width - totalGap) / barCount);

        for (let i = 0; i < barCount; i++) {
          let bh: number;
          if (isPlayingRef.current) {
            const sin1 = Math.sin(phase + i * 0.45);
            const sin2 = Math.cos(phase * 1.3 + i * 0.25);
            const sin3 = Math.sin(phase * 0.7 + i * 0.8);
            const norm = (sin1 * 0.4 + sin2 * 0.35 + sin3 * 0.25 + 1) / 2;
            bh = Math.max(4, norm * (h - 6));
          } else {
            bh = 4;
          }

          const x = i * (barWidth + gap);
          const y = h - bh;

          // Gradient bar fill
          const grad = ctx.createLinearGradient(0, y, 0, h);
          grad.addColorStop(0, accentColor);
          grad.addColorStop(1, 'rgba(250, 35, 59, 0.25)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, bh, [3, 3, 0, 0]);
          ctx.fill();

          // Glow head dot on top of bar when active
          if (isPlayingRef.current && bh > 12) {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, y + 2, Math.min(2, barWidth / 2), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (variant === 'waves') {
        // Continuous organic wave path
        ctx.beginPath();
        ctx.moveTo(0, h / 2);

        for (let x = 0; x <= width; x += 4) {
          let y: number;
          if (isPlayingRef.current) {
            const wave1 = Math.sin(x * 0.04 + phase * 1.5) * (h * 0.35);
            const wave2 = Math.cos(x * 0.08 - phase * 2.0) * (h * 0.15);
            y = h / 2 + wave1 + wave2;
          } else {
            y = h / 2;
          }
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = isPlayingRef.current ? 12 : 0;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = height * (window.devicePixelRatio || 1);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [barCount, height, accentColor, variant]);

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
