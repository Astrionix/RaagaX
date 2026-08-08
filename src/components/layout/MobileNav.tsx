'use client';

import React from 'react';
import { Home, Search, Disc3, Library, User } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ActiveTab } from '@/types/music';

export function MobileNav() {
  const { activeTab, setActiveTab, togglePlayerExpanded } = usePlayerStore();

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'search' as const, label: 'Search', icon: <Search className="w-5 h-5" /> },
    { id: 'player' as const, label: 'Player', icon: <Disc3 className="w-5 h-5" /> },
    { id: 'library' as const, label: 'Library', icon: <Library className="w-5 h-5" /> },
    { id: 'profile' as const, label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#161618]/95 backdrop-blur-xl border-t border-white/10 px-2 flex items-center justify-around text-white select-none shadow-2xl">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'player') {
                togglePlayerExpanded();
              } else {
                setActiveTab(item.id as ActiveTab);
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              isActive ? 'text-[#EF233C] font-black scale-105' : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            {item.icon}
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
