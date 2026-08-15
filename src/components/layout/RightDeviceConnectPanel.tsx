'use client';

import React from 'react';
import { X, Monitor, Smartphone, Tv, Laptop, Check, Radio } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function RightDeviceConnectPanel() {
  const { deviceId, activeDeviceId, onlineDevices, transferPlayback, setRightPanelMode, isTransferring, transferringDeviceId } = usePlayerStore();

  const handleDeviceClick = (targetId: string) => {
    if (isTransferring) return;
    transferPlayback(targetId);
  };

  const renderDeviceIcon = (name: string, isActive: boolean) => {
    const lowerName = name.toLowerCase();
    const iconClass = `w-5 h-5 ${isActive ? 'text-[#1ed760]' : 'text-slate-300'}`;
    if (lowerName.includes('tv') || lowerName.includes('smarttv')) return <Tv className={iconClass} />;
    if (lowerName.includes('phone') || lowerName.includes('android') || lowerName.includes('ios')) return <Smartphone className={iconClass} />;
    if (lowerName.includes('mac') || lowerName.includes('windows') || lowerName.includes('pc')) return <Laptop className={iconClass} />;
    return <Monitor className={iconClass} />;
  };

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full bg-[#07090E]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 font-bold text-base text-white">
          <Radio className="w-5 h-5 text-[#1ed760]" />
          Connect to a Device
        </div>
        <button 
          onClick={() => setRightPanelMode('queue')}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2">
        {onlineDevices.length === 0 && (
          <div className="p-4 text-center border border-white/5 rounded-xl bg-white/[0.02]">
            <p className="text-sm text-slate-400 font-medium">No other devices found.</p>
            <p className="text-[11px] text-slate-500 mt-2">Log into RaagaX on another device to control remote playback.</p>
          </div>
        )}

        {onlineDevices.map((device) => {
          const isActive = device.id === activeDeviceId || (!activeDeviceId && device.id === deviceId);
          const isThisDevice = device.id === deviceId;
          const isTargetTransfer = isTransferring && transferringDeviceId === device.id;

          return (
            <button
              key={device.id}
              disabled={isTransferring}
              onClick={() => handleDeviceClick(device.id)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-[#1ed760]/10 border border-[#1ed760]/30 shadow-[0_0_15px_rgba(30,215,96,0.1)]' 
                  : 'hover:bg-white/5 border border-white/5'
                } ${isTransferring ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl ${isActive ? 'bg-[#1ed760]/20' : 'bg-white/5'}`}>
                  {renderDeviceIcon(device.name, isActive)}
                </div>
                
                <div className="text-left">
                  <h4 className={`text-xs font-bold leading-tight ${isActive ? 'text-[#1ed760]' : 'text-white'}`}>
                    {device.name} {isThisDevice && '(This Device)'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isTargetTransfer 
                      ? 'Switching playback…' 
                      : isActive 
                      ? '● Playing here' 
                      : 'Ready'}
                  </p>
                </div>
              </div>

              {isActive ? (
                <Check className="w-4 h-4 text-[#1ed760]" />
              ) : isTargetTransfer ? (
                <span className="text-[10px] font-bold text-amber-400 animate-pulse">Switching playback…</span>
              ) : null}
            </button>
          );
        })}
      </div>
      
      <div className="mt-auto space-y-3 pt-6 border-t border-white/10 text-[11px]">
        <a href="#" className="flex justify-between items-center font-semibold text-slate-300 hover:text-white transition-colors">
          Don&apos;t see your device? 
          <span className="text-slate-500">↗</span>
        </a>
        <a href="#" className="flex justify-between items-center font-semibold text-slate-300 hover:text-white transition-colors">
          What can I connect to?
          <span className="text-slate-500">↗</span>
        </a>
      </div>
    </aside>
  );
}
