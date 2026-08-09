import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song, PlaybackCommand, PlaybackSession, Device } from '@/types/music';

/**
 * True Cross-Device Sync Manager (Spotify Connect-like Architecture)
 * - Strict separation of Media Plane (Local Audio Clock) and Control Plane (Realtime Commands)
 * - No continuous writing of the timeline to Supabase.
 * - Timestamp interpolation calculates actual UI progress on Remote Devices.
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

  public async initSync() {
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

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        this.isInitializing = false;
        return;
      }
      
      const user = sessionData.session.user;
      this.sessionId = `session_${user.id}`; // 1 shared playback session per user account

      // Register device
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const deviceName = isMobile ? 'Mobile App' : 'Desktop Web';
      await supabase.from('devices').upsert({
        device_id: this.deviceId,
        user_id: user.id,
        device_name: `${deviceName} (${this.deviceId.substring(7, 11)})`,
        device_type: isMobile ? 'mobile' : 'desktop',
        is_online: true,
        last_seen: new Date().toISOString()
      }, { onConflict: 'device_id' });

      // Fetch latest Durable State (Postgres)
      let { data: dbSession, error } = await supabase
        .from('playback_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .maybeSingle();

      if (!dbSession) {
        // Create initial row
        dbSession = {
          session_id: this.sessionId,
          user_id: user.id,
          active_device_id: this.deviceId, // We become active if no session exists
          position_ms: 0,
          is_playing: false,
          queue: [],
          queue_index: 0,
          shuffle: false,
          repeat_mode: 'off',
          state_version: 1
        };
        await supabase.from('playback_sessions').insert(dbSession);
      }

      this.localStateVersion = dbSession.state_version || 1;
      this.handleDurableUpdate(dbSession);

      // Setup Channel for Control Plane & DB changes
      const channelName = `sync_${this.sessionId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: this.deviceId }
        }
      });

      // DB changes - This keeps non-active devices in sync if they miss a broadcast
      this.channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'playback_sessions',
        filter: `session_id=eq.${this.sessionId}`,
      }, (payload: any) => {
        if (payload.new && payload.new.state_version > this.localStateVersion) {
          this.handleDurableUpdate(payload.new);
        }
      });

      // Realtime Commands (Control Plane)
      this.channel.on('broadcast', { event: 'command' }, (payload: { payload: PlaybackCommand, senderId: string }) => {
        if (payload.senderId === this.deviceId) return;
        this.handleCommand(payload.payload);
      });

      // Presence for discovering online devices
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

      this.channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track({
            deviceId: this.deviceId,
            deviceName: `${deviceName} (${this.deviceId.substring(7, 11)})`
          });
        }
      });

      // Watch Zustand for significant state changes (Only Active Device pushes)
      let lastState = usePlayerStore.getState();
      let lastSyncTime = lastState.currentTime;

      this.unsubscribeZustand = usePlayerStore.subscribe((state) => {
        if (this.isProcessingRemote || !state.isActiveDevice) return;

        const isSignificantStateChange = 
          state.currentSong?.id !== lastState.currentSong?.id ||
          state.queue.length !== lastState.queue.length ||
          state.queueIndex !== lastState.queueIndex ||
          state.isShuffle !== lastState.isShuffle ||
          state.repeatMode !== lastState.repeatMode ||
          state.isPlaying !== lastState.isPlaying;

        if (isSignificantStateChange || Math.abs(state.currentTime - lastSyncTime) > 10) {
          lastSyncTime = state.currentTime;
          this.persistState();
        }
        
        lastState = state;
      });
    
    } catch(e) {
      console.error("Failed to initialize sync", e);
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

    // Check version
    if (cmd.stateVersion !== undefined) {
      if (cmd.stateVersion < this.localStateVersion) {
        this.isProcessingRemote = false;
        return; // Ignore stale command
      }
      this.localStateVersion = cmd.stateVersion;
    }

    try {
      if (cmd.type === 'TRANSFER') {
        const amINowActive = cmd.toDeviceId === this.deviceId;
        store.setRemoteState({ 
          activeDeviceId: cmd.toDeviceId, 
          isActiveDevice: amINowActive,
          remoteDeviceName: amINowActive ? null : cmd.toDeviceName
        });
        
        if (amINowActive) {
          // I am taking over! Seek to the exact transferred position and play
          if (cmd.positionMs !== undefined) {
            store.setCurrentTime(cmd.positionMs / 1000, true);
          }
          store.setIsPlaying(true, true);
          // Persist that I am now active
          this.persistState(cmd.stateVersion ? cmd.stateVersion + 1 : undefined);
        } else {
          // I am losing control. Stop playing immediately.
          store.setIsPlaying(false, true);
        }
      } 
      else if (store.isActiveDevice) {
        // If I am active, execute the control commands sent by remotes
        switch (cmd.type) {
          case 'PLAY':
            store.setIsPlaying(true, true);
            this.persistState(); // Broadcast new state
            break;
          case 'PAUSE':
            store.setIsPlaying(false, true);
            this.persistState();
            break;
          case 'SEEK':
            store.setCurrentTime(cmd.position, true);
            this.persistState();
            break;
          case 'NEXT':
            store.playNext();
            break;
          case 'PREV':
            store.playPrev();
            break;
          case 'SET_VOLUME':
            store.setVolume(cmd.percent);
            break;
        }
      }
    } finally {
      setTimeout(() => { this.isProcessingRemote = false; }, 100);
    }
  }

  /**
   * Handle a Durable State update from DB. (Usually used by Remote devices)
   */
  private handleDurableUpdate(dbSession: any) {
    if (dbSession.state_version) {
      this.localStateVersion = dbSession.state_version;
    }

    const store = usePlayerStore.getState();
    
    // Check if we are active
    const isActiveDevice = dbSession.active_device_id === this.deviceId;
    
    this.isProcessingRemote = true;
    
    // Calculate live position for remotes using clock interpolation
    let calculatedTimeSeconds = dbSession.position_ms / 1000;
    
    if (dbSession.is_playing && !isActiveDevice && dbSession.updated_at) {
      const updatedAt = new Date(dbSession.updated_at).getTime();
      const elapsedSeconds = (Date.now() - updatedAt) / 1000;
      calculatedTimeSeconds += elapsedSeconds;
    }

    store.setRemoteState({
      activeDeviceId: dbSession.active_device_id,
      isActiveDevice,
      remoteDeviceName: !isActiveDevice ? (store.onlineDevices.find(d => d.id === dbSession.active_device_id)?.name || 'Another Device') : null,
      currentSong: dbSession.song_data,
      currentTime: calculatedTimeSeconds,
      isPlaying: dbSession.is_playing,
      queue: dbSession.queue || [],
      queueIndex: dbSession.queue_index || 0,
      isShuffle: dbSession.shuffle,
      repeatMode: dbSession.repeat_mode,
      lastSyncDbTime: dbSession.updated_at,
      lastSyncPositionMs: dbSession.position_ms
    });

    setTimeout(() => { this.isProcessingRemote = false; }, 100);
  }

  /**
   * Dispatches a command to the Realtime Channel
   */
  public dispatchCommand(cmd: PlaybackCommand) {
    if (!this.channel) return;
    
    this.localStateVersion++;
    cmd.stateVersion = this.localStateVersion;

    this.channel.send({
      type: 'broadcast',
      event: 'command',
      payload: { payload: cmd, senderId: this.deviceId }
    });
  }

  /**
   * Sync Current State to DB (Active Device Only)
   */
  public async persistState(forceVersion?: number) {
    const store = usePlayerStore.getState();
    if (!this.sessionId || (!store.isActiveDevice && !forceVersion)) return;

    this.localStateVersion = forceVersion ?? this.localStateVersion + 1;

    try {
      await supabase.from('playback_sessions').upsert({
        session_id: this.sessionId,
        user_id: (await supabase.auth.getSession()).data.session?.user?.id,
        active_device_id: this.deviceId,
        song_id: store.currentSong?.id || null,
        song_data: store.currentSong,
        position_ms: Math.floor(store.currentTime * 1000),
        is_playing: store.isPlaying,
        queue: store.queue,
        queue_index: store.queueIndex,
        shuffle: store.isShuffle,
        repeat_mode: store.repeatMode,
        state_version: this.localStateVersion,
        updated_at: new Date().toISOString()
      });
    } catch(e) {
      console.error("Failed to persist playback state", e);
    }
  }

  /**
   * Request to take over playback from the current active device
   */
  public takeOverPlayback() {
    const store = usePlayerStore.getState();
    const livePositionMs = store.lastSyncPositionMs ? 
      store.lastSyncPositionMs + (store.isPlaying && store.lastSyncDbTime ? (Date.now() - new Date(store.lastSyncDbTime).getTime()) : 0) 
      : 0;

    // Send transfer command. The current active device will pause.
    this.dispatchCommand({
      type: 'TRANSFER',
      toDeviceId: this.deviceId,
      toDeviceName: 'This Device',
      positionMs: livePositionMs
    });

    // I become active locally right away for responsiveness
    store.setRemoteState({ activeDeviceId: this.deviceId, isActiveDevice: true, remoteDeviceName: null });
    store.setCurrentTime(livePositionMs / 1000, true);
    store.setIsPlaying(true, true);
    this.persistState();
  }
}
