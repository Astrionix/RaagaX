'use client';

import React, { useState } from 'react';
import { X, Tv, Speaker, Smartphone, Laptop, Check, Signal, Radio } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function CastModal() {
  const { isCastModalOpen, toggleCastModal } = usePlayerStore();
  const [selectedDevice, setSelectedDevice] = useState('This Device (Web Browser)');

  if (!isCastModalOpen) return null;

  const devices = [
    { name: 'This Device (Web Browser)', type: 'Web Browser', icon: Laptop, isLocal: true },
    { name: 'Living Room TV (Chromecast)', type: 'Google Cast', icon: Tv, isLocal: false },
    { name: 'Studio HomePod (AirPlay)', type: 'AirPlay', icon: Speaker, isLocal: false },
    { name: 'Bluetooth Headphones', type: 'Bluetooth Audio', icon: Smartphone, isLocal: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-card rounded-3xl p-6 border border-white/10 shadow-2xl relative space-y-5 bg-[#131722] text-white">
        <button
          onClick={toggleCastModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base tracking-tight text-white">Connect to a Device</h3>
            <p className="text-xs text-slate-400">Stream audio to external speakers or TV</p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {devices.map((dev) => {
            const isSelected = selectedDevice === dev.name;
            const Icon = dev.icon;
            return (
              <button
                key={dev.name}
                onClick={() => setSelectedDevice(dev.name)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#EF233C] text-white shadow-lg shadow-red-500/20 border border-red-400/40'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-slate-300" />
                  <div className="text-left">
                    <p className="font-extrabold text-white">{dev.name}</p>
                    <p className="text-[10px] text-slate-400">{dev.type}</p>
                  </div>
                </div>
                {isSelected ? <Check className="w-5 h-5 text-white" /> : <Signal className="w-4 h-4 text-slate-500" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
