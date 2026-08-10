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

  private constructor() {
    this.deviceId = this.getOrCreateDeviceId();
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

  private async initialize() {
    if (!this.userId) return;
    
    // 1. Reconcile local state with cloud
    await this.reconcile();

    // 2. Subscribe to realtime library channel
    this.subscribeToChannel();
  }

  private cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
    this.mutationQueue = [];
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
      const { data, error } = await supabase
        .from('liked_songs')
        .select('song_id')
        .eq('user_id', this.userId);

      if (error) {
        console.error('[LibrarySync] Failed to reconcile library:', error);
        return;
      }

      if (data) {
        const cloudLikedSongs = data.map(row => row.song_id);
        
        // Update Zustand immediately
        usePlayerStore.getState().setLikedSongIds(cloudLikedSongs);
        console.log('[LibrarySync] Reconciled library with cloud:', cloudLikedSongs.length, 'songs');
      }
    } catch (error) {
      console.error('[LibrarySync] Error during reconcile:', error);
    }
  }

  private handleRemoteMutation(payload: any) {
    if (!payload || payload.deviceId === this.deviceId) return; // Ignore our own broadcasts

    const { type, songId } = payload;
    const store = usePlayerStore.getState();
    const currentLikes = store.likedSongIds;

    console.log('[LibrarySync] Received remote mutation:', payload);

    if (type === 'LIKE' && !currentLikes.includes(songId)) {
      store.setLikedSongIds([...currentLikes, songId]);
    } else if (type === 'UNLIKE' && currentLikes.includes(songId)) {
      store.setLikedSongIds(currentLikes.filter(id => id !== songId));
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
    this.processMutationQueue();
  }

  public likeSong(songId: string) {
    // 1. Optimistic UI update already happened in Zustand before calling this
    
    // 2. Enqueue cloud mutation
    this.enqueueMutation('LIKE', songId);
    
    // 3. Broadcast to other devices
    this.broadcastMutation('LIKE', songId);
  }

  public unlikeSong(songId: string) {
    // 1. Optimistic UI update already happened in Zustand before calling this
    
    // 2. Enqueue cloud mutation
    this.enqueueMutation('UNLIKE', songId);
    
    // 3. Broadcast to other devices
    this.broadcastMutation('UNLIKE', songId);
  }

  private async processMutationQueue() {
    if (this.isProcessingQueue || this.mutationQueue.length === 0 || !this.userId) return;
    
    this.isProcessingQueue = true;

    try {
      // Create a copy of the queue to process
      const queueToProcess = [...this.mutationQueue];
      
      for (const mutation of queueToProcess) {
        try {
          if (mutation.type === 'LIKE') {
            const { error } = await supabase.from('liked_songs').upsert({
              user_id: this.userId,
              song_id: mutation.songId,
              device_id: this.deviceId,
              version: Date.now()
            }, { onConflict: 'user_id,song_id' });
            
            if (error) throw error;
          } else if (mutation.type === 'UNLIKE') {
            const { error } = await supabase.from('liked_songs').delete()
              .eq('user_id', this.userId)
              .eq('song_id', mutation.songId);
              
            if (error) throw error;
          }

          // Remove successful mutation from queue
          this.mutationQueue = this.mutationQueue.filter(m => m.id !== mutation.id);
        } catch (error) {
          console.error('[LibrarySync] Failed to process mutation:', mutation, error);
          mutation.retryCount++;
          // If it fails too many times, we could drop it or keep retrying, let's keep it for now but maybe stop processing this loop
          break;
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async broadcastMutation(type: 'LIKE' | 'UNLIKE', songId: string) {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'LIBRARY_MUTATION',
      payload: {
        type,
        songId,
        deviceId: this.deviceId,
        version: Date.now()
      }
    });
  }
}
