import React from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { MonitorSpeaker, Play, Pause } from 'lucide-react';


export function RemoteDeviceBanner() {
  const { isActiveDevice, remoteDeviceName, currentSong, isPlaying, togglePlayPause } = usePlayerStore();

  if (isActiveDevice || !currentSong) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 w-full max-w-sm px-4">
      <div className="bg-[#18181b]/90 backdrop-blur-xl border border-[#fa233b]/30 shadow-[0_0_30px_rgba(239,35,60,0.15)] rounded-2xl p-3 flex flex-col gap-3 text-white">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1ed760] text-[11px] font-bold uppercase tracking-wider">
            <MonitorSpeaker className="w-4 h-4" />
            Playing on {remoteDeviceName || 'Remote Device'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <img 
            src={currentSong.coverUrl || '/app-icon.png'} 
            alt={currentSong.title} 
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate">{currentSong.title}</div>
            <div className="text-[10px] text-slate-400 truncate">{currentSong.artist}</div>
          </div>
          <button 
            onClick={togglePlayPause}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>
        </div>

        <button 
          onClick={() => {
            const state = usePlayerStore.getState();
            state.transferPlayback(state.deviceId);
          }}
          className="w-full py-2 rounded-xl bg-[#fa233b] hover:bg-[#e01f35] text-white text-xs font-bold transition-colors active:scale-95"
        >
          Switch to this device
        </button>

      </div>
    </div>
  );
}
