"use client";

import React, { useState } from "react";
import { X, Bluetooth, Cast, Headphones, ExternalLink, Check, Volume2 } from "lucide-react";
import { PlaybackService } from "@/lib/playback/PlaybackService";

interface BluetoothAirPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothAirPlayModal: React.FC<BluetoothAirPlayModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedDeviceName, setSelectedDeviceName] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  if (!isOpen) return null;

  const handleSelectBrowserOutput = async () => {
    setIsSelecting(true);
    if (typeof window !== "undefined" && "mediaDevices" in navigator) {
      const nav = navigator as any;
      if (typeof nav.mediaDevices.selectAudioOutput === "function") {
        try {
          const audioDevice = await nav.mediaDevices.selectAudioOutput();
          const playback = PlaybackService.getInstance();
          const audioA = (playback as any).audioA;
          const audioB = (playback as any).audioB;
          if (audioA && typeof audioA.setSinkId === "function") {
            await audioA.setSinkId(audioDevice.deviceId);
          }
          if (audioB && typeof audioB.setSinkId === "function") {
            await audioB.setSinkId(audioDevice.deviceId);
          }
          setSelectedDeviceName(audioDevice.label || "Connected Device");
        } catch (err: any) {
          // User cancelled device prompt
        }
      }
    }
    setIsSelecting(false);
  };

  const isOutputSelectionSupported =
    typeof window !== "undefined" &&
    "mediaDevices" in navigator &&
    typeof (navigator as any).mediaDevices?.selectAudioOutput === "function";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#181818] border border-white/10 shadow-2xl p-6 text-white select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header Icons */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <Bluetooth size={20} className="text-blue-400" />
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Cast size={20} className="text-purple-400" />
          </div>
        </div>

        <h3 className="text-lg font-bold tracking-tight mb-1">
          AirPlay or Bluetooth
        </h3>
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          Route RaagaX high-resolution 24-bit lossless audio directly to your wireless headphones, TWS earbuds, or Bluetooth speakers.
        </p>

        {/* Current Status */}
        {selectedDeviceName && (
          <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2.5">
            <Check size={16} className="text-green-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="text-zinc-400">Audio Routed To: </span>
              <span className="font-semibold text-white">{selectedDeviceName}</span>
            </div>
          </div>
        )}

        {/* Browser Native Device Selector (Chrome / Brave / Edge) */}
        {isOutputSelectionSupported && (
          <button
            onClick={handleSelectBrowserOutput}
            disabled={isSelecting}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white font-semibold text-xs transition-all mb-4 cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Headphones size={16} className="text-blue-400" />
              <span>Choose Audio Output Device</span>
            </span>
            <ExternalLink size={14} className="text-zinc-400" />
          </button>
        )}

        {/* Instruction Steps */}
        <div className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-3 mb-5 text-left">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold flex items-center justify-center text-zinc-300 flex-shrink-0 mt-0.5">
              1
            </span>
            <p className="text-xs text-zinc-300">
              Turn on your <strong>Bluetooth headphones or speaker</strong> and set it to pairing mode.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold flex items-center justify-center text-zinc-300 flex-shrink-0 mt-0.5">
              2
            </span>
            <p className="text-xs text-zinc-300">
              In your phone or computer settings, connect to your Bluetooth device.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold flex items-center justify-center text-zinc-300 flex-shrink-0 mt-0.5">
              3
            </span>
            <p className="text-xs text-zinc-300">
              RaagaX will automatically stream lossless sound directly through your connected speaker.
            </p>
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] text-black font-bold text-xs transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
