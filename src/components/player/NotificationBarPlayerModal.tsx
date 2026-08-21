'use client';

import React from 'react';
import { X, Bell } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { AndroidNotificationPlayerCard } from '@/components/player/AndroidNotificationPlayerCard';

interface NotificationBarPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationBarPlayerModal({ isOpen, onClose }: NotificationBarPlayerModalProps) {
  const currentSong = usePlayerStore((s) => s.currentSong);

  if (!isOpen || !currentSong) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-xl flex flex-col justify-start p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Top Navigation / Shade Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between pt-2 pb-5 text-white">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#FA233B]" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-300">
            Notification Shade Player
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Close Shade"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Single Compact Native Glass Android Notification Player Card ── */}
      <div className="w-full max-w-md mx-auto my-auto">
        <AndroidNotificationPlayerCard onExpand={onClose} />
      </div>
    </div>
  );
}
