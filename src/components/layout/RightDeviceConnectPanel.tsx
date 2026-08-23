'use client';

import React from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectPanelContent } from '@/components/connect/ConnectPanelContent';

export function RightDeviceConnectPanel() {
  const { setRightPanelMode } = usePlayerStore();

  return (
    <div className="w-full h-full flex flex-col bg-[#111216]">
      <ConnectPanelContent 
        isPanel={true} 
        onClose={() => setRightPanelMode('queue')} 
      />
    </div>
  );
}
