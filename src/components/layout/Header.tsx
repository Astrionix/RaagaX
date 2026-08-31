'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  WifiOff,
  Radio,
  User,
  X,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { useThemeStore } from '@/context/useThemeStore';
import { useNotificationStore } from '@/context/useNotificationStore';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';
import { NetworkManager } from '@/lib/offline/NetworkManager';
import { ProfileMenuModal } from '@/components/modals/ProfileMenuModal';
import { NavigationStack } from '@/lib/navigation/NavigationStack';

export function Header() {
  const [mounted, setMounted] = React.useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [canGoForward, setCanGoForward] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  React.useEffect(() => {
    setMounted(true);
    const unsubNet = NetworkManager.getInstance().subscribe((mode) => {
      setIsOnline(mode === 'online');
    });

    const updateNavState = () => {
      setCanGoBack(NavigationStack.getInstance().canGoBack());
      setCanGoForward(NavigationStack.getInstance().canGoForward());
    };
    updateNavState();
    const unsubNav = NavigationStack.getInstance().subscribe(updateNavState);

    return () => {
      unsubNet();
      unsubNav();
    };
  }, []);

  const {
    activeTab,
    selectedArtistId,
    setActiveTab,
    setSelectedAlbumId,
    setSelectedArtistId,
    setSelectedPlaylistId,
    togglePlayerExpanded,
    searchQuery,
    setSearchQuery,
  } = usePlayerStore();

  const toggleNotificationCenter = useNotificationStore((s) => s.setOpen);

  const { user } = useAuthStore();

  const handleApplyNavState = (target: any) => {
    if (target.selectedAlbumId) setSelectedAlbumId(target.selectedAlbumId);
    else setSelectedAlbumId(null);

    if (target.selectedArtistId) setSelectedArtistId(target.selectedArtistId);
    else setSelectedArtistId(null);

    if (target.selectedPlaylistId) setSelectedPlaylistId(target.selectedPlaylistId);
    else setSelectedPlaylistId(null);

    setActiveTab(target.activeTab);
    if (typeof target.isPlayerExpanded === 'boolean') {
      togglePlayerExpanded(target.isPlayerExpanded);
    }
  };

  const handleBack = () => {
    NavigationStack.getInstance().goBack(handleApplyNavState);
  };

  const handleForward = () => {
    NavigationStack.getInstance().goForward(handleApplyNavState);
  };

  return (
    <>
      {/* ── 1. Mobile Top Header (< 768px) ── */}
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

          {/* Remote Jam Party Button */}
          <button
            onClick={() => {
              import('@/context/useJamStore').then((m) => m.useJamStore.getState().toggleJamModal(true));
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#FA233B]/10 hover:bg-[#FA233B]/20 border border-[#FA233B]/20 text-[#FA233B] text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex-shrink-0"
            title="Remote Jam Party"
            aria-label="Remote Jam Party"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-[10px]">Jam</span>
          </button>

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

      {/* ── 2. Desktop & iPad Desktop-Class Top Bar (>= 768px) ── */}
      <header className="hidden md:flex sticky top-0 z-30 w-full h-14 px-6 items-center justify-between bg-[var(--bg-primary)]/85 backdrop-blur-2xl border-b border-white/[0.05] select-none text-[var(--text-primary)] flex-shrink-0">
        {/* Left: History Navigation Buttons & Desktop Search Bar */}
        <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xl">
          {/* Back & Forward Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canGoBack
                  ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white cursor-pointer active:scale-90 shadow-sm'
                  : 'bg-white/[0.03] text-zinc-600 cursor-not-allowed opacity-50'
              }`}
              title="Go Back"
              aria-label="Go Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleForward}
              disabled={!canGoForward}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canGoForward
                  ? 'bg-white/[0.08] hover:bg-white/[0.15] text-white cursor-pointer active:scale-90 shadow-sm'
                  : 'bg-white/[0.03] text-zinc-600 cursor-not-allowed opacity-50'
              }`}
              title="Go Forward"
              aria-label="Go Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop & Tablet Integrated Search Bar */}
          <div className="relative flex-1 min-w-[180px] max-w-md group">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-[#FA233B] transition-colors" />
            <input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={searchQuery}
              onFocus={() => {
                if (activeTab !== 'search') {
                  setActiveTab('search');
                }
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'search') {
                  setActiveTab('search');
                }
              }}
              placeholder="Search songs, albums, artists, podcasts..."
              className="w-full pl-9 pr-8 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.09] text-xs text-white placeholder:text-zinc-500 border border-white/[0.08] focus:border-[#FA233B]/60 focus:bg-black/60 focus:outline-none transition-all shadow-inner font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Remote Jam, Offline State, Notifications & Profile Menu */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {mounted && !isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold tracking-wide animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode</span>
            </div>
          )}

          {/* Remote Jam Party Button */}
          <button
            onClick={() => {
              import('@/context/useJamStore').then((m) => m.useJamStore.getState().toggleJamModal(true));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FA233B]/10 hover:bg-[#FA233B]/20 border border-[#FA233B]/30 text-[#FA233B] text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Remote Jam Party"
            aria-label="Remote Jam Party"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Jam Party</span>
          </button>

          {/* Notifications Center Bell */}
          <button
            onClick={() => toggleNotificationCenter(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-90 border border-white/[0.08]"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Profile Menu Trigger */}
          <button
            onClick={() => setIsProfileMenuOpen(true)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] transition-all cursor-pointer active:scale-95"
            title="Account & Profile"
            aria-label="Account & Profile"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-white/10 flex items-center justify-center text-white font-bold text-[10px]">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>
                  {user?.user_metadata?.full_name 
                    ? user.user_metadata.full_name[0].toUpperCase() 
                    : (user?.email ? user.email[0].toUpperCase() : '👤')}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-zinc-200 max-w-[100px] truncate hidden lg:inline">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Listener'}
            </span>
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
