'use client';

import React, { useState } from 'react';
import { RaagaXLogo, LogoVariant } from './RaagaXLogo';
import { RaagaXWordmark } from './RaagaXWordmark';
import { RaagaXWaveform, WaveformState } from './RaagaXWaveform';
import { useThemeStore } from '@/context/useThemeStore';
import { Moon, Sun, Monitor } from 'lucide-react';

export function BrandShowcaseView() {
  const { theme, resolvedTheme, setTheme } = useThemeStore();
  const [selectedWaveformState, setSelectedWaveformState] = useState<WaveformState>('playing');
  const [isTransferring, setIsTransferring] = useState(false);

  const logoVariants: { id: LogoVariant; label: string; desc: string }[] = [
    { id: 'full', label: 'Primary Full Logo', desc: 'Flowing red ribbon, central note head, 5-bar equalizer & continuity ring' },
    { id: 'flat', label: 'Flat Vector Logo', desc: 'Minimal vector for high-density UI, headers, and clean surfaces' },
    { id: 'micro', label: 'Micro Mark (16-24px)', desc: 'Optimized simplified silhouette for favicons & mobile status bars' },
    { id: 'monochrome-red', label: 'Monochrome Red', desc: 'Single-color Vivid Crimson (#F20D18) for loading and selected states' },
    { id: 'monochrome-black', label: 'Monochrome Charcoal', desc: 'Dark #171717 silhouette for pure minimal surfaces' },
    { id: 'monochrome-white', label: 'Monochrome White', desc: 'Pure white #FFFFFF silhouette for ultra-dark backgrounds' },
  ];

  const waveformStates: { id: WaveformState; label: string }[] = [
    { id: 'playing', label: 'Playing (Active)' },
    { id: 'buffering', label: 'Buffering (Pulse)' },
    { id: 'paused', label: 'Paused (Static)' },
    { id: 'loading', label: 'Loading' },
    { id: 'idle', label: 'Idle' },
    { id: 'error', label: 'Error' },
    { id: 'offline', label: 'Offline' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 space-y-12 select-none animate-in fade-in duration-300">
      {/* Brand Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--border-subtle)] pb-8">
        <div>
          <div className="flex items-center gap-3">
            <RaagaXLogo variant="full" size={48} />
            <div>
              <RaagaXWordmark size="xl" />
              <p className="text-xs font-bold text-[#F20D18] tracking-widest uppercase mt-0.5">
                Brand Identity & UI Specification
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-3 max-w-xl">
            <strong>Music That Moves With You.</strong> A premium abstract music-tech design system combining musical note, soundwave, circular continuity, and seamless cross-device playback.
          </p>
        </div>

        {/* Theme Quick Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          {[
            { id: 'dark' as const, label: 'Dark', icon: Moon },
            { id: 'light' as const, label: 'Light', icon: Sun },
            { id: 'system' as const, label: 'Adaptive', icon: Monitor },
          ].map((t) => {
            const Icon = t.icon;
            const isSel = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSel
                    ? 'bg-[#F20D18] text-white shadow-md'
                    : 'text-slate-400 hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 1: Logo Variants Matrix */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">1. Official Logo Variants</h2>
          <p className="text-xs text-slate-400 mt-1">Zero letters in symbol • Abstract musical note + soundwave + circular continuity</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {logoVariants.map((v) => (
            <div
              key={v.id}
              className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 shadow-sm hover:border-[#F20D18]/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">{v.label}</span>
                <span className="text-[10px] font-mono uppercase text-slate-400">{v.id}</span>
              </div>

              <div className="h-32 rounded-xl bg-black/[0.04] dark:bg-white/[0.02] border border-[var(--border-subtle)] flex items-center justify-center">
                <RaagaXLogo variant={v.id} size={v.id === 'micro' ? 36 : 68} />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Color Palette Tokens */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">2. Brand Color Tokens</h2>
          <p className="text-xs text-slate-400 mt-1">Vivid Crimson (#F20D18) + Pure White + Charcoal + Metallic Silver</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Vivid Crimson', hex: '#F20D18', bg: 'bg-[#F20D18]', text: 'text-white' },
            { label: 'Deep Red', hex: '#B4000A', bg: 'bg-[#B4000A]', text: 'text-white' },
            { label: 'Motion Highlight', hex: '#FF252D', bg: 'bg-[#FF252D]', text: 'text-white' },
            { label: 'Dark Red Shadow', hex: '#700008', bg: 'bg-[#700008]', text: 'text-white' },
            { label: 'Pure White', hex: '#FFFFFF', bg: 'bg-[#FFFFFF]', text: 'text-black border border-slate-200' },
            { label: 'Metallic Silver', hex: '#CFCFCF', bg: 'bg-[#CFCFCF]', text: 'text-black' },
            { label: 'Soft Gray', hex: '#E8E8E8', bg: 'bg-[#E8E8E8]', text: 'text-black' },
            { label: 'Silver Accent', hex: '#8A8A8A', bg: 'bg-[#8A8A8A]', text: 'text-white' },
            { label: 'Charcoal Dark', hex: '#171717', bg: 'bg-[#171717]', text: 'text-white' },
            { label: 'Deep Black', hex: '#050505', bg: 'bg-[#050505]', text: 'text-white' },
          ].map((c) => (
            <div key={c.hex} className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-2">
              <div className={`h-12 rounded-lg ${c.bg} shadow-inner flex items-center justify-center font-mono text-[10px] font-bold ${c.text}`}>
                {c.hex}
              </div>
              <div>
                <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">{c.label}</p>
                <p className="text-[10px] text-slate-400 font-mono">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Waveform Visualizer States */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">3. Integrated Waveform States</h2>
          <p className="text-xs text-slate-400 mt-1">7 dynamic equalizer states mirroring playback state</p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-6">
          <div className="flex flex-wrap gap-2">
            {waveformStates.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedWaveformState(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  selectedWaveformState === st.id
                    ? 'bg-[#F20D18] text-white border-[#F20D18]'
                    : 'bg-white/5 border-[var(--border-subtle)] text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="p-8 rounded-xl bg-black/[0.04] dark:bg-white/[0.02] border border-[var(--border-subtle)] flex flex-col items-center justify-center gap-4">
            <RaagaXWaveform state={selectedWaveformState} barCount={15} height={36} />
            <span className="text-xs font-mono font-semibold uppercase text-slate-400">
              State: <strong className="text-[#F20D18]">{selectedWaveformState}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
