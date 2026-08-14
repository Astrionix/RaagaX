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
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error fetching session:', error);
      }
      
      set({ 
        session, 
        user: session?.user || null,
        isLoading: false 
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, newSession) => {
        set({ 
          session: newSession, 
          user: newSession?.user || null 
        });
      });
    } catch (e) {
      console.error('Auth initialization failed:', e);
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      PlaybackService.getInstance().pause();
    } catch {}

    try {
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      usePlayerStore.getState().setIsPlaying(false, true);
    } catch {}

    try {
      const { LocalDatabase } = await import('@/lib/localDatabase');
      await LocalDatabase.getInstance().clearPlaybackSession();
    } catch {}

    await supabase.auth.signOut();
    set({ user: null, session: null });
    // Clear cross-device sync local storage fallbacks and queue caches on account switch
    if (typeof window !== 'undefined') {
      localStorage.removeItem('raagax_session_id');
      localStorage.removeItem('raagax_active_queue_snapshot');
      localStorage.removeItem('raagax_fallback_session');
      localStorage.removeItem('raagax_latest_playback_session');
      window.location.reload(); // Refresh to reset all states globally
    }
  }
}));
