'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Clock,
  Zap,
  Gauge,
  X,
  Info,
  Wifi,
  Monitor,
  Smartphone,
  Tablet,
  Music,
  Layers,
  Radio,
  Cpu,
} from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';

interface JamSyncBadgeProps {
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  placement?: 'down' | 'up';
}

export function JamSyncBadge({
  showLabel = true,
  className = '',
  size = 'md',
  placement = 'down',
}: JamSyncBadgeProps) {
  const { session, isInJam, diagnostics, participantState } = useJamStore();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDiagnostics) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDiagnostics(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [showDiagnostics]);

  if (!isInJam || !session) return null;

  const isOffline = diagnostics.connectionQuality === 'OFFLINE' || participantState === 'RECONNECTING';
  const isPoor = diagnostics.connectionQuality === 'POOR';
  const isFairOrSyncing = diagnostics.connectionQuality === 'FAIR' || diagnostics.syncState === 'SYNCHRONIZING' || participantState === 'SYNCING';
  const isSynced = !isOffline && !isPoor && !isFairOrSyncing && diagnostics.syncState === 'SYNCHRONIZED';

  const dotColor = isSynced
    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
    : isFairOrSyncing
    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-bounce'
    : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-ping';

  const badgeBg = isSynced
    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
    : isFairOrSyncing
    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
    : 'bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20';

  const statusLabel = isSynced
    ? 'Synced'
    : isFairOrSyncing
    ? 'Synchronizing'
    : isOffline
    ? 'Reconnecting'
    : 'Connection issue';

  const currentTrackId = session.trackId || session.currentSong?.id || diagnostics.trackId || 'N/A';
  const currentQueueId = session.currentQueueItemId || diagnostics.currentQueueItemId || 'N/A';
  const playbackState = session.state || diagnostics.playbackState || 'PAUSED';
  const generation = session.generation ?? diagnostics.generation ?? 1;
  const timelineId = session.timelineId || diagnostics.timelineId || 'TL_1';
  const transitionId = session.transitionId || diagnostics.transitionId || 'TR_1';
  const revision = session.revision ?? diagnostics.revision ?? 1;

  const deviceName = diagnostics.deviceName || 'Web Client';
  const deviceId = diagnostics.deviceId || 'DEV_LOCAL';
  const deviceType = diagnostics.deviceType || 'desktop';
  const platform = diagnostics.platform ? diagnostics.platform.toUpperCase() : 'WEB';
  const transport = diagnostics.transportLabel || (diagnostics.transport === 'LAN' ? 'LOCAL LAN' : 'LOCAL LAN / CLOUD RELAY');

  const positionClasses = placement === 'up'
    ? 'fixed md:absolute bottom-16 md:bottom-full mb-2 left-1/2 -translate-x-1/2'
    : 'fixed md:absolute top-20 md:top-full md:mt-2 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0';

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
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
          className={`${positionClasses} z-[150] w-84 max-w-[94vw] p-3.5 bg-[#0e1017]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] text-white text-xs select-none animate-in fade-in zoom-in-95 duration-150 max-h-[75vh] overflow-y-auto`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Activity className="w-3.5 h-3.5 text-[#FA233B]" />
              <span>Jam Network & Playback Sync</span>
            </div>
            <button
              onClick={() => setShowDiagnostics(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 font-mono text-[11px]">
            {/* 1. NETWORK & TIMELINE METRICS */}
            <div>
              <div className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-cyan-400" />
                <span>Network & Clock Sync</span>
              </div>
              <div className="space-y-1 bg-white/[0.03] p-2 rounded-xl border border-white/5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Connection Quality</span>
                  <span className={`font-bold ${isSynced ? 'text-emerald-400' : isFairOrSyncing ? 'text-amber-400' : 'text-rose-400'}`}>
                    {diagnostics.connectionQuality || 'GOOD'}
                  </span>
                </div>

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
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className={
                      Math.abs(diagnostics.playbackDriftMs) < 30
                        ? 'text-emerald-400'
                        : Math.abs(diagnostics.playbackDriftMs) < 100
                        ? 'text-cyan-400'
                        : Math.abs(diagnostics.playbackDriftMs) < 300
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }>
                      {diagnostics.playbackDriftMs > 0 ? `+${diagnostics.playbackDriftMs}` : diagnostics.playbackDriftMs} ms
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                      Math.abs(diagnostics.playbackDriftMs) < 30
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : Math.abs(diagnostics.playbackDriftMs) < 100
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        : Math.abs(diagnostics.playbackDriftMs) < 300
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}>
                      {diagnostics.driftQualityState || (Math.abs(diagnostics.playbackDriftMs) < 30 ? 'SYNCED' : 'CORRECTING')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> Latency / Median RTT
                  </span>
                  <span className="font-bold text-slate-200">
                    {diagnostics.rttMedianMs || diagnostics.rttMs} ms
                    {diagnostics.rttMs ? <span className="text-[9px] text-slate-500 font-normal ml-1">({diagnostics.rttMs}ms)</span> : null}
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-purple-400" /> Jitter
                  </span>
                  <span className="font-bold text-slate-200">±{diagnostics.jitterMs} ms</span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Packet Loss</span>
                  <span className={`font-bold ${diagnostics.packetLossPercent > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {diagnostics.packetLossPercent || 0}%
                  </span>
                </div>

                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Schedule Lead / Buffer</span>
                  <span className="font-bold text-slate-200">{diagnostics.estimatedLeadTimeMs} ms</span>
                </div>
              </div>
            </div>

            {/* 2. DEVICE INFORMATION */}
            <div>
              <div className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                {deviceType === 'mobile' ? (
                  <Smartphone className="w-3 h-3 text-pink-400" />
                ) : deviceType === 'tablet' ? (
                  <Tablet className="w-3 h-3 text-pink-400" />
                ) : (
                  <Monitor className="w-3 h-3 text-pink-400" />
                )}
                <span>Device Information</span>
              </div>
              <div className="space-y-1 bg-white/[0.03] p-2 rounded-xl border border-white/5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Device</span>
                  <span className="font-bold text-slate-200">{deviceName}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Device ID</span>
                  <span className="font-bold text-slate-300 font-mono text-[10px]">{deviceId}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Device Type</span>
                  <span className="font-bold text-slate-300 capitalize">{deviceType}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Platform</span>
                  <span className="font-bold text-cyan-300">{platform}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Transport</span>
                  <span className="font-bold text-indigo-300">{transport}</span>
                </div>
              </div>
            </div>

            {/* 3. PLAYBACK DIAGNOSTICS */}
            <div>
              <div className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Music className="w-3 h-3 text-[#FA233B]" />
                <span>Playback Diagnostics</span>
              </div>
              <div className="space-y-1 bg-white/[0.03] p-2 rounded-xl border border-white/5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Track</span>
                  <span className="font-bold text-slate-200 truncate max-w-[140px]" title={currentTrackId}>
                    {currentTrackId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Queue Item</span>
                  <span className="font-bold text-slate-300 truncate max-w-[140px]" title={currentQueueId}>
                    {currentQueueId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">State</span>
                  <span
                    className={`font-bold ${
                      playbackState === 'PLAYING' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {playbackState}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Generation</span>
                  <span className="font-bold text-pink-400">#{generation}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Timeline</span>
                  <span className="font-bold text-cyan-300 truncate max-w-[140px]" title={timelineId}>
                    {timelineId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Transition</span>
                  <span className="font-bold text-purple-300 truncate max-w-[140px]" title={transitionId}>
                    {transitionId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Revision</span>
                  <span className="font-bold text-[#FA233B]">#{revision}</span>
                </div>
              </div>
            </div>

            {/* 4. AUDIO BUFFER & STREAM STABILITY */}
            <div>
              <div className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-400" />
                <span>Audio Buffer & Stream Health</span>
              </div>
              <div className="space-y-1 bg-white/[0.03] p-2 rounded-xl border border-white/5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Buffered Ahead</span>
                  <span className="font-bold text-emerald-400">
                    {diagnostics.bufferedAheadMs !== undefined ? `${(diagnostics.bufferedAheadMs / 1000).toFixed(1)}s` : '3.5s'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Audio Decoder State</span>
                  <span className="font-bold text-slate-300">
                    {diagnostics.audioReadyState !== undefined ? `READY_${diagnostics.audioReadyState}` : 'READY_4'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Hard Seek Corrections</span>
                  <span className={`font-bold ${diagnostics.hardSeekCount && diagnostics.hardSeekCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {diagnostics.hardSeekCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-400">Buffering Stalls</span>
                  <span className={`font-bold ${diagnostics.bufferingCount && diagnostics.bufferingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {diagnostics.bufferingCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Unstuck / Resync Action */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await useJamStore.getState().resyncPlayback();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#FA233B]/20 hover:bg-[#FA233B]/30 border border-[#FA233B]/40 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-[#FA233B]" />
              <span>Resync Playback / Fix Lag</span>
            </button>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 text-[9px] text-slate-400 font-sans flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span>Auto-syncs every 3s. Click Resync above if playback ever stalls on Cloud.</span>
          </div>
        </div>
      )}
    </div>
  );
}

