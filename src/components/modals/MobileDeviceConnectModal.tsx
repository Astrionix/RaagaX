'use client';

import React, { useState } from 'react';
import { 
  X, Smartphone, Monitor, Check, Laptop, Tv, 
  Radio, Loader2, AlertCircle, RefreshCw, Volume2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { TransferCoordinator } from '@/lib/connect/TransferCoordinator';

export function MobileDeviceConnectModal() {
  const { 
    isDeviceModalOpen, 
    toggleDeviceModal, 
    deviceId, 
    activeDeviceId, 
    onlineDevices, 
    transferPlayback,
    isActiveDevice,
    remoteDeviceName,
    currentSong,
    isPlaying,
    currentTime,
    duration
  } = usePlayerStore();

  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isDeviceModalOpen) return null;

  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId) || 
    (isActiveDevice ? { id: deviceId, name: 'This Device (Browser)', platform: 'Web', isOnline: true } : null);

  const availableDevices = onlineDevices.filter(d => d.id !== (activeDeviceObj?.id || deviceId) && d.isOnline !== false);
  const offlineDevices = onlineDevices.filter(d => d.isOnline === false);

  const handleTransfer = async (targetId: string, targetName: string) => {
    if (targetId === activeDeviceId) return;
    setErrorMessage(null);
    setTransferringId(targetId);

    try {
      await TransferCoordinator.getInstance().initiateTransfer(targetId);
      transferPlayback(targetId);
      setTimeout(() => {
        setTransferringId(null);
        toggleDeviceModal();
      }, 800);
    } catch (err: any) {
      setTransferringId(null);
      setErrorMessage(`Couldn't switch to ${targetName}. Your current device is still playing.`);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const getDeviceIcon = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('tv')) return Tv;
    if (p.includes('phone') || p.includes('android') || p.includes('ios')) return Smartphone;
    return Laptop;
  };

  const CurrentIcon = getDeviceIcon(activeDeviceObj?.platform);

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={toggleDeviceModal}
      />

      {/* Sheet Content */}
      <div className="relative w-full max-w-lg bg-[#0F1118] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F51B3D]/10 flex items-center justify-center text-[#F51B3D]">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Where to play?</h3>
              <p className="text-[11px] text-[#8E92A4]">RaagaX Cross-Device Audio Sync</p>
            </div>
          </div>
          <button 
            onClick={toggleDeviceModal}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          
          {/* SECTION 1: CURRENT PLAYBACK */}
          <div>
            <span className="text-[10px] font-bold text-[#8E92A4] uppercase tracking-wider block mb-2.5">
              Current Playback
            </span>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F51B3D]/15 to-transparent border border-[#F51B3D]/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F51B3D]/20 flex items-center justify-center text-[#F51B3D]">
                    <CurrentIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {activeDeviceObj ? activeDeviceObj.name : 'This Device'}
                    </h4>
                    <p className="text-[11px] text-[#F51B3D] font-medium mt-0.5">
                      {isActiveDevice ? 'Playing here (This Device)' : `Playing on ${remoteDeviceName || 'Remote Device'}`}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isPlaying ? 'Playing' : 'Paused'}
                </span>
              </div>

              {currentSong && (
                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
                  <span className="truncate max-w-[240px] font-medium text-white">{currentSong.title}</span>
                  <span className="text-[11px] text-[#8E92A4] font-mono">
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: AVAILABLE DEVICES */}
          <div>
            <span className="text-[10px] font-bold text-[#8E92A4] uppercase tracking-wider block mb-2.5">
              Available Devices
            </span>

            <div className="space-y-2">
              {/* Play on This Device option if currently playing elsewhere */}
              {!isActiveDevice && (
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-3">
                    <Laptop className="w-5 h-5 text-slate-300" />
                    <div>
                      <h4 className="text-xs font-bold text-white">This Device</h4>
                      <p className="text-[11px] text-[#8E92A4]">Ready to play</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTransfer(deviceId, 'This Device')}
                    disabled={transferringId === deviceId}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#F51B3D] hover:bg-[#D91533] text-white flex items-center gap-1.5 shadow-md shadow-[#F51B3D]/20 transition-all disabled:opacity-50"
                  >
                    {transferringId === deviceId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Switching...</span>
                      </>
                    ) : (
                      <span>Play Here</span>
                    )}
                  </button>
                </div>
              )}

              {/* Other Available Online Devices */}
              {availableDevices.map((dev) => {
                const Icon = getDeviceIcon(dev.platform);
                const isTransferring = transferringId === dev.id;

                return (
                  <div key={dev.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-slate-300" />
                      <div>
                        <h4 className="text-xs font-bold text-white">{dev.name}</h4>
                        <p className="text-[11px] text-[#8E92A4]">Available</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTransfer(dev.id, dev.name)}
                      disabled={isTransferring}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 border border-white/10 transition-all disabled:opacity-50"
                    >
                      {isTransferring ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Switching...</span>
                        </>
                      ) : (
                        <span>Play Here</span>
                      )}
                    </button>
                  </div>
                );
              })}

              {availableDevices.length === 0 && isActiveDevice && (
                <p className="text-xs text-[#8E92A4] py-2 italic text-center">
                  No other devices detected. Open RaagaX on your phone or laptop to handoff playback.
                </p>
              )}
            </div>
          </div>

          {/* SECTION 3: OFFLINE DEVICES */}
          {offlineDevices.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-[#8E92A4] uppercase tracking-wider block mb-2.5">
                Offline Devices
              </span>
              <div className="space-y-2 opacity-60">
                {offlineDevices.map((dev) => {
                  const Icon = getDeviceIcon(dev.platform);
                  return (
                    <div key={dev.id} className="p-3 rounded-xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-slate-500" />
                        <div>
                          <h4 className="text-xs font-semibold text-slate-400">{dev.name}</h4>
                          <p className="text-[10px] text-slate-500">Offline</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500">Disconnected</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Note */}
        <div className="p-4 border-t border-white/5 text-[11px] text-[#8E92A4] text-center bg-black/20">
          Playback moves smoothly with exact song position, queue, and shuffle order preserved.
        </div>
      </div>
    </div>
  );
}
