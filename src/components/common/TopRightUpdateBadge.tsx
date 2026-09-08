'use client';

import React, { useState, useEffect } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { AppUpdateEngine } from '@/lib/update/AppUpdateEngine';
import { haptics } from '@/lib/haptics/HapticEngine';

export function TopRightUpdateBadge() {
  const [updateState, setUpdateState] = useState(() => AppUpdateEngine.getInstance().getSnapshot());

  useEffect(() => {
    const updateEngine = AppUpdateEngine.getInstance();
    updateEngine.startPeriodicCheck();
    const unsub = updateEngine.subscribe((state) => {
      setUpdateState(state);
    });
    return unsub;
  }, []);

  // ONLY VISIBLE WHEN UPDATE IS AVAILABLE & ON NATIVE MOBILE APK!
  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (!isNative || !updateState.isUpdateAvailable || !updateState.manifest) {
    return null;
  }

  const handleClick = () => {
    haptics.mediumImpact();
    AppUpdateEngine.getInstance().setModalOpen(true);
  };

  return (
    <button
      onClick={handleClick}
      title={`Update Ready: v${updateState.manifest.versionName}`}
      className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold tracking-wide transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer active:scale-95 animate-fade-in group select-none flex-shrink-0"
    >
      {/* Live Pulsing Green Dot Indicator */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>

      {/* Download Icon */}
      <Download className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-y-[0.5px] transition-transform" />

      {/* Badge Text */}
      <span className="hidden sm:inline font-mono font-semibold">
        v{updateState.manifest.versionName} Update
      </span>
      <span className="sm:hidden font-mono font-semibold">
        Update
      </span>

      <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" />
    </button>
  );
}
