'use client';

import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectPanelContent } from '@/components/connect/ConnectPanelContent';

export function MobileDeviceConnectModal() {
  const { isDeviceModalOpen, toggleDeviceModal } = usePlayerStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isDeviceModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-xl transition-opacity"
        onClick={toggleDeviceModal}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-[#111216] border-t sm:border border-white/15 rounded-t-[32px] sm:rounded-[32px] shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col max-h-[90dvh] overflow-hidden text-white z-10 animate-in slide-in-from-bottom-8 duration-200">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />
        <ConnectPanelContent onClose={toggleDeviceModal} />
      </div>
    </div>
  );
}
