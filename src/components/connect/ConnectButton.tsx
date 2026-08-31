'use client';

import React from 'react';
import { MonitorSpeaker, Laptop, Smartphone, Tablet, Radio } from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';

interface ConnectButtonProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectButton({ className = '', showLabel = false }: ConnectButtonProps) {
  const { isRemoteMode, activePlaybackDevice, toggleConnectModal } = useConnectStore();

  const getDeviceIcon = () => {
    if (!activePlaybackDevice) return <MonitorSpeaker className="w-3.5 h-3.5" />;
    switch (activePlaybackDevice.deviceType) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5" />;
      case 'desktop':
        return <Laptop className="w-3.5 h-3.5" />;
      default:
        return <MonitorSpeaker className="w-3.5 h-3.5" />;
    }
  };

  return (
    <button
      onClick={() => toggleConnectModal()}
      aria-label="Connect to a device"
      title={isRemoteMode && activePlaybackDevice ? `Listening on ${activePlaybackDevice.deviceName}` : 'Connect to a device'}
      className={`relative flex items-center gap-1.5 p-1.5 rounded-full transition-all cursor-pointer select-none active:scale-95 ${
        isRemoteMode
          ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
          : 'text-zinc-400 hover:text-white hover:bg-white/10'
      } ${className}`}
    >
      {getDeviceIcon()}

      {/* Active Remote Playback Indicator Pulse */}
      {isRemoteMode && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-black/80 animate-pulse" />
      )}

      {showLabel && isRemoteMode && activePlaybackDevice && (
        <span className="text-[11px] font-bold text-emerald-400 truncate max-w-[130px]">
          {activePlaybackDevice.deviceName}
        </span>
      )}
    </button>
  );
}
