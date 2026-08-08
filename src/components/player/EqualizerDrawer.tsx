'use client';

import React from 'react';
import { X, SlidersHorizontal, Volume2, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { EqualizerSettings } from '@/types/music';

export function EqualizerDrawer() {
  const { isEqOpen, toggleEq, eqSettings, setEqSettings, setBandGain, crossfadeSec, setCrossfadeSec } = usePlayerStore();

  if (!isEqOpen) return null;

  const presets: { name: EqualizerSettings['preset']; label: string; bands: EqualizerSettings['bands'] }[] = [
    { name: 'flat', label: 'Flat (Studio)', bands: { low: 0, midLow: 0, mid: 0, midHigh: 0, high: 0 } },
    { name: 'bass_boost', label: 'Bass Boost', bands: { low: 8, midLow: 4, mid: 0, midHigh: -2, high: -4 } },
    { name: 'vocal', label: 'Vocal Clarity', bands: { low: -2, midLow: 0, mid: 6, midHigh: 4, high: 2 } },
    { name: 'telugu_mass', label: 'Telugu Mass Beats', bands: { low: 9, midLow: 6, mid: 2, midHigh: 5, high: 8 } },
    { name: 'acoustic', label: 'Acoustic / Melody', bands: { low: 2, midLow: 3, mid: 1, midHigh: 4, high: 5 } },
  ];

  const applyPreset = (presetObj: typeof presets[0]) => {
    setEqSettings({
      enabled: eqSettings.enabled,
      preset: presetObj.name,
      bands: presetObj.bands,
    });
  };

  return (
    <div className="fixed right-6 top-20 bottom-28 z-40 w-96 glass-panel rounded-3xl p-6 border border-white/90 shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/60 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-red-500" />
          <h3 className="text-sm font-extrabold text-slate-900">Audio Equalizer & DSP</h3>
        </div>
        <button
          onClick={toggleEq}
          className="p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-white/80"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2 py-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Presets</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                eqSettings.preset === p.name
                  ? 'crimson-gradient text-white shadow-md'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5-Band Sliders */}
      <div className="flex-1 py-4 flex items-center justify-between px-2 bg-white/40 rounded-2xl border border-white/60">
        {[
          { key: 'low', freq: '60Hz', label: 'Bass' },
          { key: 'midLow', freq: '230Hz', label: 'Sub' },
          { key: 'mid', freq: '910Hz', label: 'Mid' },
          { key: 'midHigh', freq: '4kHz', label: 'Presence' },
          { key: 'high', freq: '14kHz', label: 'Treble' },
        ].map((band) => {
          const val = eqSettings.bands[band.key as keyof EqualizerSettings['bands']];
          return (
            <div key={band.key} className="flex flex-col items-center gap-2 h-44">
              <span className="text-[10px] font-mono text-slate-600 font-bold">{val > 0 ? `+${val}` : val}dB</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={val}
                onChange={(e) =>
                  setBandGain(band.key as keyof EqualizerSettings['bands'], parseFloat(e.target.value))
                }
                className="h-28 w-1.5 accent-red-600 appearance-none bg-slate-200 rounded-lg cursor-pointer transform -rotate-90"
              />
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-800">{band.label}</p>
                <p className="text-[9px] text-slate-400">{band.freq}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Crossfade Slider */}
      <div className="pt-3 border-t border-white/60 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-800">Gapless Crossfade</span>
          <span className="font-mono text-red-600 font-bold">{crossfadeSec} sec</span>
        </div>
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={crossfadeSec}
          onChange={(e) => setCrossfadeSec(parseInt(e.target.value))}
          className="w-full h-1.5 accent-red-600 appearance-none bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>
    </div>
  );
}
