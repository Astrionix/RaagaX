'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '@/context/useThemeStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { splashSoundEngine } from '@/components/splash/SplashSoundEngine';

export interface SplashScreenProps {
  onComplete?: () => void;
  enableAudio?: boolean;
}

/**
 * 2026-Grade Cinematic Animated Splash Screen for "RaagaX"
 * 
 * SOUND → RHYTHM → IDENTITY → PLAYBACK → RAAGAX
 * 
 * TIMELINE SPECIFICATION:
 * - 0.00–0.20s: Pure Black / Silent Dark Ambient Space
 * - 0.20–0.55s: Sound Awakens (7-9 precision organic audio waveform bars)
 * - 0.55–0.95s: Waveform Morphing into R geometry (continuous curve sweep + bar compression)
 * - 0.95–1.25s: Playback Identity (negative-space play triangle emerges forward)
 * - 1.25–1.50s: Signature Momentum Lock (settle with kinetic forward trail)
 * - 1.50–1.75s: Wordmark Reveal ("raaga" white, "x" crimson via left-to-right wipe)
 * - 1.75–1.95s: Tagline Reveal ("FEEL EVERY NOTE" uppercase tracking expansion)
 * - 1.95–2.10s: Final Brand Hold
 * - 2.10s+: Cinematic transition into application (scale down, smooth translate to header)
 */
export function SplashScreen({ onComplete, enableAudio = true }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [phase, setPhase] = useState<
    'black' | 'sound' | 'morph' | 'playback' | 'lock' | 'wordmark' | 'tagline' | 'hold' | 'transitioning'
  >('black');
  const [reducedMotion, setReducedMotion] = useState(false);
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme === 'dark';

  const soundEngineRef = useRef(splashSoundEngine);

  useEffect(() => {
    // 0. Fast-path: Check if already shown in this session, or if audio is actively playing / warm resume
    if (typeof window !== 'undefined') {
      const alreadyShown = sessionStorage.getItem('raagax_splash_completed') === 'true';
      const isPlayerActive = usePlayerStore.getState().isPlaying;
      
      if (alreadyShown || isPlayerActive) {
        setIsVisible(false);
        if (onComplete) onComplete();
        return;
      }

      // Check native background service if available
      import('@/lib/playback/native/RaagaXNativePlayer').then(({ RaagaXNativePlayer }) => {
        if (RaagaXNativePlayer.isNative()) {
          RaagaXNativePlayer.getPlaybackState().then(state => {
            if (state && state.isPlaying) {
              setIsVisible(false);
              if (onComplete) onComplete();
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // 1. Accessibility: Detect Reduced Motion
    const prefersReducedMotion = typeof window !== 'undefined' 
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    setReducedMotion(prefersReducedMotion);

    if (prefersReducedMotion) {
      // Streamlined 450ms accessible sequence
      const t1 = setTimeout(() => setPhase('lock'), 100);
      const t2 = setTimeout(() => setPhase('wordmark'), 250);
      const t3 = setTimeout(() => setPhase('tagline'), 350);
      const t4 = setTimeout(() => setPhase('transitioning'), 500);
      const t5 = setTimeout(() => {
        setIsVisible(false);
        if (typeof window !== 'undefined') sessionStorage.setItem('raagax_splash_completed', 'true');
        if (onComplete) onComplete();
      }, 700);

      return () => {
        [t1, t2, t3, t4, t5].forEach(clearTimeout);
      };
    }

    // 2. Fast 1.2s - 1.4s Cinematic Timeline
    const timers: NodeJS.Timeout[] = [];

    // Phase 1: 0.15s - Sound Awakens
    timers.push(setTimeout(() => {
      setPhase('sound');
      if (enableAudio) soundEngineRef.current.playSubPulse();
    }, 150));

    // Phase 2: 0.35s - Waveform Morphing into R
    timers.push(setTimeout(() => {
      setPhase('morph');
      if (enableAudio) soundEngineRef.current.playRisingTone();
    }, 350));

    // Phase 3: 0.60s - Playback Identity Emerges
    timers.push(setTimeout(() => {
      setPhase('playback');
      if (enableAudio) soundEngineRef.current.playClick();
    }, 600));

    // Phase 4: 0.80s - Signature Momentum Lock
    timers.push(setTimeout(() => {
      setPhase('lock');
    }, 800));

    // Phase 5: 0.95s - Wordmark Reveal (RaagaX)
    timers.push(setTimeout(() => {
      setPhase('wordmark');
      if (enableAudio) soundEngineRef.current.playResolutionChord();
    }, 950));

    // Phase 6: 1.10s - Tagline Reveal (Music that follows you)
    timers.push(setTimeout(() => {
      setPhase('tagline');
    }, 1100));

    // Phase 7: 1.25s - Final Brand Hold
    timers.push(setTimeout(() => {
      setPhase('hold');
    }, 1250));

    // Phase 8: 1.35s - Cinematic Transition to App Header
    timers.push(setTimeout(() => {
      setPhase('transitioning');
    }, 1350));

    // Phase 9: 1.50s - Complete & Dismount
    timers.push(setTimeout(() => {
      setIsVisible(false);
      if (typeof window !== 'undefined') sessionStorage.setItem('raagax_splash_completed', 'true');
      if (onComplete) onComplete();
    }, 1500));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [enableAudio, onComplete]);

  if (!isVisible) return null;

  const isTransitioning = phase === 'transitioning';
  const showWaveform = phase === 'sound';
  const showMorph = phase === 'morph';
  const showPlayback = ['playback', 'lock', 'wordmark', 'tagline', 'hold', 'transitioning'].includes(phase);
  const showWordmark = ['wordmark', 'tagline', 'hold', 'transitioning'].includes(phase);
  const showTagline = ['tagline', 'hold', 'transitioning'].includes(phase);
  const isSettled = ['lock', 'wordmark', 'tagline', 'hold', 'transitioning'].includes(phase);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center select-none overflow-hidden transition-all duration-500 ease-out ${
        isDark ? 'bg-[#07090E]' : 'bg-[#FFFFFF]'
      } ${
        isTransitioning ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      aria-label="RaagaX Splash Screen"
    >
      {/* 1. Subtle Center Ambient Glow (Dark Theme) */}
      {isDark && (
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-700 ${
            phase === 'black' ? 'w-48 h-48 opacity-20' :
            phase === 'playback' ? 'w-80 h-80 opacity-60' :
            isSettled ? 'w-64 h-64 opacity-35' : 'w-56 h-56 opacity-30'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(229, 9, 20, 0.45) 0%, rgba(6, 7, 9, 0) 70%)',
            filter: 'blur(50px)',
          }}
        />
      )}

      {/* 2. Master Motion Lockup Canvas */}
      <div 
        className={`relative z-10 flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isTransitioning ? 'scale-[0.88] -translate-y-6 opacity-0' : 'scale-100 translate-y-0 opacity-100'
        }`}
      >
        {/* ======================================================== */}
        {/* SVG ANIMATED LOGO MORPH CANVAS                           */}
        {/* ======================================================== */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
          
          {/* Subtle Momentum Trail at 1.25s */}
          {phase === 'lock' && (
            <div 
              className="absolute inset-0 scale-105 opacity-30 animate-ping pointer-events-none"
              style={{ filter: 'blur(8px)' }}
            >
              <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
                <rect x="20" y="18" width="12" height="64" rx="6" fill="#E50914" />
                <path d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" fill="#E50914" />
                <path d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" fill="#FF1E27" />
              </svg>
            </div>
          )}

          <svg 
            viewBox="0 0 100 100" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_8px_20px_rgba(229,9,20,0.35)]"
          >
            <defs>
              {/* RaagaX Red Gradient */}
              <linearGradient id="splashRedGrad" x1="20" y1="18" x2="84" y2="82" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF2E38" />
                <stop offset="0.6" stopColor="#E50914" />
                <stop offset="1" stopColor="#A80008" />
              </linearGradient>

              {/* Dynamic Glow Filter */}
              <filter id="splashGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow 
                  dx="0" 
                  dy="4" 
                  stdDeviation="4" 
                  floodColor="#E50914" 
                  floodOpacity={phase === 'playback' ? "0.8" : "0.4"} 
                />
              </filter>
            </defs>

            {/* ---------------------------------------------------- */}
            {/* 0.20-0.55s: INITIAL SOUNDWAVE BARS (SOUND AWAKENS)   */}
            {/* ---------------------------------------------------- */}
            {showWaveform && (
              <g className="transition-all duration-300">
                {/* Bar 1 */}
                <rect x="20" y="38" width="6" height="24" rx="3" fill="#E50914" className="animate-[pulse_0.4s_ease-in-out_infinite_alternate]" />
                {/* Bar 2 */}
                <rect x="28" y="28" width="6" height="44" rx="3" fill="#FF1E27" className="animate-[pulse_0.45s_ease-in-out_infinite_alternate_0.05s]" />
                {/* Bar 3 */}
                <rect x="36" y="22" width="6" height="56" rx="3" fill="#E50914" className="animate-[pulse_0.5s_ease-in-out_infinite_alternate_0.1s]" />
                {/* Bar 4 */}
                <rect x="44" y="32" width="6" height="36" rx="3" fill="#FF1E27" className="animate-[pulse_0.42s_ease-in-out_infinite_alternate_0.15s]" />
                {/* Bar 5 (Center) */}
                <rect x="52" y="18" width="6" height="64" rx="3" fill="#FFFFFF" className="animate-[pulse_0.48s_ease-in-out_infinite_alternate_0.2s]" />
                {/* Bar 6 */}
                <rect x="60" y="30" width="6" height="40" rx="3" fill="#FF1E27" className="animate-[pulse_0.44s_ease-in-out_infinite_alternate_0.25s]" />
                {/* Bar 7 */}
                <rect x="68" y="24" width="6" height="52" rx="3" fill="#E50914" className="animate-[pulse_0.52s_ease-in-out_infinite_alternate_0.3s]" />
                {/* Bar 8 */}
                <rect x="76" y="36" width="6" height="28" rx="3" fill="#FF1E27" className="animate-[pulse_0.41s_ease-in-out_infinite_alternate_0.35s]" />
              </g>
            )}

            {/* ---------------------------------------------------- */}
            {/* 0.55s+: MORPHED / SETTLED RAAGAX LOGO GEOMETRY       */}
            {/* ---------------------------------------------------- */}
            {(showMorph || showPlayback) && (
              <g className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                showMorph ? 'opacity-90 scale-95' : 'opacity-100 scale-100'
              }`}>
                {/* 1. Left Vertical Stem of 'R' (White on Dark, Charcoal on Light) */}
                <rect 
                  x="20" 
                  y="18" 
                  width="12" 
                  height="64" 
                  rx="6" 
                  fill={isDark ? '#FFFFFF' : '#0F172A'}
                  className="transition-all duration-300"
                />

                {/* 2. Outer Continuous Curved R-Stroke */}
                <path 
                  d="M38 18H58C71.2548 18 82 28.7452 82 42C82 55.2548 71.2548 66 58 66H38V18Z" 
                  fill="url(#splashRedGrad)" 
                  filter="url(#splashGlow)"
                  className="transition-all duration-400"
                />

                {/* 3. Negative-Space Play Triad Geometry (Emerges at 0.95s) */}
                <path 
                  d="M50 31L66 42L50 53V31Z" 
                  fill={isDark ? '#000000' : '#FFFFFF'}
                  className={`transition-all duration-300 transform origin-center ${
                    showPlayback ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-75 -translate-x-2'
                  }`}
                />

                {/* 4. Kinetic Forward Momentum Kick */}
                <path 
                  d="M46 59L68 82H84L60 55C55 55 50 57 46 59Z" 
                  fill="#FF1E27" 
                  filter="url(#splashGlow)"
                  className={`transition-all duration-400 transform ${
                    showMorph ? 'translate-y-2 opacity-70' : 'translate-y-0 opacity-100'
                  }`}
                />
              </g>
            )}
          </svg>
        </div>

        {/* ======================================================== */}
        {/* WORDMARK: raagax (0.150s Horizontal Wipe Reveal)          */}
        {/* ======================================================== */}
        <div 
          className="mt-6 overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            maxWidth: showWordmark ? '260px' : '0px',
            opacity: showWordmark ? 1 : 0,
          }}
        >
          <div className="font-extrabold font-sans text-3xl sm:text-4xl tracking-tight leading-none whitespace-nowrap flex items-baseline select-none">
            <span className={isDark ? 'text-white' : 'text-[#0F172A]'}>
              raaga
            </span>
            <span className="text-[#E50914] drop-shadow-[0_0_15px_rgba(229,9,20,0.85)]">
              x
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAGLINE: FEEL EVERY NOTE (0.175s Tracking Expansion)      */}
        {/* ======================================================== */}
        <div 
          className={`mt-2.5 transition-all duration-500 ease-out transform ${
            showTagline 
              ? 'opacity-80 translate-y-0 tracking-[0.28em]' 
              : 'opacity-0 translate-y-2 tracking-[0.15em]'
          }`}
        >
          <p className={`text-[11px] sm:text-xs font-semibold tracking-wide select-none ${
            isDark ? 'text-slate-300' : 'text-[#475569]'
          }`}>
            Music that follows you
          </p>
        </div>

      </div>
    </div>
  );
}
