'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Smartphone, Monitor, Check, Laptop, Tv, 
  Radio, Loader2, AlertCircle, RefreshCw, Volume2,
  Speaker, Headphones, ArrowLeft, Wifi, Sparkles, ShieldCheck
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
    duration
  } = usePlayerStore();

  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [confirmDevice, setConfirmDevice] = useState<{ id: string; name: string; platform: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [syncTimeAgo, setSyncTimeAgo] = useState('just now');

  useEffect(() => {
    if (!isDeviceModalOpen) return;
    const timer = setInterval(() => {
      setSyncTimeAgo('just now');
    }, 5000);
    return () => clearInterval(timer);
  }, [isDeviceModalOpen]);

  if (!isDeviceModalOpen) return null;

  const isRemoteConnected = !isActiveDevice && !!connectedDeviceId;
  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId || d.id === connectedDeviceId);
  const localDeviceObj = onlineDevices.find(d => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Device';

  const availableDevices = onlineDevices.filter(d => d.id !== (isRemoteConnected ? (connectedDeviceId || activeDeviceId) : deviceId) && d.isOnline !== false);
  const offlineDevices = onlineDevices.filter(d => d.isOnline === false);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  const handleConnectRemote = async (targetId: string) => {
    try {
      await connectToDevice(targetId);
    } catch (err: any) {
      setErrorMessage(`Couldn't connect to device.`);
    }
  };

  const handleTransfer = async (targetId: string, targetName: string) => {
    if (targetId === activeDeviceId) return;
    setErrorMessage(null);
    setTransferringId(targetId);
    setConfirmDevice(null);

    try {
      await transferPlayback(targetId);
      setTimeout(() => {
        setTransferringId(null);
        toggleDeviceModal();
      }, 700);
    } catch (err: any) {
      setTransferringId(null);
      setErrorMessage(`Couldn't switch to ${targetName}. Your current device is still playing.`);
    }
  };

  const formatTime = (secs: number): string => {
    if (!Number.isFinite(secs) || secs < 0) {
      return '--:--';
    }
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
  };

  const getDeviceIcon = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('tv') || p.includes('cast')) return Tv;
    if (p.includes('speaker')) return Speaker;
    if (p.includes('headphone') || p.includes('bluetooth')) return Headphones;
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

      {/* Main Connect Modal Container */}
      <div className="relative w-full max-w-lg bg-[#0d0e14] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[90dvh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-8 duration-200">
        
        {/* Top Pull Handle for Mobile */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

        {/* SCREEN 2 HEADER */}
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
              <p className="text-xs text-white/60 font-medium">Automatic Discovery · Explicit Connect</p>
            </div>
          </div>
          
          <button 
            onClick={handleScan}
            className={`p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all ${isScanning ? 'animate-spin text-[#fa233b]' : ''}`}
            title="Scan for nearby devices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* HERO DEVICE ILLUSTRATION AREA */}
        <div className="px-6 py-4 bg-gradient-to-b from-[#170e17] via-[#0d0e14] to-[#0d0e14] border-b border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute w-48 h-20 bg-[#fa233b]/20 blur-3xl rounded-full pointer-events-none -top-4" />

          {/* Multi-Device Graphic */}
          <div className="flex items-center justify-center gap-5 py-2 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#fa233b] to-[#ff4d6d] flex items-center justify-center text-white shadow-[0_0_25px_rgba(250,35,59,0.4)]">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70">
              <Tv className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-white/50">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>RaagaX Cross-Device Network · Synced {syncTimeAgo}</span>
          </div>
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
          {/* SECTION 1: NOW PLAYING (HERO CARD) */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                NOW PLAYING
              </span>
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                {isRemoteConnected ? 'Remote Controlled' : 'Active Audio Sink'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1b24] via-[#12131a] to-[#0d0e14] border border-emerald-500/30 space-y-3 shadow-xl shadow-emerald-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
                    <CurrentIcon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white leading-tight truncate">
                        {isRemoteConnected ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') : localDeviceName}
                      </h4>
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-emerald-400 font-bold mt-0.5 truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{isRemoteConnected ? `Playing on ${remoteDeviceName || activeDeviceObj?.name || 'Remote Device'}` : 'Playing now'}</span>
                    </p>
                  </div>
                </div>

                {isRemoteConnected ? (
                  <button
                    onClick={() => disconnectDevice()}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-white/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all active:scale-95 flex-shrink-0"
                  >
                    Disconnect
                  </button>
                ) : (
                  /* Equalizer Wave */
                  <div className="flex items-end gap-1 h-5 px-3 py-1 bg-white/10 rounded-full flex-shrink-0">
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-5 animate-pulse' : 'h-1.5'}`} />
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-3.5 animate-pulse delay-75' : 'h-2'}`} />
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-4.5 animate-pulse delay-150' : 'h-1.5'}`} />
                  </div>
                )}
              </div>

              {currentSong && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[240px] font-bold text-white flex items-center gap-1.5">
                      <span className="text-emerald-400">♪</span> {currentSong.title}
                    </span>
                    <span className="text-[11px] text-white/60 font-mono font-bold">
                      {formatTime(currentTime)} / {formatTime(Number.isFinite(duration) && duration > 0 ? duration : (Number.isFinite(currentSong?.duration) && currentSong.duration > 0 ? currentSong.duration : -1))}
                    </span>
                  </div>
                  {/* Subtle Progress Bar in Now Playing Card */}
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, (currentTime / (duration || currentSong.duration || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: YOUR DEVICES */}
          <div>
            <span className="text-[11px] font-black text-white/60 uppercase tracking-wider block mb-2 px-1">
              YOUR DEVICES
            </span>

            <div className="space-y-2">
              {/* Option to pull playback to this device if currently in remote controller mode */}
              {isRemoteConnected && (
                <div 
                  onClick={() => handleTransfer(deviceId, localDeviceName)}
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 flex items-center justify-between transition-all hover:bg-white/[0.06] cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 group-hover:border-emerald-500/30 flex items-center justify-center text-white/80 flex-shrink-0">
                      <Smartphone className="w-5 h-5 text-slate-300 group-hover:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300">{localDeviceName}</h4>
                      <p className="text-[11px] text-emerald-400 font-medium truncate">
                        {transferringId === deviceId ? 'Switching playback…' : 'Available'}
                      </p>
                    </div>
                  </div>

                  <button
                    disabled={transferringId === deviceId}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                  >
                    {transferringId === deviceId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Switching…</span>
                      </>
                    ) : (
                      <span>Play here</span>
                    )}
                  </button>
                </div>
              )}

              {/* Other Detected Online Devices */}
              {availableDevices.map((dev) => {
                const Icon = getDeviceIcon(dev.platform);
                const isConnected = connectedDeviceId === dev.id;
                const isTransferring = transferringId === dev.id;

                return (
                  <div 
                    key={dev.id} 
                    onClick={() => !isTransferring && handleTransfer(dev.id, dev.name)}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 flex items-center justify-between transition-all hover:bg-white/[0.06] cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 group-hover:border-emerald-500/30 flex items-center justify-center text-white/80 flex-shrink-0">
                        <Icon className="w-5 h-5 text-slate-300 group-hover:text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300">{dev.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium truncate">
                          {isTransferring ? (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Preparing…</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                              <span>Ready</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isTransferring ? (
                        <span className="text-xs text-amber-400 font-bold px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/30">
                          Switching…
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransfer(dev.id, dev.name);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-white/10 hover:bg-emerald-500 hover:text-white text-slate-200 border border-white/10 hover:border-emerald-500/30 transition-all active:scale-95"
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
              <span className="text-[11px] font-black text-white/40 uppercase tracking-wider block mb-2.5">
                OFFLINE DEVICES
              </span>
              <div className="space-y-2 opacity-50">
                {offlineDevices.map((dev) => {
                  const Icon = getDeviceIcon(dev.platform);
                  return (
                    <div key={dev.id} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-white/40" />
                        <div>
                          <h4 className="text-xs font-medium text-white/50">{dev.name}</h4>
                          <p className="text-[10px] text-white/30">Offline</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-white/30">Unavailable</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* SWITCH PLAYBACK CONFIRMATION POPUP */}
        {confirmDevice && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-2xl p-6 flex flex-col justify-center items-center text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-3xl bg-[#fa233b]/20 border border-[#fa233b]/40 flex items-center justify-center text-[#fa233b] mb-4">
              <Speaker className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-white mb-1">
              Play on {confirmDevice.name}?
            </h3>
            <p className="text-xs text-white/60 max-w-xs mb-6">
              Playback will switch instantly to {confirmDevice.name} with your current queue and position intact.
            </p>

            <div className="flex items-center gap-3 w-full max-w-xs">
              <button
                onClick={() => setConfirmDevice(null)}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTransfer(confirmDevice.id, confirmDevice.name)}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#fa233b] to-[#e01e37] text-white font-black text-xs shadow-lg shadow-[#fa233b]/30 transition-all hover:scale-105"
              >
                Play Here
              </button>
            </div>
          </div>
        )}

        {/* FOOTER SYNCHRONIZATION GUARANTEE */}
        <div className="p-4 border-t border-white/10 text-[11px] text-white/50 text-center bg-black/40 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#fa233b]" />
          <span>Synchronized: Song, Position, Queue, Shuffle & Repeat state</span>
        </div>
      </div>
    </div>
  );
}
