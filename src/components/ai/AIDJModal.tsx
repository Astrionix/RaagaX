'use client';

import React, { useState } from 'react';
import { X, Sparkles, Wand2, Mic, Flame, Heart, Zap, Moon, Sun, Music, Volume2, MessageSquare } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { AIDJState } from '@/types/music';

export function AIDJModal() {
  const { isAiDjModalOpen, toggleAiDjModal, aiDjState, setAiDjPrompt, setAiDjMood, playSong } = usePlayerStore();
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isAiDjModalOpen) return null;

  const moods: { id: AIDJState['currentMood']; label: string; icon: any; color: string }[] = [
    { id: 'energetic', label: 'Telugu Mass Energy', icon: Flame, color: 'from-amber-500 to-red-500' },
    { id: 'romantic', label: 'Love & Melodies', icon: Heart, color: 'from-rose-400 to-pink-600' },
    { id: 'chill', label: 'Chill & Relax', icon: Moon, color: 'from-indigo-400 to-cyan-500' },
    { id: 'focus', label: 'Deep Focus & Study', icon: Zap, color: 'from-emerald-400 to-teal-600' },
    { id: 'nostalgic', label: "90's Gold Nostalgia", icon: Sun, color: 'from-amber-400 to-orange-500' },
    { id: 'devotional', label: 'Devotional Raagas', icon: Music, color: 'from-purple-400 to-indigo-600' },
  ];

  const presetPrompts = [
    'Play 90s SPB romantic hits',
    'High mass Telugu workout beats',
    'Late night Sid Sriram acoustic flow',
    'Devotional Annamacharya Raagas',
  ];

  const handleGenerate = async (customPrompt?: string) => {
    const query = customPrompt || inputPrompt;
    if (!query) return;

    setIsGenerating(true);
    setAiDjPrompt(query);

    const searchResults = await RealMusicEngine.getInstance().searchRealSongs(query, 10);
    setIsGenerating(false);

    if (searchResults && searchResults.length > 0) {
      playSong(searchResults[0], searchResults);
    }
    toggleAiDjModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl glass-card rounded-3xl p-6 sm:p-8 border border-white/80 dark:border-white/10 shadow-2xl relative space-y-6 bg-white dark:bg-[#131722]">
        {/* Close Button */}
        <button
          onClick={toggleAiDjModal}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title branding with animated soundwave indicator */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#EF233C] flex items-center justify-center shadow-lg shadow-red-500/30">
            <Sparkles className="w-6 h-6 text-white animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">RaagaX AI DJ Assistant</h2>
              <div className="flex items-end gap-0.5 h-3">
                <div className="w-0.5 bg-[#EF233C] rounded-full animate-eq-1" />
                <div className="w-0.5 bg-red-400 rounded-full animate-eq-2" />
                <div className="w-0.5 bg-amber-400 rounded-full animate-eq-3" />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Autonomous Music Curation & Sound Intelligence</p>
          </div>
        </div>

        {/* Conversation Bubble */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-[#EF233C] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
            &quot;{aiDjState.insightText}&quot;
          </p>
        </div>

        {/* Natural Language Prompt Input */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
            Natural Language Prompt
          </label>
          <div className="relative">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="e.g. Play high energy Telugu dance beats for workout..."
              className="w-full pl-4 pr-28 py-3 rounded-2xl glass-input text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#EF233C]/30"
            />
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-[#EF233C] text-white text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-1.5"
            >
              {isGenerating ? 'Curating...' : 'Generate'}
            </button>
          </div>

          {/* Quick Preset Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            {presetPrompts.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputPrompt(preset);
                  handleGenerate(preset);
                }}
                className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-[#EF233C] hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap transition-colors"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Mood Matrix */}
        <div className="space-y-2.5">
          <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
            Or Choose A Mood Matrix
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {moods.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setAiDjMood(m.id);
                    handleGenerate(`Play ${m.label} songs`);
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-[#EF233C] dark:hover:border-[#EF233C] hover:scale-105 transition-all text-left flex items-center gap-2.5 group"
                >
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white shadow-sm`}>
                    <Icon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
