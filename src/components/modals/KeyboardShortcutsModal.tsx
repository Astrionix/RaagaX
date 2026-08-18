'use client';

import React, { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    togglePlayPause, 
    playNext, 
    playPrev, 
    toggleMute, 
    toggleLyrics, 
    toggleQueue,
    toggleShuffle,
    cycleRepeatMode,
    volume,
    setVolume,
    currentTime,
    duration,
    setCurrentTime,
  } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keybindings inside input fields or editable content
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === '?') {
        setIsOpen((prev) => !prev);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = usePlayerStore.getState().currentTime;
        const newTime = Math.max(0, cur - 5);
        setCurrentTime(newTime, true);
        usePlayerStore.setState({ seekTarget: newTime });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = usePlayerStore.getState().currentTime;
        const dur = usePlayerStore.getState().duration || 100;
        const newTime = Math.min(dur, cur + 5);
        setCurrentTime(newTime, true);
        usePlayerStore.setState({ seekTarget: newTime });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const curVol = usePlayerStore.getState().volume;
        setVolume(Math.min(1, parseFloat((curVol + 0.05).toFixed(2))));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const curVol = usePlayerStore.getState().volume;
        setVolume(Math.max(0, parseFloat((curVol - 0.05).toFixed(2))));
      } else if (e.key === 'N' || e.key === 'n') {
        playNext();
      } else if (e.key === 'P' || e.key === 'p') {
        playPrev();
      } else if (e.key === 'M' || e.key === 'm') {
        toggleMute();
      } else if (e.key === 'S' || e.key === 's') {
        toggleShuffle();
      } else if (e.key === 'R' || e.key === 'r') {
        cycleRepeatMode();
      } else if (e.key === 'L' || e.key === 'l') {
        toggleLyrics();
      } else if (e.key === 'Q' || e.key === 'q') {
        toggleQueue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, playNext, playPrev, toggleMute, toggleShuffle, cycleRepeatMode, toggleLyrics, toggleQueue, setVolume, setCurrentTime]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause Audio' },
    { key: '← / →', desc: 'Seek Backward / Forward 5s' },
    { key: '↑ / ↓', desc: 'Volume Up / Down' },
    { key: 'N / P', desc: 'Next / Previous Track' },
    { key: 'M', desc: 'Mute / Unmute' },
    { key: 'S', desc: 'Toggle Shuffle' },
    { key: 'R', desc: 'Cycle Repeat Mode' },
    { key: 'L', desc: 'Toggle Synced Lyrics' },
    { key: 'Q', desc: 'Toggle Play Queue' },
    { key: '?', desc: 'Show / Hide Shortcuts Modal' },
  ];

  return (
    <div
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-white select-none animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative"
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-white">Keyboard Shortcuts</h3>
            <p className="text-xs text-slate-400">Desktop Power User Controls</p>
          </div>
        </div>

        <div className="divide-y divide-white/5 bg-[#1C1C1E] rounded-2xl border border-white/10 overflow-hidden">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="py-3 px-4 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">{sc.desc}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono text-xs font-extrabold border border-white/15">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
