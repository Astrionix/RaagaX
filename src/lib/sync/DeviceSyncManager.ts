import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

// Strict typings for the RaagaX Connect Broadcast Protocol
export type BroadcastCommand = 
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SEEK', position: number }
  | { type: 'TRANSFER_PLAYBACK', toDeviceId: string }
  | { type: 'SYNC_STATE', state: any };

export class DeviceSyncManager {
  private static instance: DeviceSyncManager;
  private channel: any;
  private sessionId: string | null = null;
  private deviceId: string;
  private isProcessingRemote = false; // Flag to prevent echo loops
  private unsubscribeZustand: (() => void) | null = null;
  private localRevision = 0;

  private constructor() {
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

  public async initSync(sessionId: string) {
    if (this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      if (this.channel) {
        this.channel = null;
      }
      await supabase.removeAllChannels();
      
      if (this.unsubscribeZustand) {
        this.unsubscribeZustand();
        this.unsubscribeZustand = null;
      }
      this.sessionId = sessionId;

      // 1. Initial Durable State Load (Layer 3: Postgres)
      const { data: session } = await supabase
        .from('playback_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (session) {
        this.handleDurableUpdate(session);
      } else {
        await this.persistState(); // Create initial row
      }

      const channelName = `sync_${sessionId}`;
      this.channel = supabase.channel(channelName);

      // 2. Subscribe to Low-Latency Commands (Layer 2: Broadcast)
      this.channel.on('broadcast', { event: 'command' }, (payload: { payload: BroadcastCommand, senderId: string }) => {
        // Ignore our own broadcasts
        if (payload.senderId === this.deviceId) return;
        this.handleBroadcastCommand(payload.payload);
      });

      // 3. Subscribe to Device Discovery (Layer 1: Presence)
      this.channel.on('presence', { event: 'sync' }, () => {
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
      });

      // 4. Subscribe to Durable State Changes (Layer 3: Postgres)
      this.channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'playback_sessions',
        filter: `session_id=eq.${sessionId}`,
      }, (payload: any) => {
        if (payload.new && payload.new.active_device_id !== this.deviceId) {
          this.handleDurableUpdate(payload.new);
        }
      });

      // Finalize subscription and announce presence
      this.channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          const deviceName = isMobile ? 'Mobile App' : 'Desktop Web';
          
          await this.channel.track({
            deviceId: this.deviceId,
            deviceName: `${deviceName} (${this.deviceId.substring(7, 11)})`
          });
        }
      });

      // 5. Watch Zustand for local durable changes (e.g. queue change, song switch)
      let lastState = usePlayerStore.getState();
      let lastSyncTime = lastState.currentTime;

      this.unsubscribeZustand = usePlayerStore.subscribe((state) => {
        if (this.isProcessingRemote) return;

        const timeDiffFromLastSync = Math.abs(state.currentTime - lastSyncTime);
        const isSignificantStateChange = 
          state.currentSong?.id !== lastState.currentSong?.id ||
          state.queue.length !== lastState.queue.length ||
          state.queueIndex !== lastState.queueIndex ||
          state.isShuffle !== lastState.isShuffle ||
          state.repeatMode !== lastState.repeatMode;

        // Persist to Postgres periodically (every 10 seconds) or on significant change
        if (isSignificantStateChange || timeDiffFromLastSync > 10) {
          lastSyncTime = state.currentTime;
          this.persistState();
        }
        
        lastState = state;
      });
    
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Handle fast, transient commands via Broadcast
   */
  private handleBroadcastCommand(cmd: BroadcastCommand) {
    const store = usePlayerStore.getState();
    this.isProcessingRemote = true;

    try {
      switch (cmd.type) {
        case 'PLAY':
          if (store.isActiveDevice) {
             store.setIsPlaying(true);
          }
          break;
        case 'PAUSE':
          if (store.isActiveDevice) {
             store.setIsPlaying(false);
          }
          break;
        case 'SEEK':
          if (store.isActiveDevice) {
             store.setCurrentTime(cmd.position);
          }
          break;
        case 'TRANSFER_PLAYBACK':
          const iAmNowActive = cmd.toDeviceId === this.deviceId;
          store.setRemoteState({ activeDeviceId: cmd.toDeviceId, isActiveDevice: iAmNowActive });
          if (!iAmNowActive) {
            store.setIsPlaying(false);
          }
          break;
        case 'SYNC_STATE':
           // Quick state sync for when a device becomes active
           if (!store.isActiveDevice) {
             store.setRemoteState({
                currentSong: cmd.state.currentSong,
                currentTime: cmd.state.currentTime,
                isPlaying: cmd.state.isPlaying,
                queue: cmd.state.queue,
                queueIndex: cmd.state.queueIndex
             });
           }
           break;
      }
    } finally {
      this.isProcessingRemote = false;
    }
  }

  /**
   * Handle persistent state recovery via Postgres
   */
  private handleDurableUpdate(remoteState: any) {
    if (remoteState.revision !== undefined && remoteState.revision < this.localRevision) {
      return;
    }
    this.localRevision = remoteState.revision || this.localRevision;

    const store = usePlayerStore.getState();
    const isActiveDevice = remoteState.active_device_id === this.deviceId;
    
    this.isProcessingRemote = true;
    
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
    
    this.isProcessingRemote = false;
  }

  /**
   * Send a low-latency command to all other devices.
   */
  public sendCommand(cmd: BroadcastCommand) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'command',
      payload: { payload: cmd, senderId: this.deviceId }
    }).catch(console.error);
  }

  /**
   * Periodically write durable state to Postgres for recovery.
   */
  public async persistState() {
    if (!this.sessionId || this.isProcessingRemote) return;

    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return; // Only active device saves state

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
        revision: ++this.localRevision,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[DeviceSyncManager] Persist error:', e);
    }
  }
}
