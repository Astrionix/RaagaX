'use client';

import React from 'react';
import { User, Clock, Heart, Download, Settings, Disc, Music, ChevronRight, ShieldCheck } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function ProfileView() {
  const { setActiveTab, toggleSettingsModal, toggleBackupModal } = usePlayerStore();

  return (
    <div className="space-y-6 pb-8 text-white select-none">
      {/* User Avatar Card Header */}
      <div className="p-6 rounded-3xl bg-[#161618] border border-white/10 flex items-center gap-5 shadow-2xl relative overflow-hidden">
        <div className="w-20 h-20 rounded-full bg-[#EF233C] text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-red-500/20 flex-shrink-0 border-2 border-white/20">
          RR
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <h2 className="text-2xl font-black text-white truncate tracking-tight">Ram Reddy</h2>
          <p className="text-xs font-semibold text-slate-400 truncate">ramreddy25@icloud.com</p>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EF233C]/20 text-[#EF233C] text-[10px] font-extrabold uppercase tracking-wider border border-[#EF233C]/30 mt-1">
            RaagaX Lossless Pro
          </span>
        </div>
      </div>

      {/* Listening Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#161618] border border-white/10 text-center space-y-1">
          <Clock className="w-5 h-5 text-[#EF233C] mx-auto" />
          <h4 className="text-base font-black text-white">148 hrs</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Listening Time</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#161618] border border-white/10 text-center space-y-1">
          <User className="w-5 h-5 text-[#EF233C] mx-auto" />
          <h4 className="text-base font-black text-white truncate">Sid Sriram</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Artist</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#161618] border border-white/10 text-center space-y-1">
          <Disc className="w-5 h-5 text-[#EF233C] mx-auto" />
          <h4 className="text-base font-black text-white truncate">HIT:3</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Album</p>
        </div>
      </div>

      {/* Quick Access Menu List */}
      <div className="divide-y divide-white/5 bg-[#161618] rounded-2xl border border-white/10 overflow-hidden">
        <button
          onClick={() => setActiveTab('favorites')}
          className="w-full py-4 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Heart className="w-5 h-5 text-[#EF233C]" />
            <span className="text-sm font-bold text-white">Your Favorites</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          className="w-full py-4 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Download className="w-5 h-5 text-[#EF233C]" />
            <span className="text-sm font-bold text-white">Offline Downloads</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className="w-full py-4 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Settings className="w-5 h-5 text-[#EF233C]" />
            <span className="text-sm font-bold text-white">App Settings & Audio Quality</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          onClick={toggleBackupModal}
          className="w-full py-4 px-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">Backup & Sync Library</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
