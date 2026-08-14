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

  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId) || 
    (isActiveDevice ? { id: deviceId, name: 'This Phone (Local Device)', platform: 'Phone', isOnline: true } : null);

  const availableDevices = onlineDevices.filter(d => d.id !== (activeDeviceObj?.id || deviceId) && d.isOnline !== false);
  const offlineDevices = onlineDevices.filter(d => d.isOnline === false);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  const handleTransfer = async (targetId: string, targetName: string) => {
    if (targetId === activeDeviceId) return;
    setErrorMessage(null);
    setTransferringId(targetId);
    setConfirmDevice(null);

    try {
      await TransferCoordinator.getInstance().initiateTransfer(targetId);
      transferPlayback(targetId);
      setTimeout(() => {
        setTransferringId(null);
        toggleDeviceModal();
      }, 700);
    } catch (err: any) {
      setTransferringId(null);
      setErrorMessage(`Couldn't switch to ${targetName}. Your current device is still playing.`);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const getDeviceIcon = (platform?: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('tv') || p.includes('cast')) return Tv;
    if (p.includes('speaker')) return Speaker;
    if (p.includes('headphone') || p.includes('bluetooth')) return Headphones;
    if (p.includes('phone') || p.includes('android') || p.includes('ios')) return Smartphone;
    return Laptop;
  };

  const CurrentIcon = getDeviceIcon(activeDeviceObj?.platform || 'phone');

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
              <p className="text-xs text-white/60 font-medium">Play your music anywhere</p>
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
          
          {/* SECTION 1: CURRENT DEVICE */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black text-white/60 uppercase tracking-wider">
                CURRENT DEVICE
              </span>
              <span className="text-[10px] font-extrabold text-[#fa233b] bg-[#fa233b]/10 border border-[#fa233b]/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#fa233b]/20 via-[#2a0b12] to-[#14151f] border border-[#fa233b]/40 space-y-3 shadow-lg shadow-[#fa233b]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#fa233b] to-[#99001f] flex items-center justify-center text-white shadow-md">
                    <CurrentIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white leading-tight">
                      {activeDeviceObj ? activeDeviceObj.name : 'This Phone'}
                    </h4>
                    <p className="text-xs text-[#ff4d6d] font-bold mt-0.5">
                      {isActiveDevice ? 'Playing here (Local Device)' : `Playing on ${remoteDeviceName || 'Remote Device'}`}
                    </p>
                  </div>
                </div>

                {/* Animated Equalizer Wave */}
                <div className="flex items-end gap-1 h-5 px-3 py-1 bg-white/10 rounded-full">
                  <span className={`w-1 bg-[#fa233b] rounded-full transition-all duration-300 ${isPlaying ? 'h-5 animate-pulse' : 'h-1.5'}`} />
                  <span className={`w-1 bg-[#fa233b] rounded-full transition-all duration-300 ${isPlaying ? 'h-3.5 animate-pulse delay-75' : 'h-2'}`} />
                  <span className={`w-1 bg-[#fa233b] rounded-full transition-all duration-300 ${isPlaying ? 'h-4.5 animate-pulse delay-150' : 'h-1.5'}`} />
                </div>
              </div>

              {currentSong && (
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/80">
                  <span className="truncate max-w-[240px] font-bold text-white">{currentSong.title}</span>
                  <span className="text-[11px] text-white/60 font-mono font-bold">
                    {formatTime(currentTime)} / {formatTime(duration || currentSong.duration || 0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: AVAILABLE DEVICES */}
          <div>
            <span className="text-[11px] font-black text-white/60 uppercase tracking-wider block mb-2.5">
              AVAILABLE DEVICES
            </span>

            <div className="space-y-2.5">
              {/* Option to pull playback to this device if currently on remote */}
              {!isActiveDevice && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 flex items-center justify-between transition-all hover:bg-white/[0.06]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">This Phone</h4>
                      <p className="text-[11px] text-white/50">Ready to play</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setConfirmDevice({ id: deviceId, name: 'This Phone', platform: 'Phone' })}
                    disabled={transferringId === deviceId}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-[#fa233b] hover:bg-[#d91533] text-white flex items-center gap-1.5 shadow-md shadow-[#fa233b]/25 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {transferringId === deviceId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
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
                  <div key={dev.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 flex items-center justify-between transition-all hover:bg-white/[0.06]">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{dev.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Available</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setConfirmDevice({ id: dev.id, name: dev.name, platform: dev.platform || 'Device' })}
                      disabled={isTransferring}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isTransferring ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <span>Play Here</span>
                      )}
                    </button>
                  </div>
                );
              })}

              {availableDevices.length === 0 && isActiveDevice && (
                <div className="py-6 px-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-1">
                  <p className="text-xs font-bold text-white/70">No other devices detected</p>
                  <p className="text-[11px] text-white/40">
                    Open RaagaX on your laptop, desktop, or TV to seamlessly switch playback.
                  </p>
                </div>
              )}
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
