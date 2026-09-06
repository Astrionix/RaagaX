'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

export function VolumeHUD() {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstMount = useRef(true);

  const effectiveVol = isMuted ? 0 : (typeof volume === 'number' && !isNaN(volume) ? volume : 0.8);
  const pct = Math.round(effectiveVol * 100);

  useEffect(() => {
    // Avoid showing the HUD on initial app load
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 1400);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [volume, isMuted]);

  if (!visible) return null;

  const Icon = isMuted || effectiveVol === 0
    ? VolumeX
    : effectiveVol < 0.5
    ? Volume1
    : Volume2;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/90 backdrop-blur-2xl border border-white/15 text-white shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <Icon className={`w-4 h-4 flex-shrink-0 ${isMuted || effectiveVol === 0 ? 'text-[#FA233B]' : 'text-white'}`} />
        <div className="w-28 sm:w-36 h-1.5 bg-white/20 rounded-full relative overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-100 ${
              isMuted || effectiveVol === 0 ? 'bg-[#FA233B]' : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-mono font-bold text-white/90 min-w-[32px] text-right">
          {isMuted ? 'Muted' : `${pct}%`}
        </span>
      </div>
    </div>
  );
}
