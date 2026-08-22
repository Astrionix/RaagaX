'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  Tablet, 
  Radio, 
  Clock, 
  Check, 
  X, 
  Sliders, 
  ArrowRightLeft 
} from 'lucide-react';
import { ConnectAuthManager, PendingPairingPrompt } from '@/lib/connect/lan/ConnectAuthManager';
import { LANExpiryDuration } from '@/lib/connect/lan/types';

export function ConnectPairingRequestModal() {
  const [prompts, setPrompts] = useState<PendingPairingPrompt[]>([]);
  const [allowControl, setAllowControl] = useState(true);
  const [allowSwitch, setAllowSwitch] = useState(false);
  const [duration, setDuration] = useState<LANExpiryDuration>('permanent');

  useEffect(() => {
    const unbind = ConnectAuthManager.getInstance().onPairingRequestPrompt((active) => {
      setPrompts(active);
      if (active.length > 0) {
        setAllowControl(active[0].requestedPermissions.allowControl);
        setAllowSwitch(active[0].requestedPermissions.allowSwitch);
      }
    });
    return () => unbind();
  }, []);

  if (prompts.length === 0) return null;

  const currentPrompt = prompts[0];
  const { pairingId, requesterDevice } = currentPrompt;

  const handleDecline = () => {
    ConnectAuthManager.getInstance().respondToPairingPrompt(pairingId, false);
  };

  const handleAllow = () => {
    ConnectAuthManager.getInstance().respondToPairingPrompt(
      pairingId, 
      true, 
      { allowControl, allowSwitch }, 
      duration
    );
  };

  const renderDeviceIcon = () => {
    if (requesterDevice.deviceType === 'desktop') {
      return <Laptop className="w-6 h-6 text-emerald-400" />;
    }
    if (requesterDevice.deviceType === 'tablet') {
      return <Tablet className="w-6 h-6 text-emerald-400" />;
    }
    return <Smartphone className="w-6 h-6 text-emerald-400" />;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-white">
        {/* Header with Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            {renderDeviceIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white leading-tight">Control Request</h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                LAN Direct
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {requesterDevice.accountName ? `${requesterDevice.accountName}'s ` : ''}
              {requesterDevice.deviceName} wants to connect
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="p-3.5 mb-5 rounded-xl bg-white/[0.04] border border-white/5 space-y-1.5">
          <p className="text-xs text-neutral-300">
            A device on this Wi-Fi is requesting permission to interact with your RaagaX playback.
          </p>
        </div>

        {/* Permissions Configuration */}
        <div className="space-y-3 mb-5">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Granted Permissions
          </label>

          <label 
            onClick={() => setAllowControl(!allowControl)}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
              allowControl 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white' 
                : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-sm font-medium">Remote Playback Control</div>
                <div className="text-[11px] text-neutral-400">Play, pause, skip, seek, and volume control</div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center border ${
              allowControl ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-neutral-600'
            }`}>
              {allowControl && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </label>

          <label 
            onClick={() => setAllowSwitch(!allowSwitch)}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
              allowSwitch 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-white' 
                : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-sm font-medium">Playback Switching</div>
                <div className="text-[11px] text-neutral-400">Allow taking or transferring current session</div>
              </div>
            </div>
            <div className={`w-5 h-5 rounded flex items-center justify-center border ${
              allowSwitch ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-neutral-600'
            }`}>
              {allowSwitch && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </label>
        </div>

        {/* Expiry Selector */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
            Trust Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: '15m', label: '15 Mins' },
              { id: '1h', label: '1 Hour' },
              { id: 'permanent', label: 'Until Revoked' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDuration(opt.id as LANExpiryDuration)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  duration === opt.id
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDecline}
            className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 text-sm font-semibold transition-all"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAllow}
            disabled={!allowControl && !allowSwitch}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none text-black text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            Allow & Pair
          </button>
        </div>
      </div>
    </div>
  );
}
