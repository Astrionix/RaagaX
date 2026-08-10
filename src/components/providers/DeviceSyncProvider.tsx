'use client';

import React, { useEffect, useState } from 'react';
import { DeviceSyncManager } from '@/lib/sync/DeviceSyncManager';
import { LibrarySyncManager } from '@/lib/sync/LibrarySyncManager';
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
      await manager.initSync();
      
      // Initialize LibrarySyncManager for Liked Songs
      LibrarySyncManager.getInstance();
      
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
  const { isActiveDevice, activeDeviceId, deviceId, transferPlayback, onlineDevices } = usePlayerStore();
  const [isOpen, setIsOpen] = useState(false);

  // If we are not active, always show. If we are active but there are other devices, show.
  const shouldShow = !isActiveDevice || onlineDevices.length > 1;

  if (!shouldShow) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-full transition-colors ${!isActiveDevice ? 'text-red-500 hover:text-red-400 bg-red-500/10 animate-pulse' : 'text-emerald-400 hover:bg-white/10'}`}
        title={!isActiveDevice ? "Controlling another device" : "Connect to a device"}
      >
        <MonitorSmartphone className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#161618] border border-white/10 rounded-xl p-3 shadow-2xl z-50">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-2 border-b border-white/10 pb-2">
            Connect to a device
          </div>
          
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {/* Current Device Option */}
            <button 
              onClick={() => {
                if (!isActiveDevice) transferPlayback(deviceId);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${isActiveDevice ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 text-white'}`}
            >
              <div className="flex items-center gap-3">
                <MonitorSmartphone className="w-4 h-4" />
                <span className="text-sm font-bold">This Device</span>
              </div>
              {isActiveDevice && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
            </button>

            {/* Other Online Devices */}
            {onlineDevices.filter(d => d.id !== deviceId).map((device) => {
              const isActive = activeDeviceId === device.id;
              return (
                <button
                  key={device.id}
                  onClick={() => {
                    transferPlayback(device.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 text-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <MonitorSmartphone className="w-4 h-4" />
                    <span className="text-sm font-bold truncate max-w-[120px]">{device.name}</span>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
