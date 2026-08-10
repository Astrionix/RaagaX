'use client';

import React from 'react';
import { Home, Compass, Search, Library } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ActiveTab } from '@/types/music';

export function MobileNav() {
  const { activeTab, setActiveTab } = usePlayerStore();

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'browse' as const, label: 'Browse', icon: <Compass className="w-5 h-5" /> },
    { id: 'search' as const, label: 'Search', icon: <Search className="w-5 h-5" /> },
    { id: 'library' as const, label: 'Library', icon: <Library className="w-5 h-5" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d12]/95 backdrop-blur-xl border-t border-white/10 px-4 flex items-center justify-between text-white select-none shadow-2xl pb-[env(safe-area-inset-bottom)] h-[calc(3.75rem+env(safe-area-inset-bottom))]">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as ActiveTab)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all py-1 ${
              isActive ? 'text-[#fa233b] font-black scale-105' : 'text-slate-400 hover:text-white font-medium'
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
