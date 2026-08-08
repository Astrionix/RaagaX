'use client';

import React from 'react';
import { MonitorSmartphone, Monitor, Smartphone, Check } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function DeviceTransferPopover({ onClose }: { onClose: () => void }) {
  const { deviceId, activeDeviceId, onlineDevices, transferPlayback } = usePlayerStore();

  const handleDeviceClick = (targetId: string) => {
    transferPlayback(targetId);
    onClose();
  };

  return (
    <div className="absolute bottom-full right-0 mb-4 w-72 bg-[#1A1A1D] rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50">
      <div className="p-4 border-b border-white/5 bg-[#26262A]/50">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <MonitorSmartphone className="w-4 h-4 text-[#EF233C]" /> Connect to a device
        </h3>
      </div>

      <div className="p-2 space-y-1">
        {onlineDevices.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-400 font-medium">No other devices found.</p>
            <p className="text-[10px] text-slate-500 mt-1">Log into another device to sync.</p>
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
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-[#EF233C]/10 hover:bg-[#EF233C]/20 border border-[#EF233C]/30' 
                  : 'hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center
                  ${isActive ? 'bg-[#EF233C]' : 'bg-[#26262A] group-hover:bg-[#323236]'}
                `}>
                  {isMobile ? (
                    <Smartphone className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  ) : (
                    <Monitor className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  )}
                </div>
                <div className="text-left">
                  <h4 className={`text-xs font-bold leading-tight ${isActive ? 'text-[#EF233C]' : 'text-white'}`}>
                    {device.name} {isThisDevice && '(This Device)'}
                  </h4>
                  {isActive && (
                    <p className="text-[10px] text-[#EF233C]/80 font-semibold mt-0.5">Listening On</p>
                  )}
                </div>
              </div>

              {isActive && <Check className="w-4 h-4 text-[#EF233C]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
