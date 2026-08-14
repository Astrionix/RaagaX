'use client';

import React from 'react';
import { Smartphone, Laptop, Tv, Tablet, Radio, Wifi, Activity } from 'lucide-react';
import { RaagaXLogo } from './RaagaXLogo';
import { RaagaXWaveform } from './RaagaXWaveform';

export type DeviceStateName =
  | 'DISCOVERING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'RECONNECTING'
  | 'OFFLINE'
  | 'ERROR';

interface DeviceItem {
  id: string;
  name: string;
  type: 'phone' | 'laptop' | 'tv' | 'tablet' | 'speaker';
  state: DeviceStateName;
  transport?: 'LOCAL_DIRECT' | 'HOTSPOT_DIRECT' | 'CLOUD_RELAY';
  isActiveRenderer?: boolean;
}

interface CrossDeviceTransferFlowProps {
  sourceDevice: DeviceItem;
  targetDevice?: DeviceItem;
  isTransferring?: boolean;
  onSelectTarget?: (device: DeviceItem) => void;
  availableDevices?: DeviceItem[];
}

export function CrossDeviceTransferFlow({
  sourceDevice,
  targetDevice,
  isTransferring = false,
  onSelectTarget,
  availableDevices = [],
}: CrossDeviceTransferFlowProps) {
  const getDeviceIcon = (type: DeviceItem['type'], className = 'w-5 h-5') => {
    switch (type) {
      case 'laptop':
        return <Laptop className={className} />;
      case 'tv':
        return <Tv className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      case 'speaker':
        return <Radio className={className} />;
      case 'phone':
      default:
        return <Smartphone className={className} />;
    }
  };

  const getStateBadge = (state: DeviceStateName) => {
    switch (state) {
      case 'PLAYING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F20D18]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F20D18] animate-pulse" />
            Playing now
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Ready
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            {state === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
          </span>
        );
      case 'PAUSED':
        return <span className="text-[11px] font-medium text-slate-400">Paused</span>;
      case 'OFFLINE':
        return <span className="text-[11px] font-medium text-slate-500">Offline</span>;
      case 'ERROR':
        return <span className="text-[11px] font-semibold text-[#700008]">Unavailable</span>;
      default:
        return <span className="text-[11px] font-medium text-slate-400">{state}</span>;
    }
  };

  return (
    <div className="w-full space-y-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 select-none shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2.5">
          <RaagaXLogo variant="micro" size={24} />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">RaagaX Cross-Connect</h3>
            <p className="text-[10px] text-slate-400">Music That Moves With You</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F20D18]/10 text-[#F20D18] border border-[#F20D18]/20">
          Realtime Audio Sync
        </span>
      </div>

      {/* Active Transfer Motion Visualizer (300-800ms motion) */}
      {isTransferring && targetDevice && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#F20D18]/10 via-[#FF252D]/20 to-[#F20D18]/10 border border-[#F20D18]/30 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            {getDeviceIcon(sourceDevice.type, 'w-4 h-4 text-[#F20D18]')}
            <span className="text-xs font-bold text-[var(--text-primary)]">{sourceDevice.name}</span>
          </div>

          <div className="flex-1 px-4 flex items-center justify-center gap-1">
            <RaagaXWaveform state="playing" barCount={5} height={14} />
            <div className="h-[2px] flex-1 bg-gradient-to-r from-[#F20D18] to-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-[#F20D18]">Transferring</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-[var(--text-primary)]">{targetDevice.name}</span>
            {getDeviceIcon(targetDevice.type, 'w-4 h-4 text-emerald-400')}
          </div>
        </div>
      )}

      {/* Device List */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Available Playback Targets
        </div>

        {/* Current Active Device */}
        <div className="p-3.5 rounded-xl border border-[#F20D18]/40 bg-[#F20D18]/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F20D18]/20 flex items-center justify-center text-[#F20D18]">
              {getDeviceIcon(sourceDevice.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">{sourceDevice.name}</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-[#F20D18] text-white rounded font-mono font-bold">
                  ACTIVE
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{sourceDevice.transport || 'Local Subnet'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RaagaXWaveform state={sourceDevice.state === 'PLAYING' ? 'playing' : 'paused'} barCount={5} height={14} />
            {getStateBadge(sourceDevice.state)}
          </div>
        </div>

        {/* Remote Available Devices */}
        {availableDevices
          .filter((d) => d.id !== sourceDevice.id)
          .map((device) => (
            <div
              key={device.id}
              onClick={() => onSelectTarget?.(device)}
              className="p-3 rounded-xl border border-[var(--border-subtle)] bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between cursor-pointer transition-all hover:border-[#F20D18]/30 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-400 group-hover:text-[#F20D18] transition-colors">
                  {getDeviceIcon(device.type)}
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{device.name}</span>
                  <p className="text-[10px] text-slate-400">{device.transport || 'Direct LAN'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStateBadge(device.state)}
                <button className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 hover:bg-[#F20D18] hover:text-white border border-[var(--border-subtle)] transition-colors">
                  Play Here
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
