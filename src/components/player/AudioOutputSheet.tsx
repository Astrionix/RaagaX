'use client';

import React from 'react';
import { X, Speaker, Headphones, Cast, Radio, Check, Smartphone, Laptop } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

interface AudioOutputSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioOutputSheet({ isOpen, onClose }: AudioOutputSheetProps) {
  const {
    isLocalPlayback,
    activePlaybackDeviceName,
    toggleCastModal,
    deviceId,
    setActivePlaybackDeviceId,
  } = usePlayerStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#10121A]/95 border border-white/15 p-5 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Speaker className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Audio Output</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {/* Current Device Output */}
          <button
            onClick={() => {
              setActivePlaybackDeviceId(deviceId || 'dev_local', 'This Device');
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
              isLocalPlayback
                ? 'bg-emerald-500/15 border-emerald-500/30 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Laptop className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">This Device (Browser Audio)</p>
                <p className="text-[11px] text-white/40">Default Audio Engine • Low Latency</p>
              </div>
            </div>
            {isLocalPlayback && <Check className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Connect / Cast Remote Output */}
          <button
            onClick={() => {
              onClose();
              toggleCastModal();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
              !isLocalPlayback
                ? 'bg-blue-500/15 border-blue-500/30 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white">
                  Raaga Connect & Cast
                </p>
                <p className="text-[11px] text-white/40">
                  {!isLocalPlayback
                    ? `Active on: ${activePlaybackDeviceName}`
                    : 'Stream to phone, TV, or smart speakers'}
                </p>
              </div>
            </div>
            {!isLocalPlayback ? (
              <Check className="w-4 h-4 text-blue-400" />
            ) : (
              <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full font-medium">
                Pair
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
