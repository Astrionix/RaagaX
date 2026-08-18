'use client';

import React from 'react';
import { Sparkles, Lock, Bell, Disc3, X, Radio, ArrowRight, ShieldCheck } from 'lucide-react';

interface SystemSurfacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLockScreen: () => void;
  onOpenNotificationShade: () => void;
}

export function SystemSurfacesModal({
  isOpen,
  onClose,
  onOpenLockScreen,
  onOpenNotificationShade,
}: SystemSurfacesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--text-primary)]">System Surfaces</h3>
              <p className="text-xs text-[var(--text-secondary)]">Unified playback across 3 native Android surfaces</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Surface Selectors */}
        <div className="space-y-3">
          {/* Surface 1: Lock Screen */}
          <button
            onClick={() => {
              onClose();
              onOpenLockScreen();
            }}
            className="w-full p-4 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-left transition-all group cursor-pointer shadow-sm hover:scale-[1.01]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[#E50914] transition-colors">
                  Lock Screen Player
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">Cinematic clock, dynamic wallpaper & compact card</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#E50914] group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Surface 2: Notification Shade */}
          <button
            onClick={() => {
              onClose();
              onOpenNotificationShade();
            }}
            className="w-full p-4 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-left transition-all group cursor-pointer shadow-sm hover:scale-[1.01]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[#E50914] transition-colors">
                  Notification Shade
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">Single Android 14 MediaStyle player card</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#E50914] group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Surface 3: Dynamic Island */}
          <div className="w-full p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-left shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Dynamic Island
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">Floating live activity pill active at top of screen</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
              Always Active
            </span>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--text-secondary)] font-medium">
          <ShieldCheck className="w-4 h-4 text-[#E50914]" />
          <span>All 3 surfaces share the same global playback & download state.</span>
        </div>
      </div>
    </div>
  );
}
