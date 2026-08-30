'use client';

import React, { useEffect, useState } from 'react';
import { useJamStore } from '@/context/useJamStore';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { DriftCorrectionEngine, DriftStatus } from '@/lib/jam/client/DriftCorrectionEngine';
import { NetworkQualityEngine } from '@/lib/jam/client/NetworkQualityEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { Activity, Radio, Cpu, RefreshCw, X, Wifi, Zap } from 'lucide-react';

/**
 * RaagaX Jam Development Synchronization & Diagnostics Panel (Section 26 & 42)
 * Visible in development mode or when query parameter ?jam_debug=1 is present.
 */
export function JamDevSyncPanel() {
  const isDev = process.env.NODE_ENV === 'development';
  const [showPanel, setShowPanel] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const { session, isInJam, participantState, diagnostics } = useJamStore();
  const [driftStatus, setDriftStatus] = useState<DriftStatus | null>(null);
  const [clockState, setClockState] = useState(ClockSyncEngine.getInstance().getState());
  const [netMetrics, setNetMetrics] = useState(NetworkQualityEngine.getInstance().getMetrics());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (isDev || params.get('jam_debug') === '1') {
      setShowPanel(true);
    }
  }, [isDev]);

  useEffect(() => {
    if (!isInJam) return;

    const unsubDrift = DriftCorrectionEngine.getInstance().subscribe((status) => {
      setDriftStatus(status);
    });

    const unsubNet = NetworkQualityEngine.getInstance().subscribe((metrics) => {
      setNetMetrics(metrics);
    });

    const clockInterval = setInterval(() => {
      setClockState(ClockSyncEngine.getInstance().getState());
    }, 500);

    return () => {
      unsubDrift();
      unsubNet();
      clearInterval(clockInterval);
    };
  }, [isInJam]);

  if (!showPanel || !isInJam || !session) return null;

  const pb = PlaybackService.getInstance();
  const activeAudio = pb.getActiveAudio();
  const actualLocalSec = activeAudio ? activeAudio.currentTime : 0;
  const expectedSec = driftStatus ? driftStatus.expectedPositionMs / 1000 : 0;
  const driftMs = driftStatus ? driftStatus.driftMs : 0;
  const absDrift = Math.abs(driftMs);

  const driftColor =
    absDrift <= 35 ? 'text-emerald-400' : absDrift <= 120 ? 'text-yellow-400' : 'text-rose-400';

  const qualityColor =
    netMetrics.quality === 'EXCELLENT'
      ? 'text-emerald-400'
      : netMetrics.quality === 'GOOD'
      ? 'text-cyan-400'
      : netMetrics.quality === 'FAIR'
      ? 'text-yellow-400'
      : 'text-rose-400';

  let bufferSec = 0;
  if (activeAudio && activeAudio.buffered.length > 0) {
    const curTime = activeAudio.currentTime;
    for (let i = 0; i < activeAudio.buffered.length; i++) {
      if (activeAudio.buffered.start(i) <= curTime && curTime <= activeAudio.buffered.end(i)) {
        bufferSec = Math.max(0, activeAudio.buffered.end(i) - curTime);
        break;
      }
    }
  }

  const currentTrackId = session.trackId || session.currentSong?.id || 'N/A';
  const currentQueueId = session.currentQueueItemId || 'N/A';
  const deviceName = diagnostics.deviceName || 'Web Client';
  const deviceId = diagnostics.deviceId || 'DEV_LOCAL';
  const deviceType = diagnostics.deviceType || 'desktop';
  const platform = diagnostics.platform ? diagnostics.platform.toUpperCase() : 'WEB';
  const transport = diagnostics.transportLabel || (netMetrics.transport === 'LAN' ? 'LOCAL LAN' : 'LOCAL LAN / CLOUD RELAY');

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 left-4 z-50 px-3 py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-[10px] font-mono flex items-center gap-1.5 shadow-xl hover:scale-105 transition-all cursor-pointer"
      >
        <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
        <span>SYNC DEBUG ({driftMs >= 0 ? `+${driftMs}` : driftMs}ms)</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 z-50 w-84 rounded-2xl bg-[#0B0F19]/95 backdrop-blur-xl border border-cyan-500/30 text-white shadow-2xl p-3.5 text-xs font-mono select-none animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider text-[11px]">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>JAM SYNC & PLAYBACK DEBUG</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="text-white/40 hover:text-white text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            Minimize
          </button>
          <button
            onClick={() => setShowPanel(false)}
            className="text-white/40 hover:text-rose-400 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Data */}
      <div className="space-y-1 text-[11px]">
        {/* 1. PLAYBACK DIAGNOSTICS */}
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider my-1">
          PLAYBACK
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Track:</span>
          <span className="text-white/90 font-bold truncate max-w-[150px]" title={currentTrackId}>{currentTrackId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Queue Item:</span>
          <span className="text-white/80 truncate max-w-[150px]" title={currentQueueId}>{currentQueueId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">State:</span>
          <span
            className={`font-bold ${
              session.state === 'PLAYING' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {session.state} ({participantState})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Generation:</span>
          <span className="text-pink-400 font-bold">#{session.generation ?? 1}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Timeline:</span>
          <span className="text-cyan-400 text-[10px] truncate max-w-[150px]" title={session.timelineId}>{session.timelineId || 'TL_1'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Transition:</span>
          <span className="text-purple-300 truncate max-w-[150px]" title={session.transitionId}>{session.transitionId || 'TR_1'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Revision:</span>
          <span className="text-[#FA233B] font-bold">#{session.revision}</span>
        </div>

        <div className="h-px bg-white/10 my-1.5" />

        {/* 2. DEVICE INFORMATION */}
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider my-1">
          DEVICE
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Device:</span>
          <span className="text-slate-200 font-bold">{deviceName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Device ID:</span>
          <span className="text-slate-300 font-mono text-[10px]">{deviceId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Device Type:</span>
          <span className="text-slate-300 capitalize">{deviceType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Platform:</span>
          <span className="text-cyan-300">{platform}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Transport:</span>
          <span className="text-indigo-300 font-bold">{transport}</span>
        </div>

        <div className="h-px bg-white/10 my-1.5" />

        {/* 3. NETWORK & TIMELINE METRICS */}
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider my-1">
          NETWORK & SYNC
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Quality:</span>
          <span className={`font-bold ${qualityColor}`}>{netMetrics.quality}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">RTT (Median):</span>
          <span className="text-cyan-300 font-bold">{netMetrics.rttMedian} ms <span className="text-[9px] text-white/40">({netMetrics.rtt}ms raw)</span></span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Jitter:</span>
          <span className="text-cyan-300">±{netMetrics.jitter} ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Packet Loss:</span>
          <span className={netMetrics.packetLoss > 0 ? 'text-rose-400' : 'text-emerald-400'}>{netMetrics.packetLoss}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Clock Offset:</span>
          <span className="text-cyan-300">
            {clockState.offsetMs >= 0 ? `+${Math.round(clockState.offsetMs)}` : Math.round(clockState.offsetMs)} ms
          </span>
        </div>

        <div className="h-px bg-white/10 my-1.5" />

        {/* 4. DRIFT & AUDIO TIMELINE */}
        <div className="flex justify-between">
          <span className="text-white/40">Expected Pos:</span>
          <span className="text-white/90">{expectedSec.toFixed(3)}s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Actual Local:</span>
          <span className="text-white/90">{actualLocalSec.toFixed(3)}s</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/40">Drift:</span>
          <span className={`font-bold text-[12px] ${driftColor}`}>
            {driftMs >= 0 ? `+${driftMs}` : driftMs} ms
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Playback Rate:</span>
          <span className="text-amber-300 font-bold">
            {(driftStatus?.playbackRate ?? 1.0).toFixed(3)}x
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Buffer Ahead:</span>
          <span className="text-emerald-300">{bufferSec.toFixed(1)}s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Correction Action:</span>
          <span className="text-white/70 text-[10px]">
            {driftStatus?.correctionAction ?? 'NONE'}
          </span>
        </div>
      </div>
    </div>
  );
}

