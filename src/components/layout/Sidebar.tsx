'use client';

import React from 'react';
import {
  Home,
  Flame,
  Radio,
  Compass,
  Search,
  User,
  Music,
  ListMusic,
  Plus,
  Download,
  Heart,
  LogOut,
  LogIn,
  Settings,
  Disc3,
  WifiOff,
  Bell,
  BarChart3,
  Clock,
  MonitorSmartphone,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { useThemeStore } from '@/context/useThemeStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';
import { RaagaXWordmark } from '@/components/brand/RaagaXWordmark';

export function Sidebar() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { isOfflineMode, setOfflineMode } = useDownloadStore();
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    setSelectedPlaylistId,
    selectedPlaylistId,
    setCreatePlaylistModalOpen,
    toggleSettingsModal,
    toggleDeviceModal,
    activeDeviceId,
    deviceId,
    downloadedSongIds = [],
  } = usePlayerStore();

  const isConnectedRemote = Boolean(activeDeviceId && activeDeviceId !== deviceId);

  const { user, signOut, setAuthModalOpen } = useAuthStore();
  const { playlists: userPlaylists, fetchPlaylists } = usePlaylistStore();
  const { resolvedTheme } = useThemeStore();

  React.useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user, fetchPlaylists]);

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-20 z-30 w-64 p-4 pb-6 flex-col justify-between select-none bg-[var(--sidebar-bg)] backdrop-blur-3xl border-r border-[var(--border-subtle)] text-[var(--text-primary)] text-xs transition-colors duration-200">
      <div className="space-y-5 overflow-y-auto no-scrollbar pr-1">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <div className="flex items-center gap-3">
            <RaagaXLogo variant="full" size={36} />
            <RaagaXWordmark size="md" subEdition="Studio Edition" />
          </div>
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
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#E50914] rounded-full" />
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative px-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() !== '') {
                setActiveTab('search');
              }
            }}
            placeholder="Search music..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 text-xs text-white placeholder:text-slate-500 border border-white/10 focus:border-[#fa233b] focus:bg-black/50 focus:outline-none transition-all font-medium"
          />
        </div>

        {/* Core Navigation */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'home' ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'new' ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Flame className="w-4 h-4" />
            <span>New</span>
          </button>

          <button
            onClick={() => setActiveTab('radio')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'radio' ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Radio className="w-4 h-4" />
            <span>Radio</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'search' ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
        </div>

        {/* YOUR LIBRARY */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <span className="px-3 py-1 text-[10px] font-black text-slate-500 uppercase tracking-widest block">YOUR LIBRARY</span>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'favorites' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Heart className="w-4 h-4 text-red-400" />
            <span>Liked Songs</span>
          </button>

          <button
            onClick={() => setActiveTab('downloads')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'downloads' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Downloaded</span>
            </div>
            {downloadedSongIds && downloadedSongIds.length > 0 && (
              <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
                {downloadedSongIds.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              usePlayerStore.getState().setSelectedAlbumId(null);
              setActiveTab('album');
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'album' && !usePlayerStore.getState().selectedAlbumId
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm'
                : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Disc3 className="w-4 h-4 text-purple-400" />
            <span>Albums</span>
          </button>

          <button
            onClick={() => setActiveTab('artist')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'artist' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
            }`}
          >
            <User className="w-4 h-4 text-blue-400" />
            <span>Artists</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${activeTab === 'history' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Listening History</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${activeTab === 'insights' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm' : 'text-slate-400 hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Music Insights</span>
          </button>
        </div>

        {/* YOUR PLAYLISTS */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between px-3 py-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>YOUR PLAYLISTS</span>
            <button
              onClick={() => setCreatePlaylistModalOpen(true)}
              className="hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400"
              title="Create Playlist"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* User Custom Playlists Only */}
          {userPlaylists.length > 0 ? (
            userPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setActiveTab('playlist');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${selectedPlaylistId === pl.id && activeTab === 'playlist' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <div className="w-6 h-6 rounded-lg bg-[#fa233b]/15 text-[#fa233b] flex items-center justify-center flex-shrink-0">
                  <Music className="w-3.5 h-3.5" />
                </div>
                <div className="truncate min-w-0">
                  <p className="truncate leading-tight text-xs font-medium">{pl.title}</p>
                </div>
              </button>
            ))
          ) : (
            <div
              onClick={() => setCreatePlaylistModalOpen(true)}
              className="px-3 py-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 hover:border-[#fa233b]/40 text-slate-500 hover:text-slate-300 text-center cursor-pointer transition-all group"
            >
              <Plus className="w-3.5 h-3.5 mx-auto mb-1 text-slate-500 group-hover:text-[#fa233b] transition-colors" />
              <span className="text-[11px] font-medium block">Create a playlist</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Pins: Connect Device, Settings & Profile */}
      <div className="pt-3 border-t border-white/5 space-y-2">
        {/* Connect to My Device Button */}
        <button
          onClick={toggleDeviceModal}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${isConnectedRemote
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
            }`}
          title="Connect to My Device (Cast & Sync)"
        >
          <div className="flex items-center gap-2.5">
            <MonitorSmartphone className={`w-4 h-4 ${isConnectedRemote ? 'text-emerald-400 animate-pulse' : 'text-[#fa233b]'}`} />
            <span>Connect Device</span>
          </div>
          {isConnectedRemote ? (
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">Active</span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">Cast</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-xs ${activeTab === 'settings'
              ? 'bg-gradient-to-r from-[#fa233b] to-[#d91c2e] text-white shadow-lg shadow-red-500/25 border border-red-500/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
        >
          <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
          <span>Settings</span>
        </button>

        <div className="pt-1">
          {mounted && user ? (
            <div className="flex items-center justify-between p-2 rounded-2xl bg-white/5 border border-white/5">
              <div
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-xl bg-[#fa233b] text-white font-black text-xs flex items-center justify-center shadow-md flex-shrink-0">
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white truncate leading-tight">
                    {user.user_metadata?.name || user.email?.split('@')[0] || 'RaagaX User'}
                  </h4>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#fa233b]/10 hover:bg-[#fa233b]/20 text-[#fa233b] font-bold text-xs transition-colors border border-[#fa233b]/20"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
