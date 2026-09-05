'use client';

import React from 'react';
import {
  X,
  User,
  Settings,
  Bell,
  Sliders,
  LogOut,
  LogIn,
  ChevronRight,
  Download,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useThemeStore } from '@/context/useThemeStore';
import { haptics } from '@/lib/haptics/HapticEngine';

interface ProfileMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileMenuModal({ isOpen, onClose }: ProfileMenuModalProps) {
  const { user, signOut, setAuthModalOpen } = useAuthStore();
  const {
    setActiveTab,
    toggleSettingsModal,
  } = usePlayerStore();
  const { theme, setTheme } = useThemeStore();

  if (!isOpen) return null;

  const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
  const displayName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Guest Listener');
  const userEmail = user?.email || 'Sign in to sync across devices';

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Menu Modal / Bottom Sheet */}
      <div className="relative w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden z-10 animate-in slide-in-from-bottom-6 duration-250 flex flex-col max-h-[88vh]">
        {/* Specular Edge Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* Top Header / Account Identity */}
        <div className="p-5 pb-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[var(--border-subtle)] bg-gradient-to-br from-[#FA233B] to-purple-600 flex items-center justify-center text-white font-black text-base shadow-md flex-shrink-0">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)] truncate">{displayName}</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-[#FA233B]/20 text-[#FA233B] text-[9px] font-mono font-bold uppercase">
                  Pro Audio
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Action Items */}
        <div className="overflow-y-auto p-4 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 no-scrollbar divide-y divide-[var(--border-subtle)]">
          {/* Quick Theme Switcher */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
              Appearance Theme
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dark' as const, label: 'Dark', icon: Moon },
                { id: 'light' as const, label: 'Light', icon: Sun },
                { id: 'system' as const, label: 'Adaptive', icon: Monitor },
              ].map((t) => {
                const Icon = t.icon;
                const isSel = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      haptics.lightImpact();
                      setTheme(t.id);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSel
                        ? 'bg-[#FA233B] text-white border-[#FA233B] shadow-md shadow-[#FA233B]/20'
                        : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. Profile & Account */}
          <div className="pt-3 space-y-1">
            <button
              onClick={() => {
                haptics.lightImpact();
                onClose();
                setActiveTab('profile');
              }}
              className="w-full p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between text-left group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[#FA233B] transition-colors">
                    Account & Listening DNA
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Taste profile, stats, and badges</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>
          </div>

          {/* 2. Audio & Settings */}
          <div className="pt-3 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
              Audio & Devices
            </span>

            {/* Audio Settings */}
            <button
              onClick={() => {
                haptics.lightImpact();
                onClose();
                toggleSettingsModal();
              }}
              className="w-full p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between text-left group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-amber-500 transition-colors">
                    Audio Quality & Streaming
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">320kbps Lossless, Gapless Playback, Crossfade</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>

            {/* Downloads (Android Only) */}
            {isNative && (
              <button
                onClick={() => {
                  haptics.lightImpact();
                  onClose();
                  setActiveTab('downloads');
                }}
                className="w-full p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between text-left group transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-emerald-500 transition-colors">
                      Downloads & Offline Audio
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">Saved tracks, offline playback, Wi-Fi downloads</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
              </button>
            )}
          </div>

          {/* 3. Notifications & Preferences */}
          <div className="pt-3 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
              Preferences & System
            </span>

            {/* Notifications */}
            <button
              onClick={() => {
                haptics.lightImpact();
                onClose();
                import('@/context/useNotificationStore').then(({ useNotificationStore }) => {
                  useNotificationStore.getState().toggleOpen();
                });
              }}
              className="w-full p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between text-left group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-rose-500 transition-colors">
                    Notifications
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Artist releases and activity updates</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>

            {/* Settings & Storage */}
            <button
              onClick={() => {
                haptics.lightImpact();
                onClose();
                setActiveTab('settings');
              }}
              className="w-full p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-between text-left group transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-500/15 border border-slate-500/30 flex items-center justify-center text-slate-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[#FA233B] transition-colors">
                    App Settings & Storage
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Cache, language preferences, and privacy</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>
          </div>

          {/* 4. Auth (Sign In / Sign Out) */}
          <div className="pt-3">
            {user ? (
              <button
                onClick={() => {
                  haptics.lightImpact();
                  signOut();
                  onClose();
                }}
                className="w-full p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Account</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  haptics.lightImpact();
                  onClose();
                  setAuthModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-[#FA233B] hover:bg-[#D90429] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In or Create Account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
