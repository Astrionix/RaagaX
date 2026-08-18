'use client';

import React from 'react';
import {
  Disc3,
  Settings,
  User,
  LogIn,
  Search,
  Bell,
  WifiOff,
  MonitorSmartphone,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useThemeStore } from '@/context/useThemeStore';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';
import { NetworkManager } from '@/lib/offline/NetworkManager';

export function Header() {
  const [mounted, setMounted] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  React.useEffect(() => {
    setMounted(true);
    const unsub = NetworkManager.getInstance().subscribe((mode) => {
      setIsOnline(mode === 'online');
    });
    return () => unsub();
  }, []);

  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    toggleSettingsModal,
    toggleDeviceModal,
    activeDeviceId,
    deviceId,
  } = usePlayerStore();

  const isConnectedRemote = Boolean(activeDeviceId && activeDeviceId !== deviceId);

  const { user, setAuthModalOpen } = useAuthStore();
  const { resolvedTheme } = useThemeStore();

  return (
    <>
      {/* Mobile Top Header (md:hidden) */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 px-4 flex items-center justify-between bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border-subtle)] text-[var(--text-primary)] select-none h-[3rem] shadow-sm">
        <div className="flex items-center gap-2">
          <RaagaXLogo variant="full" size={24} />
          <RaagaXWordmark size="sm" />
        </div>

        <div className="flex items-center gap-1.5">
          {mounted && !isOnline && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold tracking-wide animate-pulse">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}

          {/* Connect to My Device Button */}
          <button
            onClick={toggleDeviceModal}
            aria-label="Connect to My Device"
            className={`p-1.5 rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
              isConnectedRemote
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/10 border-white/5 bg-white/5'
            }`}
            title="Connect to My Device"
          >
            <MonitorSmartphone className="w-4 h-4" />
            {isConnectedRemote && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              import('@/context/useNotificationStore').then(({ useNotificationStore }) => {
                useNotificationStore.getState().toggleOpen();
              });
            }}
            aria-label="Notifications"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#E50914] rounded-full" />
          </button>
        </div>
      </header>
    </>
  );
}
