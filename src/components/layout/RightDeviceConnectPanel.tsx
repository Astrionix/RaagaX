'use client';

import React from 'react';
import { X, Monitor, Smartphone, Tv, Laptop, Check, Radio, Headphones, Loader2, Volume2, Sparkles } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

export function RightDeviceConnectPanel() {
  const { 
    deviceId, 
    activeDeviceId, 
    connectedDeviceId,
    onlineDevices, 
    transferPlayback, 
    disconnectDevice,
    setRightPanelMode, 
    isTransferring, 
    transferringDeviceId,
    isActiveDevice,
    remoteDeviceName,
    currentSong,
    isPlaying,
    currentTime,
    duration
  } = usePlayerStore();

  const isRemoteConnected = !isActiveDevice && !!connectedDeviceId;
  const activeDeviceObj = onlineDevices.find(d => d.id === activeDeviceId || d.id === connectedDeviceId);
  const localDeviceObj = onlineDevices.find(d => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Computer';
  const activeDisplayName = isRemoteConnected 
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') 
    : localDeviceName;

  const handleDeviceClick = (targetId: string) => {
    if (isTransferring) return;
    if (targetId === activeDeviceId && isActiveDevice) return;
    transferPlayback(targetId);
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

  const otherDevices = onlineDevices.filter(d => d.id !== (isRemoteConnected ? (connectedDeviceId || activeDeviceId) : deviceId));

  return (
    <aside className="flex-1 flex flex-col text-white text-xs select-none p-4 h-full bg-[#090a10] border-l border-white/5 overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="font-extrabold text-sm text-white tracking-tight">Connect</h3>
        </div>
        <button 
          onClick={() => setRightPanelMode('queue')}
          className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 flex-1">
        {/* SECTION 1: NOW PLAYING HERO CARD */}
        <div>
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block mb-2 px-1">
            Playing now
          </span>

          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#181924] via-[#11121a] to-[#0c0d12] border border-emerald-500/30 space-y-3 shadow-lg shadow-emerald-500/5">
            <div className="flex items-center gap-3">
              {currentSong?.coverUrl ? (
                <img 
                  src={currentSong.coverUrl.replace('http://', 'https://')} 
                  alt={currentSong.title}
                  className="w-11 h-11 rounded-xl object-cover shadow-md flex-shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white flex-shrink-0">
                  {renderDeviceIcon(activeDeviceObj?.platform, activeDisplayName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">{currentSong?.title || 'No active track'}</h4>
                <p className="text-[11px] text-slate-400 truncate">{currentSong?.artist || 'RaagaX Music'}</p>
              </div>

              <div className="flex items-end gap-0.5 h-4 px-2 py-0.5 bg-white/10 rounded-full flex-shrink-0">
                <span className={`w-0.5 bg-emerald-400 rounded-full transition-all ${isPlaying ? 'h-4 animate-pulse' : 'h-1'}`} />
                <span className={`w-0.5 bg-emerald-400 rounded-full transition-all ${isPlaying ? 'h-2.5 animate-pulse delay-75' : 'h-1'}`} />
                <span className={`w-0.5 bg-emerald-400 rounded-full transition-all ${isPlaying ? 'h-3.5 animate-pulse delay-150' : 'h-1'}`} />
              </div>
            </div>

            {/* Position + Playing on Badge */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Playing on {activeDisplayName}</span>
              </span>
              <span className="text-slate-400 font-mono text-[10px]">
                {formatTime(currentTime)} / {formatTime(duration || currentSong?.duration || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: YOUR DEVICES */}
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 px-1">
            YOUR DEVICES
          </span>

          <div className="space-y-1.5">
            {/* This Computer (if remote is playing) */}
            {isRemoteConnected && (
              <button
                onClick={() => handleDeviceClick(deviceId)}
                disabled={isTransferring}
                className="w-full p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/30 flex items-center justify-between transition-all group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white/5 text-slate-300 group-hover:text-emerald-400">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate group-hover:text-emerald-300">{localDeviceName}</h5>
                    <span className="text-[10px] text-emerald-400 font-medium">Available</span>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-slate-300 px-2 py-1 bg-white/5 rounded-lg border border-white/10 group-hover:border-emerald-500/30">
                  Play here
                </span>
              </button>
            )}

            {/* Other Discovered Online Devices */}
            {otherDevices.map((device) => {
              const isTargetTransfer = isTransferring && transferringDeviceId === device.id;

              return (
                <button
                  key={device.id}
                  disabled={isTransferring}
                  onClick={() => handleDeviceClick(device.id)}
                  className="w-full p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/30 flex items-center justify-between transition-all group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-white/5 text-slate-300 group-hover:text-emerald-400">
                      {renderDeviceIcon(device.platform, device.name)}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-white truncate group-hover:text-emerald-300">{device.name}</h5>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        {isTargetTransfer ? 'Switching…' : 'Available'}
                      </span>
                    </div>
                  </div>

                  {isTargetTransfer ? (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Switching…</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-300 px-2 py-1 bg-white/5 rounded-lg border border-white/10 group-hover:border-emerald-500/30">
                      Transfer
                    </span>
                  )}
                </button>
              );
            })}

            {otherDevices.length === 0 && !isRemoteConnected && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs">
                No other devices found on your account.
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: AUDIO OUTPUTS */}
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 px-1">
            AUDIO OUTPUTS
          </span>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Headphones className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">Bluetooth / Audio Route</span>
                <span className="text-[10px] text-slate-400">Connected</span>
              </div>
            </div>
            <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Audio Output
            </span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400 space-y-1.5">
        <p className="font-semibold text-slate-300 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          RaagaX Cross-Device Network
        </p>
        <p className="text-[10px] text-slate-500">
          Seamlessly switch playback or control any device logged into your account.
        </p>
      </div>
    </aside>
  );
}
