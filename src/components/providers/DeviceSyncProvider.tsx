'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { CommandBus } from '@/lib/connect/CommandBus';
import { DeviceRegistry } from '@/lib/connect/DeviceRegistry';
import { ClockSynchronizer } from '@/lib/connect/ClockSynchronizer';
import { LibrarySyncManager } from '@/lib/sync/LibrarySyncManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { MonitorSmartphone, Laptop, Smartphone, Wifi, Check, ChevronUp, X, Sparkles } from 'lucide-react';
import { TransferManager } from '@/lib/connect/TransferManager';

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
      
      const deviceId = usePlayerStore.getState().deviceId;

      // Initialize Phase 3 Connect Subsystems
      CommandBus.getInstance().init(deviceId, sessionId);
      ConnectManager.getInstance().init(sessionId, deviceId);
      ConnectManager.getInstance().subscribeSession(sessionId);
      
      DeviceRegistry.getInstance().registerDevice(
        navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser',
        'browser',
        'web',
        { audio: true, video: true, connect: true }
      );
      
      ClockSynchronizer.getInstance().synchronize();
      
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

export interface DeviceSelectorProps {
  variant?: 'icon' | 'pill' | 'mini';
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DeviceSelector({ variant = 'pill', align, className = '' }: DeviceSelectorProps) {
  const { 
    isActiveDevice, 
    activeDeviceId, 
    deviceId, 
    transferPlayback, 
    onlineDevices, 
    remoteDeviceName,
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

  const activeDeviceObj = onlineDevices.find((d) => d.id === activeDeviceId);
  const activeName = !isActiveDevice 
    ? (remoteDeviceName || activeDeviceObj?.name || 'Remote Device') 
    : 'This Device';

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
            !isActiveDevice 
              ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 animate-pulse shadow-lg' 
              : isOpen
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400 shadow-md'
              : 'border-white/15 hover:border-emerald-500/50 text-slate-200 hover:text-white bg-white/5'
          } ${className}`}
          title={!isActiveDevice ? `Controlling ${activeName}` : "Connect to a device"}
        >
          <div className="relative flex items-center justify-center">
            <MonitorSmartphone className={`w-4 h-4 ${!isActiveDevice ? 'text-red-400' : 'text-emerald-400'}`} />
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${!isActiveDevice ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
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
            !isActiveDevice 
              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' 
              : isOpen
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-lg'
              : 'surface-card border-white/10 text-slate-300 hover:text-white hover:border-white/20'
          } ${className}`}
          title={!isActiveDevice ? `Controlling ${activeName}` : "Connect to a device"}
        >
          <MonitorSmartphone className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${!isActiveDevice ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
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
            !isActiveDevice 
              ? 'text-red-400 bg-red-500/10 animate-pulse' 
              : isOpen 
              ? 'text-emerald-400 bg-emerald-500/20'
              : 'text-slate-400 hover:text-emerald-400 hover:bg-white/10'
          } ${className}`}
          title={!isActiveDevice ? `Controlling ${activeName}` : "Connect to a device"}
        >
          <MonitorSmartphone className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${!isActiveDevice ? 'bg-red-500' : 'bg-emerald-400'}`} />
        </button>
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div 
          ref={popoverRef}
          className={`absolute bottom-full mb-3 ${alignClass} w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-[#121214]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-2xl z-[250] animate-in fade-in zoom-in-95 duration-200 text-white select-none`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wifi className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Connect to a Device</h4>
                <p className="text-[10px] text-slate-400 font-medium">RaagaX Cross-Device Audio Sync</p>
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
          <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar pr-0.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
              Current & Available Devices
            </div>

            {/* This Device */}
            <button 
              onClick={() => {
                if (!isActiveDevice) transferPlayback(deviceId);
                setIsOpen(false);
              }}
              className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all border ${
                isActiveDevice 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm' 
                  : 'bg-white/5 border-transparent hover:bg-white/10 text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg ${isActiveDevice ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                  <Laptop className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold truncate">This Device</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 font-mono">Web</span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {isActiveDevice ? 'Listening on this device' : 'Click to transfer playback here'}
                  </p>
                </div>
              </div>
              {isActiveDevice && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Check className="w-4 h-4 ml-1" />
                </div>
              )}
            </button>

            {/* Other Online Devices */}
            {onlineDevices.filter(d => d.id !== deviceId).map((device) => {
              const isActive = activeDeviceId === device.id;
              const isMobile = device.name.toLowerCase().includes('mobile') || device.name.toLowerCase().includes('phone');
              return (
                <button
                  key={device.id}
                  onClick={() => {
                    transferPlayback(device.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all border ${
                    isActive 
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                      : 'bg-white/5 border-transparent hover:bg-white/10 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                      {isMobile ? <Smartphone className="w-4 h-4" /> : <MonitorSmartphone className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-extrabold truncate block">{device.name}</span>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {isActive ? 'Listening on this device' : 'Click to switch audio'}
                      </p>
                    </div>
                  </div>
                  {isActive ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 hover:text-white">Switch</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                setIsOpen(false);
                toggleDeviceModal();
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fa233b]" /> Device Manager
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setRightPanelMode('devices');
              }}
              className="py-2 px-3 rounded-xl surface-card border border-white/10 hover:border-white/30 text-slate-300 hover:text-white font-extrabold text-[11px] transition-colors"
              title="Open right device panel"
            >
              Panel ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
