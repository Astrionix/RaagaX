'use client';

import React from 'react';
import { X, Smartphone, Monitor, Check } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function MobileDeviceConnectModal() {
  const { 
    isDeviceModalOpen, 
    toggleDeviceModal, 
    deviceId, 
    activeDeviceId, 
    onlineDevices, 
    transferPlayback 
  } = usePlayerStore();

  if (!isDeviceModalOpen) return null;

  const handleDeviceClick = (targetId: string) => {
    transferPlayback(targetId);
    toggleDeviceModal();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:hidden">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={toggleDeviceModal}
      />

      {/* Bottom Sheet Card */}
      <div className="relative w-full max-h-[85vh] bg-[#121212] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 overscroll-none overflow-hidden pb-safe">
        {/* Drag handle */}
        <div className="w-full flex justify-center pt-3 pb-2" onClick={toggleDeviceModal}>
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <div className="px-6 pb-6 overflow-y-auto no-scrollbar">
          <h2 className="text-xl font-bold text-white mb-6">Connect</h2>

          <div className="space-y-4">
            {onlineDevices.length === 0 && (
              <div className="p-5 text-center bg-white/5 rounded-2xl">
                <p className="text-sm text-slate-300 font-medium">No other devices found on this network.</p>
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
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200
                    ${isActive 
                      ? 'bg-[#1ed760]/10 border border-[#1ed760]/30' 
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    {isMobile ? (
                      <Smartphone className={`w-7 h-7 ${isActive ? 'text-[#1ed760]' : 'text-white'}`} />
                    ) : (
                      <Monitor className={`w-7 h-7 ${isActive ? 'text-[#1ed760]' : 'text-white'}`} />
                    )}
                    
                    <div className="text-left">
                      <h4 className={`text-base font-bold leading-tight ${isActive ? 'text-[#1ed760]' : 'text-white'}`}>
                        {isThisDevice ? 'This phone' : device.name.split(' (')[0]}
                      </h4>
                      {isActive && (
                        <p className="text-sm text-[#1ed760] font-medium mt-1">Listening On</p>
                      )}
                    </div>
                  </div>

                  {isActive && <Check className="w-6 h-6 text-[#1ed760]" />}
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-slate-300 mb-4">On other networks</h3>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Ensure devices are logged into the same RaagaX account.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
