'use client';

import React from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { MonitorSpeaker, Play, Pause, ChevronRight } from 'lucide-react';

export function RemoteDeviceBanner() {
  const { isActiveDevice, remoteDeviceName, currentSong, isPlaying, togglePlayPause, toggleDeviceModal, transferPlayback, deviceId } = usePlayerStore();

  if (isActiveDevice || !currentSong) return null;

  return (
    <div 
      className="fixed z-50 left-1/2 -translate-x-1/2 w-full max-w-md px-4 md:bottom-24 animate-in fade-in slide-in-from-bottom-4 duration-300 select-none"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 8px)' }}
    >
      <div className="bg-[#121214]/95 backdrop-blur-2xl border border-white/10 hover:border-[#FA233B]/40 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(250,35,59,0.15)] rounded-2xl p-3.5 flex flex-col gap-3 text-white transition-all">
        
        {/* Device Status Bar - Click to open device picker */}
        <div 
          onClick={toggleDeviceModal}
          className="flex items-center justify-between cursor-pointer group/hdr -mx-1 px-1 py-0.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-black tracking-wide">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <MonitorSpeaker className="w-4 h-4 text-emerald-400" />
            <span className="truncate">Playing on {remoteDeviceName || 'Remote Device'}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover/hdr:text-white transition-colors">
            <span>Change</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Track Preview & Play/Pause */}
        <div className="flex items-center gap-3">
          <img 
            src={currentSong.coverUrl || '/app-icon.png'} 
            alt={currentSong.title} 
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
            className="w-11 h-11 rounded-xl object-cover shadow-md flex-shrink-0"
          />
          <div className="min-w-0 flex-1 cursor-pointer" onClick={toggleDeviceModal}>
            <div className="text-xs font-bold text-white truncate leading-tight">{currentSong.title}</div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">{currentSong.artist}</div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#FA233B] text-white flex items-center justify-center transition-all active:scale-90 flex-shrink-0 shadow"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>
        </div>

        {/* Seamless Takeover CTA */}
        <button 
          onClick={() => {
            transferPlayback(deviceId);
          }}
          className="w-full py-2 rounded-xl bg-gradient-to-r from-[#FA233B] to-[#e01f35] hover:brightness-110 text-white text-xs font-black tracking-wide shadow-lg transition-all active:scale-[0.98] cursor-pointer"
        >
          Switch Playback to This Device
        </button>

      </div>
    </div>
  );
}

