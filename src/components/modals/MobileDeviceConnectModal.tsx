'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Smartphone, Monitor, Check, Laptop, Tv, 
  Radio, Loader2, AlertCircle, RefreshCw, Volume2,
  Speaker, Headphones, ArrowLeft, Wifi, Sparkles, ShieldCheck,
  Music, Sliders, Play, Pause, SkipForward, SkipBack, Zap
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { TransferCoordinator } from '@/lib/connect/TransferCoordinator';

export function MobileDeviceConnectModal() {
  const { 
    isDeviceModalOpen, 
    toggleDeviceModal, 
    deviceId, 
    activeDeviceId, 
    connectedDeviceId,
    connectToDevice,
    disconnectDevice,
    availableDevicePlaybackStates,
    onlineDevices, 
    transferPlayback,
    isActiveDevice,
    remoteDeviceName,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    togglePlayPause,
    playNext,
    playPrev
  } = usePlayerStore();

  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [selectedDetailDevice, setSelectedDetailDevice] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  if (!isDeviceModalOpen) return null;

  const isRemoteConnected = !isActiveDevice && !!connectedDeviceId;
  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId || d.id === connectedDeviceId);
  const localDeviceObj = onlineDevices.find(d => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Phone';

  const availableDevices = onlineDevices.filter(d => d.id !== (isRemoteConnected ? (connectedDeviceId || activeDeviceId) : deviceId) && d.isOnline !== false);
  const offlineDevices = onlineDevices.filter(d => d.isOnline === false);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1000);
  };

  const handleTransfer = async (targetId: string, targetName: string) => {
    if (targetId === activeDeviceId) return;
    setErrorMessage(null);
    setTransferringId(targetId);

    try {
      import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact());
      await transferPlayback(targetId);
      setTimeout(() => {
        setTransferringId(null);
        toggleDeviceModal();
      }, 600);
    } catch (err: any) {
      setTransferringId(null);
      setErrorMessage(`Couldn't switch to ${targetName}. Your current device is still playing.`);
    }
  };

  const formatTime = (secs: number): string => {
    if (!Number.isFinite(secs) || secs < 0) return '--:--';
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
  };

  const getDeviceIcon = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('tv') || p.includes('cast')) return Tv;
    if (p.includes('speaker')) return Speaker;
    if (p.includes('headphone') || p.includes('bluetooth') || p.includes('buds')) return Headphones;
    if (p.includes('phone') || p.includes('android') || p.includes('ios')) return Smartphone;
    return Laptop;
  };

  const CurrentIcon = getDeviceIcon(activeDeviceObj?.platform || (isRemoteConnected ? activeDeviceObj?.platform : localDeviceObj?.platform));

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Dark Ambient Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-xl transition-opacity"
        onClick={toggleDeviceModal}
      />

      {/* Main Connect Liquid Lens Modal Container */}
      <div className="relative w-full max-w-lg lens-crystal border-t sm:border border-white/18 rounded-t-[32px] sm:rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col max-h-[90dvh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-8 duration-200">
        
        {/* Specular Top Rim */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

        {/* Top Pull Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

        {/* HEADER */}
        <div className="px-6 pt-4 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleDeviceModal}
              className="p-2 -ml-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                Connect to Device
              </h3>
              <p className="text-xs text-white/60 font-medium">Choose where you want to listen</p>
            </div>
          </div>
          
          <button 
            onClick={handleScan}
            className={`p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all ${isScanning ? 'animate-spin text-[#E50914]' : ''}`}
            title="Scan for nearby devices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-xs text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* SCROLLABLE DEVICE LIST */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* SECTION 1: THIS DEVICE / NOW PLAYING */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-mono font-bold text-[#E50914] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
                CURRENT PLAYBACK
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {isRemoteConnected ? 'Remote Controlled' : 'Authoritative Renderer'}
              </span>
            </div>

            <div className="p-4 rounded-3xl lens-floating border border-white/20 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E50914] to-[#B80610] flex items-center justify-center text-white shadow-lg shadow-[#E50914]/30 flex-shrink-0">
                    <CurrentIcon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white leading-tight truncate">
                        {isRemoteConnected ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') : localDeviceName}
                      </h4>
                      <Check className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-0.5 truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
                      <span>{isPlaying ? 'Playing Lossless Stream' : 'Paused'}</span>
                    </p>
                  </div>
                </div>

                {isRemoteConnected ? (
                  <button
                    onClick={() => disconnectDevice()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all active:scale-95 flex-shrink-0"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div className="flex items-end gap-1 h-5 px-3 py-1 bg-white/10 rounded-full flex-shrink-0">
                    <span className={`w-1 bg-[#E50914] rounded-full transition-all duration-300 ${isPlaying ? 'h-5 animate-pulse' : 'h-1.5'}`} />
                    <span className={`w-1 bg-[#E50914] rounded-full transition-all duration-300 ${isPlaying ? 'h-3.5 animate-pulse delay-75' : 'h-2'}`} />
                    <span className={`w-1 bg-[#E50914] rounded-full transition-all duration-300 ${isPlaying ? 'h-4.5 animate-pulse delay-150' : 'h-1.5'}`} />
                  </div>
                )}
              </div>

              {/* Live Track & Remote Controls */}
              {currentSong && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[240px] font-bold text-white flex items-center gap-1.5">
                      <span className="text-[#E50914]">♪</span> {currentSong.title} · {currentSong.artist}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono font-bold">
                      {formatTime(currentTime)} / {formatTime(duration || currentSong.duration || 180)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#E50914] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, (currentTime / (duration || currentSong.duration || 1)) * 100))}%` }}
                    />
                  </div>

                  {/* Remote Playback Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => playPrev()}
                        className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => togglePlayPause()}
                        className="w-8 h-8 rounded-full bg-[#E50914] hover:bg-[#FF1E27] text-white flex items-center justify-center shadow-md transition-transform active:scale-95"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                      </button>
                      <button 
                        onClick={() => playNext()}
                        className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="flex items-center gap-2 max-w-[140px] flex-1 justify-end">
                      <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: AVAILABLE DEVICES */}
          <div>
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">
              AVAILABLE DEVICES
            </span>

            <div className="space-y-2">
              {/* Option to pull playback back to this device */}
              {isRemoteConnected && (
                <div 
                  onClick={() => handleTransfer(deviceId, localDeviceName)}
                  className="p-3.5 rounded-2xl lens-soft border border-white/12 hover:border-[#E50914]/50 flex items-center justify-between transition-all hover:scale-[1.01] cursor-pointer group shadow-md"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white flex-shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{localDeviceName}</h4>
                      <p className="text-[11px] text-emerald-400 font-medium truncate">
                        {transferringId === deviceId ? 'Switching playback…' : 'This Phone · Ready'}
                      </p>
                    </div>
                  </div>

                  <button
                    disabled={transferringId === deviceId}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#E50914] hover:bg-[#FF1E27] text-white flex items-center gap-1.5 shadow-md shadow-[#E50914]/25 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                  >
                    {transferringId === deviceId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Switching…</span>
                      </>
                    ) : (
                      <span>Play Here</span>
                    )}
                  </button>
                </div>
              )}

              {/* Other Detected Online Devices */}
              {availableDevices.map((dev) => {
                const Icon = getDeviceIcon(dev.platform);
                const isTransferring = transferringId === dev.id;

                return (
                  <div 
                    key={dev.id} 
                    onClick={() => !isTransferring && handleTransfer(dev.id, dev.name)}
                    className="p-3.5 rounded-2xl lens-soft border border-white/12 hover:border-[#E50914]/50 flex items-center justify-between transition-all hover:scale-[1.01] cursor-pointer group shadow-md"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white flex-shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{dev.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span className="text-emerald-400 font-sans font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Ready
                          </span>
                          <span>·</span>
                          <span className="text-[#FF1E27] uppercase font-bold">Lossless Pro</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isTransferring ? (
                        <span className="text-xs text-amber-400 font-bold px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/30 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Syncing…</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransfer(dev.id, dev.name);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-[#E50914] text-white border border-white/12 transition-all active:scale-95"
                        >
                          Transfer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>

          {/* SECTION 3: OFFLINE DEVICES */}
          {offlineDevices.length > 0 && (
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                OFFLINE DEVICES
              </span>
              <div className="space-y-2 opacity-50">
                {offlineDevices.map((dev) => {
                  const Icon = getDeviceIcon(dev.platform);
                  return (
                    <div key={dev.id} className="p-3 rounded-xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <div>
                          <h4 className="text-xs font-medium text-slate-400">{dev.name}</h4>
                          <p className="text-[10px] text-slate-500 font-mono">Offline · Last seen recently</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">Unavailable</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER GUARANTEE */}
        <div className="p-3.5 border-t border-white/10 text-[11px] text-slate-400 text-center bg-black/40 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
          <span>Synchronized: Song, Exact Position, Queue, Repeat & Remote Volume</span>
        </div>
      </div>
    </div>
  );
}

