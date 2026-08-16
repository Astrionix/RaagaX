'use client';

import React from 'react';
import { Home, Compass, Search, Library, User } from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ActiveTab } from '@/types/music';

/**
 * RaagaX Floating Liquid Glass Bottom Navigation Bar
 * 
 * Features:
 * - Floating pill shape with 24px continuous corner radius
 * - Translucent obsidian glass (Tier 01 Frosted Glass) with 1px light highlight
 * - Active red indicator pill and kinetic slide animation
 * - Safe area awareness for Android gesture bar and iOS home indicator
 * - Ambient glass reflection and micro-elevation
 */
export function MobileNav() {
  const { activeTab, setActiveTab } = usePlayerStore();

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'browse' as const, label: 'Browse', icon: Compass },
    { id: 'search' as const, label: 'Search', icon: Search },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <div 
      className="md:hidden fixed left-0 right-0 z-40 flex justify-center pointer-events-none px-4"
      style={{ bottom: 'calc(0.35rem + env(safe-area-inset-bottom))' }}
    >
      <nav 
        className="pointer-events-auto flex items-center justify-between gap-1 px-3 py-1.5 rounded-[28px] lens-floating shadow-[0_16px_40px_rgba(0,0,0,0.7)] w-full max-w-[380px] border border-white/10 relative overflow-hidden"
        aria-label="Mobile Navigation"
      >
        {/* Specular Liquid Edge Light */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                import('@/lib/haptics/HapticEngine').then(m => m.haptics.lightImpact());
                setActiveTab(item.id as ActiveTab);
              }}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isActive 
                  ? 'text-white scale-105' 
                  : 'text-[#94A3B8] hover:text-white active:scale-95'
              }`}
            >
              {/* Soft Active Red Lens Droplet */}
              {isActive && (
                <span 
                  className="absolute inset-0 rounded-2xl bg-[#E50914]/18 border border-[#E50914]/25 shadow-[0_2px_12px_rgba(229,9,20,0.25)] pointer-events-none animate-in fade-in zoom-in-95 duration-200" 
                />
              )}

              <Icon 
                className={`w-4 h-4 relative z-10 transition-transform duration-200 ${
                  isActive ? 'text-[#E50914] stroke-[2.5]' : 'stroke-[1.75]'
                }`} 
              />
              
              <span 
                className={`text-[9.5px] font-sans font-bold tracking-tight mt-0.5 relative z-10 transition-all ${
                  isActive ? 'text-white' : 'text-[#64748B]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
