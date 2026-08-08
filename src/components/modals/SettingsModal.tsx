'use client';

import React from 'react';
import { X, Settings, Sliders, Disc, Shield, Download, RefreshCw, Trash2, Zap } from 'lucide-react';
import { usePlayerStore, AudioQualityPreset } from '@/context/usePlayerStore';

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    toggleSettingsModal,
    audioQualityPreset,
    setAudioQualityPreset,
    crossfadeSec,
    setCrossfadeSec,
    isSpatial3DEnabled,
    toggleSpatial3D,
    exportBackupJson,
  } = usePlayerStore();

  if (!isSettingsModalOpen) return null;

  const qualityPresets: AudioQualityPreset[] = ['320kbps MP3', '1411kbps Lossless', '24-bit 96kHz FLAC'];

  const handleExportBackup = () => {
    const jsonStr = exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RaagaX_Backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1C1C1E] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative space-y-6 text-white">
        <button
          onClick={toggleSettingsModal}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg tracking-tight text-white">RaagaX Settings</h3>
            <p className="text-xs text-slate-400">Audio playback, quality & preferences</p>
          </div>
        </div>

        {/* Audio Quality Section */}
        <div className="space-y-3">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#EF233C]" /> Audio Quality
          </label>
          <div className="grid grid-cols-3 gap-2">
            {qualityPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setAudioQualityPreset(preset)}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all border ${
                  audioQualityPreset === preset
                    ? 'bg-[#EF233C] text-white border-red-400 shadow-md shadow-red-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Spatial Audio HRTF Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#EF233C]" /> 3D Spatial Audio Surround
            </label>
            <button
              onClick={toggleSpatial3D}
              className={`px-3 py-1 rounded-full text-xs font-extrabold transition-all border ${
                isSpatial3DEnabled
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isSpatial3DEnabled ? '3D Active' : 'Off'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">HRTF 360° binaural surround sound rotation for headphones & speakers.</p>
        </div>

        {/* Crossfade Duration Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#EF233C]" /> Audio Crossfade
            </label>
            <span className="text-xs font-mono font-bold text-[#EF233C]">{crossfadeSec} Seconds</span>
          </div>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={crossfadeSec}
            onChange={(e) => setCrossfadeSec(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#EF233C]"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0s (Off)</span>
            <span>6s</span>
            <span>12s (Smooth)</span>
          </div>
        </div>

        {/* Data & Backup Section */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#EF233C]" /> Storage & Backup
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportBackup}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/5"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Export Backup
            </button>
            <button
              onClick={() => localStorage.clear()}
              className="py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 border border-red-500/20"
            >
              <Trash2 className="w-4 h-4" /> Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
