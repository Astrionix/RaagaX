'use client';

import React from 'react';
import { X, Smartphone, Monitor, Check, Volume2, VolumeX, Radio, Laptop } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function MobileDeviceConnectModal() {
  const { 
    isDeviceModalOpen, 
    toggleDeviceModal, 
    deviceId, 
    activeDeviceId, 
    onlineDevices, 
    transferPlayback,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isActiveDevice
  } = usePlayerStore();

  if (!isDeviceModalOpen) return null;

  const handleDeviceClick = (targetId: string) => {
    transferPlayback(targetId);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={toggleDeviceModal}
      />

      {/* Modal Card - Spotify Connect Inspired */}
      <div className="relative w-full max-w-md bg-[#09090b] border border-white/10 rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overscroll-none overflow-hidden text-white z-10">
        
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <button 
            onClick={toggleDeviceModal}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">RaagaX Connect</span>
          <div className="w-8" />
        </div>

        <div className="px-6 py-6 overflow-y-auto max-h-[75vh] no-scrollbar">
          
          {/* Spotify Vector Graphic Illustration */}
          <div className="my-2 py-4 flex flex-col items-center justify-center">
            <svg className="w-48 h-20 text-slate-300/90 mx-auto" viewBox="0 0 200 90" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {/* Desktop Monitor / Laptop */}
              <rect x="20" y="20" width="60" height="42" rx="3" />
              <path d="M10 62h80v4H10z" />
              {/* Console Game Controller */}
              <path d="M105 45c0-4 4-8 8-8s8 4 8 8v8h-16z" />
              <rect x="100" y="50" width="26" height="14" rx="4" />
              {/* Speaker Box */}
              <rect x="138" y="15" width="30" height="52" rx="4" />
              <circle cx="153" cy="30" r="5" />
              <circle cx="153" cy="52" r="8" />
              {/* Smartphone */}
              <rect x="176" y="38" width="14" height="28" rx="3" />
            </svg>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-4 text-center tracking-tight">
              Connect to a device
            </h2>
          </div>

          {/* Devices List */}
          <div className="space-y-3 mt-4">
            {/* Current Device Item */}
            <button
              onClick={() => handleDeviceClick(deviceId)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 text-left border ${
                isActiveDevice 
                  ? 'bg-[#1ed760]/10 border-[#1ed760]/40' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Laptop className={`w-7 h-7 flex-shrink-0 ${isActiveDevice ? 'text-[#1ed760]' : 'text-white'}`} />
                <div className="min-w-0">
                  <h4 className={`text-base font-extrabold truncate leading-tight ${isActiveDevice ? 'text-[#1ed760]' : 'text-white'}`}>
                    This Web Browser
                  </h4>
                  <p className={`text-xs font-semibold mt-0.5 ${isActiveDevice ? 'text-[#1ed760]/80' : 'text-slate-400'}`}>
                    RaagaX Connect
                  </p>
                </div>
              </div>

              {isActiveDevice && (
                <div className="flex items-center gap-2 text-[#1ed760] flex-shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ed760] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1ed760]"></span>
                  </span>
                  <Check className="w-5 h-5 ml-1" />
                </div>
              )}
            </button>

            {/* Other Online Devices */}
            {onlineDevices.filter(d => d.id !== deviceId).map((device) => {
              const isActive = activeDeviceId === device.id;
              const isMobile = device.name.toLowerCase().includes('mobile') || device.name.toLowerCase().includes('phone');

              return (
                <button
                  key={device.id}
                  onClick={() => handleDeviceClick(device.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 text-left border ${
                    isActive 
                      ? 'bg-[#1ed760]/10 border-[#1ed760]/40' 
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {isMobile ? (
                      <Smartphone className={`w-7 h-7 flex-shrink-0 ${isActive ? 'text-[#1ed760]' : 'text-white'}`} />
                    ) : (
                      <Monitor className={`w-7 h-7 flex-shrink-0 ${isActive ? 'text-[#1ed760]' : 'text-white'}`} />
                    )}
                    
                    <div className="min-w-0">
                      <h4 className={`text-base font-extrabold truncate leading-tight ${isActive ? 'text-[#1ed760]' : 'text-white'}`}>
                        {device.name}
                      </h4>
                      <p className={`text-xs font-semibold mt-0.5 ${isActive ? 'text-[#1ed760]/80' : 'text-slate-400'}`}>
                        RaagaX Connect
                      </p>
                    </div>
                  </div>

                  {isActive && <Check className="w-5 h-5 text-[#1ed760]" />}
                </button>
              );
            })}
          </div>

          {/* Device Sync Network Info */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-1">
            <p className="text-xs font-bold text-slate-400">Listening on other networks or apps?</p>
            <p className="text-[11px] text-slate-500">Ensure devices are signed in under the same RaagaX user account.</p>
          </div>
        </div>

        {/* Spotify Bottom Volume Slider */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center gap-3">
          <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-[#fa233b]" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-[#1ed760] hover:h-2 transition-all"
          />
        </div>

      </div>
    </div>
  );
}

