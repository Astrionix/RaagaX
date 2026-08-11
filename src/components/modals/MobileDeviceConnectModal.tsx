'use client';

import React from 'react';
import { X, Smartphone, Monitor, Check, Volume2, VolumeX, Laptop, Play, Radio, Music } from 'lucide-react';
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
    isActiveDevice,
    currentSong,
    isPlaying,
    currentTime,
    duration
  } = usePlayerStore();

  if (!isDeviceModalOpen) return null;

  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId) || 
    (isActiveDevice ? { id: deviceId, name: 'This Device (Web Browser)', platform: 'Web' } : null);

  const availableDevices = onlineDevices.filter(d => d.id !== (activeDeviceObj?.id || deviceId));

  const handleTransfer = (targetId: string) => {
    if (targetId !== activeDeviceId) {
      transferPlayback(targetId);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={toggleDeviceModal}
      />

      {/* Modal Card - Spotify Connect Hierarchy */}
      <div className="relative w-full max-w-md bg-[#09090b] border border-white/10 rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overscroll-none overflow-hidden text-white z-10">
        
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <button 
            onClick={toggleDeviceModal}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#1ed760] animate-pulse" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">RaagaX Connect</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="px-6 py-5 overflow-y-auto max-h-[75vh] no-scrollbar space-y-6">
          
          {/* SECTION 1: CURRENTLY PLAYING ON */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Currently Playing On
            </h3>

            <div className="bg-[#1ed760]/10 border border-[#1ed760]/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Laptop className="w-6 h-6 text-[#1ed760]" />
                  <div>
                    <h4 className="text-base font-extrabold text-[#1ed760] leading-tight">
                      {activeDeviceObj ? activeDeviceObj.name : 'This Device'}
                    </h4>
                    <p className="text-[11px] font-semibold text-[#1ed760]/80 mt-0.5">
                      {isActiveDevice ? 'This device · Active Renderer' : 'Remote Renderer'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[#1ed760]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ed760] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1ed760]"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider">Playing</span>
                </div>
              </div>

              {/* Active Song Details & Progress */}
              {currentSong && (
                <div className="pt-2 border-t border-[#1ed760]/20 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{currentSong.title}</p>
                    <p className="text-[11px] text-slate-300 truncate">{currentSong.artist}</p>
                  </div>
                  <div className="text-right text-[10px] font-bold text-slate-400">
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: AVAILABLE DEVICES */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
              Select a Device to Play
            </h3>

            <div className="space-y-2.5">
              {/* Local Device Option if not currently active */}
              {!isActiveDevice && (
                <button
                  onClick={() => handleTransfer(deviceId)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Laptop className="w-5 h-5 text-slate-300 group-hover:text-white" />
                    <div>
                      <h4 className="text-sm font-extrabold text-white">This Web Browser</h4>
                      <p className="text-[11px] text-slate-400">Ready to play</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#1ed760] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    ▶ Play here
                  </span>
                </button>
              )}

              {/* Other Online Devices */}
              {availableDevices.map((device) => {
                const isMobile = device.name.toLowerCase().includes('mobile') || device.name.toLowerCase().includes('phone');

                return (
                  <button
                    key={device.id}
                    onClick={() => handleTransfer(device.id)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      {isMobile ? (
                        <Smartphone className="w-5 h-5 text-slate-300 group-hover:text-white" />
                      ) : (
                        <Monitor className="w-5 h-5 text-slate-300 group-hover:text-white" />
                      )}
                      <div>
                        <h4 className="text-sm font-extrabold text-white">{device.name}</h4>
                        <p className="text-[11px] text-slate-400">RaagaX Connect · Ready</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1ed760] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Transfer here →
                    </span>
                  </button>
                );
              })}

              {availableDevices.length === 0 && isActiveDevice && (
                <div className="p-4 rounded-2xl bg-white/5 text-center text-xs text-slate-400">
                  No other Connect devices online. Open RaagaX on mobile or laptop to switch playback.
                </div>
              )}
            </div>
          </div>

          {/* User Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span className="hover:text-white cursor-pointer transition-colors">See all devices</span>
            <span className="hover:text-white cursor-pointer transition-colors">Manage devices</span>
          </div>
        </div>

        {/* Volume Slider */}
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
