'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AudioReactiveWaveformProps {
  isPlaying: boolean;
  barCount?: number;
  className?: string;
}

export function AudioReactiveWaveform({
  isPlaying,
  barCount = 32,
  className = '',
}: AudioReactiveWaveformProps) {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: barCount }, (_, i) => {
      const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
      return Math.max(0.15, 1 - centerDist * 0.75);
    })
  );

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // Settle bars to resting state
      setBars(prev => prev.map(() => 0.18));
      return;
    }

    let t = 0;
    const updateLoop = () => {
      t += 0.08;
      const next = Array.from({ length: barCount }, (_, i) => {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const base = Math.max(0.2, 1 - centerDist * 0.7);
        // Multi-frequency harmonic wave simulation
        const wave1 = Math.sin(t * 1.8 + i * 0.45);
        const wave2 = Math.cos(t * 2.6 - i * 0.3);
        const wave3 = Math.sin(t * 3.4 + i * 0.8) * 0.5;
        const combined = (wave1 + wave2 + wave3) / 2.5;
        const normalized = Math.max(0.15, Math.min(1.0, base * (0.5 + combined * 0.5)));
        return normalized;
      });

      setBars(next);
      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, barCount, prefersReducedMotion]);

  return (
    <div
      aria-label="Audio Reactive Waveform"
      className={`flex items-center justify-center gap-[3px] h-9 px-4 w-full select-none ${className}`}
    >
      {bars.map((heightFactor, i) => {
        const isCenter = Math.abs(i - barCount / 2) < barCount / 4;
        return (
          <div
            key={i}
            className="flex-1 max-w-[4px] rounded-full transition-all duration-75"
            style={{
              height: `${Math.max(4, heightFactor * 32)}px`,
              backgroundColor: isCenter ? 'var(--chameleon-primary, #fa233b)' : 'var(--chameleon-secondary, #8b5cf6)',
              opacity: isPlaying ? 0.75 + heightFactor * 0.25 : 0.25,
              boxShadow: isPlaying && isCenter ? '0 0 8px var(--chameleon-glow, rgba(250,35,59,0.5))' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
