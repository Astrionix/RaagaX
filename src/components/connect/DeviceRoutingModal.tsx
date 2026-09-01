'use client';

/**
 * DeviceRoutingModal — Spotify Connect "Connect to a Device" Modal Overlay
 *
 * Provides a production-grade device picker listing all active playback sinks
 * and remote controllers operating under the same user account.
 *
 * Features:
 * - Real-time active connection indicator and animated sound waves
 * - One-click Zero-Latency Handover ("Play on this device")
 * - Dynamic device type mapping (Desktop, Mobile, Tablet, TV, Speaker)
 * - Volume Slider control for active speaker
 * - Disconnect & Detach Remote Control action
 */

import React, { useState } from 'react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useSpotifyConnectEngine } from '@/hooks/useSpotifyConnectEngine';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { ConnectDevice } from '@/types/connect';
import {
  Laptop,
  Smartphone,
  Tablet,
  Tv,
  Speaker,
  Volume2,
  VolumeX,
  Radio,
  Check,
  X,
  Loader2,
  RefreshCw,
  Settings,
  Globe,
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/config/apiConfig';

export function DeviceRoutingModal() {
  const isConnectModalOpen = useConnectStore((s) => s.isConnectModalOpen);
  const toggleConnectModal = useConnectStore((s) => s.toggleConnectModal);
  const devices = useConnectStore((s) => s.devices);
  const activePlaybackDevice = useConnectStore((s) => s.activePlaybackDevice);
  const isRemoteMode = useConnectStore((s) => s.isRemoteMode);

  const {
    isSpeaker,
    activeSpeakerName,
    volume,
    isMuted,
    sendVolume,
    takeoverPlayback,
    disconnect,
    isTakingOver,
  } = useSpotifyConnectEngine();

  const [isScanning, setIsScanning] = useState(false);
  const [switchingDeviceId, setSwitchingDeviceId] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rx_custom_api_base') || '';
    }
    return '';
  });

  const handleSaveServerUrl = () => {
    if (typeof window !== 'undefined') {
      if (customServerUrl.trim()) {
        localStorage.setItem('rx_custom_api_base', customServerUrl.trim().replace(/\/+$/, ''));
      } else {
        localStorage.removeItem('rx_custom_api_base');
      }
      ConnectDiscoveryEngine.getInstance().scanNow();
      setShowServerConfig(false);
    }
  };

  if (!isConnectModalOpen) return null;

  const localDevice = typeof window !== 'undefined' ? ConnectDiscoveryEngine.getInstance().getLocalDevice() : null;
  const localDeviceId = localDevice?.deviceId || 'dev_local';

  const handleDeviceSelect = async (device: ConnectDevice) => {
    if (device.deviceId === localDeviceId) {
      // User tapped "This Device" while listening remotely
      setSwitchingDeviceId(device.deviceId);
      try {
        await takeoverPlayback();
        toggleConnectModal(false);
      } finally {
        setSwitchingDeviceId(null);
      }
      return;
    }

    // User tapped another remote speaker
    setSwitchingDeviceId(device.deviceId);
    try {
      await ConnectClientManager.getInstance().transferPlaybackTo(device.deviceId);
      toggleConnectModal(false);
    } finally {
      setSwitchingDeviceId(null);
    }
  };

  const handleRefresh = () => {
    setIsScanning(true);
    ConnectDiscoveryEngine.getInstance().scanNow();
    setTimeout(() => setIsScanning(false), 600);
  };

  const getDeviceIcon = (type?: string | null, className: string = 'w-5 h-5') => {
    if (type === 'tv') return <Tv className={className} />;
    if (type === 'mobile') return <Smartphone className={className} />;
    if (type === 'tablet') return <Tablet className={className} />;
    if (type === 'desktop') return <Laptop className={className} />;
    return <Speaker className={className} />;
  };

  const isLocalActiveSpeaker = isSpeaker && !isRemoteMode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => toggleConnectModal(false)}
    >
      <div
        className="relative w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#1db954]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Connect to a device</h2>
              <p className="text-xs text-white/50">Listen with RaagaX on your other devices</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              title="Refresh device list"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-[#1db954]' : ''}`} />
            </button>
            <button
              onClick={() => toggleConnectModal(false)}
              className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Active Speaker Section */}
        <div className="mt-5">
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/40 mb-2.5 block">
            Current Listening Device
          </span>
          <div className="flex items-center justify-between p-3.5 bg-[#1db954]/10 border border-[#1db954]/40 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1db954]/20 flex items-center justify-center text-[#1db954]">
                {getDeviceIcon(activePlaybackDevice?.deviceType || localDevice?.deviceType, 'w-5 h-5')}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  {isRemoteMode ? activeSpeakerName : `${localDevice?.deviceName || 'This Computer'} (This Device)`}
                  <span className="inline-block w-2 h-2 rounded-full bg-[#1db954] animate-pulse" />
                </span>
                <span className="text-xs font-semibold text-[#1db954]">
                  {isRemoteMode ? 'Playing Remotely via Connect' : 'Playing Audio Locally'}
                </span>
              </div>
            </div>
            <div className="text-[#1db954]">
              <Check className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Volume Slider for Remote Speaker */}
        {isRemoteMode && (
          <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
            <button
              onClick={() => sendVolume(isMuted ? 0.8 : 0)}
              className="text-white/60 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => sendVolume(Number(e.target.value) / 100)}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#1db954]"
            />
            <span className="text-xs font-medium text-white/50 w-8 text-right tabular-nums">
              {isMuted ? '0%' : `${volume}%`}
            </span>
          </div>
        )}

        {/* Available Devices Section */}
        <div className="mt-6">
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/40 mb-2.5 block">
            Select Another Device
          </span>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {/* Option to switch to local device if currently remote */}
            {isRemoteMode && localDevice && (
              <button
                onClick={() => handleDeviceSelect(localDevice)}
                disabled={isTakingOver || switchingDeviceId === localDeviceId}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10 text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white">
                    {getDeviceIcon(localDevice.deviceType)}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-[#1db954] transition-colors block">
                      {localDevice.deviceName} (This Device)
                    </span>
                    <span className="text-[11px] text-white/40">Switch audio output to this device</span>
                  </div>
                </div>
                {switchingDeviceId === localDeviceId ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1db954]" />
                ) : (
                  <span className="text-xs font-bold text-[#1db954] opacity-0 group-hover:opacity-100 transition-opacity">
                    Play Here
                  </span>
                )}
              </button>
            )}

            {/* Discovered Remote Devices */}
            {devices.map((device) => {
              const isCurrentActive = activePlaybackDevice?.deviceId === device.deviceId;
              if (isCurrentActive) return null;

              return (
                <button
                  key={device.deviceId}
                  onClick={() => handleDeviceSelect(device)}
                  disabled={switchingDeviceId === device.deviceId}
                  className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10 text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white group-hover:text-[#1db954] transition-colors block">
                        {device.deviceName}
                      </span>
                      <span className="text-[11px] text-white/40 capitalize">{device.deviceType}</span>
                    </div>
                  </div>
                  {switchingDeviceId === device.deviceId ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#1db954]" />
                  ) : (
                    <span className="text-xs font-bold text-white/60 group-hover:text-[#1db954] transition-colors">
                      Connect
                    </span>
                  )}
                </button>
              );
            })}

            {devices.length === 0 && !isRemoteMode && (
              <div className="py-6 text-center text-white/40 text-xs">
                <p>No other active devices found on this account.</p>
                <p className="mt-1 text-[11px] text-white/30">
                  Open RaagaX on your phone, laptop, or tablet to stream together.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Gateway & Network Info */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] text-white/40">
            <span className="flex items-center gap-1.5 truncate max-w-[240px]">
              <Globe className="w-3 h-3 text-[#1db954]" />
              <span className="truncate">{getApiBaseUrl()}</span>
            </span>
            <button
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-white/60 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Settings className="w-3 h-3" />
              <span>{showServerConfig ? 'Close' : 'Server Settings'}</span>
            </button>
          </div>

          {showServerConfig && (
            <div className="mt-2.5 p-3 bg-white/5 rounded-xl border border-white/10 space-y-2 animate-in fade-in duration-150">
              <label className="text-[11px] font-medium text-white/70 block">
                Connect Gateway / LAN Server URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. http://192.168.1.15:3000"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#1db954]"
                />
                <button
                  onClick={handleSaveServerUrl}
                  className="px-3 py-1.5 bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-white/30">
                Leave empty for automatic Cloud Relay (https://raaga-x-chi.vercel.app).
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {isRemoteMode && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={disconnect}
              className="text-xs text-red-400/80 hover:text-red-400 font-semibold transition-colors"
            >
              Disconnect Remote Control
            </button>
            <button
              onClick={() => toggleConnectModal(false)}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-full transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
