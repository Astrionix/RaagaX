'use client';

import React, { useState } from 'react';
import { Radio, Activity, Clock, Zap, Gauge, X, Info } from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';

interface JamSyncBadgeProps {
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function JamSyncBadge({ showLabel = true, className = '', size = 'md' }: JamSyncBadgeProps) {
  const { session, isInJam, diagnostics, participantState } = useJamStore();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  if (!isInJam || !session) return null;

  const isSynced = diagnostics.syncState === 'SYNCHRONIZED';
  const isSyncing = diagnostics.syncState === 'SYNCHRONIZING' || participantState === 'SYNCING';
  const isReconnecting = diagnostics.syncState === 'RECONNECTING' || participantState === 'RECONNECTING';

  const dotColor = isSynced
    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
    : isSyncing
    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-bounce'
    : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-ping';

  const badgeBg = isSynced
    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
    : isSyncing
    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
    : 'bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20';

  const statusLabel = isSynced ? 'Synced' : isSyncing ? 'Synchronizing' : 'Reconnecting';

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDiagnostics(!showDiagnostics);
        }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer select-none font-mono text-[10px] font-semibold ${badgeBg} ${className}`}
        title="Jam Playback Sync Status — Click for diagnostics"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {showLabel && <span>{statusLabel}</span>}
      </button>

      {/* Diagnostics Popover */}
      {showDiagnostics && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed md:absolute bottom-16 md:bottom-full mb-2 left-1/2 -translate-x-1/2 z-[150] w-72 p-3.5 bg-[#12131a]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] text-white text-xs select-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Activity className="w-3.5 h-3.5 text-[#FA233B]" />
              <span>Jam Sync Diagnostics</span>
            </div>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" /> Clock Offset
              </span>
              <span className="font-bold text-emerald-400">
                {diagnostics.clockOffsetMs > 0 ? `+${diagnostics.clockOffsetMs}` : diagnostics.clockOffsetMs} ms
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-cyan-400" /> Playback Drift
              </span>
              <span className={`font-bold ${Math.abs(diagnostics.playbackDriftMs) <= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {diagnostics.playbackDriftMs > 0 ? `+${diagnostics.playbackDriftMs}` : diagnostics.playbackDriftMs} ms
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Round-Trip (RTT)
              </span>
              <span className="font-bold text-slate-200">{diagnostics.rttMs} ms</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-purple-400" /> Network Jitter
              </span>
              <span className="font-bold text-slate-200">±{diagnostics.jitterMs} ms</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400">Schedule Lead Buffer</span>
              <span className="font-bold text-slate-200">{diagnostics.estimatedLeadTimeMs} ms</span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400">Session Revision</span>
              <span className="font-bold text-[#FA233B]">#{diagnostics.revision}</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 text-[9px] text-slate-400 font-sans flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span>Continuous drift engine aligns local playback automatically without audio stutter.</span>
          </div>
        </div>
      )}
    </div>
  );
}
