'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Smartphone, Monitor, Check, Laptop, Tv, 
  Loader2, AlertCircle, RefreshCw, Volume2,
  Speaker, Headphones, ArrowLeft, Wifi, ShieldCheck,
  Play, Pause, SkipForward, SkipBack, Search, CheckCircle2
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
  const [handoverTarget, setHandoverTarget] = useState<string | null>(null);
  const [handoverStep, setHandoverStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isDeviceModalOpen) return;
    try {
      const engine = DeviceDiscoveryEngine.getInstance();
      engine.startDiscovery();
      const unsubscribe = engine.subscribe((list) => {
        setDevices(Array.isArray(list) ? list : []);
      });

      return () => {
        try {
          unsubscribe();
          engine.stopDiscovery();
        } catch {}
      };
    } catch (err) {
      console.warn('[MobileDeviceConnectModal] Discovery engine error:', err);
    }
  }, [isDeviceModalOpen]);

  const filteredDevices = useMemo(() => {
    if (!Array.isArray(devices)) return [];
    if (!searchQuery.trim()) return devices.filter(Boolean);
    const q = searchQuery.toLowerCase();
    return devices.filter(d => 
      d && (
        (d.name || '').toLowerCase().includes(q) || 
        (d.platform || '').toLowerCase().includes(q) || 
        (d.type || '').toLowerCase().includes(q)
      )
    );
  }, [devices, searchQuery]);

  if (!isDeviceModalOpen) return null;

  const isRemotePlaying = Boolean(activeDeviceId && activeDeviceId !== deviceId);
  const currentlyPlayingDevice = filteredDevices.find(d => d?.reachabilityState === 'CURRENTLY_PLAYING') || filteredDevices.find(d => d?.deviceId === (activeDeviceId || deviceId)) || filteredDevices[0] || null;
  const nearbyDevices = filteredDevices.filter(d => d && d.deviceId !== currentlyPlayingDevice?.deviceId && d.isNearby && !d.isAudioOutput && d.reachabilityState !== 'OFFLINE');
  const audioOutputs = filteredDevices.filter(d => d && d.isAudioOutput);
  const otherDevices = filteredDevices.filter(d => d && d.deviceId !== currentlyPlayingDevice?.deviceId && !d.isNearby && !d.isAudioOutput && d.reachabilityState !== 'OFFLINE');
  const offlineDevices = filteredDevices.filter(d => d && (d.reachabilityState === 'OFFLINE' || d.reachabilityState === 'STALE'));

  const handleScan = () => {
    setIsScanning(true);
    try {
      DeviceDiscoveryEngine.getInstance().refreshDiscovery();
    } catch {}
    setTimeout(() => setIsScanning(false), 800);
  };

  const handleTransfer = async (targetId: string, targetName: string) => {
    if (!targetId || targetId === activeDeviceId) return;
    setErrorMessage(null);
    setTransferringId(targetId);
    setHandoverTarget(targetName);
    setHandoverStep(1);

    try {
      import('@/lib/haptics/HapticEngine').then(m => m.haptics.mediumImpact()).catch(() => {});

      const { TransferManager } = await import('@/lib/connect/TransferManager');
      setHandoverStep(3);
      await TransferManager.getInstance().initiateTransfer(targetId);
      setHandoverStep(5);

      setTimeout(() => {
        setTransferringId(null);
        setHandoverTarget(null);
        setHandoverStep(0);
        toggleDeviceModal();
      }, 500);
    } catch (err: any) {
      setTransferringId(null);
      setHandoverTarget(null);
      setHandoverStep(0);
      setErrorMessage(`Couldn't switch to ${targetName || 'device'}. Current playback continued.`);
    }
  };

  const handleDisconnect = async () => {
    setErrorMessage(null);
    try {
      if (deviceId) {
        const { TransferManager } = await import('@/lib/connect/TransferManager');
        await TransferManager.getInstance().initiateTransfer(deviceId);
      }
      toggleDeviceModal();
    } catch {
      setErrorMessage('Could not disconnect from remote device.');
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
  const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : (currentSong?.duration || 180);
  const progressPercent = Math.min(100, Math.max(0, (safeCurrentTime / safeDuration) * 100));
  const safeVolume = Number.isFinite(volume) ? volume : 1;

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-xl transition-opacity"
        onClick={toggleDeviceModal}
      />

      <div className="relative w-full max-w-lg lens-crystal border-t sm:border border-white/15 rounded-t-[32px] sm:rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col max-h-[90dvh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-8 duration-200">
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
              <h3 className="text-base font-black text-white tracking-tight">Connect to Device</h3>
              <p className="text-xs text-slate-400 font-medium">Choose where you want to listen</p>
            </div>
          </div>
          
          <button 
            onClick={handleScan}
            className={`p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all ${isScanning ? 'animate-spin text-[#FA233B]' : ''}`}
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
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FA233B]/50 transition-colors"
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

        {/* Handover Real-Time Progress Card */}
        {handoverTarget && (
          <div className="mx-6 mt-3 p-4 rounded-3xl bg-gradient-to-br from-[#FA233B]/20 via-purple-600/20 to-slate-900 border border-[#FA233B]/40 shadow-2xl space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FA233B]" />
                Connecting to {handoverTarget}...
              </span>
              <span className="text-[10px] font-mono font-bold text-[#FA233B] uppercase">
                {handoverStep === 5 ? 'Ready' : 'Handing Over'}
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                Preparing playback
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`flex items-center gap-1.5 font-bold ${handoverStep >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Song</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold ${handoverStep >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Position</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold ${handoverStep >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Queue</span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold ${handoverStep >= 4 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Playback state</span>
                </div>
              </div>
            </div>

            {handoverStep === 5 && (
              <div className="pt-1 text-center text-xs font-black text-emerald-400 flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </div>
            )}
          </div>
        )}

        {/* DEVICE LIST */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. CURRENT PLAYBACK */}
          {currentlyPlayingDevice && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-[#FA233B] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FA233B] animate-pulse" />
                  {isRemotePlaying ? 'REMOTE PLAYBACK' : 'THIS DEVICE'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentlyPlayingDevice.deviceId === deviceId ? 'Authoritative Renderer' : 'Remote Controlled'}
                </span>
              </div>

              <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/15 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FA233B] to-purple-800 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                      <CurrentIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-white leading-tight truncate">
                          {currentlyPlayingDevice?.name || 'This Device'}
                        </h4>
                        <Check className="w-4 h-4 text-[#FA233B] flex-shrink-0" />
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-0.5 truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Connected to Wi-Fi</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Track Details & Controls */}
                {currentSong && (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[240px] font-bold text-white flex items-center gap-1.5">
                        <span className="text-[#FA233B]">♪</span> {currentSong.title} · {currentSong.artist}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono font-bold">
                        {formatTime(safeCurrentTime)} / {formatTime(safeDuration)}
                      </span>
                    </div>

                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#FA233B] rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => playPrev()}
                          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => togglePlayPause()}
                          className="w-8 h-8 rounded-full bg-[#FA233B] hover:bg-[#d91e32] text-white flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                        </button>
                        <button 
                          onClick={() => playNext()}
                          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 max-w-[140px] flex-1 justify-end">
                        <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                        <input 
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={safeVolume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FA233B]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. AVAILABLE NEARBY DEVICES */}
          {nearbyDevices.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-[#FA233B]" />
                  AVAILABLE DEVICES
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Same Wi-Fi</span>
              </div>

              <div className="space-y-2">
                {nearbyDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.platform, device.isAudioOutput);
                  const isBusy = transferringId === device.deviceId;

                  return (
                    <div 
                      key={device.deviceId}
                      onClick={() => !isBusy && handleTransfer(device.deviceId, device.name || 'Nearby Device')}
                      className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 flex items-center justify-between transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 group-hover:text-white group-hover:bg-[#FA233B]/20 group-hover:text-[#FA233B] transition-all flex-shrink-0">
                          <DeviceIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                            {device.name || 'Nearby Device'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Connected to Wi-Fi</span>
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FA233B] hover:bg-[#d91e32] text-white shadow-md transition-all group-hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. OTHER ONLINE RAAGAX DEVICES */}
          {otherDevices.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  OTHER RAAGAX DEVICES
                </span>
                <span className="text-[10px] font-mono text-blue-400">Account Linked</span>
              </div>

              <div className="space-y-2">
                {otherDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.platform, device.isAudioOutput);
                  const isBusy = transferringId === device.deviceId;

                  return (
                    <div 
                      key={device.deviceId}
                      onClick={() => !isBusy && handleTransfer(device.deviceId, device.name || 'RaagaX Device')}
                      className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 flex items-center justify-between transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 group-hover:text-white group-hover:bg-[#FA233B]/20 group-hover:text-[#FA233B] transition-all flex-shrink-0">
                          <DeviceIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">
                            {device.name || 'RaagaX Device'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>Online</span>
                          </p>
                        </div>
                      </div>

                      <button
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-[#FA233B] text-white transition-all group-hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. AUDIO OUTPUTS */}
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
                {audioOutputs.map((device) => (
                  <div 
                    key={device.deviceId}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-300 flex items-center justify-center flex-shrink-0">
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {device.name || 'Audio Output'}
                        </h4>
                        <p className="text-[10px] text-purple-300 font-medium mt-0.5">
                          Audio Output Device
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. OFFLINE DEVICES */}
          {offlineDevices.length > 0 && (
            <div className="opacity-50">
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
                            {device.name || 'Offline Device'}
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
            </div>
          )}

          {/* Empty / Searching State if no external devices found */}
          {nearbyDevices.length === 0 && otherDevices.length === 0 && (
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
                <Wifi className="w-6 h-6 animate-pulse text-[#FA233B]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Looking for nearby RaagaX devices...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  To connect your Desktop or other devices:
                </p>
                <div className="mt-3 text-[11px] text-slate-400 space-y-1 text-left max-w-xs mx-auto bg-black/30 p-3 rounded-xl border border-white/5">
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Open RaagaX on your computer</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Ensure both are on the same Wi-Fi network</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleScan}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#FA233B]' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Scan Again'}</span>
              </button>
            </div>
          )}
        </div>

        {/* DISCONNECT ACTION */}
        {isRemotePlaying && (
          <div className="px-6 py-3 bg-black/40 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-300">Playing on remote device</span>
            <button
              onClick={handleDisconnect}
              className="px-4 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* FOOTER */}
        <div className="p-3.5 border-t border-white/10 text-[11px] text-slate-400 text-center bg-black/40 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FA233B]" />
          <span>Synchronized: Song, Position, Queue & Playback State</span>
        </div>
      </div>
    </div>
  );
}
