'use client';

import React from 'react';
import { Home, Compass, Search, Library, Music, QrCode, Mic, Tv } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';

interface TVSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenTVNowPlaying: () => void;
  onOpenQRPairing?: () => void;
  onOpenVoiceSearch?: () => void;
}

export function TVSidebar({ activeTab, setActiveTab, onOpenTVNowPlaying, onOpenQRPairing, onOpenVoiceSearch }: TVSidebarProps) {
  const { currentSong } = usePlayerStore();

  const navItems = [
    { id: 'home', label: 'Listen Now', icon: Home },
    { id: 'discover', label: 'Browse', icon: Compass },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 h-screen tv-glass-panel fixed left-0 top-0 z-40 p-6 select-none border-r border-white/10">
      {/* BRANDING */}
      <div className="flex items-center gap-3 mb-8 px-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fa233b] to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
          <Music className="w-6 h-6 text-white stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">RaagaX</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#fa233b]">tvOS Edition</span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <nav className="space-y-2.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              data-tv-focusable="true"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-extrabold text-sm transition-all cursor-pointer ${
                isActive 
                  ? 'bg-[#fa233b] text-white shadow-xl shadow-red-500/30 scale-102' 
                  : 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* TV EXTRA CONTROLS: PAIR PHONE & VOICE SEARCH */}
        {onOpenVoiceSearch && (
          <button
            data-tv-focusable="true"
            onClick={onOpenVoiceSearch}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-extrabold text-sm bg-white/5 hover:bg-white/15 text-white/80 transition-all cursor-pointer"
          >
            <Mic className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>Voice Search</span>
          </button>
        )}

        {onOpenQRPairing && (
          <button
            data-tv-focusable="true"
            onClick={onOpenQRPairing}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-extrabold text-sm bg-white/5 hover:bg-white/15 text-white/80 transition-all cursor-pointer"
          >
            <QrCode className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>Pair Phone (QR)</span>
          </button>
        )}
      </nav>

      {/* APPLE TV NOW PLAYING QUICK CARD */}
      {currentSong && (
        <div 
          data-tv-focusable="true"
          onClick={onOpenTVNowPlaying}
          className="mt-auto bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-2xl rounded-2xl p-3 flex items-center gap-3 transition-all cursor-pointer group"
        >
          <img 
            src={currentSong.coverUrl || '/default-playlist-cover.png'} 
            alt={currentSong.title}
            className="w-12 h-12 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform"
            onError={(e) => {
              (e.target as HTMLElement).setAttribute('src', '/default-playlist-cover.png');
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-white truncate">{currentSong.title}</div>
            <div className="text-[10px] font-medium text-white/60 truncate">{currentSong.artist}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#fa233b] text-white flex items-center justify-center flex-shrink-0 shadow-lg">
            <Tv className="w-4 h-4" />
          </div>
        </div>
      )}
    </aside>
  );
}
