'use client';

import React from 'react';
import {
  Home,
  Flame,
  Search,
  User,
  ListMusic,
  Plus,
  Heart,
  LogOut,
  LogIn,
  Settings,
  Disc3,
  BarChart3,
  Clock,
  Download,
  ChevronRight,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { TopRightUpdateBadge } from '@/components/common/TopRightUpdateBadge';

export function Sidebar() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    setSelectedPlaylistId,
    selectedPlaylistId,
    setCreatePlaylistModalOpen,
    toggleGetAppModal,
  } = usePlayerStore();

  const { user, signOut, setAuthModalOpen } = useAuthStore();
  const { playlists: userPlaylists, fetchPlaylists } = usePlaylistStore();

  React.useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user, fetchPlaylists]);

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="hidden md:flex fixed left-3 top-3 bottom-3 z-30 w-[240px] select-none flex-col justify-between rounded-2xl bg-[var(--sidebar-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-200 text-[var(--text-secondary)]"
    >
      {/* ── TOP HEADER & BRAND ────────────────────────────────────────────── */}
      <div className="p-3 pb-2 flex-shrink-0 border-b border-[var(--border-subtle)]">
        {/* Brand Header & Update Badge */}
        <div className="flex items-center justify-between px-2 py-1.5 select-none">
          <div
            onClick={() => {
              usePlayerStore.getState().setSelectedAlbumId(null);
              usePlayerStore.getState().setSelectedArtistId(null);
              usePlayerStore.getState().setSelectedPlaylistId(null);
              setActiveTab('home');
            }}
            className="cursor-pointer group transition-colors"
            title="RaagaX — Music Beyond Limits"
          >
            <span className="font-black text-[23px] tracking-tight text-[var(--text-primary)] transition-colors">
              Raaga<span className="text-[#FA233B] drop-shadow-[0_0_14px_rgba(250,35,59,0.55)]">X</span>
            </span>
          </div>

          <TopRightUpdateBadge />
        </div>

        {/* Integrated Quick Search Input */}
        <div className="relative mt-2 px-1">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="sidebar-search-input"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="raagax-sidebar-search-query"
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
            placeholder="Search"
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-subtle)] focus:border-[#FA233B]/60 focus:outline-none transition-all font-medium"
          />
        </div>
      </div>

      {/* ── MIDDLE SCROLLABLE NAVIGATION ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-4 sidebar-scrollbar">
        {/* 1. PRIMARY NAVIGATION */}
        <div className="space-y-0.5">
          <button
            onClick={() => {
              usePlayerStore.getState().setSelectedAlbumId(null);
              usePlayerStore.getState().setSelectedArtistId(null);
              usePlayerStore.getState().setSelectedPlaylistId(null);
              setActiveTab('home');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'home'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <Home className={`w-4 h-4 flex-shrink-0 ${activeTab === 'home' ? 'text-[#FA233B]' : 'text-[var(--text-muted)]'}`} />
            <span>Home</span>
          </button>

          <button
            onClick={() => {
              usePlayerStore.getState().setSelectedAlbumId(null);
              usePlayerStore.getState().setSelectedArtistId(null);
              usePlayerStore.getState().setSelectedPlaylistId(null);
              setActiveTab('new');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'new'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <Flame className={`w-4 h-4 flex-shrink-0 ${activeTab === 'new' ? 'text-[#FA233B]' : 'text-[var(--text-muted)]'}`} />
            <span>New</span>
          </button>
        </div>

        {/* 2. LIBRARY SECTION */}
        <div className="space-y-0.5">
          <span className="px-2.5 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
            LIBRARY
          </span>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <Heart className={`w-4 h-4 flex-shrink-0 ${activeTab === 'favorites' ? 'text-[#FA233B]' : 'text-[var(--text-muted)]'}`} />
            <span>Liked Songs</span>
          </button>

          <button
            onClick={() => {
              usePlayerStore.getState().setSelectedAlbumId(null);
              setActiveTab('album');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'album' && !usePlayerStore.getState().selectedAlbumId
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <Disc3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'album' ? 'text-[#FA233B]' : 'text-[var(--text-muted)]'}`} />
            <span>Albums</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'history' ? 'text-[#FA233B]' : 'text-[var(--text-muted)]'}`} />
            <span>Listening History</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'insights'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <BarChart3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'insights' ? 'text-[#FA233B]' : 'text-[var(--text-muted)]'}`} />
            <span>Music Insights</span>
          </button>
        </div>

        {/* 3. PLAYLISTS SECTION */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>YOUR PLAYLISTS</span>
            <button
              onClick={() => setCreatePlaylistModalOpen(true)}
              className="p-1 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Create Playlist"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {userPlaylists.length > 0 ? (
            <div className="space-y-0.5">
              {userPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => {
                    setSelectedPlaylistId(pl.id);
                    setActiveTab('playlist');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    selectedPlaylistId === pl.id && activeTab === 'playlist'
                      ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] font-medium'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate text-xs">{pl.title || (pl as any).name || 'Untitled Playlist'}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setCreatePlaylistModalOpen(true)}
              className="w-full flex flex-col items-center justify-center py-2.5 px-3 rounded-xl bg-[var(--bg-surface)]/50 border border-dashed border-[var(--border-subtle)] hover:border-[#FA233B]/40 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-center cursor-pointer transition-all group"
            >
              <Plus className="w-3.5 h-3.5 mx-auto mb-0.5 text-[var(--text-muted)] group-hover:text-[#FA233B] transition-colors" />
              <span className="text-[11px] font-medium block">Create a playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* ── INSTALL APP PROMO BUTTON ── */}
      <div className="px-2.5 pb-2 flex-shrink-0">
        <button
          onClick={() => toggleGetAppModal(true)}
          className="w-full group relative flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-[#FA233B]/10 via-rose-500/10 to-[#FA233B]/15 hover:from-[#FA233B]/20 hover:to-[#FA233B]/25 border border-[#FA233B]/20 hover:border-[#FA233B]/45 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(250,35,59,0.15)]"
          title="Install RaagaX for Windows, Mac & Android"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#FA233B]/20 text-[#FA233B] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)] group-hover:text-[#FA233B] transition-colors leading-tight truncate flex items-center gap-1.5">
                Install App
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </p>
              <p className="text-[9px] text-[var(--text-muted)] truncate leading-tight">Mac, Windows & APK</p>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[#FA233B] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </button>
      </div>

      {/* ── BOTTOM PIN: USER ACCOUNT / SETTINGS ────────────────────────────── */}
      <div className="p-2.5 flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/40">
        {mounted && user ? (
          <div
            onClick={() => setActiveTab('settings')}
            className={`flex items-center justify-between p-1.5 rounded-xl border transition-all cursor-pointer group ${
              activeTab === 'settings'
                ? 'bg-[#FA233B]/15 border-[#FA233B]/30 text-[var(--text-primary)] shadow-sm'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[#FA233B]/30 hover:bg-[var(--bg-elevated)]'
            }`}
            title="Account & Settings"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FA233B] to-[#FF4757] text-white font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate leading-tight group-hover:text-[#FA233B] transition-colors">
                  {user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'RaagaX User'}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] truncate leading-tight mt-0.5">Account & Settings</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                signOut();
              }}
              className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded-md hover:bg-[var(--bg-surface)] transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#FA233B]/15 hover:bg-[#FA233B]/25 text-[#FA233B] font-semibold text-xs transition-colors border border-[#FA233B]/20 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`p-1.5 rounded-lg border border-[var(--border-subtle)] transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'text-white bg-[#FA233B]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]'
              }`}
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
