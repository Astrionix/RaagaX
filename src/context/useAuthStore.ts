import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { AccountIsolationGuard } from '@/lib/auth/AccountIsolationGuard';

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

/**
 * Atomic helper to completely purge all user-owned in-memory and local state
 */
export async function purgeAllUserScopedState(source: string = 'PURGE') {
  const guard = AccountIsolationGuard.getInstance();
  guard.clearAuthenticatedUser(source);

  // 1. Pause and reset playback
  try {
    const { PlaybackService } = await import('@/lib/playback/PlaybackService');
    PlaybackService.getInstance().pause();
  } catch {}

  // 2. Reset user library and player stores
  try {
    const { usePlayerStore } = await import('@/context/usePlayerStore');
    usePlayerStore.getState().resetUserLibraryState();
  } catch {}

  // 3. Reset user playlist stores
  try {
    const { usePlaylistStore } = await import('@/context/usePlaylistStore');
    usePlaylistStore.getState().resetPlaylistState();
  } catch {}

  // 4. Leave and cleanup Jam session if active
  try {
    const { JamClientManager } = await import('@/lib/jam/client/JamClientManager');
    JamClientManager.getInstance().leaveJam().catch(() => {});
  } catch {}

  // 5. Cleanup sync engines and unsubscribe realtime channels
  try {
    const { AccountSyncEngine } = await import('@/lib/sync/AccountSyncEngine');
    AccountSyncEngine.getInstance().unsubscribe();
  } catch {}
  try {
    const { LibrarySyncManager } = await import('@/lib/sync/LibrarySyncManager');
    LibrarySyncManager.getInstance().cleanup();
  } catch {}

  // 6. Clear local databases and session snapshots
  try {
    const { LocalDatabase } = await import('@/lib/localDatabase');
    await LocalDatabase.getInstance().clearPlaybackSession();
  } catch {}

  // 7. Clear user-specific localStorage and sessionStorage keys
  if (typeof window !== 'undefined') {
    try {
      const keysToClear = [
        'raagax_session_id',
        'raagax_active_queue_snapshot',
        'raagax_fallback_session',
        'raagax_latest_playback_session',
        'raagax-playlists-store-v2',
        'liked_songs_sort',
        'raagax_library_mutation_queue',
      ];
      keysToClear.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
        try { sessionStorage.removeItem(k); } catch {}
      });
    } catch {}
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

      const initialUser = error ? null : (session?.user || null);
      if (initialUser?.id) {
        AccountIsolationGuard.getInstance().setAuthenticatedUser(initialUser.id, 'INITIAL_SESSION');
        // Instantly reconcile library and playlists for authenticated user
        import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
          AccountSyncEngine.getInstance().reconcile(initialUser.id);
        }).catch(() => {});
        import('@/context/usePlaylistStore').then(({ usePlaylistStore }) => {
          usePlaylistStore.getState().fetchPlaylists(true);
        }).catch(() => {});
      } else {
        AccountIsolationGuard.getInstance().clearAuthenticatedUser('INITIAL_GUEST');
      }

      set({
        session: error ? null : session,
        user: initialUser,
        isLoading: false
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        const newUserId = newSession?.user?.id || null;
        const currentGuardUser = AccountIsolationGuard.getInstance().getActiveUserId();

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || (event as string) === 'INITIAL_SESSION') {
          // If switching from another account or re-authenticating, purge previous account state first
          if (currentGuardUser && newUserId && currentGuardUser !== newUserId) {
            console.log(`[useAuthStore] User switch detected: ${currentGuardUser} -> ${newUserId}. Purging state...`);
            await purgeAllUserScopedState('USER_SWITCH');
          }

          const wasGuest = AccountIsolationGuard.getInstance().getIsGuestSession();
          AccountIsolationGuard.getInstance().setAuthenticatedUser(newUserId, event);

          set({
            session: newSession,
            user: newSession?.user || null
          });

          if (newUserId) {
            // Only migrate guest data if this session was genuinely an unauthenticated guest session
            if (event === 'SIGNED_IN' && wasGuest && !currentGuardUser) {
              import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
                AccountSyncEngine.getInstance().migrateGuestDataToUser(newUserId);
              }).catch(() => { });
            }

            // Freshly bootstrap library for the authenticated user
            import('@/context/usePlaylistStore').then(({ usePlaylistStore }) => {
              usePlaylistStore.getState().fetchPlaylists(true);
            }).catch(() => {});
            import('@/lib/sync/AccountSyncEngine').then(({ AccountSyncEngine }) => {
              AccountSyncEngine.getInstance().reconcile(newUserId);
            }).catch(() => {});
          }
        } else if (event === 'SIGNED_OUT') {
          await purgeAllUserScopedState('AUTH_EVENT_SIGNED_OUT');
          set({ session: null, user: null });
        }
      });
    } catch (e) {
      console.warn('Auth initialization fallback:', e);
      set({ isLoading: false, session: null, user: null });
    }
  },

  signOut: async () => {
    // 1. Purge all in-memory, store, cache, and local database state
    await purgeAllUserScopedState('USER_SIGNOUT_CLICK');

    // 2. Sign out from Supabase cloud
    await supabase.auth.signOut().catch(() => { });

    // 3. Clear store state
    set({ user: null, session: null });
  }
}));

if (typeof window !== 'undefined') {
  useAuthStore.getState().initializeAuth();
}

