'use client';

import React, { useState } from 'react';
import { 
  X, Monitor, Smartphone, Tv, Laptop, Check, Radio, Headphones, 
  Loader2, Volume2, Sparkles, Wifi, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function RightDeviceConnectPanel() {
  const { 
    deviceId, 
    activeDeviceId, 
    connectedDeviceId,
    onlineDevices, 
    setRightPanelMode, 
    isActiveDevice,
    remoteDeviceName,
    currentSong,
    isPlaying,
    currentTime,
    duration
  } = usePlayerStore();

  const [handoverTarget, setHandoverTarget] = useState<string | null>(null);
  const [handoverStep, setHandoverStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRemoteConnected = !isActiveDevice && Boolean(connectedDeviceId && connectedDeviceId !== deviceId);
  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId || d.id === connectedDeviceId);
  const localDeviceObj = onlineDevices.find(d => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Device';
  const activeDisplayName = isRemoteConnected 
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') 
    : localDeviceName;

  const handleDeviceClick = async (targetId: string, targetName: string) => {
    if (targetId === activeDeviceId && isActiveDevice) return;
    setErrorMessage(null);
    setHandoverTarget(targetName);
    setHandoverStep(1); // 1: Song

    try {
      await new Promise(r => setTimeout(r, 150));
      setHandoverStep(2); // 2: Position

      await new Promise(r => setTimeout(r, 150));
      setHandoverStep(3); // 3: Queue

      await new Promise(r => setTimeout(r, 150));
      setHandoverStep(4); // 4: Playback state

      const { TransferManager } = await import('@/lib/connect/TransferManager');
      await TransferManager.getInstance().initiateTransfer(targetId);

      setHandoverStep(5); // 5: Connected
      setTimeout(() => {
        setHandoverTarget(null);
        setHandoverStep(0);
      }, 700);
    } catch (err: any) {
      setHandoverTarget(null);
      setHandoverStep(0);
      setErrorMessage(`Could not switch to ${targetName}. Current playback continued.`);
    }
  };

  const handleDisconnect = async () => {
    setErrorMessage(null);
    try {
      if (deviceId) {
        const { TransferManager } = await import('@/lib/connect/TransferManager');
        await TransferManager.getInstance().initiateTransfer(deviceId);
      }
    } catch (err) {
      setErrorMessage('Could not disconnect from remote device.');
    }
  };

  const renderDeviceIcon = (platform?: string, name?: string) => {
    const combined = `${platform || ''} ${name || ''}`.toLowerCase();
    if (combined.includes('tv') || combined.includes('smarttv')) return <Tv className="w-5 h-5" />;
    if (combined.includes('phone') || combined.includes('android') || combined.includes('ios')) return <Smartphone className="w-5 h-5" />;
    if (combined.includes('mac') || combined.includes('windows') || combined.includes('pc') || combined.includes('laptop')) return <Laptop className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  const formatTime = (secs: number): string => {
    if (!Number.isFinite(secs) || secs < 0) return '--:--';
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
  };

  const availableDevices = onlineDevices.filter(d => d.id !== (isRemoteConnected ? (connectedDeviceId || activeDeviceId) : deviceId));

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full bg-[#090a10] border-l border-white/5 overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FA233B] animate-pulse" />
          <h3 className="font-extrabold text-sm text-white tracking-tight">Connect to Device</h3>
        </div>
        <button 
          onClick={() => setRightPanelMode('queue')}
          className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Handover Real-Time Progress Card */}
      {handoverTarget && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#FA233B]/20 via-purple-600/20 to-slate-900 border border-[#FA233B]/40 shadow-xl space-y-2.5 animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-1.5 truncate">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FA233B]" />
              Connecting to {handoverTarget}...
            </span>
            <span className="text-[10px] font-mono font-bold text-[#FA233B] uppercase">
              {handoverStep === 5 ? 'Ready' : 'Transferring'}
            </span>
          </div>

          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
              Preparing playback
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={`flex items-center gap-1 font-bold ${handoverStep >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className="w-3 h-3" />
                <span>Song</span>
              </div>
              <div className={`flex items-center gap-1 font-bold ${handoverStep >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className="w-3 h-3" />
                <span>Position</span>
              </div>
              <div className={`flex items-center gap-1 font-bold ${handoverStep >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className="w-3 h-3" />
                <span>Queue</span>
              </div>
              <div className={`flex items-center gap-1 font-bold ${handoverStep >= 4 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className="w-3 h-3" />
                <span>Playback state</span>
              </div>
            </div>
          </div>

          {handoverStep === 5 && (
            <div className="pt-1 text-center text-xs font-black text-emerald-400 flex items-center justify-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4 flex-1">
        {/* SECTION 1: THIS DEVICE / ACTIVE PLAYBACK */}
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 px-1">
            {isRemoteConnected ? 'Remote Playback' : 'This Device'}
          </span>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FA233B] to-purple-700 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                {renderDeviceIcon(activeDeviceObj?.platform, activeDisplayName)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white truncate">{activeDisplayName}</h4>
                  <Check className="w-3.5 h-3.5 text-[#FA233B] flex-shrink-0" />
                </div>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>Connected to Wi-Fi</span>
                </p>
              </div>
            </div>

            {currentSong && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="truncate max-w-[170px] text-white font-bold">
                  {currentSong.title}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {formatTime(currentTime)} / {formatTime(duration || currentSong.duration || 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: AVAILABLE DEVICES ON SAME WI-FI / ACCOUNT */}
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 px-1">
            Available Devices
          </span>

          <div className="space-y-2">
            {/* If remote is playing, offer This Device as target */}
            {isRemoteConnected && (
              <button
                onClick={() => handleDeviceClick(deviceId, localDeviceName)}
                className="w-full p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-[#FA233B]/40 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 group-hover:text-white group-hover:bg-[#FA233B]/20">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">{localDeviceName}</h5>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>Connected to Wi-Fi</span>
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-white px-2.5 py-1 bg-[#FA233B] rounded-xl shadow-md">
                  Play here
                </span>
              </button>
            )}

            {/* Other Online Devices */}
            {availableDevices.map((device) => (
              <button
                key={device.id}
                onClick={() => handleDeviceClick(device.id, device.name)}
                className="w-full p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-[#FA233B]/40 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 group-hover:text-white group-hover:bg-[#FA233B]/20">
                    {renderDeviceIcon(device.platform, device.name)}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate group-hover:text-[#FA233B] transition-colors">{device.name}</h5>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>Connected to Wi-Fi</span>
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-slate-300 px-2.5 py-1 bg-white/5 rounded-xl border border-white/10 group-hover:border-[#FA233B]/40">
                  Connect
                </span>
              </button>
            ))}

            {availableDevices.length === 0 && !isRemoteConnected && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs">
                Searching for other RaagaX devices on this Wi-Fi...
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: DISCONNECT ACTION */}
        {isRemoteConnected && (
          <div className="pt-2">
            <button
              onClick={handleDisconnect}
              className="w-full py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FA233B]" />
          Direct Cross-Device Playback
        </p>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Local lossless playback is prioritized if the track is downloaded on the receiving device.
        </p>
      </div>
    </aside>
  );
}
