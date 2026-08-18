'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Moon, Check, Clock, Plus, Minus, RotateCcw, 
  Sparkles, Radio, Music, ListMusic, ShieldCheck, ArrowLeft, Tv
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function SleepTimerModal() {
  const { 
    isSleepTimerModalOpen, 
    toggleSleepTimerModal, 
    sleepTimerMinutes, 
    sleepTimerEndsAt, 
    sleepTimerMode,
    setSleepTimer, 
    extendSleepTimer, 
    cancelSleepTimer,
    setToastMessage,
    isActiveDevice,
    remoteDeviceName
  } = usePlayerStore();

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom' | 'end_of_song' | 'end_of_queue' | null>(15);
  const [selectedCondition, setSelectedCondition] = useState<'duration' | 'end_of_song' | 'end_of_queue'>('duration');
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Live countdown remaining calculation
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [totalSec, setTotalSec] = useState<number>(0);

  if (!mounted || !isSleepTimerModalOpen) return null;

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setRemainingSec(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.floor((sleepTimerEndsAt - Date.now()) / 1000));
      setRemainingSec(diff);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt]);

  if (!isSleepTimerModalOpen) return null;

  const isTimerRunning = (sleepTimerEndsAt !== null && sleepTimerEndsAt > Date.now()) || sleepTimerMode === 'end_of_song' || sleepTimerMode === 'end_of_queue';

  const presets = [
    { label: '5 min', minutes: 5 },
    { label: '10 min', minutes: 10 },
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '45 min', minutes: 45 },
    { label: '60 min', minutes: 60 },
    { label: '90 min', minutes: 90 },
    { label: 'Custom', minutes: 'custom' as const },
  ];

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getTargetEndTimeString = () => {
    if (!sleepTimerEndsAt) return '';
    const date = new Date(sleepTimerEndsAt);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleStartTimer = () => {
    if (selectedCondition === 'end_of_song') {
      setSleepTimer(-1, 'end_of_song');
      setToastMessage('Sleep Timer set: Stop at end of current song');
    } else if (selectedCondition === 'end_of_queue') {
      setSleepTimer(-1, 'end_of_queue');
      setToastMessage('Sleep Timer set: Stop at end of current queue');
    } else if (selectedPreset === 'custom') {
      const totalMins = customHours * 60 + customMinutes;
      if (totalMins <= 0) return;
      setSleepTimer(totalMins, 'duration');
      setToastMessage(`Sleep Timer set for ${totalMins} minutes`);
    } else if (typeof selectedPreset === 'number') {
      setSleepTimer(selectedPreset, 'duration');
      setToastMessage(`Sleep Timer set for ${selectedPreset} minutes`);
    }
    toggleSleepTimerModal();
    setIsEditingActive(false);
  };

  const handleCancelTimer = () => {
    cancelSleepTimer();
    setToastMessage('Sleep Timer cancelled');
    toggleSleepTimerModal();
    setIsEditingActive(false);
  };

  const handleAdd15Min = () => {
    extendSleepTimer(15);
    setToastMessage('Added 15 minutes to Sleep Timer');
  };

  const deviceTargetName = !isActiveDevice ? (remoteDeviceName || 'Remote Device') : 'this device';

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Dark Ambient Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
        onClick={toggleSleepTimerModal}
      />

      {/* Main Bottom Sheet Container */}
      <div className="relative w-full max-w-md bg-[#0e0f17] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col max-h-[90dvh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-8 duration-200">
        
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

        {/* HEADER */}
        <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#fa233b]/30 to-indigo-500/20 border border-[#fa233b]/40 flex items-center justify-center text-[#fa233b]">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight">Sleep Timer</h3>
                <span className="text-[10px] text-indigo-300 font-bold bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Zzz
                </span>
              </div>
              <p className="text-xs text-white/50 font-medium">Stop playback automatically</p>
            </div>
          </div>

          <button
            onClick={toggleSleepTimerModal}
            className="p-2 -mr-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* ACTIVE COUNTDOWN STATE SCREEN (When running and not editing) */}
          {isTimerRunning && !isEditingActive ? (
            <div className="flex flex-col items-center justify-center py-3 text-center space-y-6 animate-in fade-in">
              
              {/* Circular Countdown Ring */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                {/* SVG Progress Ring */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="76"
                    className="text-white/10"
                    strokeWidth="6"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="76"
                    className="text-[#fa233b] transition-all duration-1000"
                    strokeWidth="6"
                    strokeDasharray={477}
                    strokeDashoffset={
                      sleepTimerEndsAt 
                        ? Math.max(0, 477 - (477 * remainingSec) / Math.max(1, (sleepTimerMinutes || 15) * 60))
                        : 0
                    }
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>

                {/* Center Live Remaining Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 rounded-full bg-[#fa233b]/20 flex items-center justify-center text-[#fa233b] mb-1">
                    <Moon className="w-4 h-4 animate-pulse" />
                  </div>
                  <span className="text-3xl font-mono font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(250,35,59,0.5)]">
                    {sleepTimerMode === 'end_of_song' 
                      ? 'Song End' 
                      : sleepTimerMode === 'end_of_queue' 
                        ? 'Queue End' 
                        : formatCountdown(remainingSec)}
                  </span>
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                    Remaining
                  </span>
                </div>
              </div>

              {/* Stopping target info */}
              <div className="space-y-1">
                {sleepTimerEndsAt && (
                  <p className="text-sm font-bold text-white/90">
                    Playback will stop at <span className="text-[#fa233b]">{getTargetEndTimeString()}</span>
                  </p>
                )}
                {!isActiveDevice && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-300 font-semibold">
                    <Tv className="w-3.5 h-3.5" />
                    <span>Stopping playback on {deviceTargetName}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Add 15 Min, Change Timer, Cancel */}
              <div className="flex flex-col gap-2.5 w-full pt-2">
                {sleepTimerEndsAt && (
                  <button
                    onClick={handleAdd15Min}
                    className="w-full py-3 rounded-2xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <Plus className="w-4 h-4" /> Add 15 Minutes
                  </button>
                )}

                <div className="flex items-center gap-2.5 w-full">
                  <button
                    onClick={() => setIsEditingActive(true)}
                    className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
                  >
                    Change Timer
                  </button>
                  <button
                    onClick={handleCancelTimer}
                    className="flex-1 py-3 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs transition-colors"
                  >
                    Cancel Timer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TIMER PRESET SELECTION SCREEN */
            <div className="space-y-5 animate-in fade-in">
              
              {/* SECTION A: TIME PRESETS (PILL GRID) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-black text-white/60 uppercase tracking-wider">
                    SELECT DURATION
                  </span>
                  {isEditingActive && (
                    <button 
                      onClick={() => setIsEditingActive(false)}
                      className="text-xs text-white/50 hover:text-white flex items-center gap-1 font-semibold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to active
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {presets.map((p) => {
                    const isSelected = selectedPreset === p.minutes && selectedCondition === 'duration';
                    return (
                      <button
                        key={p.label}
                        onClick={() => {
                          setSelectedPreset(p.minutes);
                          setSelectedCondition('duration');
                          if (p.minutes === 'custom') {
                            setIsCustomMode(true);
                          } else {
                            setIsCustomMode(false);
                          }
                        }}
                        className={`py-3 px-2 rounded-2xl text-xs font-extrabold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border ${
                          isSelected
                            ? 'bg-gradient-to-tr from-[#fa233b] to-[#ff4d6d] text-white border-transparent shadow-[0_0_20px_rgba(250,35,59,0.4)]'
                            : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border-white/10'
                        }`}
                      >
                        <span>{p.label}</span>
                        {isSelected && <span className="w-1 h-1 rounded-full bg-white animate-ping" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: CUSTOM TIME SELECTOR */}
              {selectedPreset === 'custom' && selectedCondition === 'duration' && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between text-xs font-bold text-white/70">
                    <span>Custom Duration</span>
                    <span className="text-[#fa233b] font-mono font-bold">
                      {customHours > 0 ? `${customHours}h ` : ''}{customMinutes}m
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-4 py-2">
                    {/* Hours Stepper */}
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        onClick={() => setCustomHours(h => Math.min(12, h + 1))}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xl font-mono font-black text-white w-10 text-center">
                        {customHours < 10 ? `0${customHours}` : customHours}
                      </span>
                      <button 
                        onClick={() => setCustomHours(h => Math.max(0, h - 1))}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-white/40 uppercase">Hours</span>
                    </div>

                    <span className="text-2xl font-black text-white/40 -mt-4">:</span>

                    {/* Minutes Stepper */}
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        onClick={() => setCustomMinutes(m => Math.min(59, m + 5))}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xl font-mono font-black text-white w-10 text-center">
                        {customMinutes < 10 ? `0${customMinutes}` : customMinutes}
                      </span>
                      <button 
                        onClick={() => setCustomMinutes(m => Math.max(1, m - 5))}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-white/40 uppercase">Mins</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION C: STOP CONDITIONS */}
              <div>
                <span className="text-[11px] font-black text-white/60 uppercase tracking-wider block mb-2.5">
                  OR STOP WHEN FINISHED
                </span>

                <div className="space-y-2">
                  {/* End of Current Song */}
                  <div 
                    onClick={() => setSelectedCondition('end_of_song')}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      selectedCondition === 'end_of_song'
                        ? 'bg-gradient-to-r from-[#fa233b]/20 to-transparent border-[#fa233b]/50 shadow-sm'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        selectedCondition === 'end_of_song' ? 'bg-[#fa233b] text-white' : 'bg-white/10 text-white/60'
                      }`}>
                        <Music className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">End of current song</h4>
                        <p className="text-[11px] text-white/50">Stop when this song finishes</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedCondition === 'end_of_song' ? 'border-[#fa233b] bg-[#fa233b]' : 'border-white/30'
                    }`}>
                      {selectedCondition === 'end_of_song' && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  {/* End of Queue */}
                  <div 
                    onClick={() => setSelectedCondition('end_of_queue')}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      selectedCondition === 'end_of_queue'
                        ? 'bg-gradient-to-r from-[#fa233b]/20 to-transparent border-[#fa233b]/50 shadow-sm'
                        : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        selectedCondition === 'end_of_queue' ? 'bg-[#fa233b] text-white' : 'bg-white/10 text-white/60'
                      }`}>
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">End of queue</h4>
                        <p className="text-[11px] text-white/50">Stop when current playlist finishes</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedCondition === 'end_of_queue' ? 'border-[#fa233b] bg-[#fa233b]' : 'border-white/30'
                    }`}>
                      {selectedCondition === 'end_of_queue' && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* PRIMARY START BUTTON */}
              <button
                onClick={handleStartTimer}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#fa233b] to-[#ff4d6d] hover:brightness-110 text-white font-black text-sm shadow-[0_0_30px_rgba(250,35,59,0.4)] transition-all active:scale-98 flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <Moon className="w-4 h-4" />
                <span>Start Timer</span>
              </button>
            </div>
          )}

        </div>

        {/* FOOTER GUARANTEE */}
        <div className="p-3.5 border-t border-white/5 text-[11px] text-white/40 text-center bg-black/30 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Playback will pause cleanly without deleting queue or app state</span>
        </div>
      </div>
    </div>
  );
}
