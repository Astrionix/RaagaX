import { supabase } from '@/lib/supabase';
import { LocalDatabase, PendingMutation } from '@/lib/offline/LocalDatabase';
import { Song } from '@/types/music';

export interface UserPlaylist {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cover_url?: string;
  created_at: string;
  updated_at: string;
  songs?: Song[];
}

export class AccountSyncEngine {
  private static instance: AccountSyncEngine;
  private isFlushing = false;
  private isOnline = true;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushPendingMutations();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  public static getInstance(): AccountSyncEngine {
    if (!AccountSyncEngine.instance) {
      AccountSyncEngine.instance = new AccountSyncEngine();
    }
    return AccountSyncEngine.instance;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  // --- LIKES ---

  public async getLikedSongIds(userId: string): Promise<string[]> {
    const localDb = LocalDatabase.getInstance();
    const cached = await localDb.getUserStore<string[]>(userId, 'liked_songs');
    if (cached) return cached;

    if (this.isOnline && this.isUUID(userId)) {
      try {
        const { data, error } = await supabase
          .from('liked_songs')
          .select('song_id')
          .eq('user_id', userId);

        if (!error && data) {
          const songIds = data.map((row: any) => row.song_id);
          await localDb.setUserStore(userId, 'liked_songs', songIds);
          return songIds;
        }
      } catch (e) {
        console.warn('[AccountSyncEngine] Failed to fetch liked songs from Supabase:', e);
      }
    }

    return [];
  }

  public async likeSong(userId: string, songId: string): Promise<void> {
    const localDb = LocalDatabase.getInstance();
    const currentLikes = (await localDb.getUserStore<string[]>(userId, 'liked_songs')) || [];
    if (!currentLikes.includes(songId)) {
      const updated = [songId, ...currentLikes];
      await localDb.setUserStore(userId, 'liked_songs', updated);
    }

    if (this.isOnline && this.isUUID(userId)) {
      try {
        await supabase
          .from('liked_songs')
          .upsert({ user_id: userId, song_id: songId }, { onConflict: 'user_id,song_id' });
        return;
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote like failed, queueing offline mutation:', e);
      }
    }

    // Queue mutation for offline or guest recovery
    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'LIKE_SONG',
      entity_id: songId,
      created_at: new Date().toISOString(),
    };
    await localDb.addPendingMutation(mutation);
  }

  public async unlikeSong(userId: string, songId: string): Promise<void> {
    const localDb = LocalDatabase.getInstance();
    const currentLikes = (await localDb.getUserStore<string[]>(userId, 'liked_songs')) || [];
    const updated = currentLikes.filter((id) => id !== songId);
    await localDb.setUserStore(userId, 'liked_songs', updated);

    if (this.isOnline && this.isUUID(userId)) {
      try {
        await supabase
          .from('liked_songs')
          .delete()
          .eq('user_id', userId)
          .eq('song_id', songId);
        return;
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote unlike failed, queueing offline mutation:', e);
      }
    }

    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'UNLIKE_SONG',
      entity_id: songId,
      created_at: new Date().toISOString(),
    };
    await localDb.addPendingMutation(mutation);
  }

  // --- PLAYLISTS ---

  public async getUserPlaylists(userId: string): Promise<UserPlaylist[]> {
    const localDb = LocalDatabase.getInstance();
    const cached = await localDb.getUserStore<UserPlaylist[]>(userId, 'playlists');
    if (cached) return cached;

    if (this.isOnline && this.isUUID(userId)) {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const playlists = data as UserPlaylist[];
          await localDb.setUserStore(userId, 'playlists', playlists);
          return playlists;
        }
      } catch (e) {
        console.warn('[AccountSyncEngine] Failed to fetch playlists from Supabase:', e);
      }
    }

    return [];
  }

  public async createPlaylist(userId: string, name: string, description?: string): Promise<UserPlaylist> {
    const localDb = LocalDatabase.getInstance();
    const playlists = (await localDb.getUserStore<UserPlaylist[]>(userId, 'playlists')) || [];

    const newPlaylist: UserPlaylist = {
      id: this.isUUID(userId) ? crypto.randomUUID() : `local_pl_${Date.now()}`,
      user_id: userId,
      name,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      songs: [],
    };

    const updatedPlaylists = [newPlaylist, ...playlists];
    await localDb.setUserStore(userId, 'playlists', updatedPlaylists);

    if (this.isOnline && this.isUUID(userId)) {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .insert({
            id: newPlaylist.id,
            user_id: userId,
            name,
            description,
          })
          .select()
          .single();

        if (!error && data) return data as UserPlaylist;
      } catch (e) {
        console.warn('[AccountSyncEngine] Create remote playlist failed, queueing offline mutation:', e);
      }
    }

    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'CREATE_PLAYLIST',
      entity_id: newPlaylist.id,
      payload: { name, description },
      created_at: new Date().toISOString(),
    };
    await localDb.addPendingMutation(mutation);

    return newPlaylist;
  }

  public async deletePlaylist(userId: string, playlistId: string): Promise<void> {
    const localDb = LocalDatabase.getInstance();
    const playlists = (await localDb.getUserStore<UserPlaylist[]>(userId, 'playlists')) || [];
    const updatedPlaylists = playlists.filter((p) => p.id !== playlistId);
    await localDb.setUserStore(userId, 'playlists', updatedPlaylists);

    if (this.isOnline && this.isUUID(userId)) {
      try {
        // Cascade delete on playlist_songs handled by DB FK constraint
        await supabase
          .from('playlists')
          .delete()
          .eq('id', playlistId)
          .eq('user_id', userId);
        return;
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote delete playlist failed, queueing offline mutation:', e);
      }
    }

    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'DELETE_PLAYLIST',
      entity_id: playlistId,
      created_at: new Date().toISOString(),
    };
    await localDb.addPendingMutation(mutation);
  }

  // --- OFFLINE SYNC FLUSH ---

  public async flushPendingMutations(userId?: string): Promise<void> {
    if (this.isFlushing || !this.isOnline) return;
    this.isFlushing = true;

    try {
      const activeUserId = userId || (await supabase.auth.getSession())?.data?.session?.user?.id;
      if (!activeUserId || !this.isUUID(activeUserId)) return;

      const localDb = LocalDatabase.getInstance();
      const mutations = await localDb.getPendingMutations(activeUserId);

      for (const mut of mutations) {
        try {
          if (mut.type === 'LIKE_SONG') {
            await supabase.from('liked_songs').upsert({ user_id: mut.user_id, song_id: mut.entity_id }, { onConflict: 'user_id,song_id' });
          } else if (mut.type === 'UNLIKE_SONG') {
            await supabase.from('liked_songs').delete().eq('user_id', mut.user_id).eq('song_id', mut.entity_id);
          } else if (mut.type === 'CREATE_PLAYLIST') {
            await supabase.from('playlists').insert({ id: mut.entity_id, user_id: mut.user_id, name: mut.payload?.name, description: mut.payload?.description });
          } else if (mut.type === 'DELETE_PLAYLIST') {
            await supabase.from('playlists').delete().eq('id', mut.entity_id).eq('user_id', mut.user_id);
          }

          await localDb.removePendingMutation(mut.mutation_id);
        } catch (err) {
          console.warn('[AccountSyncEngine] Failed to process pending mutation:', mut.mutation_id, err);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
