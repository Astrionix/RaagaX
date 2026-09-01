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
  Wifi,
  Loader2,
  Speaker,
  Radio,
  Gamepad2,
} from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectDevice, ConnectDeviceType } from '@/types/connect';

/* ─── tiny CSS injected once ─── */
const SLIDER_STYLE = `
  .rx-vol-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    width: 100%;
  }
  .rx-vol-slider::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 99px;
    background: rgba(255,255,255,0.15);
  }
  .rx-vol-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    margin-top: -4.5px;
    transition: transform 0.15s;
  }
  .rx-vol-slider:hover::-webkit-slider-thumb {
    transform: scale(1.3);
    background: #1db954;
  }
  .rx-vol-slider::-moz-range-track {
    height: 3px;
    border-radius: 99px;
    background: rgba(255,255,255,0.15);
  }
  .rx-vol-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: none;
  }
`;

function SliderStyleOnce() {
  return <style>{SLIDER_STYLE}</style>;
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
    disconnectAndPlayLocally,
    sendVolume,
  } = useConnectStore();

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [transferringId, setTransferringId] = useState<string | null>(null);

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

  const getDeviceIcon = (type: ConnectDeviceType) => {
    switch (type) {
      case 'mobile':   return <Smartphone className="w-[18px] h-[18px]" />;
      case 'tablet':   return <Tablet     className="w-[18px] h-[18px]" />;
      case 'desktop':  return <Laptop     className="w-[18px] h-[18px]" />;
      case 'tv':       return <Tv         className="w-[18px] h-[18px]" />;
      default:         return <MonitorSpeaker className="w-[18px] h-[18px]" />;
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
      // Already actively controlling this speaker — keep connected
      return;
    }
    setTransferringId(device.deviceId);
    await transferPlayback(device);
    setTransferringId(null);
  };

  const volPct = Math.round((remoteSession?.volume ?? 0.8) * 100);

  /* ─── helper: device row ─── */
  const DeviceRow = ({
    device,
    isActive,
    isTransferring,
  }: {
    device: ConnectDevice;
    isActive: boolean;
    isTransferring: boolean;
  }) => (
    <button
      key={device.deviceId}
      onClick={() => handleSelectDevice(device)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                 hover:bg-white/[0.07] active:bg-white/[0.04]
                 transition-colors duration-150 text-left cursor-pointer"
    >
      {/* Icon bubble */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: isActive
            ? 'rgba(29,185,84,0.18)'
            : 'rgba(255,255,255,0.07)',
          color: isActive ? '#1db954' : 'rgba(255,255,255,0.55)',
        }}
      >
        {getDeviceIcon(device.deviceType)}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] font-semibold leading-tight truncate"
          style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.85)' }}
        >
          {device.deviceName}
          {device.isCurrentDevice && (
            <span className="ml-1.5 text-[11px] font-normal text-white/35">
              — This device
            </span>
          )}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: '#1db954', opacity: isActive ? 1 : 0 }}>
          {isActive ? '▶ Playing on this speaker' : ''}
        </div>
        {!isActive && !device.isCurrentDevice && (
          <div className="text-[11px] mt-0.5 text-white/35 truncate">
            {device.state === 'PLAYING' && device.currentSong ? (
              <span className="text-[#1db954] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-pulse" />
                Listening to: {device.currentSong.title}
              </span>
            ) : (
              device.transport === 'CLOUD_RELAY' ? 'Cloud' : 'Local Wi-Fi'
            )}
          </div>
        )}
        {!isActive && device.isCurrentDevice && (
          <div className="text-[11px] mt-0.5 text-white/35">
            {isRemoteMode ? 'Tap to play on this device' : (isPlaying ? '▶ Playing on this device' : 'Ready')}
          </div>
        )}
      </div>

      {/* Right indicator */}
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        {isTransferring ? (
          <Loader2 className="w-4 h-4 text-[#1db954] animate-spin" />
        ) : isActive ? (
          <div className="w-4 h-4 rounded-full bg-[#1db954] flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
          </div>
        ) : null}
      </div>
    </button>
  );

  return (
    <>
      <SliderStyleOnce />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[160] select-none"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      >
        <div
          onClick={() => toggleConnectModal(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        />

        {/* Panel */}
        <div
          className="relative z-10 w-full text-white flex flex-col"
          style={{
            maxWidth: '360px',
            maxHeight: '82vh',
            background: '#121212',
            borderRadius: '16px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
            overflow: 'hidden',
            animation: 'rxSlideUp 0.22s cubic-bezier(0.34,1.1,0.64,1) both',
          }}
        >
          <style>{`
            @keyframes rxSlideUp {
              from { opacity:0; transform: translateY(14px) scale(0.97); }
              to   { opacity:1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-[15px] font-bold tracking-tight text-white">
              Connect to a device
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={scanDevices}
                title="Refresh"
                className="w-8 h-8 rounded-full flex items-center justify-center
                           hover:bg-white/10 transition-colors cursor-pointer"
                style={{ color: isScanning ? '#1db954' : 'rgba(255,255,255,0.5)' }}
              >
                <RefreshCw
                  className="w-3.5 h-3.5"
                  style={{ animation: isScanning ? 'spin 0.9s linear infinite' : 'none' }}
                />
              </button>
              <button
                onClick={() => toggleConnectModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center
                           hover:bg-white/10 transition-colors cursor-pointer text-white/50 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Remote banner ── */}
          {isRemoteMode && activePlaybackDevice && (
            <div
              className="mx-4 mb-3 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5"
              style={{ background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.2)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(29,185,84,0.2)', color: '#1db954' }}
              >
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/45 leading-none mb-0.5">Playing on</div>
                <div className="text-[13px] font-semibold text-white truncate">
                  {activePlaybackDevice.deviceName}
                </div>
              </div>
              <button
                onClick={() => disconnectAndPlayLocally()}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer
                           transition-all active:scale-95"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
              >
                Disconnect
              </button>
            </div>
          )}

          {/* ── Scrollable list ── */}
          <div className="overflow-y-auto flex-1 px-2 pb-2">
            {/* Section label: This device */}
            <div className="px-3 pt-1 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                This device
              </span>
            </div>
            <DeviceRow
              device={currentLocalDevice}
              isActive={!isRemoteMode}
              isTransferring={transferringId === currentLocalDevice.deviceId}
            />

            {/* Section label: Other devices */}
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Available devices
              </span>
              <span className="flex items-center gap-1 text-white/30 text-[10px]">
                <Wifi className="w-3 h-3" />
                LAN
              </span>
            </div>

            {otherDevices.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-white/35 leading-relaxed">
                  No other RaagaX devices found on this Wi-Fi.
                  <br />
                  Open RaagaX on another device on the same network.
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

            {/* ── Volume slider ── */}
            {isRemoteMode && activePlaybackDevice && (
              <div className="mx-1 mt-3 mb-1 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] text-white/45 truncate">
                    {activePlaybackDevice.deviceName} volume
                  </span>
                  <span className="text-[11px] font-semibold text-[#1db954]">{volPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                  <div className="flex-1 relative" style={{ height: '3px' }}>
                    {/* filled track */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${volPct}%`,
                        background: '#1db954',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={remoteSession?.volume ?? 0.8}
                      onChange={(e) => sendVolume(parseFloat(e.target.value))}
                      className="rx-vol-slider absolute inset-0"
                      style={{ height: '3px' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-white/30">
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
              className="text-[11px] text-white/35 hover:text-white underline
                         underline-offset-2 transition-colors cursor-pointer"
            >
              Multi-Speaker Jam
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
