'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RaagaXSplashScene } from '@/components/splash/RaagaXSplashScene';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';
import { RaagaXWaveform } from '@/components/brand/RaagaXWaveform';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [textRevealed, setTextRevealed] = useState(false);
  const [taglineRevealed, setTaglineRevealed] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const splashSceneRef = useRef<RaagaXSplashScene | null>(null);

  useEffect(() => {
    // 1. Detect WebGL Availability
    let isWebGlAvailable = true;
    try {
      const canvas = document.createElement('canvas');
      isWebGlAvailable = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
      isWebGlAvailable = false;
    }
    setWebGlSupported(isWebGlAvailable);

    // 2. Reduced Motion Check
    const prefersReducedMotion = typeof window !== 'undefined' 
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3. Staggered Cinematic Reveal Timeline (1.55s RAAGAX, 1.85s Tagline)
    const t1 = setTimeout(() => setTextRevealed(true), prefersReducedMotion ? 400 : 1550);
    const t2 = setTimeout(() => setTaglineRevealed(true), prefersReducedMotion ? 600 : 1850);

    // 4. Initialize Three.js Splash
    if (isWebGlAvailable && containerRef.current) {
      splashSceneRef.current = new RaagaXSplashScene({
        container: containerRef.current,
        reducedMotion: prefersReducedMotion,
        onComplete: () => {
          setIsVisible(false);
        },
      });
    }

    // 5. Fallback timer if Three.js completes or WebGL is disabled
    const fallbackTimer = setTimeout(() => {
      setIsVisible(false);
    }, prefersReducedMotion ? 1200 : 3300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(fallbackTimer);
      if (splashSceneRef.current) {
        splashSceneRef.current.destroy();
        splashSceneRef.current = null;
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] bg-[#040508] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-700 pointer-events-auto"
      style={{ opacity: 1 }}
    >
      {/* Three.js 3D WebGL Canvas Layer */}
      {webGlSupported && (
        <div 
          ref={containerRef} 
          className="absolute inset-0 z-0 w-full h-full"
        />
      )}

      {/* Cinematic Vignette Overlay */}
      <div className="absolute inset-0 z-[5] pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(4,5,8,0.85)_100%)]" />

      {/* 2D Brand Overlay Layer (Staggered Cinematic Typography) */}
      <div className="relative z-10 flex flex-col items-center pointer-events-none text-center px-4 mt-28 sm:mt-32">
        {/* Fallback Static Brand Logo if WebGL is unavailable */}
        {!webGlSupported && (
          <div className="mb-6 animate-in zoom-in-95 duration-500">
            <RaagaXLogo variant="full" size={100} animated={true} />
          </div>
        )}

        {/* RAAGAX Brand Title with Light Sweep (1.55s Reveal) */}
        <div 
          className={`relative overflow-hidden transition-all duration-700 transform ${
            textRevealed 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <div className="font-black font-sans leading-none flex items-baseline text-4xl sm:text-5xl tracking-[0.22em] drop-shadow-[0_0_25px_rgba(242,13,24,0.35)]">
            <span className="text-white">RAAGA</span>
            <span className="text-[#F20D18] drop-shadow-[0_0_18px_rgba(242,13,24,0.95)]">X</span>
          </div>

          {/* Subtle Light Sweep Accent */}
          {textRevealed && (
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_ease-out_forwards] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
          )}
        </div>

        {/* Official Tagline (1.85s Reveal) */}
        <div 
          className={`transition-all duration-700 delay-100 transform ${
            taglineRevealed 
              ? 'opacity-100 translate-y-0 tracking-[0.32em]' 
              : 'opacity-0 translate-y-2 tracking-[0.55em]'
          }`}
        >
          <p className="text-[10px] sm:text-xs font-black text-[#F20D18] uppercase mt-3.5 drop-shadow-[0_0_12px_rgba(242,13,24,0.6)]">
            MUSIC THAT MOVES WITH YOU.
          </p>
        </div>

        {/* WebGL Fallback Waveform Visualizer */}
        {!webGlSupported && (
          <div className="pt-4">
            <RaagaXWaveform state="playing" barCount={9} height={20} />
          </div>
        )}
      </div>
    </div>
  );
}
