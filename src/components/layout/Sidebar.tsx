'use client';

import React from 'react';
import {
  Home,
  Compass,
  Search,
  User,
  Disc,
  Music,
  ListMusic,
  Plus,
  Download,
  Heart, 
  LogOut, 
  LogIn,
  Settings,
  Disc3,
  WifiOff
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';

export function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    setSelectedPlaylistId,
    selectedPlaylistId,
    setCreatePlaylistModalOpen,
    toggleSettingsModal
  } = usePlayerStore();
  
  const { user, signOut, setAuthModalOpen } = useAuthStore();
  const { playlists: userPlaylists, fetchPlaylists } = usePlaylistStore();

  React.useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user, fetchPlaylists]);

  // Valid JioSaavn curated playlists
  const staticPlaylists = [
    { id: '150750109', name: 'Favourites Mix', desc: 'RaagaX Mix', icon: Heart },
    { id: '169673226', name: 'Chill Hits', desc: 'RaagaX Chill' },
    { id: '767984632', name: 'Workout', desc: 'RaagaX Fitness' },
    { id: '1170578801', name: "90's Hits", desc: "RaagaX 90's" },
    { id: '384435110', name: 'Love Songs', desc: 'Romance' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-20 z-30 w-64 p-4 pb-6 flex-col justify-between select-none bg-[#0a0c12] border-r border-white/5 text-white text-xs">
      <div className="space-y-5 overflow-y-auto no-scrollbar pr-1">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-2 pt-1 pb-2">
          <div className="w-8 h-8 rounded-xl bg-[#fa233b] flex items-center justify-center shadow-lg shadow-red-500/20">
            <Disc3 className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-white">RAAGAX</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Studio Edition</p>
          </div>
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
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 text-xs text-white placeholder:text-slate-500 border border-white/5 focus:border-[#fa233b] focus:bg-black/40 focus:outline-none transition-all font-medium"
          />
        </div>

        {/* Core Navigation */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === 'home' ? 'bg-[#fa233b] text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('browse')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === 'browse' ? 'bg-[#fa233b] text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Browse</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === 'search' ? 'bg-[#fa233b] text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
              activeTab === 'favorites' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4 text-red-400" />
            <span>Liked Songs</span>
          </button>



          <button 
            onClick={() => setActiveTab('album')} 
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'album' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Disc className="w-4 h-4 text-amber-400" />
            <span>Albums</span>
          </button>

          <button 
            onClick={() => setActiveTab('artist')} 
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'artist' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <User className="w-4 h-4 text-blue-400" />
            <span>Artists</span>
          </button>

          <button 
            onClick={() => setActiveTab('downloads')} 
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'downloads' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Downloads</span>
          </button>
          
          <button 
            onClick={() => {
              const store = require('@/context/useDownloadStore').useDownloadStore.getState();
              store.setOfflineMode(!store.isOfflineMode);
            }} 
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all ${
              require('@/context/useDownloadStore').useDownloadStore().isOfflineMode ? 'bg-[#fa233b]/10 text-[#fa233b] font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <WifiOff className="w-4 h-4" />
            <span>Offline Mode</span>
            <div className={`ml-auto w-8 h-4 rounded-full relative transition-colors ${require('@/context/useDownloadStore').useDownloadStore().isOfflineMode ? 'bg-[#fa233b]' : 'bg-slate-700'}`}>
               <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-transform ${require('@/context/useDownloadStore').useDownloadStore().isOfflineMode ? 'left-[18px]' : 'left-0.5'}`} />
            </div>
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

          {/* User Custom Playlists */}
          {userPlaylists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => {
                setSelectedPlaylistId(pl.id);
                setActiveTab('playlist');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                selectedPlaylistId === pl.id && activeTab === 'playlist' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-[#fa233b]/15 text-[#fa233b] flex items-center justify-center flex-shrink-0">
                <Music className="w-3.5 h-3.5" />
              </div>
              <div className="truncate min-w-0">
                <p className="truncate leading-tight text-xs font-medium">{pl.title}</p>
              </div>
            </button>
          ))}

          {/* Global Curated Playlists */}
          {staticPlaylists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => {
                setSelectedPlaylistId(pl.id);
                setActiveTab('playlist');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                selectedPlaylistId === pl.id && activeTab === 'playlist' ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-white/5 text-slate-400 flex items-center justify-center flex-shrink-0">
                {pl.icon ? <pl.icon className="w-3.5 h-3.5 text-red-400" /> : <Music className="w-3.5 h-3.5" />}
              </div>
              <div className="truncate min-w-0">
                <p className="truncate leading-tight text-xs font-medium">{pl.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Pins: Settings & Profile */}
      <div className="pt-3 border-t border-white/5 space-y-2">
        <button
          onClick={toggleSettingsModal}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition-all text-xs"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>

        <div className="pt-1">
          {user ? (
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
