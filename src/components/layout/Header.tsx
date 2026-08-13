'use client';

import React from 'react';
import {
  Disc3,
  Settings,
  User,
  LogIn,
  Search,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';

export function Header() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    toggleSettingsModal,
  } = usePlayerStore();

  const { user, setAuthModalOpen } = useAuthStore();

  return (
    <>
      {/* Mobile Top Header (md:hidden) */}
      <header className="md:hidden h-14 fixed top-0 left-0 right-0 z-40 px-4 flex items-center justify-between bg-[#07090E]/90 backdrop-blur-md border-b border-white/5 text-white select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#fa233b] flex items-center justify-center shadow-md">
            <Disc3 className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '10s' }} />
          </div>
          <span className="font-black text-sm tracking-tight text-white">RAAGAX</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (user) {
                setActiveTab('profile');
              } else {
                setAuthModalOpen(true);
              }
            }} 
            className="p-1.5 text-slate-300 hover:text-white" 
            title="Profile"
          >
            {user ? (
              <div className="w-6 h-6 rounded-full bg-[#fa233b] text-white text-[10px] font-bold flex items-center justify-center">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            ) : (
              <LogIn className="w-4 h-4" />
            )}
          </button>
          <button onClick={() => setActiveTab('settings')} className="p-1.5 text-slate-300 hover:text-white" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>


    </>
  );
}
