'use client';

import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '@/lib/audioEngine';

interface Visualizer2DProps {
  isPlaying: boolean;
  width?: number;
  height?: number;
}

export function Visualizer2D({ isPlaying, width = 120, height = 30 }: Visualizer2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(64);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (isPlaying) {
        AudioEngine.getInstance().getFrequencyData(dataArray);
      }

      const barWidth = width / 16;
      let x = 0;

      for (let i = 0; i < 16; i++) {
        const val = isPlaying ? dataArray[i * 2] || 10 : 6;
        const barHeight = Math.max(4, (val / 255) * height);

        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#EF233C');
        gradient.addColorStop(1, '#D90429');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, 3);
        ctx.fill();

        x += barWidth;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="rounded-md opacity-90" />;
}
