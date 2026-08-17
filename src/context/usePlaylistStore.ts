import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { Playlist, Song } from '@/types/music';

export interface PlaylistCollaborator {
  userId: string;
  name: string;
  avatarUrl?: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
}

export interface UserPlaylist extends Playlist {
  visibility: 'public' | 'private' | 'unlisted';
  ownerId: string;
  ownerName?: string;
  isCollaborative?: boolean;
  inviteCode?: string;
  collaborators?: PlaylistCollaborator[];
  likesCount?: number;
  isLikedByMe?: boolean;
  songs: Song[];
  songIds: string[];
}

interface PlaylistStore {
  playlists: UserPlaylist[];
  isLoading: boolean;

  // Actions
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (
    title: string,
    description: string,
    visibility: 'public' | 'private',
    isCollaborative?: boolean
  ) => Promise<UserPlaylist | null>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  reorderSongs: (playlistId: string, oldIndex: number, newIndex: number) => Promise<boolean>;
  toggleCollaborative: (playlistId: string, isCollaborative: boolean) => Promise<boolean>;
  generateInviteLink: (playlistId: string) => string;
  joinCollaborativePlaylist: (inviteCodeOrId: string) => Promise<UserPlaylist | null>;
  removeCollaborator: (playlistId: string, userId: string) => Promise<boolean>;
  clonePlaylistToLibrary: (playlistId: string) => Promise<UserPlaylist | null>;
  toggleLikePlaylist: (playlistId: string) => Promise<boolean>;
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

          // Fetch playlists owned by user OR where user is a collaborator
          const { data: playlistsData, error } = await supabase
            .from('playlists')
            .select('*')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const playlistList = playlistsData || [];
          const playlistIds = playlistList.map((p) => p.id);

          // Fetch all song mappings for these playlists
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
            title: p.name || p.title || 'Untitled Playlist',
            description: p.description || '',
            coverUrl: p.cover_url || '',
            visibility: (p.visibility || 'private') as any,
            ownerId: p.owner_id,
            ownerName: session.user.user_metadata?.full_name || 'You',
            isCollaborative: Boolean(p.is_collaborative),
            inviteCode: p.invite_code || p.id.slice(0, 8),
            creator: p.owner_id === session.user.id ? 'You' : (p.owner_name || 'Friend'),
            collaborators: [
              {
                userId: p.owner_id,
                name: session.user.user_metadata?.full_name || 'You',
                role: 'owner',
                joinedAt: new Date(p.created_at || Date.now()).getTime(),
              },
            ],
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
          console.error('Failed to fetch playlists:', e);
        } finally {
          set({ isLoading: false });
        }
      },

      createPlaylist: async (title, description, visibility, isCollaborative = false) => {
        const id = crypto.randomUUID();
        let authUserId = '';
        let authUserName = 'You';
        try {
          const { data: { session } } = await supabase.auth.getSession();
          authUserId = session?.user?.id || 'guest';
          authUserName = session?.user?.user_metadata?.full_name || 'You';
        } catch { }

        const inviteCode = id.slice(0, 8);
        const newPl: UserPlaylist = {
          id,
          title,
          description: description || '',
          coverUrl: '',
          visibility: (visibility || 'private') as any,
          ownerId: authUserId,
          ownerName: authUserName,
          isCollaborative,
          inviteCode,
          creator: 'You',
          collaborators: [
            {
              userId: authUserId,
              name: authUserName,
              role: 'owner',
              joinedAt: Date.now(),
            },
          ],
          songIds: [],
          songs: [],
        };

        // 1. Optimistic UI update immediately
        set((state) => ({ playlists: [newPl, ...state.playlists] }));

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return newPl;

          const { error } = await supabase.from('playlists').insert({
            id,
            name: title,
            description: description || '',
            visibility: visibility || 'private',
            is_collaborative: isCollaborative,
            invite_code: inviteCode,
            owner_id: session.user.id,
          });

          if (error) throw error;
          return newPl;
        } catch (e) {
          console.error('Failed to create playlist in cloud, keeping locally:', e);
          return newPl;
        }
      },

      deletePlaylist: async (playlistId) => {
        const previousPlaylists = get().playlists;
        set((state) => ({ playlists: state.playlists.filter((p) => p.id !== playlistId) }));

        try {
          const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
          if (error) throw error;
          return true;
        } catch (e) {
          console.error('Failed to delete playlist from cloud, rolling back:', e);
          set({ playlists: previousPlaylists });
          return false;
        }
      },

      addSongToPlaylist: async (playlistId, song) => {
        const targetPl = get().playlists.find((p) => p.id === playlistId);
        if (targetPl && targetPl.songIds.includes(song.id)) {
          import('@/context/usePlayerStore').then(({ usePlayerStore }) => {
            usePlayerStore.getState().setToastMessage(`"${song.title}" is already in "${targetPl.title}"`);
          });
          return false;
        }

        const previousPlaylists = get().playlists;
        // 1. Optimistic UI update
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId) {
              return {
                ...pl,
                coverUrl: pl.coverUrl || song.coverUrl,
                songIds: [...pl.songIds, song.id],
                songs: [...pl.songs, song],
              };
            }
            return pl;
          }),
        }));

        try {
          const { data: existing } = await supabase
            .from('playlist_songs')
            .select('position')
            .eq('playlist_id', playlistId)
            .order('position', { ascending: false })
            .limit(1);

          const nextPosition = (existing && existing[0]?.position !== undefined) ? existing[0].position + 1 : 1;

          const { error } = await supabase.from('playlist_songs').upsert({
            playlist_id: playlistId,
            song_id: song.id,
            position: nextPosition,
          }, { onConflict: 'playlist_id,song_id', ignoreDuplicates: true });

          if (error && error.code !== '23505' && (error as any).status !== 409) {
            console.warn('[usePlaylistStore] Add song to playlist warning:', error.message);
          }

          // 2. Smart Download Rules Hook (Auto-Download for Playlists)
          try {
            const { SmartDownloadEngine } = await import('@/lib/offline/SmartDownloadEngine');
            SmartDownloadEngine.getInstance().evaluateAndDownload(song, {
              trigger: 'PLAYLIST_ADD',
              playlistId,
            }).catch((err) => {
              console.warn('[SmartDownloadEngine] Playlist download evaluation error:', err);
            });
          } catch (autoErr) {
            console.warn('[SmartDownloadEngine] Error loading SmartDownloadEngine:', autoErr);
          }

          return true;
        } catch (e) {
          console.error('Failed to add song to playlist in cloud, rolling back:', e);
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

          if (error) throw error;
          return true;
        } catch (e) {
          console.error('Failed to remove song from playlist in cloud, rolling back:', e);
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
              return { ...p, songs: newSongs, songIds: newSongIds };
            }
            return p;
          }),
        }));

        return true;
      },

      toggleCollaborative: async (playlistId, isCollaborative) => {
        set((state) => ({
          playlists: state.playlists.map((p) => (p.id === playlistId ? { ...p, isCollaborative } : p)),
        }));

        try {
          await supabase.from('playlists').update({ is_collaborative: isCollaborative }).eq('id', playlistId);
          return true;
        } catch {
          return true;
        }
      },

      generateInviteLink: (playlistId) => {
        const pl = get().playlists.find((p) => p.id === playlistId);
        const code = pl?.inviteCode || playlistId.slice(0, 8);
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://raaga-x-chi.vercel.app';
        return `${baseUrl}/playlist/${playlistId}?invite=${code}`;
      },

      joinCollaborativePlaylist: async (inviteCodeOrId) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id || 'guest';
          const userName = session?.user?.user_metadata?.full_name || 'Friend';

          const { data: plData } = await supabase
            .from('playlists')
            .select('*')
            .or(`id.eq.${inviteCodeOrId},invite_code.eq.${inviteCodeOrId}`)
            .single();

          if (!plData) return null;

          const joinedPl: UserPlaylist = {
            id: plData.id,
            title: plData.name || plData.title || 'Shared Playlist',
            description: plData.description || '',
            coverUrl: plData.cover_url || '',
            visibility: plData.visibility || 'public',
            ownerId: plData.owner_id,
            ownerName: plData.owner_name || 'Friend',
            isCollaborative: true,
            inviteCode: plData.invite_code,
            creator: plData.owner_id === userId ? 'You' : (plData.owner_name || 'Collaborator'),
            collaborators: [
              {
                userId: plData.owner_id,
                name: plData.owner_name || 'Owner',
                role: 'owner',
                joinedAt: Date.now() - 100000,
              },
              {
                userId,
                name: userName,
                role: 'editor',
                joinedAt: Date.now(),
              },
            ],
            songIds: [],
            songs: [],
          };

          set((state) => ({
            playlists: [joinedPl, ...state.playlists.filter((p) => p.id !== joinedPl.id)],
          }));

          return joinedPl;
        } catch (e) {
          console.warn('[usePlaylistStore] Failed to join collaborative playlist:', e);
          return null;
        }
      },

      removeCollaborator: async (playlistId, userId) => {
        set((state) => ({
          playlists: state.playlists.map((pl) => {
            if (pl.id === playlistId && pl.collaborators) {
              return {
                ...pl,
                collaborators: pl.collaborators.filter((c) => c.userId !== userId),
              };
            }
            return pl;
          }),
        }));
        return true;
      },

      clonePlaylistToLibrary: async (playlistId) => {
        const source = get().playlists.find((p) => p.id === playlistId);
        if (!source) return null;

        const clone = await get().createPlaylist(
          `Copy of ${source.title}`,
          `Cloned from ${source.creator || 'collaborator'} • ${source.songs.length} tracks`,
          'private',
          false
        );

        if (clone) {
          for (const s of source.songs) {
            await get().addSongToPlaylist(clone.id, s);
          }
        }

        return clone;
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
    }),
    {
      name: 'raagax-playlists-store-v2',
    }
  )
);
