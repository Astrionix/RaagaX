'use client';

import React, { useState } from 'react';
import {
  X,
  Laptop,
  Smartphone,
  Tablet,
  Tv,
  Check,
  RefreshCw,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  Loader2,
  Speaker,
  Radio,
  WifiOff,
  Disc3,
  Sliders,
} from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectDevice, ConnectDeviceType } from '@/types/connect';

/* ─── Styles for volume slider & equalizer animation ─── */
const MODAL_STYLE = `
  .rx-vol-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    width: 100%;
    height: 4px;
    outline: none;
  }
  .rx-vol-slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 99px;
    background: rgba(255,255,255,0.12);
  }
  .rx-vol-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    margin-top: -5px;
    transition: transform 0.12s, background 0.12s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  .rx-vol-slider:hover::-webkit-slider-thumb {
    transform: scale(1.2);
    background: #1db954;
  }
  .rx-vol-slider::-moz-range-track {
    height: 4px;
    border-radius: 99px;
    background: rgba(255,255,255,0.12);
  }
  .rx-vol-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  @keyframes rxModalEnter {
    from { opacity: 0; transform: translateY(12px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes rxEqBar1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
  @keyframes rxEqBar2 { 0%, 100% { height: 12px; } 50% { height: 5px; } }
  @keyframes rxEqBar3 { 0%, 100% { height: 7px; } 50% { height: 15px; } }
`;

function StyleOnce() {
  return <style>{MODAL_STYLE}</style>;
}

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
    disconnect,
    disconnectAndPlayLocally,
    sendVolume,
  } = useConnectStore();

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [hoveringId, setHoveringId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isConnectModalOpen) {
      scanDevices();
      const interval = setInterval(() => scanDevices(), 1500);
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

  const getDeviceIcon = (type: ConnectDeviceType, className = 'w-4 h-4') => {
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
        return <Speaker className={className} />;
    }
  };

  /**
   * One-Click Toggle Logic:
   * • Inactive device -> transferPlayback (connect)
   * • Active speaker -> disconnect (detach controller)
   * • "This device" -> disconnectAndPlayLocally
   */
  const handleSelectDevice = async (device: ConnectDevice) => {
    if (device.isCurrentDevice || device.deviceId === 'dev_local') {
      if (isRemoteMode) {
        setTransferringId(device.deviceId);
        await disconnectAndPlayLocally();
        setTransferringId(null);
      }
      return;
    }

    const isAlreadyActive = activePlaybackDevice?.deviceId === device.deviceId;

    if (isAlreadyActive) {
      setTransferringId(device.deviceId);
      await disconnect();
      setTransferringId(null);
      return;
    }

    setTransferringId(device.deviceId);
    await transferPlayback(device);
    setTransferringId(null);
  };

  const rawVol = remoteSession?.volume ?? 0.8;
  const volPct = Math.round(rawVol * 100);

  const VolumeIcon =
    rawVol === 0 ? VolumeX : rawVol < 0.5 ? Volume1 : Volume2;

  /* ── Device Row ── */
  const DeviceRow = ({
    device,
    isActive,
    isTransferring,
  }: {
    device: ConnectDevice;
    isActive: boolean;
    isTransferring: boolean;
  }) => {
    const isLocalRow = device.isCurrentDevice || device.deviceId === 'dev_local';
    const isHovering = hoveringId === device.deviceId;
    const showDisconnectHint = isActive && !isLocalRow && isHovering && !isTransferring;

    return (
      <button
        key={device.deviceId}
        onClick={() => handleSelectDevice(device)}
        onMouseEnter={() => setHoveringId(device.deviceId)}
        onMouseLeave={() => setHoveringId(null)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left cursor-pointer group"
        style={{
          background: isActive
            ? showDisconnectHint
              ? 'rgba(239, 68, 68, 0.08)'
              : 'rgba(29, 185, 84, 0.08)'
            : isHovering
            ? 'rgba(255, 255, 255, 0.06)'
            : 'transparent',
          border: isActive
            ? showDisconnectHint
              ? '1px solid rgba(239, 68, 68, 0.25)'
              : '1px solid rgba(29, 185, 84, 0.25)'
            : '1px solid transparent',
        }}
      >
        {/* Device Icon Bubble */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            background: isActive
              ? showDisconnectHint
                ? 'rgba(239, 68, 68, 0.18)'
                : 'rgba(29, 185, 84, 0.18)'
              : 'rgba(255, 255, 255, 0.06)',
            color: isActive
              ? showDisconnectHint
                ? '#ef4444'
                : '#1db954'
              : 'rgba(255, 255, 255, 0.6)',
          }}
        >
          {showDisconnectHint ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            getDeviceIcon(device.deviceType, 'w-4 h-4')
          )}
        </div>

        {/* Device Text */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px] font-semibold leading-tight truncate flex items-center gap-1.5"
            style={{
              color: isActive
                ? showDisconnectHint
                  ? '#fca5a5'
                  : '#fff'
                : 'rgba(255, 255, 255, 0.9)',
            }}
          >
            <span className="truncate">{device.deviceName}</span>
            {isLocalRow && (
              <span className="text-[10px] font-normal text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">
                This device
              </span>
            )}
          </div>

          <div className="text-[11px] mt-0.5 truncate transition-all">
            {showDisconnectHint ? (
              <span className="text-red-400 font-medium">Click to disconnect</span>
            ) : isActive && !isLocalRow ? (
              <span className="text-[#1db954] font-medium flex items-center gap-1.5">
                <span className="flex items-end gap-[2px] h-3">
                  <span className="w-[2px] bg-[#1db954] rounded-full animate-[rxEqBar1_0.8s_ease-in-out_infinite]" />
                  <span className="w-[2px] bg-[#1db954] rounded-full animate-[rxEqBar2_0.8s_ease-in-out_infinite]" />
                  <span className="w-[2px] bg-[#1db954] rounded-full animate-[rxEqBar3_0.8s_ease-in-out_infinite]" />
                </span>
                <span>Active Speaker</span>
              </span>
            ) : isLocalRow ? (
              <span className="text-zinc-400">
                {isRemoteMode
                  ? 'Tap to play on this device'
                  : isPlaying
                  ? '▶ Playing on this device'
                  : 'Ready to play'}
              </span>
            ) : device.state === 'PLAYING' && device.currentSong ? (
              <span className="text-[#1db954] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-pulse" />
                Listening to: {device.currentSong.title}
              </span>
            ) : (
              <span className="text-zinc-400">
                {device.transport === 'CLOUD_RELAY' ? 'Cloud' : 'Local Wi-Fi'}
              </span>
            )}
          </div>
        </div>

        {/* Right Status Indicator */}
        <div className="flex-shrink-0 w-6 flex items-center justify-center">
          {isTransferring ? (
            <Loader2 className="w-4 h-4 text-[#1db954] animate-spin" />
          ) : isActive && !isLocalRow ? (
            showDisconnectHint ? (
              <X className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#1db954] flex items-center justify-center shadow">
                <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
              </div>
            )
          ) : isLocalRow && !isRemoteMode ? (
            <div className="w-4 h-4 rounded-full bg-[#1db954] flex items-center justify-center shadow">
              <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
            </div>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <>
      <StyleOnce />

      {/* Backdrop */}
      <div className="fixed inset-0 z-[160] select-none flex items-center justify-center p-4">
        <div
          onClick={() => toggleConnectModal(false)}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <div
          className="relative z-10 w-full text-white flex flex-col max-w-[360px] max-h-[85vh] bg-[#121214] border border-white/10 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden"
          style={{ animation: 'rxModalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#1db954] animate-pulse" />
              <h2 className="text-[14px] font-bold text-white tracking-tight">
                Connect to a device
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={scanDevices}
                title="Scan for devices"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#1db954]' : ''}`}
                />
              </button>
              <button
                onClick={() => toggleConnectModal(false)}
                title="Close"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Active Remote Speaker Hero Card (When in Remote Controller Mode) ── */}
          {isRemoteMode && activePlaybackDevice && (
            <div className="mx-3.5 mt-3.5 p-3 rounded-xl bg-gradient-to-b from-[#1db954]/15 to-[#1db954]/5 border border-[#1db954]/25 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1db954]/25 flex items-center justify-center text-[#1db954] flex-shrink-0 shadow">
                    {getDeviceIcon(activePlaybackDevice.deviceType, 'w-4 h-4')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      Playing on speaker
                    </div>
                    <div className="text-[13px] font-bold text-white truncate">
                      {activePlaybackDevice.deviceName}
                    </div>
                  </div>
                </div>

                <div className="flex items-end gap-[2.5px] h-3.5 flex-shrink-0 px-1">
                  <span className="w-[2.5px] bg-[#1db954] rounded-full animate-[rxEqBar1_0.8s_ease-in-out_infinite]" />
                  <span className="w-[2.5px] bg-[#1db954] rounded-full animate-[rxEqBar2_0.8s_ease-in-out_infinite]" />
                  <span className="w-[2.5px] bg-[#1db954] rounded-full animate-[rxEqBar3_0.8s_ease-in-out_infinite]" />
                </div>
              </div>

              {/* Dual Actions: Play here / Detach */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#1db954]/15">
                <button
                  onClick={() => disconnectAndPlayLocally()}
                  className="flex-1 py-1.5 px-3 bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Play on this device</span>
                </button>
                <button
                  onClick={() => disconnect()}
                  className="py-1.5 px-3 bg-white/10 hover:bg-white/15 active:scale-95 text-white/80 hover:text-white text-xs font-medium rounded-lg transition-all cursor-pointer"
                  title="Detach controller (speaker keeps playing)"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* ── Scrollable Devices List ── */}
          <div className="overflow-y-auto flex-1 px-2 py-3 space-y-1">
            {/* Section 1: This Device */}
            <div className="px-3 pt-1 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                This Device
              </span>
            </div>
            <DeviceRow
              device={currentLocalDevice}
              isActive={!isRemoteMode}
              isTransferring={transferringId === currentLocalDevice.deviceId}
            />

            {/* Section 2: Discovered Available Devices */}
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Available Devices
              </span>
              <span className="flex items-center gap-1 text-zinc-400 text-[10px] font-medium">
                <Wifi className="w-3 h-3 text-[#1db954]" />
                <span>Wi-Fi Network</span>
              </span>
            </div>

            {otherDevices.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  No other RaagaX devices detected on this Wi-Fi.
                  <br />
                  Open RaagaX on your other phone or computer.
                </p>
              </div>
            ) : (
              otherDevices.map((device) => (
                <DeviceRow
                  key={device.deviceId}
                  device={device}
                  isActive={activePlaybackDevice?.deviceId === device.deviceId}
                  isTransferring={transferringId === device.deviceId}
                />
              ))
            )}

            {/* ── Remote Speaker Volume Slider ── */}
            {isRemoteMode && activePlaybackDevice && (
              <div className="mx-1 mt-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-zinc-400 truncate">
                    {activePlaybackDevice.deviceName} volume
                  </span>
                  <span className="text-[11px] font-bold text-[#1db954]">{volPct}%</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <VolumeIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <div className="flex-1 relative" style={{ height: '4px' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#1db954] pointer-events-none"
                      style={{ width: `${volPct}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={rawVol}
                      onChange={(e) => sendVolume(parseFloat(e.target.value))}
                      className="rx-vol-slider absolute inset-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Radio className="w-3 h-3 text-[#1db954]" />
              <span>RaagaX Connect</span>
            </div>
            <button
              onClick={() => {
                toggleConnectModal(false);
                import('@/context/useJamStore').then((m) =>
                  m.useJamStore.getState().toggleJamModal(true)
                );
              }}
              className="text-[11px] text-zinc-400 hover:text-white font-medium underline underline-offset-2 transition-colors cursor-pointer"
            >
              Multi-Speaker Jam
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
