import { create } from 'zustand';
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

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
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
      
      const parsedPlaylists: UserPlaylist[] = playlistsData.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        coverUrl: p.cover_url || '',
        visibility: p.visibility as any,
        ownerId: p.owner_id,
        creator: 'You',
        songIds: [],
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const id = crypto.randomUUID();
      const { data, error } = await supabase.from('playlists').insert({
        id,
        title,
        description,
        visibility,
        owner_id: session.user.id,
        language: 'Telugu' // Default
      }).select().single();

      if (error) throw error;

      const newPl: UserPlaylist = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        coverUrl: data.cover_url || '',
        visibility: data.visibility as any,
        ownerId: data.owner_id,
        creator: 'You',
        songIds: [],
        songs: []
      };

      set(state => ({ playlists: [newPl, ...state.playlists] }));
      return newPl;
    } catch (e) {
      console.error('Failed to create playlist:', e);
      return null;
    }
  },

  deletePlaylist: async (playlistId) => {
    try {
      const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
      if (error) throw error;
      set(state => ({ playlists: state.playlists.filter(p => p.id !== playlistId) }));
      return true;
    } catch (e) {
      console.error('Failed to delete playlist:', e);
      return false;
    }
  },

  addSongToPlaylist: async (playlistId, song) => {
    try {
      // First, upsert the song into canonical_songs to ensure it exists
      await supabase.from('canonical_songs').upsert({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        cover_url: song.coverUrl,
        language: 'Telugu'
      }, { onConflict: 'id' });

      // Get current max position
      const { data: existing } = await supabase
        .from('playlist_songs')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = (existing && existing[0]?.position !== undefined) ? existing[0].position + 1 : 1;

      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from('playlist_songs').insert({
        playlist_id: playlistId,
        song_id: song.id,
        position: nextPosition,
        added_by: session?.user?.id
      });

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Failed to add song to playlist:', e);
      return false;
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    try {
      const { error } = await supabase.from('playlist_songs').delete().match({ playlist_id: playlistId, song_id: songId });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Failed to remove song from playlist:', e);
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
}));
