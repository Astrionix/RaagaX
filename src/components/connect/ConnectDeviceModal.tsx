'use client';

import React, { useState } from 'react';
import {
  X,
  MonitorSpeaker,
  Laptop,
  Smartphone,
  Tablet,
  Tv,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
  Wifi,
  Radio,
  Loader2,
  Power,
  Play,
  Gamepad2,
  Speaker,
} from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';
import { ConnectDevice, ConnectDeviceType } from '@/types/connect';

export function ConnectDeviceModal() {
  const {
    devices,
    activePlaybackDevice,
    remoteSession,
    isConnectModalOpen,
    isRemoteMode,
    isScanning,
    toggleConnectModal,
    scanDevices,
    transferPlayback,
    disconnectAndPlayLocally,
    sendVolume,
  } = useConnectStore();

  const [transferringId, setTransferringId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isConnectModalOpen) {
      scanDevices();
      const interval = setInterval(() => {
        scanDevices();
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isConnectModalOpen, scanDevices]);

  if (!isConnectModalOpen) return null;

  const currentLocalDevice = devices.find((d) => d.isCurrentDevice) || {
    deviceId: 'dev_local',
    deviceName: 'This device',
    deviceType: 'desktop' as ConnectDeviceType,
    isCurrentDevice: true,
    isOnline: true,
    state: 'PLAYING' as const,
    lastSeenAt: Date.now(),
    transport: 'LOCAL_LAN' as const,
  };

  const otherDevices = devices.filter((d) => !d.isCurrentDevice);

  const getDeviceIcon = (type: ConnectDeviceType, className = 'w-5 h-5') => {
    switch (type) {
      case 'mobile':
        return <Smartphone className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      case 'desktop':
        return <Laptop className={className} />;
      case 'tv':
        return <Tv className={className} />;
      default:
        return <MonitorSpeaker className={className} />;
    }
  };

  const handleSelectDevice = async (device: ConnectDevice) => {
    if (device.isCurrentDevice) {
      if (isRemoteMode) {
        setTransferringId(device.deviceId);
        await disconnectAndPlayLocally();
        setTransferringId(null);
      }
      return;
    }

    if (activePlaybackDevice?.deviceId === device.deviceId) {
      setTransferringId(device.deviceId);
      await disconnectAndPlayLocally();
      setTransferringId(null);
      return;
    }

    setTransferringId(device.deviceId);
    await transferPlayback(device);
    setTransferringId(null);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={() => toggleConnectModal(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md bg-[#0A0B10]/95 border border-white/15 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.9)] overflow-hidden text-white p-6 flex flex-col animate-in zoom-in-95 duration-200 max-h-[85vh]">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
              <Speaker className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                <span>RaagaX Connect</span>
              </h2>
              <p className="text-xs text-zinc-400">Play music on 1 Speaker & control from other devices</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={scanDevices}
              className={`p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ${
                isScanning ? 'animate-spin text-emerald-400' : ''
              }`}
              title="Refresh Devices"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleConnectModal(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="my-4 space-y-4 overflow-y-auto pr-1 flex-1">
          {/* ROLE STATUS CARD */}
          {isRemoteMode && activePlaybackDevice ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/40 shadow-[0_0_25px_rgba(52,211,153,0.15)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                  <Gamepad2 className="w-3 h-3" />
                  <span>This Device = Remote Controller</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-bold">
                    <Speaker className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400 font-medium">Sound is physically playing on:</div>
                    <div className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>{activePlaybackDevice.deviceName}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">SPEAKER</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => disconnectAndPlayLocally()}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                  title="Disconnect and bring playback back to this device"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-bold">
                <Speaker className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>This Device is the Active Speaker</span>
                </div>
                <div className="text-xs text-zinc-400">Audio is outputting from this machine.</div>
              </div>
            </div>
          )}

          {/* 1. THIS DEVICE */}
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
              THIS DEVICE
            </div>

            <button
              onClick={() => handleSelectDevice(currentLocalDevice)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                !isRemoteMode
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    !isRemoteMode
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {getDeviceIcon(currentLocalDevice.deviceType, 'w-4 h-4')}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <span>{currentLocalDevice.deviceName}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">(This Device)</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                    {!isRemoteMode ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        🔊 Active Speaker (Sound playing here)
                      </span>
                    ) : (
                      <span className="text-zinc-400 hover:text-white">Tap to make this device the Speaker</span>
                    )}
                  </div>
                </div>
              </div>

              {!isRemoteMode ? (
                <div className="p-1 rounded-full bg-emerald-500 text-black">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  Play on this Device
                </span>
              )}
            </button>
          </div>

          {/* 2. AVAILABLE ON WI-FI */}
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>AVAILABLE DEVICES ON WI-FI</span>
              <span className="flex items-center gap-1 text-emerald-400 lowercase font-normal text-[10px]">
                <Wifi className="w-3 h-3" />
                <span>LAN</span>
              </span>
            </div>

            {otherDevices.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-1.5">
                <p className="text-xs text-zinc-400">No other RaagaX devices found on this Wi-Fi.</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Open RaagaX on your laptop or phone on the same Wi-Fi network to control or play audio.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {otherDevices.map((device) => {
                  const isConnected = activePlaybackDevice?.deviceId === device.deviceId;
                  const isTransferring = transferringId === device.deviceId;

                  return (
                    <div
                      key={device.deviceId}
                      onClick={() => handleSelectDevice(device)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isConnected
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                          : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isConnected
                              ? 'bg-emerald-500 text-black'
                              : 'bg-white/10 text-zinc-400'
                          }`}
                        >
                          {getDeviceIcon(device.deviceType, 'w-4 h-4')}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-sm font-bold truncate flex items-center gap-1.5">
                            <span>{device.deviceName}</span>
                            {isConnected && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                SPEAKER
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                            {isConnected ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                🔊 Audio is playing from this speaker
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                                {device.isSameAccount ? (
                                  <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                    Same Account
                                  </span>
                                ) : device.transport === 'CLOUD_RELAY' ? (
                                  <span className="text-[9px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded">
                                    Cloud • 5G
                                  </span>
                                ) : device.authStatus === 'REQUIRES_PAIRING' ? (
                                  <span className="text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                    Guest Wi-Fi • Pair
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                    Local Wi-Fi
                                  </span>
                                )}
                                <span>• Tap to Play</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isTransferring ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : isConnected ? (
                          <div className="p-1 rounded-full bg-emerald-500 text-black">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : device.authStatus === 'REQUIRES_PAIRING' ? (
                          <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                            Pair & Connect
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                            Play Here
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. REMOTE SPEAKER VOLUME */}
          {isRemoteMode && activePlaybackDevice && (
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{activePlaybackDevice.deviceName} Speaker Volume</span>
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {Math.round(((remoteSession?.volume ?? 0.8) * 100))}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-zinc-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={remoteSession?.volume ?? 0.8}
                  onChange={(e) => sendVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500 relative z-10 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>RaagaX Connect (1 Speaker + Remote Controllers)</span>
          </div>
          <button
            onClick={() => {
              toggleConnectModal(false);
              import('@/context/useJamStore').then((m) => m.useJamStore.getState().toggleJamModal(true));
            }}
            className="text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Multi-Speaker Jam
          </button>
        </div>
      </div>
    </div>
  );
}
