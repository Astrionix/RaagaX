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
  private hasUserDownloadsTable: boolean = true;
  private inFlightReconcile: Promise<string[]> | null = null;
  private lastReconcileTime = 0;
  private lastReconciledUser: string | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushPendingMutations();
        if (this.subscribedUserId) {
          this.subscribeToRealtime(this.subscribedUserId);
          this.reconcile(this.subscribedUserId);
        }
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      // Handle App Foreground / Visibility Resume (Reconcile missed changes and resubscribe if needed)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this.subscribedUserId) {
            this.subscribeToRealtime(this.subscribedUserId);
            this.reconcile(this.subscribedUserId);
          }
        });
      }

      // Auto-listen to auth changes and reconcile idempotently
      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user?.id) {
          this.subscribeToRealtime(session.user.id);
          this.reconcile(session.user.id);
        } else {
          this.unsubscribe();
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
    if (this.subscribedUserId === userId && this.channel && this.channel.state === 'joined') {
      return; // Already actively subscribed
    }

    this.unsubscribe();
    this.subscribedUserId = userId;

    const channelName = `user-account-sync:${userId}`;

    try {
      const rawChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
      const channels = Array.isArray(rawChannels) ? rawChannels : [];
      const existing = channels.find((c: any) => c.topic === `realtime:${channelName}` || c.topic === channelName);
      if (existing) {
        await supabase.removeChannel(existing);
      }
    } catch {}

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerReconcile = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.reconcile(userId);
      }, 150);
    };

    try {
      this.channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'liked_songs', filter: `user_id=eq.${userId}` },
          (payload: any) => {
            this.handleRealtimeLikedSongs(userId, payload);
            triggerReconcile();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playlists', filter: `owner_id=eq.${userId}` },
          (payload: any) => {
            this.handleRealtimePlaylists(userId, payload);
            triggerReconcile();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'playlist_songs' },
          (payload: any) => {
            this.handleRealtimePlaylistSongs(payload);
            triggerReconcile();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_favorites', filter: `user_id=eq.${userId}` },
          (payload: any) => {
            this.handleRealtimeUserFavorites(userId, payload);
            triggerReconcile();
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('[AccountSyncEngine] Subscribed to account realtime changes');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[AccountSyncEngine] Realtime channel status: ${status}`, err);
          }
        });
    } catch (err) {
      console.warn('[AccountSyncEngine] Realtime subscription error:', err);
    }
  }

  public async handleRealtimeLikedSongs(userId: string, payload: any): Promise<void> {
    try {
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      const eventType = payload.eventType;

      if (eventType === 'INSERT' && payload.new?.song_id) {
        const songId = payload.new.song_id;
        const currentIds = usePlayerStore.getState().likedSongIds;
        if (!currentIds.includes(songId)) {
          usePlayerStore.setState({ likedSongIds: [songId, ...currentIds] });
        }
        import('@/lib/discovery/SongResolver').then(({ SongResolver }) => {
          SongResolver.resolveSongs([songId]).then((resolved) => {
            if (resolved && resolved.length > 0) {
              const currentSongs = usePlayerStore.getState().likedSongs;
              if (!currentSongs.some((s) => s.id === songId)) {
                usePlayerStore.setState({ likedSongs: [resolved[0], ...currentSongs] });
              }
            }
          }).catch(() => {});
        }).catch(() => {});
      } else if (eventType === 'DELETE') {
        const songId = payload.old?.song_id;
        if (songId) {
          const currentIds = usePlayerStore.getState().likedSongIds;
          const currentSongs = usePlayerStore.getState().likedSongs;
          usePlayerStore.setState({
            likedSongIds: currentIds.filter((id) => id !== songId),
            likedSongs: currentSongs.filter((s) => s.id !== songId),
          });
        }
      }
    } catch (err) {
      console.warn('[AccountSyncEngine] handleRealtimeLikedSongs error:', err);
    }
  }

  public async handleRealtimePlaylists(userId: string, payload: any): Promise<void> {
    try {
      const { usePlaylistStore } = await import('@/context/usePlaylistStore');
      const eventType = payload.eventType;

      if (eventType === 'INSERT' && payload.new) {
        const p = payload.new;
        const currentPlaylists = usePlaylistStore.getState().playlists;
        if (!currentPlaylists.some((pl) => pl.id === p.id)) {
          const newPl = {
            id: p.id,
            title: p.name || p.title || 'Untitled Playlist',
            description: p.description || '',
            coverUrl: p.cover_url || '',
            visibility: (p.visibility || 'private') as any,
            ownerId: p.owner_id || userId,
            creator: 'You',
            songIds: [],
            songs: [],
          };
          usePlaylistStore.setState({ playlists: [newPl, ...currentPlaylists] });
        }
      } else if (eventType === 'DELETE' && payload.old?.id) {
        const playlistId = payload.old.id;
        const currentPlaylists = usePlaylistStore.getState().playlists;
        usePlaylistStore.setState({
          playlists: currentPlaylists.filter((pl) => pl.id !== playlistId),
        });
      } else if (eventType === 'UPDATE' && payload.new) {
        const p = payload.new;
        const currentPlaylists = usePlaylistStore.getState().playlists;
        usePlaylistStore.setState({
          playlists: currentPlaylists.map((pl) => {
            if (pl.id === p.id) {
              return {
                ...pl,
                title: p.name || p.title || pl.title,
                description: p.description !== undefined ? p.description : pl.description,
                coverUrl: p.cover_url || pl.coverUrl,
                visibility: (p.visibility || pl.visibility) as any,
              };
            }
            return pl;
          }),
        });
      }
    } catch (err) {
      console.warn('[AccountSyncEngine] handleRealtimePlaylists error:', err);
    }
  }

  public async handleRealtimePlaylistSongs(payload: any): Promise<void> {
    try {
      const { usePlaylistStore } = await import('@/context/usePlaylistStore');
      const eventType = payload.eventType;

      if (eventType === 'INSERT' && payload.new?.playlist_id && payload.new?.song_id) {
        const { playlist_id, song_id } = payload.new;
        const currentPlaylists = usePlaylistStore.getState().playlists;
        usePlaylistStore.setState({
          playlists: currentPlaylists.map((pl) => {
            if (pl.id === playlist_id && !pl.songIds.includes(song_id)) {
              return {
                ...pl,
                songIds: [...pl.songIds, song_id],
              };
            }
            return pl;
          }),
        });
      } else if (eventType === 'DELETE' && payload.old?.playlist_id && payload.old?.song_id) {
        const { playlist_id, song_id } = payload.old;
        const currentPlaylists = usePlaylistStore.getState().playlists;
        usePlaylistStore.setState({
          playlists: currentPlaylists.map((pl) => {
            if (pl.id === playlist_id) {
              return {
                ...pl,
                songIds: pl.songIds.filter((id) => id !== song_id),
                songs: pl.songs.filter((s) => s.id !== song_id),
              };
            }
            return pl;
          }),
        });
      }
    } catch (err) {
      console.warn('[AccountSyncEngine] handleRealtimePlaylistSongs error:', err);
    }
  }

  public async handleRealtimeUserFavorites(userId: string, payload: any): Promise<void> {
    try {
      const { usePlayerStore } = await import('@/context/usePlayerStore');
      const eventType = payload.eventType;

      if (eventType === 'INSERT' && payload.new) {
        const { item_id, item_type } = payload.new;
        if (item_type === 'artist') {
          const current = usePlayerStore.getState().favoriteArtistIds;
          if (!current.includes(item_id)) {
            usePlayerStore.setState({ favoriteArtistIds: [...current, item_id] });
          }
        } else if (item_type === 'album') {
          const current = usePlayerStore.getState().favoriteAlbumIds;
          if (!current.includes(item_id)) {
            usePlayerStore.setState({ favoriteAlbumIds: [...current, item_id] });
          }
        }
      } else if (eventType === 'DELETE' && (payload.old || payload.new)) {
        const record = payload.old || payload.new;
        const { item_id, item_type } = record;
        if (item_type === 'artist') {
          const current = usePlayerStore.getState().favoriteArtistIds;
          usePlayerStore.setState({ favoriteArtistIds: current.filter((id) => id !== item_id) });
        } else if (item_type === 'album') {
          const current = usePlayerStore.getState().favoriteAlbumIds;
          usePlayerStore.setState({ favoriteAlbumIds: current.filter((id) => id !== item_id) });
        }
      }
    } catch (err) {
      console.warn('[AccountSyncEngine] handleRealtimeUserFavorites error:', err);
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

    // Coalesce duplicate concurrent reconcile calls
    if (this.inFlightReconcile && this.lastReconciledUser === userId) {
      return this.inFlightReconcile;
    }

    const now = Date.now();
    if (this.lastReconciledUser === userId && now - this.lastReconcileTime < 800) {
      return [];
    }

    this.lastReconciledUser = userId;
    this.lastReconcileTime = now;

    this.inFlightReconcile = (async () => {
      try {
        const localDb = LocalDatabase.getInstance();
        const { usePlayerStore } = await import('@/context/usePlayerStore');
        const { usePlaylistStore } = await import('@/context/usePlaylistStore');
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

        // Resolve full song metadata for liked songs cache
        import('@/lib/discovery/SongResolver').then(({ SongResolver }) => {
          SongResolver.resolveSongs(songIds).then((resolved) => {
            if (resolved && resolved.length > 0) {
              usePlayerStore.setState({ likedSongs: resolved });
            }
          }).catch(() => {});
        }).catch(() => {});
      }

      // 2. Reconcile Playlists
      try {
        await usePlaylistStore.getState().fetchPlaylists();
      } catch (plErr) {
        console.warn('[AccountSyncEngine] Failed to reconcile playlists:', plErr);
      }

      // 3. Reconcile User Favorites (Artists & Albums)
      try {
        const { data: favData, error: favError } = await supabase
          .from('user_favorites')
          .select('item_id, item_type')
          .eq('user_id', userId);

        if (!favError && favData) {
          const favArtists = favData.filter((f: any) => f.item_type === 'artist').map((f: any) => f.item_id);
          const favAlbums = favData.filter((f: any) => f.item_type === 'album').map((f: any) => f.item_id);
          usePlayerStore.setState({
            favoriteArtistIds: favArtists,
            favoriteAlbumIds: favAlbums
          });
        }
      } catch (favErr) {
        console.warn('[AccountSyncEngine] Failed to reconcile favorites:', favErr);
      }

      // 4. Reconcile Cloud Download Records (User's Cloud Download List)
      if (this.hasUserDownloadsTable) {
        try {
          const { data: downloadData, error: downloadError } = await supabase
            .from('user_downloads')
            .select('*')
            .eq('user_id', userId);

          if (downloadError) {
            if (downloadError.code === '42P01' || downloadError.message?.includes('does not exist')) {
              this.hasUserDownloadsTable = false;
            }
          } else if (downloadData) {
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
        } catch (e) {
          this.hasUserDownloadsTable = false;
        }
      }

        // 5. Authoritative Local Device Storage Check
        // IMPORTANT RULE: Only mark as locally downloaded if the actual audio file is present in IndexedDB on THIS device!
        const catalog = OfflineCatalog.getInstance();
        const allLocalTracks = await catalog.getAllTracks();
        const localIds = allLocalTracks.map((t) => t.trackId);
        usePlayerStore.setState({ downloadedSongIds: localIds });

        return localIds;
      } catch (e) {
        console.warn('[AccountSyncEngine] Reconcile error:', e);
        return [];
      } finally {
        this.inFlightReconcile = null;
      }
    })();

    return this.inFlightReconcile;
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
    let effectiveUserId = userId;
    if (!this.isUUID(effectiveUserId)) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id && this.isUUID(data.session.user.id)) {
          effectiveUserId = data.session.user.id;
        }
      } catch {}
    }

    const localDb = LocalDatabase.getInstance();
    const currentLikes = (await localDb.getUserStore<string[]>(effectiveUserId, 'liked_songs')) || [];
    if (!currentLikes.includes(songId)) {
      const updated = [songId, ...currentLikes];
      await localDb.setUserStore(effectiveUserId, 'liked_songs', updated);
    }

    if (this.isOnline && this.isUUID(effectiveUserId)) {
      try {
        const { error } = await supabase
          .from('liked_songs')
          .upsert(
            { user_id: effectiveUserId, song_id: songId },
            { onConflict: 'user_id,song_id', ignoreDuplicates: true }
          );

        if (error) {
          // If 409 Conflict or 23505 duplicate key, the song is already liked (idempotent success)
          if (error.code === '23505' || (error as any).status === 409) {
            return;
          }
          if (error.code === '23503') {
            console.debug('[AccountSyncEngine] Foreign key pending, kept like locally');
            return;
          }
          console.warn('[AccountSyncEngine] Remote like failed:', error.message);
        } else {
          return;
        }
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote like failed, queueing offline mutation:', e);
      }
    }

    // Queue mutation for offline or guest recovery
    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: effectiveUserId,
      type: 'LIKE_SONG',
      entity_id: songId,
      created_at: new Date().toISOString(),
    };
    await localDb.addPendingMutation(mutation);
  }

  public async unlikeSong(userId: string, songId: string): Promise<void> {
    let effectiveUserId = userId;
    if (!this.isUUID(effectiveUserId)) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id && this.isUUID(data.session.user.id)) {
          effectiveUserId = data.session.user.id;
        }
      } catch {}
    }

    const localDb = LocalDatabase.getInstance();
    const currentLikes = (await localDb.getUserStore<string[]>(effectiveUserId, 'liked_songs')) || [];
    const updated = currentLikes.filter((id) => id !== songId);
    await localDb.setUserStore(effectiveUserId, 'liked_songs', updated);

    if (this.isOnline && this.isUUID(effectiveUserId)) {
      try {
        const { error } = await supabase
          .from('liked_songs')
          .delete()
          .eq('user_id', effectiveUserId)
          .eq('song_id', songId);

        if (!error) return;
      } catch (e) {
        console.warn('[AccountSyncEngine] Remote unlike failed, queueing offline mutation:', e);
      }
    }

    const mutation: PendingMutation = {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: effectiveUserId,
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
          .or(`owner_id.eq.${userId},user_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const playlists = (data || []).map((p: any) => ({
            id: p.id,
            user_id: p.owner_id || p.user_id || userId,
            name: p.name || p.title || 'Untitled Playlist',
            description: p.description || '',
            created_at: p.created_at || new Date().toISOString(),
            updated_at: p.updated_at || new Date().toISOString(),
            songs: [],
          })) as UserPlaylist[];
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
            owner_id: userId,
            name,
            description: description || '',
          })
          .select()
          .single();

        if (!error && data) return {
          id: data.id,
          user_id: data.owner_id || userId,
          name: data.name || name,
          description: data.description || '',
          created_at: data.created_at,
          updated_at: data.updated_at,
          songs: [],
        } as UserPlaylist;
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
        await supabase
          .from('playlists')
          .delete()
          .eq('id', playlistId);
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

    if (this.hasUserDownloadsTable && this.isOnline && this.isUUID(userId)) {
      try {
        const { data, error } = await supabase
          .from('user_downloads')
          .select('*')
          .eq('user_id', userId)
          .order('downloaded_at', { ascending: false });

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            this.hasUserDownloadsTable = false;
          }
        } else if (data) {
          const records = data as CloudDownloadRecord[];
          await localDb.setUserStore(userId, 'user_downloads', records);
          return records;
        }
      } catch (e) {
        this.hasUserDownloadsTable = false;
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

    if (this.hasUserDownloadsTable && this.isOnline && this.isUUID(userId)) {
      try {
        const { error } = await supabase
          .from('user_downloads')
          .upsert({
            user_id: userId,
            song_id: song.id,
            song_title: song.title,
            song_artist: song.artist,
            song_cover: song.coverUrl,
            song_duration: song.duration,
            song_version: '1.0',
            downloaded_at: newRecord.downloaded_at,
          }, { onConflict: 'user_id,song_id' });
          
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            this.hasUserDownloadsTable = false;
          } else {
            console.warn('[AccountSyncEngine] Remote cloud download record failed, queueing offline mutation:', error);
          }
        } else {
          return;
        }
      } catch (e) {
        this.hasUserDownloadsTable = false;
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

    if (this.hasUserDownloadsTable && this.isOnline && this.isUUID(userId)) {
      try {
        const { error } = await supabase
          .from('user_downloads')
          .delete()
          .eq('user_id', userId)
          .eq('song_id', songId);
        if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          this.hasUserDownloadsTable = false;
        } else {
          return;
        }
      } catch (e) {
        this.hasUserDownloadsTable = false;
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
            await supabase.from('liked_songs').upsert({ user_id: mut.user_id, song_id: mut.entity_id }, { onConflict: 'user_id,song_id', ignoreDuplicates: true });
          } else if (mut.type === 'UNLIKE_SONG') {
            await supabase.from('liked_songs').delete().eq('user_id', mut.user_id).eq('song_id', mut.entity_id);
          } else if (mut.type === 'CREATE_PLAYLIST') {
            await supabase.from('playlists').insert({ id: mut.entity_id, owner_id: mut.user_id, name: mut.payload?.name, description: mut.payload?.description });
          } else if (mut.type === 'DELETE_PLAYLIST') {
            await supabase.from('playlists').delete().eq('id', mut.entity_id);
          } else if (mut.type === 'RECORD_DOWNLOAD' && this.hasUserDownloadsTable) {
            const { error } = await supabase.from('user_downloads').upsert({
              user_id: mut.user_id,
              song_id: mut.entity_id,
              song_title: mut.payload?.song_title,
              song_artist: mut.payload?.song_artist,
              song_cover: mut.payload?.song_cover,
              song_duration: mut.payload?.song_duration,
              downloaded_at: mut.payload?.downloaded_at || mut.created_at,
            }, { onConflict: 'user_id,song_id' });
            if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
              this.hasUserDownloadsTable = false;
            }
          } else if (mut.type === 'REMOVE_DOWNLOAD_RECORD' && this.hasUserDownloadsTable) {
            const { error } = await supabase.from('user_downloads').delete().eq('user_id', mut.user_id).eq('song_id', mut.entity_id);
            if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
              this.hasUserDownloadsTable = false;
            }
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
