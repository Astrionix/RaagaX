'use client';

import React from 'react';
import { X, Sliders, Volume2, Wifi } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function AudioSettingsDrawer() {
  const {
    isSettingsModalOpen,
    toggleSettingsModal,
    crossfadeSec,
    setCrossfadeSec,
    isGaplessEnabled,
    setGaplessEnabled,
    streamingQuality,
    setStreamingQuality,
    isDataSaverEnabled,
    setDataSaverEnabled,
    downloadQuality,
    setDownloadQuality,
  } = usePlayerStore();

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-[#18181b] rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-10 flex flex-col gap-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Audio Settings</h2>
              <p className="text-xs text-slate-400 font-medium">Customize your listening experience</p>
            </div>
          </div>
          <button
            onClick={toggleSettingsModal}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gapless Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded bg-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white">Gapless Playback</h3>
            </div>
            
            <button
              onClick={() => setGaplessEnabled(!isGaplessEnabled)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 ${isGaplessEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isGaplessEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Allow gapless transitions between consecutive tracks. Automatically handled when Crossfade is active.
          </p>
        </div>

        <div className="h-px w-full bg-white/10" />

        {/* Crossfade Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#fa233b]" />
              <h3 className="text-sm font-bold text-white">Crossfade</h3>
            </div>
            <span className="text-xs font-bold text-[#fa233b] bg-[#fa233b]/10 px-2 py-1 rounded-md">
              {crossfadeSec}s
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Smoothly transition between songs by overlapping their audio.
          </p>
          
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={crossfadeSec}
            onChange={(e) => setCrossfadeSec(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#fa233b]"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <span>Off</span>
            <span>12s</span>
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        {/* Audio Quality Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Streaming Quality</h3>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            Higher quality requires more data and bandwidth.
          </p>

          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Automatic', value: 'AUTO', desc: 'Best available quality based on connection' },
              { label: 'Low', value: 'LOW', desc: '64 kbps (Saves data)' },
              { label: 'Normal', value: 'NORMAL', desc: '128 kbps (Standard)' },
              { label: 'High', value: 'HIGH', desc: '192 kbps (High quality)' },
              { label: 'Very High', value: 'VERY_HIGH', desc: '320 kbps (Best audio)' },
              { label: 'Lossless', value: 'LOSSLESS', desc: 'FLAC / CD quality when available' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStreamingQuality(option.value as import('@/lib/playback/types').AudioQuality)}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  streamingQuality === option.value
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-left">
                  <div className={`text-sm font-bold ${streamingQuality === option.value ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {option.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{option.desc}</div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  streamingQuality === option.value ? 'border-emerald-400' : 'border-slate-500'
                }`}>
                  {streamingQuality === option.value && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        {/* Data Saver Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#fa233b]/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded bg-[#fa233b]" />
              </div>
              <h3 className="text-sm font-bold text-white">Data Saver</h3>
            </div>
            
            <button
              onClick={() => setDataSaverEnabled(!isDataSaverEnabled)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 ${isDataSaverEnabled ? 'bg-[#fa233b]' : 'bg-slate-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isDataSaverEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Caps streaming quality to Normal or Low when on cellular networks.
          </p>
        </div>

      </div>
    </div>
  );
}
