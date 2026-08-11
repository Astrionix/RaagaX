'use client';

import React from 'react';
import { X, Settings, Sliders, Disc, Shield, Download, Trash2, LogOut, User } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    toggleSettingsModal,
    streamingQuality,
    setStreamingQuality,
    crossfadeSec,
    setCrossfadeSec,
    exportBackupJson,
    preferredLanguage,
    setPreferredLanguage,
  } = usePlayerStore();

  if (!isSettingsModalOpen) return null;

  const qualityPresets = [
    { label: 'Low', value: 'LOW' },
    { label: 'Normal', value: 'NORMAL' },
    { label: 'High', value: 'HIGH' },
    { label: 'Very High', value: 'VERY_HIGH' },
    { label: 'Lossless', value: 'LOSSLESS' },
    { label: 'Auto', value: 'AUTO' },
  ];

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

  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-[#1C1C1E] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl text-white flex flex-col max-h-[92dvh] sm:max-h-[90vh]">

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C] flex-shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">RaagaX Settings</h3>
              <p className="text-[11px] text-slate-400">Audio playback, quality & preferences</p>
            </div>
          </div>
          <button
            onClick={toggleSettingsModal}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-5">

          {/* Audio Quality */}
          <div className="space-y-3">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Disc className="w-3.5 h-3.5 text-[#EF233C]" /> Audio Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {qualityPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setStreamingQuality(preset.value as any)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    streamingQuality === preset.value
                      ? 'bg-[#EF233C] text-white border-[#EF233C]'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Language */}
          <div className="space-y-3">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Disc className="w-3.5 h-3.5 text-[#EF233C]" /> Content Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Telugu', 'Kannada', 'Tamil', 'Hindi', 'Malayalam', 'English'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setPreferredLanguage(lang)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    preferredLanguage === lang
                      ? 'bg-[#EF233C] text-white border-[#EF233C]'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Crossfade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#EF233C]" /> Audio Crossfade
              </label>
              <span className="text-xs font-mono font-bold text-[#EF233C]">{crossfadeSec}s</span>
            </div>
            <input
              type="range" min="0" max="12" step="1" value={crossfadeSec}
              onChange={(e) => setCrossfadeSec(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#EF233C]"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0s (Off)</span><span>6s</span><span>12s (Smooth)</span>
            </div>
          </div>

          {/* Storage & Backup */}
          <div className="space-y-3">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#EF233C]" /> Storage & Backup
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-white/5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" /> Export Backup
              </button>
              <button
                onClick={() => localStorage.clear()}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 border border-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Cache
              </button>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-3 border-t border-white/5 pt-4">
            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#EF233C]" /> Account
            </label>
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-2 border border-red-500/20 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>

        </div>

        {/* Sticky save button */}
        <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex-shrink-0 border-t border-white/5">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('raagax_preferred_language', preferredLanguage);
                localStorage.setItem('raagax_audio_quality', streamingQuality);
                localStorage.setItem('raagax_crossfade', String(crossfadeSec));
              }
              toggleSettingsModal();
            }}
            className="w-full py-3.5 rounded-2xl bg-[#EF233C] hover:bg-[#d91e32] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all active:scale-95"
          >
            Save Settings & Remember
          </button>
        </div>

      </div>
    </div>
  );
}
