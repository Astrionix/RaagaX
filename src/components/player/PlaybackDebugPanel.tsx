'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Zap, CheckCircle2, AlertCircle, RefreshCw, X, Radio, Clock, ShieldCheck } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackTelemetry, PlaybackLatencySummary } from '@/lib/playback/PlaybackTelemetry';
import { PreloadManager } from '@/lib/playback/PreloadManager';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PlayableUrlCache } from '@/lib/playback/PlayableUrlCache';

export function PlaybackDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<PlaybackLatencySummary | null>(null);
  const { currentSong, isPlaying, queue, queueIndex, networkMode, deliveredQuality } = usePlayerStore();

  useEffect(() => {
    const update = () => {
      setSummary(PlaybackTelemetry.getInstance().getSummary());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 bg-black/80 hover:bg-black text-emerald-400 border border-emerald-500/30 backdrop-blur-xl px-2.5 py-1.5 rounded-full text-[10px] font-mono font-black flex items-center gap-1.5 shadow-2xl transition-all active:scale-95 cursor-pointer"
        title="Open Playback Diagnostics Debug Panel"
      >
        <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
        <span>{summary?.lastTTFAMs !== undefined ? `${summary.lastTTFAMs}ms` : 'Perf'}</span>
      </button>
    );
  }

  const nextSong = queue[queueIndex + 1] || null;
  const preloadStatus = PreloadManager.getInstance().getStatus();
  const preloadTrackId = PreloadManager.getInstance().getPreloadedTrackId();
  const isNextReady = nextSong ? PreloadManager.getInstance().isTrackReady(nextSong.id) : false;
  const isCached = currentSong ? Boolean(PlayableUrlCache.getInstance().get(currentSong.id)) : false;

  const activeAudio = typeof window !== 'undefined' ? PlaybackService.getInstance().getActiveAudio() : null;
  const standbyAudio = typeof window !== 'undefined' ? PlaybackService.getInstance().getStandbyAudio() : null;

  let bufferSec = 0;
  if (activeAudio && activeAudio.buffered.length > 0) {
    for (let i = 0; i < activeAudio.buffered.length; i++) {
      if (activeAudio.buffered.start(i) <= activeAudio.currentTime && activeAudio.currentTime <= activeAudio.buffered.end(i)) {
        bufferSec = Math.max(0, activeAudio.buffered.end(i) - activeAudio.currentTime);
        break;
      }
    }
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-80 bg-[#0d0e15]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-3 text-white text-xs font-mono shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-150 select-none">
      <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <Activity className="w-3.5 h-3.5" />
          <span>Playback Diagnostics</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/40 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {/* Latency Benchmarks */}
        <div className="bg-white/5 rounded-xl p-2 border border-white/5">
          <div className="text-[10px] text-white/50 uppercase font-black tracking-wider mb-1 flex items-center justify-between">
            <span>Startup Latency</span>
            <span className="text-emerald-400 font-bold">{summary?.lastSourceType || 'STREAM'}</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center font-bold">
            <div className="bg-white/5 rounded-lg py-1">
              <div className="text-[9px] text-white/40">LAST</div>
              <div className="text-xs text-white">{summary?.lastTTFAMs ?? '--'}ms</div>
            </div>
            <div className="bg-white/5 rounded-lg py-1">
              <div className="text-[9px] text-white/40">P50</div>
              <div className="text-xs text-emerald-400">{summary?.p50TTFAMs ?? 0}ms</div>
            </div>
            <div className="bg-white/5 rounded-lg py-1">
              <div className="text-[9px] text-white/40">P75</div>
              <div className="text-xs text-amber-400">{summary?.p75TTFAMs ?? 0}ms</div>
            </div>
            <div className="bg-white/5 rounded-lg py-1">
              <div className="text-[9px] text-white/40">P95</div>
              <div className="text-xs text-sky-400">{summary?.p95TTFAMs ?? 0}ms</div>
            </div>
          </div>
        </div>

        {/* Current Song State */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/50">Current:</span>
            <span className="font-bold text-white truncate max-w-[170px]">
              {currentSong?.title || 'None'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/50">Audio URL Cache:</span>
            <span className={`font-bold ${isCached ? 'text-emerald-400' : 'text-white/70'}`}>
              {isCached ? 'HIT (0ms)' : 'RESOLVED'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/50">Active Buffer:</span>
            <span className="font-bold text-cyan-400">
              {bufferSec > 0 ? `${bufferSec.toFixed(1)}s ahead` : 'Live'}
            </span>
          </div>
        </div>

        {/* Next Song Preload State */}
        <div className="bg-white/5 rounded-xl p-2 border border-white/5 space-y-1">
          <div className="text-[10px] text-white/50 uppercase font-black tracking-wider flex items-center justify-between">
            <span>Next Preload</span>
            <span className={`font-bold ${isNextReady ? 'text-emerald-400' : preloadStatus === 'BUFFERING' ? 'text-amber-400 animate-pulse' : 'text-white/40'}`}>
              {isNextReady ? 'READY ✓' : preloadStatus}
            </span>
          </div>
          <div className="text-[11px] truncate text-white/80 font-bold">
            {nextSong ? nextSong.title : 'End of queue'}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/40">
            <span>Standby Tag:</span>
            <span>{standbyAudio ? `readyState=${standbyAudio.readyState}` : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
