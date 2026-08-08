'use client';

import React, { useEffect, useState } from 'react';
import { DeviceSyncManager } from '@/lib/sync/DeviceSyncManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { MonitorSmartphone } from 'lucide-react';

export function DeviceSyncProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const { user, isLoading, initializeAuth } = useAuthStore();

  // 1. Initialize Global Auth first
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 2. Once Auth is loaded, connect the Sync Engine
  useEffect(() => {
    if (isLoading) return; // Wait for auth to finish loading!

    const initSync = async () => {
      // Use secure Supabase Auth ID if logged in, otherwise fallback to guest
      let sessionId = user?.id;
      
      if (!sessionId) {
        sessionId = localStorage.getItem('raagax_session_id') || '';
        if (!sessionId) {
          sessionId = 'guest_' + Math.random().toString(36).substring(2, 10);
          localStorage.setItem('raagax_session_id', sessionId);
        }
      }
      
      const manager = DeviceSyncManager.getInstance();
      await manager.initSync(sessionId);
      
      if (user?.id) {
        await usePlayerStore.getState().syncCloudLibrary();
      }
      
      setIsInitializing(false);
    };
    
    initSync();
  }, [user?.id, isLoading]); // Re-connect sync ONLY if user ID changes or loading finishes

  return <>{children}</>;
}

export function DeviceSelector() {
  const { isActiveDevice, activeDeviceId, deviceId, transferPlayback } = usePlayerStore();
  const [isOpen, setIsOpen] = useState(false);

  if (isActiveDevice) return null; // Only show if we are a remote control

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 rounded-full animate-pulse transition-colors"
        title="Controlling another device"
      >
        <MonitorSmartphone className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#161618] border border-white/10 rounded-xl p-2 shadow-2xl z-50">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
            Playback Control
          </div>
          <div className="text-xs text-white font-medium px-2 pb-2">
            Playing on another device
          </div>
          <button 
            onClick={() => {
              transferPlayback(deviceId);
              setIsOpen(false);
            }}
            className="w-full text-left px-2 py-2 hover:bg-white/5 rounded-lg text-sm text-[#EF233C] font-bold transition-colors"
          >
            Play here instead
          </button>
        </div>
      )}
    </div>
  );
}
