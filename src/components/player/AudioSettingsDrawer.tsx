'use client';

import React from 'react';
import { X, Sliders, Volume2, Wifi } from 'lucide-react';
import { usePlayerStore, AudioQualityPreset } from '@/context/usePlayerStore';

export function AudioSettingsDrawer() {
  const {
    isSettingsModalOpen,
    toggleSettingsModal,
    crossfadeSec,
    setCrossfadeSec,
    audioQualityPreset,
    setAudioQualityPreset,
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
              { label: 'Data Saver', value: '320kbps MP3', desc: 'Best for slow connections' },
              { label: 'High Quality', value: '1411kbps Lossless', desc: 'Standard CD quality' },
              { label: 'Master Quality', value: '24-bit 96kHz FLAC', desc: 'Studio resolution (Requires fast Wi-Fi)' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setAudioQualityPreset(option.value as AudioQualityPreset)}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  audioQualityPreset === option.value
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-left">
                  <div className={`text-sm font-bold ${audioQualityPreset === option.value ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {option.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{option.desc}</div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  audioQualityPreset === option.value ? 'border-emerald-400' : 'border-slate-500'
                }`}>
                  {audioQualityPreset === option.value && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
