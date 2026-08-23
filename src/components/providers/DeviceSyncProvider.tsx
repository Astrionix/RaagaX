'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { DeviceRegistry } from '@/lib/connect/DeviceRegistry';
import { ClockSynchronizer } from '@/lib/connect/ClockSynchronizer';
import { LibrarySyncManager } from '@/lib/sync/LibrarySyncManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { MonitorSmartphone, Laptop, Smartphone, Wifi, Check, ChevronUp, X, Sparkles, Headphones } from 'lucide-react';
import { TransferManager } from '@/lib/connect/TransferManager';
import { initQueueSystem } from '@/lib/queue/initQueue';
import { ConnectPanelContent } from '@/components/connect/ConnectPanelContent';

export function DeviceSyncProvider({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const { user, isLoading, initializeAuth } = useAuthStore();

  const lastInitializedUserIdRef = useRef<string | null>(null);

  // 1. Initialize Global Auth first
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 2. Once Auth is loaded, connect the Sync Engine
  useEffect(() => {
    if (isLoading) return;

    const initSync = async () => {
      const deviceId = usePlayerStore.getState().deviceId;

      // Use the real Supabase Auth user ID so session can be tied server-side.
      // Fall back to a stable guest ID for unauthenticated users.
      let userId = user?.id;
      if (!userId) {
        let storedId = typeof window !== 'undefined' ? localStorage.getItem('raagax_session_id') : null;
        if (!storedId) {
          storedId = 'guest_' + Math.random().toString(36).substring(2, 10);
          if (typeof window !== 'undefined') localStorage.setItem('raagax_session_id', storedId);
        }
        userId = storedId;
      }

      if (lastInitializedUserIdRef.current === userId) {
        return;
      }
      lastInitializedUserIdRef.current = userId;

      // Initialize RaagaX Connect V2 (Local LAN Direct Architecture)
      const { RaagaXConnectV2 } = await import('@/lib/connect/lan/RaagaXConnectV2');
      await RaagaXConnectV2.getInstance().init();

      // ConnectManager.init now handles the full bootstrap:
      // inbox subscription → session create/join → lease → session subscribe → CommandBus/PSM init
      await ConnectManager.getInstance().init(userId, deviceId);

      DeviceRegistry.getInstance().registerDevice();
      
      ClockSynchronizer.getInstance().synchronize();
      LibrarySyncManager.getInstance();
      initQueueSystem();
      
      if (user?.id) {
        const { AccountSyncEngine } = await import('@/lib/sync/AccountSyncEngine');
        AccountSyncEngine.getInstance().subscribeToRealtime(user.id);
        await usePlayerStore.getState().syncCloudLibrary();
      }
      
      setIsInitializing(false);
    };
    
    initSync();
  }, [user?.id, isLoading]);

  // 3. Smooth seeker progress ticker for remote controller device (when not active renderer but remote is playing)
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isActiveDevice = usePlayerStore((state) => state.isActiveDevice);

  useEffect(() => {
    if (isActiveDevice || !isPlaying) return;

    const interval = setInterval(() => {
      const { currentTime, duration, isPlaying: currentPlaying, isActiveDevice: currentActive } = usePlayerStore.getState();
      if (!currentActive && currentPlaying && duration > 0 && currentTime < duration) {
        usePlayerStore.setState({ currentTime: Math.min(duration, currentTime + 1) });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, isActiveDevice]);

  return <>{children}</>;
}

export interface DeviceSelectorProps {
  variant?: 'icon' | 'pill' | 'mini';
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DeviceSelector({ variant = 'pill', align, className = '' }: DeviceSelectorProps) {
  const { 
    isActiveDevice, 
    activeDeviceId, 
    connectedDeviceId,
    deviceId, 
    connectToDevice,
    disconnectDevice,
    transferPlayback, 
    onlineDevices, 
    remoteDeviceName,
    availableDevicePlaybackStates,
    isTransferring,
    transferringDeviceId,
    toggleDeviceModal,
    setRightPanelMode
  } = usePlayerStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Default alignment: 'left' for 'pill' (so it extends right into view), 'right' for icon/mini
  const effectiveAlign = align || (variant === 'pill' ? 'left' : 'right');

  const alignClass = 
    effectiveAlign === 'left' ? 'left-0 origin-bottom-left' :
    effectiveAlign === 'center' ? 'left-1/2 -translate-x-1/2 origin-bottom' :
    'right-0 origin-bottom-right';

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId || d.id === connectedDeviceId);
  const localDeviceObj = onlineDevices.find((d) => d.id === deviceId);
  const localDeviceName = localDeviceObj?.name || 'This Device';
  const isRemoteConnected = !isActiveDevice && !!connectedDeviceId;
  const activeName = isRemoteConnected 
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') 
    : localDeviceName;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Variant 1: Pill button */}
      {variant === 'pill' && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`px-4 py-3.5 rounded-2xl surface-card border transition-all flex items-center gap-2.5 cursor-pointer font-bold text-xs select-none ${
            isRemoteConnected 
              ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 shadow-lg' 
              : isOpen
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 shadow-md'
              : 'border-white/15 hover:border-emerald-500/50 text-slate-200 hover:text-white bg-white/5'
          } ${className}`}
          title={isRemoteConnected ? `Controlling ${activeName}` : "Connect to a device"}
        >
          <div className="relative flex items-center justify-center">
            <MonitorSmartphone className={`w-4 h-4 ${isRemoteConnected ? 'text-red-400' : 'text-emerald-400'}`} />
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isRemoteConnected ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
          </div>
          <span className="truncate max-w-[120px] font-extrabold">{activeName}</span>
          <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
        </button>
      )}

      {/* Variant 2: Standard Icon button */}
      {variant === 'icon' && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all relative cursor-pointer border select-none ${
            isRemoteConnected 
              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' 
              : isOpen
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg'
              : 'surface-card border-white/10 text-slate-300 hover:text-white hover:border-white/20'
          } ${className}`}
          title={isRemoteConnected ? `Controlling ${activeName}` : "Connect to a device"}
        >
          <MonitorSmartphone className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${isRemoteConnected ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
        </button>
      )}

      {/* Variant 3: Mini icon button for tight bars */}
      {variant === 'mini' && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`p-1.5 rounded-lg transition-all relative cursor-pointer select-none ${
            isRemoteConnected 
              ? 'text-red-400 bg-red-500/10 animate-pulse' 
              : isOpen 
              ? 'text-emerald-400 bg-emerald-500/20'
              : 'text-slate-400 hover:text-emerald-400 hover:bg-white/10'
          } ${className}`}
          title={isRemoteConnected ? `Controlling ${activeName}` : "Connect to a device"}
        >
          <MonitorSmartphone className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${isRemoteConnected ? 'bg-red-500' : 'bg-emerald-400'}`} />
        </button>
      )}

      {/* Popover Dropdown using Unified ConnectPanelContent */}
      {isOpen && (
        <div 
          ref={popoverRef}
          className={`absolute bottom-full mb-3 ${alignClass} w-88 sm:w-96 max-w-[calc(100vw-2rem)] bg-[#111216] backdrop-blur-2xl border border-white/15 rounded-[28px] p-2 shadow-2xl z-[250] animate-in fade-in zoom-in-95 duration-200 text-white select-none overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          <ConnectPanelContent isPanel={true} onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}

