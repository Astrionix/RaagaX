import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { Playlist, Song } from '@/types/music';

export interface UserPlaylist extends Playlist {
  visibility: 'public' | 'private' | 'unlisted';
  ownerId: string;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
  songs: Song[];
  songIds: string[];
  likesCount?: number;
  isLikedByMe?: boolean;
  isCollaborative?: boolean;
}

interface PlaylistStore {
  playlists: UserPlaylist[];
  isLoading: boolean;

  // Actions
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (
    title: string,
    description?: string,
    visibility?: 'public' | 'private',
    coverUrl?: string
  ) => Promise<UserPlaylist | null>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  reorderSongs: (playlistId: string, oldIndex: number, newIndex: number) => Promise<boolean>;
  savePlaylistOrder: (playlistId: string, orderedSongIds: string[]) => Promise<boolean>;
  updatePlaylist: (
    playlistId: string,
    updates: { title?: string; description?: string; coverUrl?: string; visibility?: 'public' | 'private' }
  ) => Promise<boolean>;
  clearPlaylist: (playlistId: string) => Promise<boolean>;
  clonePlaylistToLibrary: (playlistId: string, sourcePlaylist?: UserPlaylist) => Promise<UserPlaylist | null>;
  toggleLikePlaylist: (playlistId: string) => Promise<boolean>;
  generateInviteLink: (playlistId: string) => string;
  joinCollaborativePlaylist: (inviteCodeOrId: string) => Promise<UserPlaylist | null>;
  toggleCollaborative: (playlistId: string, isCollaborative: boolean) => Promise<boolean>;
}

export const usePlaylistStore = create<PlaylistStore>()(
  persist(
    (set, get) => ({
      playlists: [],
      isLoading: false,

      fetchPlaylists: async () => {
        set({ isLoading: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            set({ isLoading: false });
            return;
          }

          // Fetch playlists owned by authenticated user
          const { data: playlistsData, error } = await supabase
            .from('playlists')
            .select('id, owner_id, name, description, cover_url, visibility, created_at, updated_at')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: false });

          if (error) {
            console.warn('[usePlaylistStore] Fetch playlists error:', error.message);
            set({ isLoading: false });
            return;
          }

          const playlistList = playlistsData || [];
          const playlistIds = playlistList.map((p) => p.id);

          // Fetch all song mappings for these playlists ordered by position
          let songsByPlaylist: Record<string, string[]> = {};
          if (playlistIds.length > 0) {
            try {
              const { data: songMappings } = await supabase
                .from('playlist_songs')
                .select('playlist_id, song_id, position')
                .in('playlist_id', playlistIds)
                .order('position', { ascending: true });

              if (songMappings) {
                songMappings.forEach((m: any) => {
                  if (!songsByPlaylist[m.playlist_id]) songsByPlaylist[m.playlist_id] = [];
                  songsByPlaylist[m.playlist_id].push(m.song_id);
                });
              }
            } catch (songErr) {
              console.warn('[usePlaylistStore] Failed to fetch playlist songs mapping:', songErr);
            }
          }

          const parsedPlaylists: UserPlaylist[] = playlistList.map((p) => ({
            id: p.id,
            title: p.name || 'Untitled Playlist',
            description: p.description || '',
            coverUrl: p.cover_url || '',
            visibility: (p.visibility || 'private') as any,
            ownerId: p.owner_id,
            ownerName: session.user.user_metadata?.full_name || 'You',
            creator: 'You',
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            songIds: songsByPlaylist[p.id] || [],
            songs: [],
          }));

          // Collect all song IDs across playlists and resolve their full Song objects
          const allPlaylistSongIds = Array.from(new Set(Object.values(songsByPlaylist).flat()));
          if (allPlaylistSongIds.length > 0) {
            try {
              const { SongResolver } = await import('@/lib/discovery/SongResolver');
              const resolvedSongs = await SongResolver.resolveSongs(allPlaylistSongIds);
              const resolvedMap = new Map<string, Song>();
              resolvedSongs.forEach((s) => resolvedMap.set(s.id, s));

              parsedPlaylists.forEach((pl) => {
                pl.songs = pl.songIds.map((id) => resolvedMap.get(id)).filter((s): s is Song => Boolean(s));
                if (!pl.coverUrl && pl.songs.length > 0 && pl.songs[0].coverUrl) {
                  pl.coverUrl = pl.songs[0].coverUrl;
                }
              });
            } catch (resolveErr) {
              console.warn('[usePlaylistStore] SongResolver background hydration failed:', resolveErr);
            }
          }

          set({ playlists: parsedPlaylists });
        } catch (e) {
          console.error('[usePlaylistStore] Failed to fetch playlists:', e);
        } finally {
          set({ isLoading: false });
        }
      },

      createPlaylist: async (title, description = '', visibility = 'private', coverUrl = '') => {
        const id = crypto.randomUUID();
        let authUserId = '';
        let authUserName = 'You';
        try {
          const { data: { session } } = await supabase.auth.getSession();
          authUserId = session?.user?.id || 'guest';
          authUserName = session?.user?.user_metadata?.full_name || 'You';
        } catch { }

        const now = new Date().toISOString();
        const newPl: UserPlaylist = {
          id,
          title,
          description: description || '',
          coverUrl: coverUrl || '',
          visibility: visibility as any,
          ownerId: authUserId,
          ownerName: authUserName,
          creator: 'You',
          createdAt: now,
          updatedAt: now,
          songIds: [],
          songs: [],
        };

        // 1. Optimistic UI update immediately
        set((state) => ({ playlists: [newPl, ...state.playlists] }));

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('[usePlaylistStore] Stored playlist locally (unauthenticated)');
            return newPl;
          }

          // Exact columns matching public.playlists table
          const { error } = await supabase.from('playlists').insert({
            id,
            name: title,
            description: description || '',
            cover_url: coverUrl || null,
            visibility: visibility || 'private',
            owner_id: session.user.id,
          });

          if (error) {
            console.error('[usePlaylistStore] Supabase playlist create error:', error.message);
            import('@/context/usePlayerStore').then(({ usePlayerStore }) => {
              usePlayerStore.getState().setToastMessage(`Playlist saved locally (${error.message})`);
            });
            return newPl;
          }

          return newPl;
        } catch (e: any) {
          console.error('[usePlaylistStore] Failed to create playlist in cloud, saved locally:', e);
          return newPl;
        }
      },

      deletePlaylist: async (playlistId) => {
        const previousPlaylists = get().playlists;
        set((state) => ({ playlists: state.playlists.filter((p) => p.id !== playlistId) }));

        try {
          const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
          if (error) {
            console.warn('[usePlaylistStore] Supabase delete playlist error:', error.message);
          }
          return true;
        } catch (e) {
          console.error('[usePlaylistStore] Failed to delete playlist from cloud, rolling back:', e);
          set({ playlists: previousPlaylists });
          return false;
        }
      },

      addSongToPlaylist: async (playlistId, song) => {
        const targetPl = get().playlists.find((p) => p.id === playlistId);
        if (!targetPl) return false;

        // Duplicate Check: Prevent adding if song already in playlist
        if (targetPl.songIds.includes(song.id)) {
          import('@/context/usePlayerStore').then(({ usePlayerStore }) => {
            usePlayerStore.getState().setToastMessage(`✓ "${song.title}" is already in "${targetPl.title}"`);
          });
          return false;
        }

        const newSongIds = [...targetPl.songIds, song.id];
        const newSongs = [...targetPl.songs, song];
        const newCoverUrl = targetPl.coverUrl || song.coverUrl || '';
        const previousPlaylists = get().playlists;

        // 1. Optimistic UI update
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId) {
              return {
                ...pl,
                coverUrl: newCoverUrl,
                songIds: newSongIds,
                songs: newSongs,
                updatedAt: new Date().toISOString(),
              };
            }
            return pl;
          }),
        }));

        try {
          const nextPosition = newSongIds.length;

          // Insert into playlist_songs
          const { error } = await supabase.from('playlist_songs').insert({
            playlist_id: playlistId,
            song_id: song.id,
            position: nextPosition,
          });

          if (error) {
            console.warn('[usePlaylistStore] Supabase playlist_songs insert error:', error.message);
            if (error.code !== '23505') {
              console.error('[usePlaylistStore] Failed to insert song relationship in cloud:', error);
            }
          }

          // If playlist had no cover art, update cover_url in Supabase
          if (!targetPl.coverUrl && song.coverUrl) {
            try {
              await supabase.from('playlists').update({ cover_url: song.coverUrl }).eq('id', playlistId);
            } catch {}
          }

          import('@/context/usePlayerStore').then(({ usePlayerStore }) => {
            usePlayerStore.getState().setToastMessage(`Added "${song.title}" to "${targetPl.title}"`);
          });

          return true;
        } catch (e) {
          console.error('[usePlaylistStore] Failed to add song to playlist in cloud, rolling back:', e);
          set({ playlists: previousPlaylists });
          return false;
        }
      },

      removeSongFromPlaylist: async (playlistId, songId) => {
        const previousPlaylists = get().playlists;
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId) {
              return {
                ...pl,
                songIds: pl.songIds.filter((id) => id !== songId),
                songs: pl.songs.filter((s) => s.id !== songId),
                updatedAt: new Date().toISOString(),
              };
            }
            return pl;
          }),
        }));

        try {
          const { error } = await supabase
            .from('playlist_songs')
            .delete()
            .eq('playlist_id', playlistId)
            .eq('song_id', songId);

          if (error) {
            console.warn('[usePlaylistStore] Remove song error:', error.message);
          }
          return true;
        } catch (e) {
          console.error('[usePlaylistStore] Failed to remove song from playlist in cloud, rolling back:', e);
          set({ playlists: previousPlaylists });
          return false;
        }
      },

      reorderSongs: async (playlistId, oldIndex, newIndex) => {
        const pl = get().playlists.find((p) => p.id === playlistId);
        if (!pl || oldIndex === newIndex) return false;

        const newSongs = [...pl.songs];
        const [movedSong] = newSongs.splice(oldIndex, 1);
        newSongs.splice(newIndex, 0, movedSong);

        const newSongIds = newSongs.map((s) => s.id);

        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id === playlistId) {
              return { ...p, songs: newSongs, songIds: newSongIds, updatedAt: new Date().toISOString() };
            }
            return p;
          }),
        }));

        // Persist new order to Supabase
        await get().savePlaylistOrder(playlistId, newSongIds);
        return true;
      },

      savePlaylistOrder: async (playlistId, orderedSongIds) => {
        try {
          // Batch update positions in playlist_songs
          const updates = orderedSongIds.map((songId, index) => 
            supabase
              .from('playlist_songs')
              .update({ position: index + 1 })
              .eq('playlist_id', playlistId)
              .eq('song_id', songId)
          );

          await Promise.allSettled(updates);
          return true;
        } catch (e) {
          console.warn('[usePlaylistStore] Error persisting playlist order:', e);
          return false;
        }
      },

      updatePlaylist: async (playlistId, updates) => {
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id === playlistId) {
              return {
                ...p,
                ...(updates.title && { title: updates.title }),
                ...(updates.description !== undefined && { description: updates.description }),
                ...(updates.coverUrl !== undefined && { coverUrl: updates.coverUrl }),
                ...(updates.visibility && { visibility: updates.visibility as any }),
                updatedAt: new Date().toISOString(),
              };
            }
            return p;
          }),
        }));

        try {
          const payload: any = { updated_at: new Date().toISOString() };
          if (updates.title) payload.name = updates.title;
          if (updates.description !== undefined) payload.description = updates.description;
          if (updates.coverUrl !== undefined) payload.cover_url = updates.coverUrl;
          if (updates.visibility) payload.visibility = updates.visibility;

          const { error } = await supabase.from('playlists').update(payload).eq('id', playlistId);
          if (error) {
            console.warn('[usePlaylistStore] Supabase update playlist error:', error.message);
          }
          return true;
        } catch (e) {
          console.error('[usePlaylistStore] Error updating playlist:', e);
          return false;
        }
      },

      clearPlaylist: async (playlistId) => {
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id === playlistId) {
              return { ...p, songs: [], songIds: [], updatedAt: new Date().toISOString() };
            }
            return p;
          }),
        }));

        try {
          await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId);
          return true;
        } catch (e) {
          console.warn('[usePlaylistStore] Clear playlist error:', e);
          return false;
        }
      },

      clonePlaylistToLibrary: async (playlistId, sourcePlaylist) => {
        // First check the local store; fall back to the provided sourcePlaylist
        // (needed for curated/editorial playlists that only live in PlaylistDetailView state)
        const source = get().playlists.find((p) => p.id === playlistId) ?? sourcePlaylist;
        if (!source) return null;

        const songs = Array.isArray(source.songs) ? [...source.songs] : [];
        const songIds = Array.isArray(source.songIds) && source.songIds.length > 0
          ? [...source.songIds]
          : songs.map((s) => s.id);

        const id = crypto.randomUUID();
        let authUserId = 'guest';
        let authUserName = 'You';
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            authUserId = session.user.id;
            authUserName = session.user.user_metadata?.full_name || 'You';
          }
        } catch { }

        const now = new Date().toISOString();
        const newPl: UserPlaylist = {
          id,
          title: source.title,
          description: source.description || `Saved from catalog • ${songs.length} tracks`,
          coverUrl: source.coverUrl || (songs.length > 0 ? songs[0].coverUrl : ''),
          visibility: 'private',
          ownerId: authUserId,
          ownerName: authUserName,
          creator: 'You',
          createdAt: now,
          updatedAt: now,
          songIds,
          songs,
        };

        // 1. Atomic UI update: insert playlist with all songs already populated
        set((state) => ({ playlists: [newPl, ...state.playlists] }));

        // 2. Batch persist to Supabase if user is logged in
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { error: plError } = await supabase.from('playlists').insert({
              id,
              name: newPl.title,
              description: newPl.description || '',
              cover_url: newPl.coverUrl || null,
              visibility: 'private',
              owner_id: session.user.id,
            });

            if (!plError && songIds.length > 0) {
              const rows = songIds.map((songId, idx) => ({
                playlist_id: id,
                song_id: songId,
                position: idx + 1,
              }));
              await supabase.from('playlist_songs').insert(rows);
            }
          }
        } catch (err) {
          console.warn('[usePlaylistStore] Cloud sync failed for saved playlist, stored locally:', err);
        }

        return newPl;
      },

      toggleLikePlaylist: async (playlistId) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId) {
              const currentLiked = Boolean(pl.isLikedByMe);
              return {
                ...pl,
                isLikedByMe: !currentLiked,
                likesCount: (pl.likesCount || 0) + (currentLiked ? -1 : 1),
              };
            }
            return pl;
          }),
        }));
        return true;
      },

      generateInviteLink: (playlistId) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://raaga-x-chi.vercel.app';
        return `${baseUrl}/playlist/${playlistId}`;
      },

      joinCollaborativePlaylist: async (inviteCodeOrId) => {
        return null;
      },

      toggleCollaborative: async (playlistId, isCollaborative) => {
        set((state) => ({
          playlists: state.playlists.map((p) => (p.id === playlistId ? { ...p, isCollaborative } : p)),
        }));
        return true;
      },
    }),
    {
      name: 'raagax-playlists-store-v2',
      partialize: (state) => ({
        playlists: (state.playlists || []).map((pl) => ({
          id: pl.id,
          title: pl.title,
          description: pl.description,
          coverUrl: pl.coverUrl,
          cover_url: (pl as any).cover_url || pl.coverUrl,
          visibility: pl.visibility,
          ownerId: pl.ownerId,
          owner_id: (pl as any).owner_id || pl.ownerId,
          createdAt: pl.createdAt,
          updatedAt: pl.updatedAt,
          songIds: pl.songIds || [],
          songs: (pl.songs || []).slice(0, 50).map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            coverUrl: s.coverUrl,
            audioUrl: s.audioUrl,
            genre: s.genre,
            category: s.category,
          })),
          likesCount: pl.likesCount,
          isLikedByMe: pl.isLikedByMe,
          isCollaborative: pl.isCollaborative,
        })),
      }),
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          try {
            const val = window.localStorage.getItem(name);
            return val ? JSON.parse(val) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          try {
            window.localStorage.setItem(name, JSON.stringify(value));
          } catch (err: any) {
            console.warn('[usePlaylistStore] Quota guard triggered:', err?.message);
            try {
              // Store compact ID-only list to stay well under 5MB quota
              const compact = {
                state: {
                  playlists: ((value as any)?.state?.playlists || []).map((p: any) => ({
                    id: p.id,
                    title: p.title || p.name || 'Playlist',
                    coverUrl: p.coverUrl,
                    songIds: p.songIds || [],
                    songs: [],
                  })),
                },
              };
              window.localStorage.setItem(name, JSON.stringify(compact));
            } catch {
              // In-memory store continues safely without crashing
            }
          }
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          try {
            window.localStorage.removeItem(name);
          } catch {}
        },
      },
    }
  )
);
