'use client';

import React, { useState, useEffect } from 'react';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';
import { RaagaXWaveform } from '@/components/brand/RaagaXWaveform';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-[var(--text-primary)] select-none animate-out fade-out duration-400 transition-colors">
      <div className="space-y-5 text-center flex flex-col items-center">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <RaagaXLogo variant="full" size={104} animated={true} />
        </div>

        {/* Wordmark & Official Tagline */}
        <div className="space-y-1">
          <RaagaXWordmark size="xl" />
          <p className="text-[11px] font-bold text-[#F20D18] tracking-[0.25em] uppercase mt-2">
            MUSIC THAT MOVES WITH YOU.
          </p>
        </div>

        {/* Waveform Visualizer */}
        <div className="pt-2">
          <RaagaXWaveform state="playing" barCount={7} height={18} />
        </div>
      </div>
    </div>
  );
}
