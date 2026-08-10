import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { usePlayerStore } from '@/context/usePlayerStore';

interface LibraryMutation {
  id: string;
  type: 'LIKE' | 'UNLIKE';
  songId: string;
  createdAt: number;
  retryCount: number;
}

export class LibrarySyncManager {
  private static instance: LibrarySyncManager;
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private mutationQueue: LibraryMutation[] = [];
  private isProcessingQueue = false;
  private deviceId: string;
  private localRevision: number = 0;

  private constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.loadQueueFromStorage();

    // Start listening to auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (this.userId !== session.user.id) {
          this.userId = session.user.id;
          this.initialize();
        }
      } else {
        this.cleanup();
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        this.userId = data.session.user.id;
        this.initialize();
      }
    });
    
    // Periodically process mutation queue in case of transient failures
    setInterval(() => this.processMutationQueue(), 5000);
  }

  public static getInstance(): LibrarySyncManager {
    if (!LibrarySyncManager.instance) {
      LibrarySyncManager.instance = new LibrarySyncManager();
    }
    return LibrarySyncManager.instance;
  }

  private getOrCreateDeviceId(): string {
    let id = localStorage.getItem('raagax_library_device_id');
    if (!id) {
      id = `device_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('raagax_library_device_id', id);
    }
    return id;
  }

  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('raagax_library_mutation_queue');
      if (stored) {
        this.mutationQueue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load library mutation queue', e);
    }
  }

  private saveQueueToStorage() {
    try {
      localStorage.setItem('raagax_library_mutation_queue', JSON.stringify(this.mutationQueue));
    } catch (e) {
      console.error('Failed to save library mutation queue', e);
    }
  }

  private async initialize() {
    if (!this.userId) return;
    
    // 1. Reconcile local state with cloud (fetches library + current revision)
    await this.reconcile();

    // 2. Subscribe to realtime library channel
    this.subscribeToChannel();

    // 3. Process any mutations that were pending while offline
    this.processMutationQueue();
  }

  private cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
    this.mutationQueue = [];
    this.localRevision = 0;
    this.saveQueueToStorage();
  }

  private async subscribeToChannel() {
    if (this.channel) {
      await this.channel.unsubscribe();
    }

    if (!this.userId) return;

    const channelName = `library_sync_${this.userId}`;
    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'LIBRARY_MUTATION' }, (payload) => {
        this.handleRemoteMutation(payload.payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[LibrarySync] Subscribed to library channel');
        }
      });
  }

  public async reconcile() {
    if (!this.userId) return;

    try {
      // Fetch both the liked songs and the user's library revision
      const [songsResult, stateResult] = await Promise.all([
        supabase.from('liked_songs').select('song_id').eq('user_id', this.userId),
        supabase.from('user_library_state').select('revision').eq('user_id', this.userId).single()
      ]);

      if (songsResult.error) {
        console.error('[LibrarySync] Failed to reconcile library:', songsResult.error);
        return;
      }

      if (songsResult.data) {
        const cloudLikedSongs = songsResult.data.map(row => row.song_id);
        usePlayerStore.getState().setLikedSongIds(cloudLikedSongs);
        
        try {
          const { SongResolver } = await import('@/lib/discovery/SongResolver');
          const resolvedSongs = await SongResolver.resolveSongs(cloudLikedSongs);
          usePlayerStore.getState().setLikedSongs(resolvedSongs);
        } catch (resolveError) {
          console.error('[LibrarySync] Failed to resolve song metadata:', resolveError);
        }
        
        this.localRevision = stateResult.data?.revision || 0;
        console.log(`[LibrarySync] Reconciled library with cloud: ${cloudLikedSongs.length} songs. Revision: ${this.localRevision}`);
      }
    } catch (error) {
      console.error('[LibrarySync] Error during reconcile:', error);
    }
  }

  private handleRemoteMutation(payload: any) {
    if (!payload || payload.deviceId === this.deviceId) return; // Ignore our own broadcasts

    const { type, songId, revision } = payload;
    
    // Revision gap detection
    if (revision <= this.localRevision) {
      console.log(`[LibrarySync] Ignored outdated broadcast. Local: ${this.localRevision}, Broadcast: ${revision}`);
      return;
    }

    if (revision > this.localRevision + 1) {
      console.log(`[LibrarySync] Detected missed event! Local: ${this.localRevision}, Broadcast: ${revision}. Reconciling...`);
      this.reconcile();
      return;
    }

    // Perfect sequence: apply mutation and increment local revision
    this.localRevision = revision;
    const store = usePlayerStore.getState();
    const currentLikes = store.likedSongIds;

    console.log('[LibrarySync] Applied remote mutation:', payload);

    if (type === 'LIKE' && !currentLikes.includes(songId)) {
      store.setLikedSongIds([...currentLikes, songId]);
      
      // Attempt to resolve and append to likedSongs
      import('@/lib/discovery/SongResolver').then(({ SongResolver }) => {
        SongResolver.resolveSongs([songId]).then((resolved) => {
          if (resolved.length > 0) {
            const currentLikedSongs = usePlayerStore.getState().likedSongs;
            if (!currentLikedSongs.find(s => s.id === songId)) {
              usePlayerStore.getState().setLikedSongs([...currentLikedSongs, resolved[0]]);
            }
          }
        });
      });

    } else if (type === 'UNLIKE' && currentLikes.includes(songId)) {
      store.setLikedSongIds(currentLikes.filter(id => id !== songId));
      const currentLikedSongs = store.likedSongs;
      store.setLikedSongs(currentLikedSongs.filter(s => s.id !== songId));
    }
  }

  private enqueueMutation(type: 'LIKE' | 'UNLIKE', songId: string) {
    const mutation: LibraryMutation = {
      id: Math.random().toString(36).substring(2, 15),
      type,
      songId,
      createdAt: Date.now(),
      retryCount: 0
    };
    
    this.mutationQueue.push(mutation);
    this.saveQueueToStorage();
    this.processMutationQueue();
  }

  public likeSong(songId: string) {
    this.enqueueMutation('LIKE', songId);
  }

  public unlikeSong(songId: string) {
    this.enqueueMutation('UNLIKE', songId);
  }

  private async processMutationQueue() {
    if (this.isProcessingQueue || this.mutationQueue.length === 0 || !this.userId) return;
    
    this.isProcessingQueue = true;

    try {
      // Process mutations sequentially
      while (this.mutationQueue.length > 0) {
        const mutation = this.mutationQueue[0];
        try {
          if (mutation.type === 'LIKE') {
            const { error } = await supabase.from('liked_songs').upsert({
              user_id: this.userId,
              song_id: mutation.songId
            }, { onConflict: 'user_id,song_id' });
            if (error) throw error;
          } else if (mutation.type === 'UNLIKE') {
            const { error } = await supabase.from('liked_songs').delete()
              .eq('user_id', this.userId)
              .eq('song_id', mutation.songId);
            if (error) throw error;
          }

          // Increment cloud revision via RPC
          const { data: newRevision, error: rpcError } = await supabase.rpc('increment_library_revision', {
            p_user_id: this.userId
          });
          
          if (rpcError) {
            console.error('[LibrarySync] Failed to increment revision', rpcError);
          }

          const resolvedRevision = newRevision || (this.localRevision + 1);
          this.localRevision = resolvedRevision;

          // Broadcast with new revision
          this.broadcastMutation(mutation.type, mutation.songId, resolvedRevision);

          // Remove successful mutation from queue
          this.mutationQueue.shift();
          this.saveQueueToStorage();
        } catch (error) {
          console.error('[LibrarySync] Failed to process mutation:', mutation, error);
          mutation.retryCount++;
          // Wait and retry later
          break;
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async broadcastMutation(type: 'LIKE' | 'UNLIKE', songId: string, revision: number) {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'LIBRARY_MUTATION',
      payload: {
        type,
        songId,
        deviceId: this.deviceId,
        revision
      }
    });
  }
}
