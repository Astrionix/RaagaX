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
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { RaagaXLogo } from '@/components/brand/RaagaXLogo';

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
      className="hidden md:flex fixed left-3 top-3 bottom-3 z-30 w-[240px] select-none flex-col justify-between rounded-2xl bg-[#121316]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-200 text-zinc-300"
    >
      {/* ── TOP HEADER & BRAND ────────────────────────────────────────────── */}
      <div className="p-3 pb-2 flex-shrink-0 border-b border-white/[0.04]">
        {/* Brand Logo */}
        <div
          onClick={() => {
            usePlayerStore.getState().setSelectedAlbumId(null);
            usePlayerStore.getState().setSelectedArtistId(null);
            usePlayerStore.getState().setSelectedPlaylistId(null);
            setActiveTab('home');
          }}
          className="flex items-center gap-2.5 px-2 py-1 cursor-pointer group rounded-lg hover:bg-white/[0.04] transition-colors"
          title="RaagaX — Music Beyond Limits"
        >
          <RaagaXLogo size={22} variant="monochrome-red" />
          <span className="font-bold text-[15px] tracking-tight text-white group-hover:text-[#FA233B] transition-colors">
            RaagaX
          </span>
        </div>

        {/* Integrated Quick Search Input */}
        <div className="relative mt-2 px-1">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 border border-white/[0.06] focus:border-[#FA233B]/60 focus:bg-black/50 focus:outline-none transition-all font-medium"
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
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <Home className={`w-4 h-4 flex-shrink-0 ${activeTab === 'home' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
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
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <Flame className={`w-4 h-4 flex-shrink-0 ${activeTab === 'new' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
            <span>New</span>
          </button>
        </div>

        {/* 2. LIBRARY SECTION */}
        <div className="space-y-0.5">
          <span className="px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
            LIBRARY
          </span>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'favorites'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <Heart className={`w-4 h-4 flex-shrink-0 ${activeTab === 'favorites' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
            <span>Liked Songs</span>
          </button>

          <button
            onClick={() => {
              usePlayerStore.getState().setSelectedArtistId(null);
              setActiveTab('artist');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'artist' && !usePlayerStore.getState().selectedArtistId
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <User className={`w-4 h-4 flex-shrink-0 ${activeTab === 'artist' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
            <span>Artists</span>
          </button>

          <button
            onClick={() => {
              usePlayerStore.getState().setSelectedAlbumId(null);
              setActiveTab('album');
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'album' && !usePlayerStore.getState().selectedAlbumId
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <Disc3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'album' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
            <span>Albums</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'history' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
            <span>Listening History</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              activeTab === 'insights'
                ? 'bg-[#FA233B]/15 text-[#FA233B] font-semibold'
                : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
            }`}
          >
            <BarChart3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'insights' ? 'text-[#FA233B]' : 'text-zinc-400'}`} />
            <span>Music Insights</span>
          </button>
        </div>

        {/* 3. PLAYLISTS SECTION */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>YOUR PLAYLISTS</span>
            <button
              onClick={() => setCreatePlaylistModalOpen(true)}
              className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
                      : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 font-medium'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate text-xs">{pl.title || (pl as any).name || 'Untitled Playlist'}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setCreatePlaylistModalOpen(true)}
              className="w-full flex flex-col items-center justify-center py-2.5 px-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 hover:border-[#FA233B]/40 text-zinc-500 hover:text-zinc-300 text-center cursor-pointer transition-all group"
            >
              <Plus className="w-3.5 h-3.5 mx-auto mb-0.5 text-zinc-500 group-hover:text-[#FA233B] transition-colors" />
              <span className="text-[11px] font-medium block">Create a playlist</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BOTTOM PIN: USER ACCOUNT / SETTINGS ────────────────────────────── */}
      <div className="p-2.5 flex-shrink-0 border-t border-white/[0.06] bg-white/[0.02]">
        {mounted && user ? (
          <div
            onClick={() => setActiveTab('settings')}
            className={`flex items-center justify-between p-1.5 rounded-xl border transition-all cursor-pointer group ${
              activeTab === 'settings'
                ? 'bg-[#FA233B]/15 border-[#FA233B]/30 text-white shadow-sm'
                : 'bg-white/[0.03] border-white/[0.06] hover:border-white/10 hover:bg-white/[0.06]'
            }`}
            title="Account & Settings"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FA233B] to-[#FF4757] text-white font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-200 truncate leading-tight group-hover:text-white transition-colors">
                  {user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'RaagaX User'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate leading-tight mt-0.5">Account & Settings</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                signOut();
              }}
              className="p-1 text-zinc-400 hover:text-red-400 rounded-md hover:bg-white/10 transition-colors"
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
              className={`p-1.5 rounded-lg border border-white/5 transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'text-white bg-[#FA233B]'
                  : 'text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10'
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
