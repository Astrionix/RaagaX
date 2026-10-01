import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserProfile, UserPlaylist, Song } from "@/types/music";
import { supabase } from "@/lib/supabase/client";
import { syncClient } from "@/services/connect/raaga-sync-client";
import { generateUUID } from "@/lib/utils";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  likedSongIds: string[];
  likedSongs: Song[];
  playlists: UserPlaylist[];
  history: Song[];

  // Actions
  initAuth: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string, password?: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password?: string) => Promise<{ error?: string }>;
  setYouTubeSession: (session: import("@/types/music").YouTubeAccountSession) => void;
  removeYouTubeSession: () => void;
  signOut: () => Promise<void>;

  // Liked Songs
  isLiked: (videoId: string) => boolean;
  toggleLike: (song: Song) => Promise<void>;

  // Playlists
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<UserPlaylist | null>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;

  // History
  recordHistory: (song: Song) => void;
  clearHistory: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      likedSongIds: [],
      likedSongs: [],
      playlists: [],
      history: [],

      initAuth: async () => {
        set({ isLoading: true });
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const authUser = data.session.user;
            const profile: UserProfile = {
              id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Raaga User",
              avatarUrl: authUser.user_metadata?.avatar_url,
              isGuest: false,
            };
            set({ user: profile });

            // Connect sync client with user ID
            syncClient.connect(authUser.id);

            // Fetch remote data from Supabase
            get().fetchPlaylists();

            // Fetch liked songs
            const { data: likedData } = await supabase
              .from("liked_songs")
              .select("song_id")
              .eq("user_id", authUser.id);

            if (likedData) {
              set({ likedSongIds: likedData.map((r: any) => r.song_id) });
            }
          } else {
            // Guest mode
            syncClient.connect();
          }
        } catch (err) {
          console.warn("Auth initialization warning:", err);
          syncClient.connect();
        } finally {
          set({ isLoading: false });
        }
      },

      signInWithGoogle: async () => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
              queryParams: {
                access_type: "offline",
                prompt: "consent",
              },
            },
          });
          if (error) {
            set({ isLoading: false });
            return { error: error.message };
          }
          return {};
        } catch (err: any) {
          set({ isLoading: false });
          return { error: err.message || "Google Sign-In failed" };
        }
      },

      setYouTubeSession: (session: import("@/types/music").YouTubeAccountSession) => {
        const { user } = get();
        const activeProfile = session.profiles.find((p) => p.profileId === session.activeProfileId) || session.profiles[0];
        const updatedUser: UserProfile = {
          id: user?.id || session.accountId,
          email: session.email || user?.email,
          name: activeProfile?.name || session.name || user?.name || "YouTube Music User",
          avatarUrl: activeProfile?.avatar || user?.avatarUrl,
          isGuest: false,
          youtubeSession: session,
        };
        set({ user: updatedUser });
      },

      removeYouTubeSession: () => {
        const { user } = get();
        if (user) {
          const updated: UserProfile = { ...user, youtubeSession: undefined };
          set({ user: updated });
        }
      },

      signInWithEmail: async (email: string, password?: string) => {
        set({ isLoading: true });
        try {
          let res;
          if (password) {
            res = await supabase.auth.signInWithPassword({ email, password });
          } else {
            res = await supabase.auth.signInWithOtp({ email });
          }

          if (res.error) {
            set({ isLoading: false });
            return { error: res.error.message };
          }

          if (res.data?.user) {
            const authUser = res.data.user;
            const profile: UserProfile = {
              id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Raaga User",
              avatarUrl: authUser.user_metadata?.avatar_url,
              isGuest: false,
            };
            set({ user: profile, isLoading: false });
            syncClient.connect(authUser.id);
            get().fetchPlaylists();
          }
          return {};
        } catch (err: any) {
          set({ isLoading: false });
          return { error: err.message || "Failed to sign in" };
        }
      },

      signUpWithEmail: async (email: string, password?: string) => {
        set({ isLoading: true });
        try {
          const res = await supabase.auth.signUp({
            email,
            password: password || "RaagaXPass123!",
          });

          if (res.error) {
            set({ isLoading: false });
            return { error: res.error.message };
          }

          if (res.data?.user) {
            const authUser = res.data.user;
            const profile: UserProfile = {
              id: authUser.id,
              email: authUser.email,
              name: email.split("@")[0],
              isGuest: false,
            };
            set({ user: profile, isLoading: false });
            syncClient.connect(authUser.id);
          }
          return {};
        } catch (err: any) {
          set({ isLoading: false });
          return { error: err.message || "Failed to sign up" };
        }
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn("Sign out error:", err);
        }
        set({ user: null });
        syncClient.connect();
      },

      isLiked: (videoId: string) => {
        return get().likedSongIds.includes(videoId);
      },

      toggleLike: async (song: Song) => {
        const { user, likedSongIds, likedSongs } = get();
        const exists = likedSongIds.includes(song.videoId);

        if (exists) {
          const newIds = likedSongIds.filter((id) => id !== song.videoId);
          const newSongs = likedSongs.filter((s) => s.videoId !== song.videoId);
          set({ likedSongIds: newIds, likedSongs: newSongs });

          if (user && !user.isGuest) {
            await supabase
              .from("liked_songs")
              .delete()
              .eq("user_id", user.id)
              .eq("song_id", song.videoId);
          }
        } else {
          const newIds = [song.videoId, ...likedSongIds];
          const newSongs = [song, ...likedSongs];
          set({ likedSongIds: newIds, likedSongs: newSongs });

          if (user && !user.isGuest) {
            await supabase.from("liked_songs").insert({
              user_id: user.id,
              song_id: song.videoId,
            });
          }
        }
      },

      fetchPlaylists: async () => {
        const { user } = get();
        if (!user || user.isGuest) return;

        try {
          const { data, error } = await supabase
            .from("playlists")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });

          if (data && !error) {
            const formatted: UserPlaylist[] = data.map((p: any) => ({
              id: p.id,
              ownerId: p.owner_id,
              name: p.name,
              description: p.description || "",
              coverUrl: p.cover_url || "",
              songCount: 0,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }));
            set({ playlists: formatted });
          }
        } catch (err) {
          console.error("Fetch playlists error:", err);
        }
      },

      createPlaylist: async (name: string, description: string = "") => {
        const { user, playlists } = get();
        const id = "pl_" + generateUUID().replace(/-/g, "").substring(0, 12);
        const ownerId = user?.id || "guest";

        const newPlaylist: UserPlaylist = {
          id,
          ownerId,
          name,
          description,
          coverUrl: "",
          songCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          songs: [],
        };

        set({ playlists: [newPlaylist, ...playlists] });

        if (user && !user.isGuest) {
          await supabase.from("playlists").insert({
            id,
            owner_id: user.id,
            name,
            description,
          });
        }

        return newPlaylist;
      },

      deletePlaylist: async (playlistId: string) => {
        const { user, playlists } = get();
        set({ playlists: playlists.filter((p) => p.id !== playlistId) });

        if (user && !user.isGuest) {
          await supabase.from("playlists").delete().eq("id", playlistId);
        }
      },

      addSongToPlaylist: async (playlistId: string, song: Song) => {
        const { user, playlists } = get();
        const target = playlists.find((p) => p.id === playlistId);
        if (!target) return;

        const updatedSongs = [...(target.songs || [])];
        if (!updatedSongs.some((s) => s.videoId === song.videoId)) {
          updatedSongs.push(song);
        }

        const updated = playlists.map((p) =>
          p.id === playlistId
            ? { ...p, songs: updatedSongs, songCount: updatedSongs.length }
            : p
        );
        set({ playlists: updated });

        if (user && !user.isGuest) {
          await supabase.from("playlist_songs").insert({
            playlist_id: playlistId,
            song_id: song.videoId,
            position: updatedSongs.length,
          });
        }
      },

      removeSongFromPlaylist: async (playlistId: string, songId: string) => {
        const { user, playlists } = get();
        const target = playlists.find((p) => p.id === playlistId);
        if (!target) return;

        const updatedSongs = (target.songs || []).filter((s) => s.videoId !== songId);
        const updated = playlists.map((p) =>
          p.id === playlistId
            ? { ...p, songs: updatedSongs, songCount: updatedSongs.length }
            : p
        );
        set({ playlists: updated });

        if (user && !user.isGuest) {
          await supabase
            .from("playlist_songs")
            .delete()
            .eq("playlist_id", playlistId)
            .eq("song_id", songId);
        }
      },

      recordHistory: (song: Song) => {
        const { history } = get();
        const filtered = history.filter((s) => s.videoId !== song.videoId);
        set({ history: [song, ...filtered].slice(0, 100) });
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "raaga_auth_storage",
      partialize: (state) => ({
        user: state.user,
        likedSongIds: state.likedSongIds,
        likedSongs: state.likedSongs,
        playlists: state.playlists,
        history: state.history,
      }),
    }
  )
);
