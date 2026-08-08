'use client';

import React from 'react';
import { X, Monitor, Smartphone, Check } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function RightDeviceConnectPanel() {
  const { deviceId, activeDeviceId, onlineDevices, transferPlayback, setRightPanelMode } = usePlayerStore();

  const handleDeviceClick = (targetId: string) => {
    transferPlayback(targetId);
  };

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full bg-[#07090E]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-base text-white">Connect</h3>
        <button 
          onClick={() => setRightPanelMode('queue')}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2">
        {onlineDevices.length === 0 && (
          <div className="p-4 text-center border border-white/5 rounded-xl">
            <p className="text-sm text-slate-400 font-medium">No other devices found.</p>
            <p className="text-[11px] text-slate-500 mt-2">Log into another device to sync.</p>
          </div>
        )}

        {onlineDevices.map((device) => {
          const isActive = device.id === activeDeviceId || (!activeDeviceId && device.id === deviceId);
          const isMobile = device.name.toLowerCase().includes('mobile');
          const isThisDevice = device.id === deviceId;

          return (
            <button
              key={device.id}
              onClick={() => handleDeviceClick(device.id)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-[#1ed760]/10 border border-[#1ed760]/20' 
                  : 'hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-4">
                {isMobile ? (
                  <Smartphone className={`w-6 h-6 ${isActive ? 'text-[#1ed760]' : 'text-white'}`} />
                ) : (
                  <Monitor className={`w-6 h-6 ${isActive ? 'text-[#1ed760]' : 'text-white'}`} />
                )}
                
                <div className="text-left">
                  <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-[#1ed760]' : 'text-white'}`}>
                    {device.name} {isThisDevice && '(This Device)'}
                  </h4>
                  {isActive && (
                    <p className="text-xs text-[#1ed760]/80 font-semibold mt-1">Listening On</p>
                  )}
                </div>
              </div>

              {isActive && <Check className="w-5 h-5 text-[#1ed760]" />}
            </button>
          );
        })}
      </div>
      
      <div className="mt-8 space-y-4 pt-6 border-t border-white/10">
        <a href="#" className="flex justify-between items-center text-sm font-bold text-white hover:underline">
          Don't see your device? 
          <span className="text-slate-400">↗</span>
        </a>
        <a href="#" className="flex justify-between items-center text-sm font-bold text-white hover:underline">
          What can I connect to?
          <span className="text-slate-400">↗</span>
        </a>
      </div>
    </aside>
  );
}
