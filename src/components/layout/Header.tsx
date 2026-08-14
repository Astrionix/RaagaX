'use client';

import React from 'react';
import {
  Disc3,
  Settings,
  User,
  LogIn,
  Search,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useThemeStore } from '@/context/useThemeStore';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';

export function Header() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    toggleSettingsModal,
  } = usePlayerStore();

  const { user, setAuthModalOpen } = useAuthStore();
  const { resolvedTheme } = useThemeStore();

  return (
    <>
      {/* Mobile Top Header (md:hidden) */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 px-4 flex items-center justify-between bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border-subtle)] text-[var(--text-primary)] select-none pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))] shadow-md">
        <div className="flex items-center gap-2">
          <RaagaXLogo variant="full" size={28} />
          <RaagaXWordmark size="sm" />
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={usePlayerStore.getState().toggleDeviceModal}
            className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Connect to Device"
          >
            <Disc3 className="w-5 h-5 text-indigo-400" />
          </button>

          <button 
            onClick={() => {
              if (user) {
                setActiveTab('profile');
              } else {
                setAuthModalOpen(true);
              }
            }} 
            className="p-1.5 text-slate-300 hover:text-white" 
            title="Profile"
          >
            {mounted && user ? (
              <div className="w-6 h-6 rounded-full bg-[#fa233b] text-white text-[10px] font-bold flex items-center justify-center">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            ) : (
              <LogIn className="w-4 h-4" />
            )}
          </button>
          <button onClick={() => setActiveTab('settings')} className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>


    </>
  );
}
