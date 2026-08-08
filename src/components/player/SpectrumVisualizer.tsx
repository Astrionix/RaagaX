'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AudioEngine } from '@/lib/audioEngine';

export function SpectrumVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isPlaying } = usePlayerStore();

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const audioEngine = AudioEngine.getInstance();
    const dataArray = new Uint8Array(audioEngine.getAnalyserFrequencyBinCount() || 64);

    const draw = () => {
      animId = requestAnimationFrame(draw);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isPlaying) {
        return;
      }

      audioEngine.getFrequencyData(dataArray);

      const barWidth = (canvas.width / 24) - 2;
      let x = 0;

      for (let i = 0; i < 24; i++) {
        const val = dataArray[i * 2] || 0;
        const percent = val / 255;
        const barHeight = Math.max(2, percent * canvas.height);

        // Crimson Gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#EF233C');
        gradient.addColorStop(1, '#FF758F');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  return (
    <div className="hidden lg:flex items-center px-2 py-0.5 rounded-lg bg-black/50 border border-white/10" title="Web Audio API Spectrum Visualizer">
      <canvas ref={canvasRef} width={80} height={16} className="w-20 h-4" />
    </div>
  );
}
