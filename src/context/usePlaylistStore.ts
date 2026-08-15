import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { Playlist, Song } from '@/types/music';

export interface UserPlaylist extends Playlist {
  visibility: 'public' | 'private' | 'unlisted';
  ownerId: string;
  songs: Song[];
  songIds: string[];
}

interface PlaylistStore {
  playlists: UserPlaylist[];
  isLoading: boolean;
  
  // Actions
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (title: string, description: string, visibility: 'public' | 'private') => Promise<UserPlaylist | null>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<boolean>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  reorderSongs: (playlistId: string, oldIndex: number, newIndex: number) => Promise<boolean>;
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
        set({ playlists: [], isLoading: false });
        return;
      }

      // Fetch playlists owned by user
      const { data: playlistsData, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const playlistList = playlistsData || [];
      const playlistIds = playlistList.map(p => p.id);

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

      const parsedPlaylists: UserPlaylist[] = playlistList.map(p => ({
        id: p.id,
        title: p.name || p.title || 'Untitled Playlist',
        description: p.description || '',
        coverUrl: p.cover_url || '',
        visibility: (p.visibility || 'private') as any,
        ownerId: p.owner_id,
        creator: 'You',
        songIds: songsByPlaylist[p.id] || [],
        songs: []
      }));

      set({ playlists: parsedPlaylists });
    } catch (e) {
      console.error('Failed to fetch playlists:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  createPlaylist: async (title, description, visibility) => {
    const id = crypto.randomUUID();
    let authUserId = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      authUserId = session?.user?.id || '';
    } catch {}

    const newPl: UserPlaylist = {
      id,
      title,
      description: description || '',
      coverUrl: '',
      visibility: (visibility || 'private') as any,
      ownerId: authUserId,
      creator: 'You',
      songIds: [],
      songs: []
    };

    // 1. Optimistic UI update immediately
    set(state => ({ playlists: [newPl, ...state.playlists] }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated with Supabase');

      const { data, error } = await supabase.from('playlists').insert({
        id,
        name: title,
        description: description || '',
        visibility: visibility || 'private',
        owner_id: session.user.id,
      }).select().single();

      if (error) throw error;
      return newPl;
    } catch (e) {
      console.error('Failed to create playlist in cloud, rolling back:', e);
      set(state => ({ playlists: state.playlists.filter(p => p.id !== id) }));
      return null;
    }
  },

  deletePlaylist: async (playlistId) => {
    const previousPlaylists = get().playlists;
    // 1. Optimistic UI removal
    set(state => ({ playlists: state.playlists.filter(p => p.id !== playlistId) }));

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
    const previousPlaylists = get().playlists;
    // 1. Optimistic UI update: immediately show song in local playlist
    set(state => ({
      playlists: state.playlists.map(pl => {
        if (pl.id === playlistId) {
          const hasSong = pl.songIds.includes(song.id);
          if (hasSong) return pl;
          return {
            ...pl,
            songIds: [...pl.songIds, song.id],
            songs: [...pl.songs, song]
          };
        }
        return pl;
      })
    }));

    try {
      // 2. Upsert song into canonical_songs if possible
      try {
        await supabase.from('canonical_songs').upsert({
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: typeof song.duration === 'string' ? song.duration : `${song.duration || 0}`,
          cover_url: song.coverUrl,
          language: 'Telugu'
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (err) {}

      // 3. Get current max position
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
      return true;
    } catch (e) {
      console.error('Failed to add song to playlist in cloud, rolling back:', e);
      set({ playlists: previousPlaylists });
      return false;
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    const previousPlaylists = get().playlists;
    // 1. Optimistic UI update: immediately remove song from local playlist
    set(state => ({
      playlists: state.playlists.map(pl => {
        if (pl.id === playlistId) {
          return {
            ...pl,
            songIds: pl.songIds.filter(id => id !== songId),
            songs: pl.songs.filter(s => s.id !== songId)
          };
        }
        return pl;
      })
    }));

    try {
      const { error } = await supabase.from('playlist_songs').delete().match({ playlist_id: playlistId, song_id: songId });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Failed to remove song from playlist in cloud, rolling back:', e);
      set({ playlists: previousPlaylists });
      return false;
    }
  },

  reorderSongs: async (playlistId, oldIndex, newIndex) => {
    // Implementing exact position updates safely requires an RPC, or fetching all and mass updating.
    // For MVP, we'll fetch all songs, reorder the array, and mass update.
    try {
      const { data: mappings } = await supabase
        .from('playlist_songs')
        .select('song_id, position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });
        
      if (!mappings) return false;
      
      const newMappings = [...mappings];
      const [moved] = newMappings.splice(oldIndex, 1);
      newMappings.splice(newIndex, 0, moved);
      
      // Upsert the new positions
      const updates = newMappings.map((m, idx) => ({
        playlist_id: playlistId,
        song_id: m.song_id,
        position: idx + 1
      }));
      
      const { error } = await supabase.from('playlist_songs').upsert(updates);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Failed to reorder playlist:', e);
      return false;
    }
  }
    }),
    {
      name: 'raagax_playlist_store',
      partialize: (state) => ({ playlists: state.playlists }),
    }
  )
);
