import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEvent } from '@/types/music';
import { PlaybackSessionManager } from './PlaybackSessionManager';
import { PositionSynchronizer } from './PositionSynchronizer';

export class DeviceSyncManager {
  private static instance: DeviceSyncManager;
  private channel: any;
  private sessionId: string | null = null;
  private deviceId: string;
  private isProcessingRemote = false;
  private localSessionRevision = 0;
  private isInitializing = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

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
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
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
        last_seen: new Date().toISOString(),
        capabilities: {
          play: true,
          pause: true,
          seek: true,
          volume: true,
          queue: true
        }
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
          active_device_id: this.deviceId, 
          position_ms: 0,
          is_playing: false,
          queue: [],
          queue_index: 0,
          shuffle: false,
          repeat_mode: 'off',
          session_revision: 1
        };
        await supabase.from('playback_sessions').upsert(dbSession, { onConflict: 'session_id' });
      }

      this.localSessionRevision = dbSession.session_revision || 1;
      this.handleDurableUpdate(dbSession);
      
      // Initialize dedicated managers
      PlaybackSessionManager.getInstance().init(this.deviceId, this.sessionId, this.localSessionRevision);
      PositionSynchronizer.getInstance().start();

      // Setup Channel for Control Plane & DB changes
      const channelName = `sync_${this.sessionId}_${Date.now()}`;
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
        if (payload.new && payload.new.session_revision > this.localSessionRevision) {
          this.handleDurableUpdate(payload.new);
        }
      });

      // Realtime Commands (Control Plane)
      this.channel.on('broadcast', { event: 'command' }, (payload: { payload: PlaybackEvent, senderId: string }) => {
        if (payload.senderId === this.deviceId) return;
        this.handleCommand(payload.payload);
      });

      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED' && !this.isInitializing) {
          console.log('[DeviceSyncManager] Reconnected to channel, reconciling state...');
          this.reconcileState();
        }
      });

      // Database Heartbeat (HTTP) - Every 30s
      this.heartbeatInterval = setInterval(async () => {
        await supabase.from('devices').update({
          last_seen: new Date().toISOString()
        }).eq('device_id', this.deviceId);
      }, 30000);
      
      // Initial fetch of devices
      this.fetchDevices();
    
    } catch(e) {
      console.error("Failed to initialize sync", e);
    } finally {
      this.isInitializing = false;
    }
  }

  public async fetchDevices() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    
    // threshold offline: 90s
    const ninetySecondsAgo = new Date(Date.now() - 90000).toISOString();
    const { data: onlineDevices } = await supabase
      .from('devices')
      .select('device_id, device_name')
      .eq('user_id', userId)
      .gte('last_seen', ninetySecondsAgo);

    if (onlineDevices) {
      usePlayerStore.getState().setOnlineDevices(
        onlineDevices.map(d => ({ id: d.device_id, name: d.device_name }))
      );
    }
  }

  public async reconcileState() {
    if (!this.sessionId) return;
    
    try {
      const { data: dbSession, error } = await supabase
        .from('playback_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .maybeSingle();
        
      if (dbSession && dbSession.session_revision && dbSession.session_revision > this.localSessionRevision) {
        console.warn(`[DeviceSyncManager] Local revision ${this.localSessionRevision} is stale. DB has ${dbSession.session_revision}. Reconciling...`);
        this.handleDurableUpdate(dbSession);
      } else {
        console.log(`[DeviceSyncManager] Local state is up to date (Rev: ${this.localSessionRevision}).`);
      }
    } catch(e) {
      console.error("[DeviceSyncManager] Reconciliation failed", e);
    }
  }

  /**
   * Handle incoming commands from the Control Plane.
   */
  private handleCommand(cmd: PlaybackEvent) {
    const store = usePlayerStore.getState();
    this.isProcessingRemote = true;

    // Check version
    if (cmd.revision !== undefined) {
      if (cmd.revision < this.localSessionRevision) {
        this.isProcessingRemote = false;
        return; // Ignore stale command
      }
      this.localSessionRevision = cmd.revision;
    }

    try {
      if (cmd.type === 'TRANSFER') {
        const amINowActive = cmd.transferToDeviceId === this.deviceId;
        store.setRemoteState({ 
          activeDeviceId: cmd.transferToDeviceId || null, 
          isActiveDevice: amINowActive,
          remoteDeviceName: amINowActive ? null : cmd.transferToDeviceName || null
        });
        
        if (amINowActive) {
          if (cmd.renderer) store.setRenderer(cmd.renderer);
          if (cmd.positionMs !== undefined) {
            store.setCurrentTime(cmd.positionMs / 1000, true);
            store.setSeekTarget(cmd.positionMs / 1000);
          }
          setTimeout(() => {
            store.setIsPlaying(cmd.status !== 'paused', true);
            PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
          }, 100);
        } else {
          store.setIsPlaying(false, true);
        }
      } 
      else if (store.isActiveDevice) {
        switch (cmd.type) {
          case 'PLAY':
            store.setIsPlaying(true, true);
            break;
          case 'PAUSE':
            store.setIsPlaying(false, true);
            PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
            break;
          case 'SEEK':
            if (cmd.positionMs !== undefined) {
              store.setCurrentTime(cmd.positionMs / 1000, true);
              store.setSeekTarget(cmd.positionMs / 1000);
              PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!, cmd.positionMs);
            }
            break;
          case 'NEXT':
            store.playNext();
            break;
          case 'PREV':
            store.playPrev();
            break;
          case 'VOLUME':
            if (cmd.volumePercent !== undefined) store.setVolume(cmd.volumePercent);
            break;
          case 'SHUFFLE':
             if (cmd.shuffleEnabled !== undefined) {
               usePlayerStore.setState({ isShuffle: cmd.shuffleEnabled });
               PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
             }
             break;
          case 'REPEAT':
             if (cmd.repeatMode) {
               usePlayerStore.setState({ repeatMode: cmd.repeatMode });
               PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
             }
             break;
        }
      }
    } finally {
      setTimeout(() => { this.isProcessingRemote = false; }, 100);
    }
  }

  private handleDurableUpdate(dbSession: any) {
    if (dbSession.session_revision) {
      this.localSessionRevision = dbSession.session_revision;
    }

    const store = usePlayerStore.getState();
    const isActiveDevice = dbSession.active_device_id === this.deviceId;
    
    this.isProcessingRemote = true;
    
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

  public dispatchCommand(cmdType: PlaybackEvent['type'], extra?: Partial<PlaybackEvent>) {
    if (!this.channel || !this.sessionId) return;
    
    this.localSessionRevision++;

    const payload: PlaybackEvent = {
      eventId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      sequence: Date.now(),
      type: cmdType,
      serverTimestamp: Date.now(),
      revision: this.localSessionRevision,
      ...extra
    };

    if (this.channel && (this.channel as any).state === 'joined') {
      this.channel.send({
        type: 'broadcast',
        event: 'command',
        payload: { payload, senderId: this.deviceId }
      });
    }
  }

  public takeOverPlayback() {
    const store = usePlayerStore.getState();
    const livePositionMs = store.lastSyncPositionMs ? 
      store.lastSyncPositionMs + (store.isPlaying && store.lastSyncDbTime ? (Date.now() - new Date(store.lastSyncDbTime).getTime()) : 0) 
      : 0;

    this.dispatchCommand('TRANSFER', {
      transferToDeviceId: this.deviceId,
      transferToDeviceName: 'This Device',
      positionMs: livePositionMs,
      renderer: store.activeRenderer,
      status: store.playbackStatus
    });

    store.setRemoteState({ activeDeviceId: this.deviceId, isActiveDevice: true, remoteDeviceName: null });
    store.setCurrentTime(livePositionMs / 1000, true);
    store.setSeekTarget(livePositionMs / 1000);
    store.setIsPlaying(true, true);
    PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
  }
}
