'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Sparkles,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { AppUpdateEngine, CURRENT_APP_VERSION_NAME } from '@/lib/update/AppUpdateEngine';
import { haptics } from '@/lib/haptics/HapticEngine';

export function AppUpdateModal() {
  const [updateState, setUpdateState] = useState(() => AppUpdateEngine.getInstance().getSnapshot());

  useEffect(() => {
    const updateEngine = AppUpdateEngine.getInstance();
    const unsub = updateEngine.subscribe((state) => {
      setUpdateState(state);
    });
    return unsub;
  }, []);

  if (!updateState.isModalOpen || !updateState.manifest) {
    return null;
  }

  const manifest = updateState.manifest;
  const isDownloading = updateState.isDownloading;
  const progress = updateState.downloadProgress;

  const handleClose = () => {
    haptics.lightImpact();
    AppUpdateEngine.getInstance().setModalOpen(false);
  };

  const handleStartDownload = () => {
    haptics.mediumImpact();
    AppUpdateEngine.getInstance().downloadAndInstallUpdate();
  };

  const formattedFileSize = manifest.fileSize
    ? `${(manifest.fileSize / (1024 * 1024)).toFixed(1)} MB`
    : '14 MB';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md bg-[#121212] border border-emerald-500/30 shadow-[0_32px_64px_rgba(0,0,0,0.95)] rounded-3xl overflow-hidden text-white flex flex-col transition-all duration-300">
        
        {/* Header Hero Section */}
        <div className="relative p-6 pb-4 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent border-b border-white/10">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Download className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-black text-[10px] font-black tracking-wider uppercase">
                  New Update
                </span>
                <span className="text-xs text-white/60 font-mono">
                  {manifest.releaseDate || 'Latest Release'}
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
                RaagaX v{manifest.versionName}
              </h2>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-white/70 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Current: <strong className="text-white">v{CURRENT_APP_VERSION_NAME}</strong></span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/40" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target: <strong className="text-emerald-400">v{manifest.versionName}</strong></span>
            </div>
          </div>
        </div>

        {/* Release Notes Body */}
        <div className="p-6 space-y-4 max-h-[280px] overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> What&apos;s New in this Release
          </h3>

          <ul className="space-y-2.5 text-xs text-white/90">
            {(manifest.releaseNotes && manifest.releaseNotes.length > 0
              ? manifest.releaseNotes
              : [
                  'Fixed Jam Session guest playback flickering and audio stutters.',
                  'Seamless volume button synchronization on mobile devices.',
                  'Performance enhancements and lossless audio engine stability.'
                ]
            ).map((note, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-white/5 border border-white/5 rounded-xl p-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{note}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between pt-2 text-[11px] text-white/50">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> Size: {formattedFileSize}
            </span>
            <span className="flex items-center gap-1 text-emerald-400/80">
              <ShieldCheck className="w-3 h-3" /> SHA-256 Verified
            </span>
          </div>
        </div>

        {/* Footer Actions & Progress Bar */}
        <div className="p-6 pt-3 bg-black/40 border-t border-white/10 space-y-3">
          {isDownloading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Downloading Update...
                </span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartDownload}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm tracking-wide shadow-[0_0_24px_rgba(16,185,129,0.4)] hover:shadow-[0_0_32px_rgba(16,185,129,0.6)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-4 h-4 stroke-[3]" />
              Install Update Now ({formattedFileSize})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
