'use client';

import React from 'react';
import { X, Moon, Check, Clock } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function SleepTimerModal() {
  const { isSleepTimerModalOpen, toggleSleepTimerModal, sleepTimerMinutes, setSleepTimer } = usePlayerStore();

  if (!isSleepTimerModalOpen) return null;

  const timerOptions = [
    { label: 'Off', minutes: null },
    { label: '5 Minutes', minutes: 5 },
    { label: '10 Minutes', minutes: 10 },
    { label: '15 Minutes', minutes: 15 },
    { label: '30 Minutes', minutes: 30 },
    { label: '45 Minutes', minutes: 45 },
    { label: '1 Hour', minutes: 60 },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-white/10 shadow-2xl relative space-y-5 text-white">
        <button
          onClick={toggleSleepTimerModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-white">Sleep Timer</h3>
            <p className="text-xs text-slate-400">Stop playback automatically</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          {timerOptions.map((opt) => {
            const isActive = sleepTimerMinutes === opt.minutes;
            return (
              <button
                key={opt.label}
                onClick={() => {
                  setSleepTimer(opt.minutes);
                  toggleSleepTimerModal();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#EF233C] text-white shadow-lg shadow-red-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {opt.label}
                </span>
                {isActive && <Check className="w-4 h-4 text-white" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
