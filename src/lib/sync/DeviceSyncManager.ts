import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song, PlaybackCommand, PlaybackSession, Device } from '@/types/music';

/**
 * DeviceSyncManager acts as the RaagaX Connect Command Bus and State Syncer.
 * It strictly separates the Control Plane (commands) from the Media Plane (audio).
 */
export class DeviceSyncManager {
  private static instance: DeviceSyncManager;
  private channel: any;
  private sessionId: string | null = null;
  private deviceId: string;
  private isProcessingRemote = false;
  private unsubscribeZustand: (() => void) | null = null;
  private localStateVersion = 0;
  private isInitializing = false;
  private persistTimeout: NodeJS.Timeout | null = null;

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

      // 0. Ensure device is registered in Postgres before any foreign key constraints
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const deviceName = isMobile ? 'Mobile App' : 'Desktop Web';
        await supabase.from('devices').upsert({
          device_id: this.deviceId,
          user_id: sessionData.session.user.id,
          device_name: `${deviceName} (${this.deviceId.substring(7, 11)})`,
          device_type: isMobile ? 'mobile' : 'desktop',
          is_online: true,
          last_seen: new Date().toISOString()
        }, { onConflict: 'device_id' });
      }

      // 1. Initial Durable State Load (Postgres)
      const { data: session, error } = await supabase
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
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: this.deviceId }
        }
      });

      // 2. Control Plane: Fast Commands
      this.channel.on('broadcast', { event: 'command' }, (payload: { payload: PlaybackCommand, senderId: string }) => {
        if (payload.senderId === this.deviceId) return;
        this.handleCommand(payload.payload);
      });

      // 3. Device Discovery
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

      // 4. Durable State Plane (Postgres)
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

      // Announce Presence
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

      // 5. Watch Zustand for significant state changes (Only Active Device pushes)
      let lastState = usePlayerStore.getState();
      let lastSyncTime = lastState.currentTime;

      this.unsubscribeZustand = usePlayerStore.subscribe((state) => {
        if (this.isProcessingRemote || !state.isActiveDevice) return;

        const timeDiffFromLastSync = Math.abs(state.currentTime - lastSyncTime);
        const isSignificantStateChange = 
          state.currentSong?.id !== lastState.currentSong?.id ||
          state.queue.length !== lastState.queue.length ||
          state.queueIndex !== lastState.queueIndex ||
          state.isShuffle !== lastState.isShuffle ||
          state.repeatMode !== lastState.repeatMode;

        // Sync periodically or on big changes
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
   * Handle incoming commands from the Control Plane.
   */
  private handleCommand(cmd: PlaybackCommand) {
    const store = usePlayerStore.getState();
    this.isProcessingRemote = true;

    // Version check (only process if it's new or unversioned)
    if (cmd.stateVersion !== undefined) {
      if (cmd.stateVersion < this.localStateVersion) {
        this.isProcessingRemote = false;
        return; // Ignore stale command
      }
      this.localStateVersion = cmd.stateVersion;
    }

    try {
      switch (cmd.type) {
        case 'PLAY':
          if (store.isActiveDevice) {
             store.setIsPlaying(true, true); // true = fromRemote, prevent echo
          }
          break;
        case 'PAUSE':
          if (store.isActiveDevice) {
             store.setIsPlaying(false, true);
          }
          break;
        case 'SEEK':
          if (store.isActiveDevice) {
             store.setCurrentTime(cmd.position, true); // true = fromRemote
          }
          break;
        case 'NEXT':
          if (store.isActiveDevice) {
             store.playNext(); // Active device will calculate next and then sync durable state
          }
          break;
        case 'PREV':
          if (store.isActiveDevice) {
             store.playPrev();
          }
          break;
        case 'SET_VOLUME':
          if (store.isActiveDevice) {
             store.setVolume(cmd.percent);
          }
          break;
        case 'SET_SHUFFLE':
          if (store.isActiveDevice) {
             store.setRemoteState({ isShuffle: cmd.enabled });
          }
          break;
        case 'SET_REPEAT':
          if (store.isActiveDevice) {
             store.setRemoteState({ repeatMode: cmd.mode });
          }
          break;
        case 'ADD_TO_QUEUE':
          if (store.isActiveDevice) {
             store.addToQueue(cmd.song);
          }
          break;
        case 'REMOVE_FROM_QUEUE':
          if (store.isActiveDevice) {
             store.removeFromQueue(cmd.songId);
          }
          break;
        case 'TRANSFER':
          const iAmNowActive = cmd.toDeviceId === this.deviceId;
          store.setRemoteState({ 
            activeDeviceId: cmd.toDeviceId, 
            isActiveDevice: iAmNowActive 
          });
          
          if (iAmNowActive) {
            // I am taking over!
            if (cmd.positionMs !== undefined) {
              store.setRemoteState({ currentTime: cmd.positionMs / 1000 });
            }
            store.setIsPlaying(true, true); // Start playing immediately
          } else {
            // I am transferring away!
            if (store.isActiveDevice) {
              store.setIsPlaying(false, true);
            }
          }
          break;
        case 'SYNC_STATE':
           // Fallback fast-sync
           if (!store.isActiveDevice) {
             store.setRemoteState({
                currentSong: cmd.state.songData || null,
                currentTime: cmd.state.positionMs !== undefined ? cmd.state.positionMs / 1000 : store.currentTime,
                isPlaying: cmd.state.isPlaying ?? false,
                queue: cmd.state.queue ?? [],
                queueIndex: cmd.state.queueIndex ?? 0
             });
           }
           break;
      }
    } finally {
      this.isProcessingRemote = false;
      
      // Spotify-Smooth State Echoing: Immediately broadcast our exact state back over WebSocket
      if (cmd.type !== 'SYNC_STATE' && store.isActiveDevice) {
         this.dispatchCommand({
            type: 'SYNC_STATE',
            state: {
               songData: store.currentSong || undefined,
               positionMs: Math.floor(store.currentTime * 1000),
               isPlaying: store.isPlaying,
               queue: store.queue,
               queueIndex: store.queueIndex
            }
         });
      }
    }
  }

  /**
   * Handle persistent state recovery from Postgres.
   */
  private handleDurableUpdate(remoteState: any) {
    if (remoteState.state_version !== undefined && remoteState.state_version < this.localStateVersion) {
      return;
    }
    this.localStateVersion = remoteState.state_version || this.localStateVersion;

    const store = usePlayerStore.getState();
    const isActiveDevice = remoteState.active_device_id === this.deviceId;
    
    this.isProcessingRemote = true;
    
    store.setRemoteState({
      activeDeviceId: remoteState.active_device_id,
      isActiveDevice,
      currentSong: remoteState.song_data,
      isPlaying: remoteState.is_playing,
      currentTime: Number(remoteState.position_ms) / 1000 || 0,
      queue: remoteState.queue || [],
      queueIndex: remoteState.queue_index || 0,
      isShuffle: remoteState.shuffle,
      repeatMode: remoteState.repeat_mode as any,
    });
    
    this.isProcessingRemote = false;
  }

  /**
   * Dispatch a command over the Control Plane.
   */
  public dispatchCommand(cmd: PlaybackCommand) {
    if (!this.channel) return;
    
    this.localStateVersion++;
    const versionedCmd = { ...cmd, stateVersion: this.localStateVersion };

    this.channel.send({
      type: 'broadcast',
      event: 'command',
      payload: { payload: versionedCmd, senderId: this.deviceId }
    }).catch(console.error);
    
    // Also update durable state if we're actively modifying it
    if (['PLAY', 'PAUSE', 'SEEK', 'TRANSFER'].includes(cmd.type)) {
      this.persistState();
    }
  }

  /**
   * Periodically write durable state to Postgres for recovery.
   */
  public persistState() {
    if (!this.sessionId || this.isProcessingRemote) return;

    const store = usePlayerStore.getState();
    
    // Anyone can persist during a transfer, otherwise only active device persists
    if (!store.isActiveDevice && !store.activeDeviceId) return; 

    // Debounce Postgres writes by 1.5 seconds to prevent race conditions and lag
    if (this.persistTimeout) clearTimeout(this.persistTimeout);
    
    this.persistTimeout = setTimeout(async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user) return;

        await supabase.from('playback_sessions').upsert({
          session_id: this.sessionId,
          user_id: session.session.user.id,
          active_device_id: store.activeDeviceId || this.deviceId,
          song_id: store.currentSong?.id || null,
          song_data: store.currentSong || null,
          position_ms: Math.floor(store.currentTime * 1000),
          is_playing: store.isPlaying,
          queue: store.queue,
          queue_index: store.queueIndex,
          shuffle: store.isShuffle,
          repeat_mode: store.repeatMode,
          state_version: this.localStateVersion,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });
      } catch (e) {
        console.error('[DeviceSyncManager] Persist error:', e);
      }
    }, 1500);
  }
}
