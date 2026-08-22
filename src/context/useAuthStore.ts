import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;

  // Actions
  initializeAuth: () => Promise<void>;
  setAuthModalOpen: (isOpen: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthModalOpen: false,

  setAuthModalOpen: (isOpen) => set({ isAuthModalOpen: isOpen }),

  initializeAuth: async () => {
    try {
      // Get initial session safely
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Session refresh error (clearing stale session):', error.message);
        if (error.message?.includes('Refresh Token') || error.message?.includes('invalid_grant')) {
          await supabase.auth.signOut().catch(() => { });
        }
      }

      set({
        session: error ? null : session,
        user: error ? null : (session?.user || null),
        isLoading: false
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          set({
            session: newSession,
            user: newSession?.user || null
          });
          if (event === 'SIGNED_IN' && newSession?.user?.id) {
            import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
              AccountSyncEngine.getInstance().migrateGuestDataToUser(newSession.user.id);
            }).catch(() => { });
          }
        } else if (event === 'SIGNED_OUT') {
          set({ session: null, user: null });
          import('@/lib/connect/lan/RaagaXConnectV2').then(({ RaagaXConnectV2 }) => {
            RaagaXConnectV2.getInstance().handleAccountLogout();
          }).catch(() => {});
        }
      });
    } catch (e) {
      console.warn('Auth initialization fallback:', e);
      set({ isLoading: false, session: null, user: null });
    }
  },

  signOut: async () => {
    try {
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      PlaybackService.getInstance().pause();
    } catch { }

    try {
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      usePlayerStore.getState().setIsPlaying(false, true);
    } catch { }

    try {
      const { LocalDatabase } = await import('@/lib/localDatabase');
      await LocalDatabase.getInstance().clearPlaybackSession();
    } catch { }

    try {
      const { RaagaXConnectV2 } = await import('@/lib/connect/lan/RaagaXConnectV2');
      RaagaXConnectV2.getInstance().handleAccountLogout();
    } catch { }

    await supabase.auth.signOut().catch(() => { });
    set({ user: null, session: null });
    // Clear cross-device sync local storage fallbacks and queue caches on account switch
    if (typeof window !== 'undefined') {
      localStorage.removeItem('raagax_session_id');
      localStorage.removeItem('raagax_active_queue_snapshot');
      localStorage.removeItem('raagax_fallback_session');
      localStorage.removeItem('raagax_latest_playback_session');
    }
  }
}));
