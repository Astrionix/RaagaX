'use client';

import React from 'react';
import {
  Home,
  Compass,
  Radio,
  Search,
  Clock,
  User,
  Disc,
  Music,
  Sparkles,
  ListMusic,
  Plus,
} from 'lucide-react';
import { Heart, LogOut, LogIn } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';

export function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
  } = usePlayerStore();
  
  const { user, signOut, setAuthModalOpen } = useAuthStore();

  const playlists = [
    { id: 'fav-mix', name: 'Favourites Mix', desc: 'RaagaX Mix for Ram', icon: Heart, active: true },
    { id: 'chill-hits', name: 'Chill Hits', desc: 'RaagaX Chill' },
    { id: 'workout', name: 'Workout', desc: 'RaagaX Fitness' },
    { id: '90s-hits', name: "90's Hits", desc: "RaagaX 90's" },
    { id: 'telugu-love', name: 'Telugu Love Songs', desc: "Ram's Playlist" },
    { id: 'travel-vibes', name: 'Travel Vibes', desc: 'RaagaX' },
    { id: 'party-mix', name: 'Party Mix', desc: 'RaagaX Dance' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-30 h-screen w-64 p-3.5 flex-col justify-between select-none glass-panel border-r-white/5 text-white text-xs pt-20">
      <div className="space-y-4 overflow-y-auto no-scrollbar pr-1">

        {/* Search Input Pill */}
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
            placeholder="Search"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg glass-input text-xs text-white placeholder:text-slate-400 border border-transparent focus:border-[#fa233b] focus:outline-none font-medium"
          />
        </div>

        {/* RaagaX Section */}
        <div className="space-y-0.5">
          <span className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RaagaX</span>
          
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'home' ? 'bg-[#fa233b]/20 text-[#fa233b] shadow-[0_0_10px_rgba(239,35,60,0.1)]' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('album')}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'album' ? 'bg-[#fa233b]/20 text-[#fa233b] shadow-[0_0_10px_rgba(239,35,60,0.1)]' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Browse</span>
          </button>

          <button
            onClick={() => setActiveTab('radio')}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'radio' ? 'bg-[#fa233b]/20 text-[#fa233b] shadow-[0_0_10px_rgba(239,35,60,0.1)]' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Radio</span>
          </button>
        </div>

        {/* Library Section */}
        <div className="space-y-0.5 pt-1">
          <span className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Library</span>
          
          <button onClick={() => setActiveTab('library')} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-[#26262A] hover:text-white font-medium">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Recently Added</span>
          </button>

          <button onClick={() => setActiveTab('artist')} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-[#26262A] hover:text-white font-medium">
            <User className="w-4 h-4 text-slate-400" />
            <span>Artists</span>
          </button>

          <button onClick={() => setActiveTab('album')} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-[#26262A] hover:text-white font-medium">
            <Disc className="w-4 h-4 text-slate-400" />
            <span>Albums</span>
          </button>

          <button onClick={() => setActiveTab('library')} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-[#26262A] hover:text-white font-medium">
            <Music className="w-4 h-4 text-slate-400" />
            <span>Songs</span>
          </button>

          <button onClick={() => setActiveTab('library')} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-[#26262A] hover:text-white font-medium">
            <Sparkles className="w-4 h-4 text-slate-400" />
            <span>Made For You</span>
          </button>
        </div>

        {/* Playlists Section */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Playlists</span>
            <button className="hover:text-white p-0.5"><Plus className="w-3.5 h-3.5" /></button>
          </div>

          <button onClick={() => setActiveTab('playlist')} className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-[#26262A] hover:text-white font-medium">
            <ListMusic className="w-4 h-4 text-slate-400" />
            <span>All Playlists</span>
          </button>

          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => setActiveTab('playlist')}
              className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                pl.active ? 'bg-[#26262A] text-white font-bold' : 'text-slate-300 hover:bg-[#26262A] hover:text-white font-medium'
              }`}
            >
              <div className="w-6 h-6 rounded bg-[#fa233b]/20 text-[#fa233b] flex items-center justify-center flex-shrink-0">
                {pl.icon ? <pl.icon className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
              </div>
              <div className="truncate">
                <p className="truncate leading-tight text-[11px]">{pl.name}</p>
                <p className="truncate text-[9px] text-slate-400 leading-tight">{pl.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* User Profile Pill at Bottom */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between px-2">
        {user ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#fa233b] text-white font-black text-xs flex items-center justify-center shadow-md flex-shrink-0">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 pr-2">
                <h4 className="text-xs font-bold text-white truncate leading-tight">
                  {user.user_metadata?.name || 'RaagaX User'}
                </h4>
                <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
            <button 
              onClick={() => signOut()}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button 
            onClick={() => setAuthModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors border border-white/5"
          >
            <LogIn className="w-4 h-4 text-[#fa233b]" />
            Sign In / Sign Up
          </button>
        )}
      </div>
    </aside>
  );
}
