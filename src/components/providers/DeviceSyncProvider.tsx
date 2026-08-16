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

      {/* Popover Dropdown */}
      {isOpen && (
        <div 
          ref={popoverRef}
          className={`absolute bottom-full mb-3 ${alignClass} w-80 max-w-[calc(100vw-2rem)] bg-[#121214]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-2xl z-[250] animate-in fade-in zoom-in-95 duration-200 text-white select-none`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wifi className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Devices</h4>
                <p className="text-[10px] text-slate-400 font-medium">Automatic Discovery · Explicit Connect</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current & Available Devices */}
          <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar pr-0.5">
            {/* SECTION 1: NOW PLAYING */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1a1b24] via-[#12131a] to-[#0d0e14] border border-emerald-500/30 space-y-2.5 shadow-lg shadow-emerald-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md flex-shrink-0">
                    <MonitorSmartphone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white truncate">{activeName}</span>
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    </div>
                    <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{isRemoteConnected ? `Playing on ${activeName}` : 'Playing now'}</span>
                    </div>
                  </div>
                </div>

                {isRemoteConnected ? (
                  <button
                    onClick={() => disconnectDevice()}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all active:scale-95"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div className="flex items-end gap-0.5 h-4 px-2 py-0.5 bg-white/10 rounded-full flex-shrink-0">
                    <span className="w-0.5 h-4 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-pulse delay-75" />
                    <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: YOUR DEVICES */}
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 px-1">
                YOUR DEVICES
              </span>
              <div className="space-y-1.5">
                {/* Local device if connected remotely */}
                {isRemoteConnected && (
                  <div 
                    onClick={() => {
                      transferPlayback(deviceId);
                      setIsOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/30 flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MonitorSmartphone className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate group-hover:text-emerald-300">{localDeviceName}</span>
                        <span className="text-[10px] text-emerald-400">Available</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-emerald-400 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
                      Play here
                    </span>
                  </div>
                )}

                {/* Other Discovered Online Devices */}
                {onlineDevices
                  .filter(d => d.id !== (isRemoteConnected ? connectedDeviceId : deviceId))
                  .map(d => (
                    <div 
                      key={d.id}
                      onClick={() => {
                        transferPlayback(d.id);
                        setIsOpen(false);
                      }}
                      className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/30 flex items-center justify-between cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MonitorSmartphone className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate group-hover:text-emerald-300">{d.name}</span>
                          <span className="text-[10px] text-emerald-400">Ready</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-emerald-400 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
                        Transfer
                      </span>
                    </div>
                  ))}

                {onlineDevices.filter(d => d.id !== deviceId).length === 0 && !isRemoteConnected && (
                  <div className="py-4 px-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-0.5">
                    <p className="text-[11px] font-bold text-white/60">No other devices detected</p>
                    <p className="text-[9px] text-white/40">Open RaagaX on another device with your account to connect.</p>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: AUDIO DEVICES */}
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 px-1">
                AUDIO DEVICES
              </span>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Headphones className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">Bluetooth / Audio Route</span>
                    <span className="text-[10px] text-slate-400">Connected</span>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Audio Output
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
