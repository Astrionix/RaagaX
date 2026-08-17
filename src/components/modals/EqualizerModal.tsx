'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Sliders, Sparkles, Volume2, RotateCcw, Zap, Headphones, 
  Radio, Check, Activity, ShieldCheck 
} from 'lucide-react';
import { 
  EqualizerDSP, 
  EqualizerSettings, 
  EqualizerPreset, 
  DEFAULT_EQ_BANDS 
} from '@/lib/audio/EqualizerDSP';
import { usePlayerStore } from '@/context/usePlayerStore';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS: { id: EqualizerPreset; label: string }[] = [
  { id: 'flat', label: 'Flat' },
  { id: 'bass_boost', label: 'Bass Boost' },
  { id: 'vocal_clarity', label: 'Vocal Clarity' },
  { id: 'rock', label: 'Rock' },
  { id: 'pop', label: 'Pop' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'classical', label: 'Classical' },
  { id: 'hip_hop', label: 'Hip Hop' },
  { id: 'custom', label: 'Custom' },
];

export function EqualizerModal({ isOpen, onClose }: EqualizerModalProps) {
  const { isPlaying } = usePlayerStore();
  const [settings, setSettings] = useState<EqualizerSettings>(() => 
    EqualizerDSP.getInstance().getSettings()
  );

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = EqualizerDSP.getInstance().subscribe(setSettings);
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const dsp = EqualizerDSP.getInstance();

  return (
    <div className="fixed inset-0 z-[170] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-xl transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl lens-crystal border-t sm:border border-white/18 rounded-t-[32px] sm:rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col max-h-[92dvh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-8 duration-200">
        
        {/* Top Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

        {/* HEADER */}
        <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FA233B] to-purple-700 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                Pro Audio Equalizer
              </h3>
              <p className="text-xs text-slate-400 font-medium">10-Band DSP & 3D Spatial Virtualizer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => dsp.resetToDefault()}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset Equalizer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Master Enable & Spatial Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Equalizer Master</span>
                <span className="text-[10px] text-slate-400">10-Band Graphic DSP</span>
              </div>
              <button
                onClick={() => dsp.setEnabled(!settings.isEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                  settings.isEnabled ? 'bg-[#FA233B]' : 'bg-slate-700'
                }`}
              >
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                    settings.isEnabled ? 'left-6' : 'left-1'
                  }`} 
                />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                  3D Spatial Audio
                </span>
                <span className="text-[10px] text-slate-400">Headphone Virtualizer</span>
              </div>
              <button
                onClick={() => dsp.setVirtualizer(!settings.virtualizer, settings.virtualizerIntensity)}
                className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${
                  settings.virtualizer ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                    settings.virtualizer ? 'left-6' : 'left-1'
                  }`} 
                />
              </button>
            </div>
          </div>

          {/* Preset Selector Pills */}
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
              GENRE PRESETS
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {PRESETS.map((p) => {
                const isActive = settings.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => dsp.setPreset(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                      isActive 
                        ? 'bg-[#FA233B] text-white shadow-lg shadow-red-500/25' 
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10-Band Graphic Slider Faders */}
          <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3 shadow-xl">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold px-1">
              <span>+12 dB</span>
              <span>0 dB</span>
              <span>-12 dB</span>
            </div>

            <div className="grid grid-cols-10 gap-1 sm:gap-2 items-center justify-items-center h-44 pt-2">
              {settings.bands.map((band) => {
                return (
                  <div key={band.frequency} className="flex flex-col items-center justify-between h-full group">
                    <span className="text-[9px] font-mono font-bold text-slate-400 group-hover:text-white transition-colors">
                      {band.gain > 0 ? `+${band.gain}` : band.gain}
                    </span>

                    <div className="h-28 flex items-center justify-center relative py-1">
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        disabled={!settings.isEnabled}
                        value={band.gain}
                        onChange={(e) => dsp.setBandGain(band.frequency, parseFloat(e.target.value))}
                        className="h-24 w-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FA233B] -rotate-90 disabled:opacity-40"
                      />
                    </div>

                    <span className="text-[9px] font-mono text-slate-400 font-bold">
                      {band.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bass Boost & Virtualizer Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bass Boost */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Bass Boost
                </span>
                <span className="font-mono font-bold text-amber-400">{settings.bassBoost}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={!settings.isEnabled}
                value={settings.bassBoost}
                onChange={(e) => dsp.setBassBoost(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
              />
            </div>

            {/* Spatial Virtualizer Intensity */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" /> 3D Staging
                </span>
                <span className="font-mono font-bold text-cyan-400">{settings.virtualizerIntensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={!settings.isEnabled || !settings.virtualizer}
                value={settings.virtualizerIntensity}
                onChange={(e) => dsp.setVirtualizer(settings.virtualizer, parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3.5 border-t border-white/10 text-[11px] text-slate-400 text-center bg-black/40 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-time low latency 32-bit DSP processor active</span>
        </div>

      </div>
    </div>
  );
}
