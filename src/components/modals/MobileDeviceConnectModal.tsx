'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Smartphone, Monitor, Check, Laptop, Tv, 
  Radio, Loader2, AlertCircle, RefreshCw, Volume2,
  Speaker, Headphones, ArrowLeft, Wifi, Sparkles, ShieldCheck,
  Music, Sliders, Play, Pause, SkipForward, SkipBack, Zap,
  Search, CheckCircle2, CircleDashed
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceDiscoveryEngine } from '@/lib/connect/discovery/DeviceDiscoveryEngine';
import { VerifiedDevice } from '@/lib/connect/discovery/types';

export function MobileDeviceConnectModal() {
  const { 
    isDeviceModalOpen, 
    toggleDeviceModal, 
    deviceId, 
    activeDeviceId, 
    connectedDeviceId,
    transferPlayback,
    isActiveDevice,
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

  const [devices, setDevices] = useState<VerifiedDevice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [selectedDetailDevice, setSelectedDetailDevice] = useState<VerifiedDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isDeviceModalOpen) return;
    const engine = DeviceDiscoveryEngine.getInstance();
    engine.startDiscovery();
    const unsubscribe = engine.subscribe((list) => {
      setDevices(list);
    });

    return () => {
      unsubscribe();
      engine.stopDiscovery();
    };
  }, [isDeviceModalOpen]);

  if (!isDeviceModalOpen) return null;

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter(d => 
      d.name.toLowerCase().includes(q) || 
      d.platform.toLowerCase().includes(q) || 
      d.type.toLowerCase().includes(q)
    );
  }, [devices, searchQuery]);

  const currentlyPlayingDevice = filteredDevices.find(d => d.reachabilityState === 'CURRENTLY_PLAYING') || filteredDevices.find(d => d.deviceId === (activeDeviceId || deviceId));
  const nearbyDevices = filteredDevices.filter(d => d.deviceId !== currentlyPlayingDevice?.deviceId && d.isNearby && !d.isAudioOutput && d.reachabilityState !== 'OFFLINE');
  const audioOutputs = filteredDevices.filter(d => d.isAudioOutput);
  const otherDevices = filteredDevices.filter(d => d.deviceId !== currentlyPlayingDevice?.deviceId && !d.isNearby && !d.isAudioOutput && d.reachabilityState !== 'OFFLINE');
  const offlineDevices = filteredDevices.filter(d => d.reachabilityState === 'OFFLINE' || d.reachabilityState === 'STALE');

  const handleScan = () => {
    setIsScanning(true);
    DeviceDiscoveryEngine.getInstance().refreshDiscovery();
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

  const getDeviceIcon = (platform?: string, isAudioOutput?: boolean) => {
    if (isAudioOutput) return Headphones;
    const p = (platform || '').toLowerCase();
    if (p.includes('tv') || p.includes('cast')) return Tv;
    if (p.includes('speaker')) return Speaker;
    if (p.includes('headphone') || p.includes('bluetooth') || p.includes('buds')) return Headphones;
    if (p.includes('phone') || p.includes('android') || p.includes('ios')) return Smartphone;
    return Laptop;
  };

  const CurrentIcon = getDeviceIcon(currentlyPlayingDevice?.platform, currentlyPlayingDevice?.isAudioOutput);

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

        {/* Search Bar */}
        <div className="px-6 pt-3 pb-1">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 pointer-events-none" />
            <input 
              type="text"
              placeholder="Search devices by name or platform..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#EF233C]/50 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-white/40 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-xs text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* SCROLLABLE DEVICE LIST */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* SECTION 1: NOW PLAYING */}
          {currentlyPlayingDevice && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-[#E50914] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
                  CURRENT PLAYBACK
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentlyPlayingDevice.deviceId === deviceId ? 'Authoritative Renderer' : 'Remote Controlled'}
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
                          {currentlyPlayingDevice.name}
                        </h4>
                        <Check className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-0.5 truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
                        <span>{isPlaying ? 'Playing Lossless Stream' : 'Ready'}</span>
                      </p>
                    </div>
                  </div>
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
          )}

          {/* SECTION 2: NEARBY RAAGAX DEVICES (SAME WI-FI) */}
          {nearbyDevices.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-[#E50914]" />
                  NEARBY ON SAME WI-FI
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Fast LAN Direct</span>
              </div>

              <div className="space-y-2">
                {nearbyDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.platform, device.isAudioOutput);
                  const isBusy = transferringId === device.deviceId;

                  return (
                    <div 
                      key={device.deviceId}
                      onClick={() => !isBusy && handleTransfer(device.deviceId, device.name)}
                      className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 group-hover:text-white group-hover:bg-[#E50914]/20 group-hover:text-[#E50914] transition-all flex-shrink-0">
                          <DeviceIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">
                              {device.name}
                            </h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                              Verified
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Same Wi-Fi · Lossless Ready</span>
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E50914] hover:bg-[#FF1E27] text-white shadow-md transition-all group-hover:scale-105 active:scale-95 flex-shrink-0"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Play Here'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: OTHER ONLINE RAAGAX DEVICES (CLOUD) */}
          {otherDevices.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  YOUR RAAGAX DEVICES
                </span>
                <span className="text-[10px] font-mono text-blue-400">Cloud Relay</span>
              </div>

              <div className="space-y-2">
                {otherDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.platform, device.isAudioOutput);
                  const isBusy = transferringId === device.deviceId;

                  return (
                    <div 
                      key={device.deviceId}
                      onClick={() => !isBusy && handleTransfer(device.deviceId, device.name)}
                      className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 group-hover:text-white group-hover:bg-[#E50914]/20 group-hover:text-[#E50914] transition-all flex-shrink-0">
                          <DeviceIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">
                            {device.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>Online · Ready</span>
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-[#E50914] text-white transition-all group-hover:scale-105 active:scale-95 flex-shrink-0"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Play Here'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: CONNECTED AUDIO OUTPUTS */}
          {audioOutputs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-purple-400" />
                  AUDIO OUTPUTS
                </span>
                <span className="text-[10px] font-mono text-purple-400">Bluetooth / System</span>
              </div>

              <div className="space-y-2">
                {audioOutputs.map((device) => {
                  return (
                    <div 
                      key={device.deviceId}
                      className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-300 flex items-center justify-center flex-shrink-0">
                          <Headphones className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">
                            {device.name}
                          </h4>
                          <p className="text-[10px] text-purple-300 font-medium mt-0.5">
                            Audio Output Device
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 5: OFFLINE DEVICES */}
          {offlineDevices.length > 0 && (
            <div className="opacity-60">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  OFFLINE DEVICES
                </span>
              </div>

              <div className="space-y-2">
                {offlineDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.platform, device.isAudioOutput);

                  return (
                    <div 
                      key={device.deviceId}
                      className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 flex-shrink-0">
                          <DeviceIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-medium text-white/60 truncate">
                            {device.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Offline · Last seen recently
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

