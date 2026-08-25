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
  Sparkles,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useThemeStore } from '@/context/useThemeStore';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';
import { NetworkManager } from '@/lib/offline/NetworkManager';
import { ProfileMenuModal } from '@/components/modals/ProfileMenuModal';

export function Header() {
  const [mounted, setMounted] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
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
  } = usePlayerStore();

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

        <div className="flex items-center gap-2">
          {mounted && !isOnline && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold tracking-wide animate-pulse">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}

          {/* Profile Avatar on Top Right -> Opens Profile Menu Drawer */}
          <button
            onClick={() => setIsProfileMenuOpen(true)}
            className="w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-white/10 hover:border-white/40 transition-all flex items-center justify-center text-white font-bold text-xs shadow-sm cursor-pointer active:scale-95 flex-shrink-0"
            title="Account & Menu"
            aria-label="Account & Menu"
          >
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span>
                {user?.user_metadata?.full_name 
                  ? user.user_metadata.full_name[0].toUpperCase() 
                  : (user?.email ? user.email[0].toUpperCase() : '👤')}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Profile & Account Drawer Modal */}
      <ProfileMenuModal
        isOpen={isProfileMenuOpen}
        onClose={() => setIsProfileMenuOpen(false)}
      />
    </>
  );
}
