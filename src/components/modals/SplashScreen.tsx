'use client';

import React, { useState, useEffect } from 'react';
import { useThemeStore } from '@/context/useThemeStore';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-[var(--bg-primary)] flex flex-col items-center justify-center p-6 text-[var(--text-primary)] select-none animate-out fade-out duration-500 transition-colors">
      <div className="space-y-6 text-center">
        {/* Animated Official Brand Logo */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center animate-pulse">
          <img 
            src={resolvedTheme === 'light' ? '/logo-light.png' : '/logo-dark.png'} 
            alt="RaagaX" 
            className="w-full h-full object-contain drop-shadow-[0_10px_30px_rgba(239,35,60,0.35)]" 
          />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">RaagaX</h1>
          <p className="text-xs font-bold text-[#EF233C] uppercase tracking-widest">Ultra Luxury Music</p>
        </div>

        {/* Soundwave equalizer bars animation */}
        <div className="flex items-center justify-center gap-1.5 pt-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1.5 bg-[#EF233C] rounded-full animate-bounce"
              style={{
                height: `${24 + i * 8}px`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.8s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
