import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';

export class DeviceSyncManager {
  private static instance: DeviceSyncManager;
  private channel: any;
  private sessionId: string | null = null;
  private deviceId: string;
  private isBroadcasting = false;
  private unsubscribeZustand: (() => void) | null = null;

  private constructor() {
    // Generate a unique device ID for this session
    this.deviceId = typeof window !== 'undefined' 
      ? localStorage.getItem('raagax_device_id') || this.generateDeviceId() 
      : 'server';
      
    if (typeof window !== 'undefined' && !localStorage.getItem('raagax_device_id')) {
      localStorage.setItem('raagax_device_id', this.deviceId);
    }
  }

  public static getInstance(): DeviceSyncManager {
    if (!DeviceSyncManager.instance) {
      DeviceSyncManager.instance = new DeviceSyncManager();
    }
    return DeviceSyncManager.instance;
  }

  private generateDeviceId(): string {
    return 'device_' + Math.random().toString(36).substring(2, 15);
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  private isInitializing = false;

  /**
   * Initialize sync for a given session ID (usually user's username or email)
   */
  public async initSync(sessionId: string) {
    if (this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      if (this.channel) {
        await supabase.removeChannel(this.channel);
        this.channel = null;
      }
      if (this.unsubscribeZustand) {
        this.unsubscribeZustand();
        this.unsubscribeZustand = null;
      }
      this.sessionId = sessionId;

      // 1. Fetch initial state
    const { data: session } = await supabase
      .from('playback_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (session) {
      this.handleRemoteUpdate(session);
    } else {
      // Create a new session record if it doesn't exist
      await this.broadcastState(true);
    }

    // 2. Subscribe to real-time changes and Presence
    const channelName = `sync_${sessionId}`;
    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playback_sessions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            this.handleRemoteUpdate(payload.new);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const newState = this.channel.presenceState();
        const devices: { id: string; name: string }[] = [];
        
        for (const presenceId in newState) {
          const presenceList = newState[presenceId] as any[];
          presenceList.forEach(p => {
            if (p.deviceId && p.deviceName && !devices.find(d => d.id === p.deviceId)) {
              devices.push({ id: p.deviceId, name: p.deviceName });
            }
          });
        }
        
        usePlayerStore.getState().setOnlineDevices(devices);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Detect if we are on a mobile device by checking window width or user agent
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          const deviceName = isMobile ? 'Mobile App' : 'Desktop Web';
          
          await this.channel.track({
            deviceId: this.deviceId,
            deviceName: `${deviceName} (${this.deviceId.substring(7, 11)})`
          });
        }
      });

    // 3. Subscribe to Zustand local changes
    let lastState = usePlayerStore.getState();
    let lastSyncTime = lastState.currentTime;

    this.unsubscribeZustand = usePlayerStore.subscribe((state) => {
      // Don't broadcast if this change was triggered BY a remote update
      if (this.isBroadcasting) return;

      const timeDiffFromLastSync = Math.abs(state.currentTime - lastSyncTime);
      const isSeek = Math.abs(state.currentTime - lastState.currentTime) > 2;

      const changed = 
        state.currentSong?.id !== lastState.currentSong?.id ||
        state.isPlaying !== lastState.isPlaying ||
        state.queue.length !== lastState.queue.length ||
        state.queueIndex !== lastState.queueIndex ||
        isSeek || 
        timeDiffFromLastSync > 5; // Sync every 5 seconds of normal playback

      lastState = state;

      if (changed) {
        lastSyncTime = state.currentTime;
        this.broadcastState();
      }
    });
    
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Handle incoming remote state changes
   */
  private handleRemoteUpdate(remoteState: any) {
    const store = usePlayerStore.getState();
    const isActiveDevice = remoteState.active_device_id === this.deviceId;
    
    // Prevent self-feedback loop
    this.isBroadcasting = true;
    
    // Update store with remote state
    store.setRemoteState({
      activeDeviceId: remoteState.active_device_id,
      isActiveDevice,
      currentSong: remoteState.song_data,
      isPlaying: remoteState.is_playing,
      currentTime: Number(remoteState.current_time) || 0,
      queue: remoteState.queue || [],
      queueIndex: remoteState.queue_index || 0,
      isShuffle: remoteState.shuffle,
      repeatMode: remoteState.repeat_mode as any,
    });
    
    this.isBroadcasting = false;
  }

  /**
   * Broadcast local state to Supabase
   */
  public async broadcastState(force = false) {
    if (!this.sessionId || this.isBroadcasting) return;

    const store = usePlayerStore.getState();
    
    // Only broadcast if we are the active device, OR if we are forcing an override
    if (!force && !store.isActiveDevice) return;

    try {
      await supabase.from('playback_sessions').upsert({
        session_id: this.sessionId,
        active_device_id: store.activeDeviceId || this.deviceId,
        song_id: store.currentSong?.id || null,
        song_data: store.currentSong || null,
        current_time: store.currentTime,
        is_playing: store.isPlaying,
        queue: store.queue,
        queue_index: store.queueIndex,
        shuffle: store.isShuffle,
        repeat_mode: store.repeatMode,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[DeviceSyncManager] Broadcast error:', e);
    }
  }
}
