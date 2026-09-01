'use client';

/**
 * RaagaX Connect — SpeakerControlledBanner Component (Device Y UI)
 *
 * Renders on the Authoritative Active Speaker device (e.g. Laptop, Desktop)
 * when playback is being driven / controlled remotely by another device (e.g. Phone).
 *
 * Designed as a floating pill ribbon that aligns above the player bar on desktop.
 */

import React from 'react';
import { Smartphone, LogOut, Radio } from 'lucide-react';
import { useConnectStore } from '@/context/useConnectStore';
import { usePlayerStore } from '@/context/usePlayerStore';

export function SpeakerControlledBanner() {
  const isControlledByRemote = useConnectStore((s) => s.isControlledByRemote);
  const controllerDeviceName = useConnectStore((s) => s.controllerDeviceName);
  const disconnectRemoteControllerFromSpeaker = useConnectStore(
    (s) => s.disconnectRemoteControllerFromSpeaker
  );
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);

  if (!isControlledByRemote) {
    return null;
  }

  return (
    <>
      {/* ── DESKTOP: Floating Pill Docked Above PlayerBar ── */}
      <div
        className={`hidden md:flex fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-40 select-none items-center justify-between px-4 py-1.5 bg-[#121214]/95 hover:bg-[#16161a] backdrop-blur-2xl border border-[#1db954]/30 hover:border-[#1db954]/50 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.7),0_0_20px_rgba(29,185,84,0.15)] transition-all duration-300 max-w-[calc(100vw-18rem)] md:max-w-[760px] lg:max-w-[840px] w-auto h-[38px] gap-3 -translate-x-1/2 animate-in slide-in-from-bottom-2 ${
          isQueueOpen
            ? 'left-[calc(50%+8rem)] xl:left-[calc(50%+8rem-180px)]'
            : 'left-[calc(50%+8rem)]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <div className="relative w-6 h-6 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#1db954]">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1db954] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1db954]"></span>
            </span>
          </div>

          <div className="text-[11px] font-medium text-zinc-300 truncate max-w-[320px]">
            <span>Controlled by </span>
            <span className="text-[#1db954] font-semibold">
              {controllerDeviceName || 'Remote Device'}
            </span>
            <span className="text-zinc-500 hidden sm:inline text-[10px] ml-1.5">
              (Commands arriving remotely)
            </span>
          </div>
        </div>

        <button
          onClick={() => disconnectRemoteControllerFromSpeaker()}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 hover:border-white/30 bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-white/90 hover:text-white text-[11px] font-medium transition-all cursor-pointer shadow-sm flex-shrink-0"
          title="Disconnect remote controller — music continues playing uninterrupted on this device"
        >
          <LogOut className="w-3 h-3 text-zinc-400" />
          <span>Disconnect Remote</span>
        </button>
      </div>

      {/* ── MOBILE: Docked bottom bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121214]/95 backdrop-blur-xl border-t border-[#1db954]/30 px-3.5 py-2 flex items-center justify-between text-xs select-none shadow-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#1db954]/15 flex items-center justify-center text-[#1db954] flex-shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0 truncate">
            <div className="text-[11px] font-semibold text-white truncate">
              Controlled by <span className="text-[#1db954]">{controllerDeviceName || 'Remote Device'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => disconnectRemoteControllerFromSpeaker()}
          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[11px] font-medium rounded-full transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
        >
          <LogOut className="w-3 h-3" />
          <span>Disconnect</span>
        </button>
      </div>
    </>
  );
}
