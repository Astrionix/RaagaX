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

export interface CloudDownloadRecord {
  song_id: string;
  user_id: string;
  downloaded_at: string;
  song_title?: string;
  song_artist?: string;
  song_cover?: string;
  song_duration?: number;
  song_version?: string;
}

export class AccountSyncEngine {
  private static instance: AccountSyncEngine;
  private isFlushing = false;
  private isOnline = true;

  private channel: any = null;
  private subscribedUserId: string | null = null;

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

      // Auto-listen to auth changes and reconcile
      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user?.id) {
          this.subscribeToRealtime(session.user.id);
          this.reconcile(session.user.id);
        } else {
          this.unsubscribe();
        }
      });

      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) {
          this.subscribeToRealtime(data.session.user.id);
          this.reconcile(data.session.user.id);
        }
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

  public async subscribeToRealtime(userId: string) {
    if (!this.isUUID(userId)) return;
    if (this.subscribedUserId === userId && this.channel) {
      return; // Already subscribed
    }

    this.unsubscribe();
    this.subscribedUserId = userId;

    const channelName = `user-account-sync:${userId}`;

    try {
      const rawChannels = supabase.getChannels();
      const channels = Array.isArray(rawChannels) ? rawChannels : [];
      const existing = channels.find((c: any) => c.topic === `realtime:${channelName}` || c.topic === channelName);
      if (existing) {
        await supabase.removeChannel(existing);
      }
    } catch {}

    try {
      this.channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'liked_songs', filter: `user_id=eq.${userId}` },
          async () => {
            console.log('[AccountSyncEngine] Realtime liked_songs update detected, reconciling...');
            await this.reconcile(userId);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_downloads', filter: `user_id=eq.${userId}` },
          async () => {
            console.log('[AccountSyncEngine] Realtime user_downloads update detected, reconciling...');
            await this.reconcile(userId);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[AccountSyncEngine] Realtime subscription error:', err);
    }
  }

  public unsubscribe() {
    this.subscribedUserId = null;
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
  }

  public async reconcile(userId: string): Promise<string[]> {
    if (!this.isUUID(userId)) return [];
    try {
      const localDb = LocalDatabase.getInstance();
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      const { OfflineCatalog } = await import('@/lib/offline/OfflineCatalog');

      // 1. Reconcile Liked Songs
      const { data: likedData, error: likedError } = await supabase
        .from('liked_songs')
        .select('song_id')
        .eq('user_id', userId);

      if (!likedError && likedData) {
        const songIds = likedData.map((row: any) => row.song_id);
        await localDb.setUserStore(userId, 'liked_songs', songIds);
        usePlayerStore.setState({ likedSongIds: songIds });
      }

      // 2. Reconcile Cloud Download Records (User's Cloud Download List)
      try {
        const { data: downloadData, error: downloadError } = await supabase
          .from('user_downloads')
          .select('*')
          .eq('user_id', userId);

        if (!downloadError && downloadData) {
          const records: CloudDownloadRecord[] = downloadData.map((row: any) => ({
            song_id: row.song_id,
            user_id: row.user_id,
            downloaded_at: row.downloaded_at || row.created_at,
            song_title: row.song_title,
            song_artist: row.song_artist,
            song_cover: row.song_cover,
            song_duration: row.song_duration,
            song_version: row.song_version,
          }));

          await localDb.setUserStore(userId, 'user_downloads', records);
          const cloudIds = records.map((r) => r.song_id);
          usePlayerStore.setState({
            cloudDownloadedSongIds: cloudIds,
            cloudDownloadRecords: records,
          });
        }
      } catch {}

      // 3. Authoritative Local Device Storage Check
      // IMPORTANT RULE: Only mark as locally downloaded if the actual audio file is present in IndexedDB on THIS device!
      const catalog = OfflineCatalog.getInstance();
      const allLocalTracks = await catalog.getAllTracks();
      const localIds = allLocalTracks.map((t) => t.trackId);
      usePlayerStore.setState({ downloadedSongIds: localIds });

      return localIds;
    } catch (e) {
      console.warn('[AccountSyncEngine] Reconcile error:', e);
    }
    return [];
  }

  // --- LIKES ---

  public async getLikedSongIds(userId: string): Promise<string[]> {
    const localDb = LocalDatabase.getInstance();
    const cached = await localDb.getUserStore<string[]>(userId, 'liked_songs');

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

    return cached || [];
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

  // --- CLOUD DOWNLOAD RECORDS ---

  public async getCloudDownloadRecords(userId: string): Promise<CloudDownloadRecord[]> {
    const localDb = LocalDatabase.getInstance();
    const cached = await localDb.getUserStore<CloudDownloadRecord[]>(userId, 'user_downloads');
    if (cached) return cached;

    if (this.isOnline && this.isUUID(userId)) {
      try {
        const { data, error } = await supabase
          .from('user_downloads')
          .select('*')
          .eq('user_id', userId)
          .order('downloaded_at', { ascending: false });

        if (!error && data) {
          const records = data as CloudDownloadRecord[];
          await localDb.setUserStore(userId, 'user_downloads', records);
          return records;
        }
      } catch (e) {
        console.warn('[AccountSyncEngine] Failed to fetch cloud downloads from Supabase:', e);
      }
    }

    return [];
  }

  public async recordCloudDownload(userId: string, song: Song): Promise<void> {
    const localDb = LocalDatabase.getInstance();
    const records = (await localDb.getUserStore<CloudDownloadRecord[]>(userId, 'user_downloads')) || [];
    
    const newRecord: CloudDownloadRecord = {
      song_id: song.id,
      user_id: userId,
      downloaded_at: new Date().toISOString(),
      song_title: song.title,
      song_artist: song.artist,
      song_cover: song.coverUrl,
      song_duration: song.duration,
      song_version: '1.0',
    };

    const updated = [newRecord, ...records.filter((r) => r.song_id !== song.id)];
    await localDb.setUserStore(userId, 'user_downloads', updated);

    // Update in-memory player store
    try {
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      const cloudIds = updated.map((r) => r.song_id);
      usePlayerStore.setState({
        cloudDownloadedSongIds: cloudIds,
        cloudDownloadRecords: updated,
      });
    } catch {}

    if (this.isOnline && this.isUUID(userId)) {
      try {
        await supabase
          .from('user_downloads')
          .upsert({
            user_id: userId,
            song_id: song.id,
            song_title: song.title,
            song_artist: song.artist,
            song_cover: song.coverUrl,
            song_duration: song.duration,
            downloaded_at: newRecord.downloaded_at,
          }, { onConflict: 'user_id,song_id' });
        return;
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote cloud download record failed, queueing offline mutation:', e);
      }
    }

    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'RECORD_DOWNLOAD',
      entity_id: song.id,
      payload: newRecord,
      created_at: new Date().toISOString(),
    };
    await localDb.addPendingMutation(mutation);
  }

  public async removeCloudDownloadRecord(userId: string, songId: string): Promise<void> {
    const localDb = LocalDatabase.getInstance();
    const records = (await localDb.getUserStore<CloudDownloadRecord[]>(userId, 'user_downloads')) || [];
    const updated = records.filter((r) => r.song_id !== songId);
    await localDb.setUserStore(userId, 'user_downloads', updated);

    try {
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      const cloudIds = updated.map((r) => r.song_id);
      usePlayerStore.setState({
        cloudDownloadedSongIds: cloudIds,
        cloudDownloadRecords: updated,
      });
    } catch {}

    if (this.isOnline && this.isUUID(userId)) {
      try {
        await supabase
          .from('user_downloads')
          .delete()
          .eq('user_id', userId)
          .eq('song_id', songId);
        return;
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote delete download record failed, queueing offline mutation:', e);
      }
    }

    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
      type: 'REMOVE_DOWNLOAD_RECORD',
      entity_id: songId,
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
          } else if (mut.type === 'RECORD_DOWNLOAD') {
            await supabase.from('user_downloads').upsert({
              user_id: mut.user_id,
              song_id: mut.entity_id,
              song_title: mut.payload?.song_title,
              song_artist: mut.payload?.song_artist,
              song_cover: mut.payload?.song_cover,
              song_duration: mut.payload?.song_duration,
              downloaded_at: mut.payload?.downloaded_at || mut.created_at,
            }, { onConflict: 'user_id,song_id' });
          } else if (mut.type === 'REMOVE_DOWNLOAD_RECORD') {
            await supabase.from('user_downloads').delete().eq('user_id', mut.user_id).eq('song_id', mut.entity_id);
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
