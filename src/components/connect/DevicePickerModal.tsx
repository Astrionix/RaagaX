'use client';

/**
 * RaagaX Connect — Spotify Connect Style Device Picker Modal
 *
 * Implements:
 * - Dynamic list of online devices on account and local subnet.
 * - Clear distinction between "This Device" and remote speakers.
 * - Single-click seamless audio handoff with visual feedback.
 * - Real-time synchronized volume slider for active sink.
 */

import React, { useState } from 'react';
import {
  X,
  Laptop,
  Smartphone,
  Tablet,
  Tv,
  MonitorSpeaker,
  Volume2,
  VolumeX,
  Check,
  Radio,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';
import { useCrossDeviceSync } from '@/hooks/useCrossDeviceSync';
import { ConnectDevice, ConnectDeviceType } from '@/types/connect';

export function DevicePickerModal() {
  const {
    isConnectModalOpen,
    toggleConnectModal,
    scanDevices,
  } = useConnectStore();

  const {
    session,
    activeTrack,
    isPlaying,
    isRemoteMode,
    currentDeviceId,
    activeSinkDevice,
    availableDevices,
    transferPlayback,
    setVolume,
  } = useCrossDeviceSync();

  const [transferringId, setTransferringId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isConnectModalOpen) {
      scanDevices();
      const timer = setInterval(() => scanDevices(), 2000);
      return () => clearInterval(timer);
    }
  }, [isConnectModalOpen, scanDevices]);

  if (!isConnectModalOpen) return null;

  const currentLocalDevice = availableDevices.find((d) => d.isCurrentDevice) || {
    deviceId: currentDeviceId || 'dev_local',
    deviceName: 'This device',
    deviceType: 'desktop' as ConnectDeviceType,
    isCurrentDevice: true,
    isOnline: true,
    state: 'PLAYING' as const,
    lastSeenAt: Date.now(),
    transport: 'LOCAL_LAN' as const,
  };

  const remoteTargets = availableDevices.filter((d) => !d.isCurrentDevice);

  const getDeviceIcon = (type: ConnectDeviceType, active: boolean) => {
    const cls = `w-5 h-5 ${active ? 'text-[#1db954]' : 'text-white/60'}`;
    switch (type) {
      case 'mobile':
        return <Smartphone className={cls} />;
      case 'tablet':
        return <Tablet className={cls} />;
      case 'tv':
        return <Tv className={cls} />;
      case 'desktop':
        return <Laptop className={cls} />;
      default:
        return <MonitorSpeaker className={cls} />;
    }
  };

  const handleDeviceClick = async (device: ConnectDevice) => {
    if (transferringId) return;
    setTransferringId(device.deviceId);
    try {
      await transferPlayback(device.deviceId);
    } finally {
      setTransferringId(null);
    }
  };

  const currentVolume = session?.volume ?? 0.8;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-picker-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={() => toggleConnectModal(false)}
    >
      <div
        className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#1db954]">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 id="device-picker-title" className="text-base font-bold text-white tracking-tight">
                Connect to a device
              </h2>
              <p className="text-xs text-white/50">
                Listen on your speakers, TVs, and computers
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleConnectModal(false)}
            className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close device menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Playback Hero Card */}
        {activeTrack && (
          <div className="px-6 py-4 bg-gradient-to-b from-white/[0.04] to-transparent border-b border-white/5">
            <div className="flex items-center gap-3">
              {activeTrack.artworkUrl ? (
                <img
                  src={activeTrack.artworkUrl}
                  alt={activeTrack.title}
                  className="w-12 h-12 rounded-lg object-cover shadow-md border border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/40">
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#1db954] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1db954] animate-ping" />
                  {isRemoteMode && activeSinkDevice ? `Listening on ${activeSinkDevice.deviceName}` : 'Current Playback'}
                </div>
                <h4 className="text-sm font-semibold text-white truncate mt-0.5">
                  {activeTrack.title}
                </h4>
                <p className="text-xs text-white/50 truncate">
                  {activeTrack.artist}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Device Lists */}
        <div className="p-4 max-h-[360px] overflow-y-auto space-y-4 scrollbar-thin">
          {/* Section: This Device */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 px-3 mb-1.5">
              Current Device
            </div>
            <button
              onClick={() => handleDeviceClick(currentLocalDevice)}
              disabled={transferringId !== null}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                !isRemoteMode
                  ? 'bg-[#1db954]/15 border border-[#1db954]/30 text-white'
                  : 'hover:bg-white/[0.06] text-white/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  {getDeviceIcon(currentLocalDevice.deviceType, !isRemoteMode)}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {currentLocalDevice.deviceName}
                    {!isRemoteMode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1db954]/20 text-[#1db954] font-semibold">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">
                    {!isRemoteMode
                      ? (isPlaying ? '▶ Playing on this speaker' : 'Ready to play')
                      : 'Tap to transfer audio back to this device'}
                  </p>
                </div>
              </div>
              {transferringId === currentLocalDevice.deviceId ? (
                <Loader2 className="w-5 h-5 text-[#1db954] animate-spin" />
              ) : (
                !isRemoteMode && <Check className="w-5 h-5 text-[#1db954]" />
              )}
            </button>
          </div>

          {/* Section: Available Remote Targets */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 px-3 mb-1.5">
              Select another device
            </div>
            {remoteTargets.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-xs">
                Searching for devices on your Wi-Fi...
              </div>
            ) : (
              <div className="space-y-1">
                {remoteTargets.map((dev) => {
                  const isActiveSpeaker = isRemoteMode && activeSinkDevice?.deviceId === dev.deviceId;
                  const isTransferring = transferringId === dev.deviceId;

                  return (
                    <button
                      key={dev.deviceId}
                      onClick={() => handleDeviceClick(dev)}
                      disabled={transferringId !== null}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        isActiveSpeaker
                          ? 'bg-[#1db954]/15 border border-[#1db954]/30 text-white'
                          : 'hover:bg-white/[0.06] text-white/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                          {getDeviceIcon(dev.deviceType, isActiveSpeaker)}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {dev.deviceName}
                            {dev.transport === 'LOCAL_LAN' && (
                              <span className="text-[10px] text-white/40 font-normal">
                                • Wi-Fi
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 truncate">
                            {isActiveSpeaker
                              ? '▶ Connected • Playing here'
                              : (dev.state === 'PLAYING' && dev.currentSong
                                ? `Listening to: ${dev.currentSong.title}`
                                : 'RaagaX Connect')}
                          </p>
                        </div>
                      </div>
                      {isTransferring ? (
                        <Loader2 className="w-5 h-5 text-[#1db954] animate-spin flex-shrink-0" />
                      ) : (
                        isActiveSpeaker && <Check className="w-5 h-5 text-[#1db954] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Remote Volume Slider (Active when controlling a remote speaker) */}
        {isRemoteMode && (
          <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between text-xs text-white/60 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                {currentVolume === 0 ? <VolumeX className="w-4 h-4 text-white/40" /> : <Volume2 className="w-4 h-4 text-[#1db954]" />}
                Speaker Volume
              </span>
              <span className="text-white/40 font-mono">
                {Math.round(currentVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentVolume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-[#1db954] cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
