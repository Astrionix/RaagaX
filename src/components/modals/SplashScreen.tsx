'use client';

import React, { useState, useEffect } from 'react';
import { Disc3 } from 'lucide-react';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-[#07090E] flex flex-col items-center justify-center p-6 text-white select-none animate-out fade-out duration-500">
      <div className="space-y-6 text-center">
        {/* Animated Brand Disc */}
        <div className="relative w-24 h-24 rounded-3xl bg-[#EF233C] flex items-center justify-center mx-auto shadow-2xl shadow-red-500/40 animate-pulse">
          <Disc3 className="w-14 h-14 text-white animate-spin" style={{ animationDuration: '6s' }} />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-white">RaagaX</h1>
          <p className="text-xs font-bold text-[#EF233C] uppercase tracking-widest">Ultra Luxury Telugu Music</p>
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
