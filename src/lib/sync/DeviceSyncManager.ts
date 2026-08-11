import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackCommand, PlaybackEventType } from '@/types/music';
import { PlaybackSessionManager } from './PlaybackSessionManager';

export class DeviceSyncManager {
  private static instance: DeviceSyncManager;
  private channel: any;
  private sessionId: string | null = null;
  private deviceId: string;
  private isProcessingRemote = false;
  private isInitializing = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private processedCommands = new Set<string>();
  
  // Clock synchronization
  private clockOffsetMs: number = 0;

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
    return 'device_' + crypto.randomUUID().substring(0, 13);
  }

  public getDeviceId(): string {
    return this.deviceId;
  }
  
  public getSynchronizedTime(): number {
    return Date.now() + this.clockOffsetMs;
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
      this.sessionId = `session_${user.id}`; 

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
      let { data: dbSession } = await supabase
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
          active_renderer: 'audio',
          status: 'paused',
          position_ms: 0,
          duration_ms: 0,
          queue: [],
          queue_index: 0,
          shuffle: false,
          repeat_mode: 'off',
          session_epoch: 1,
          sequence_number: 0,
          server_timestamp: Date.now()
        };
        await supabase.from('playback_sessions').upsert(dbSession, { onConflict: 'session_id' });
        this.clockOffsetMs = 0;
      } else {
        // Calculate clock offset based on the server timestamp
        if (dbSession.server_timestamp) {
           this.clockOffsetMs = dbSession.server_timestamp - Date.now();
        }
      }

      this.handleDurableUpdate(dbSession);
      
      // Initialize dedicated managers
      PlaybackSessionManager.getInstance().init(this.deviceId, this.sessionId, dbSession.session_epoch || 1, dbSession.sequence_number || 0);

      // Setup Broadcast Channel
      const channelName = `playback:${user.id}:${this.sessionId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true } // RLS on realtime.messages ensures private authorization
        }
      });

      // Realtime Commands (Control Plane) via Broadcast
      this.channel.on('broadcast', { event: 'command' }, (payload: { payload: PlaybackCommand }) => {
        if (payload.payload.senderDeviceId === this.deviceId) return;
        this.handleCommand(payload.payload);
      });

      this.channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED' && !this.isInitializing) {
          console.log('[DeviceSyncManager] Reconnected to channel, fetching latest checkpoint...');
          this.reconcileState();
        }
      });

      // Database Heartbeat (HTTP) - Every 60s
      this.heartbeatInterval = setInterval(async () => {
        await supabase.from('devices').update({
          last_seen: new Date().toISOString()
        }).eq('device_id', this.deviceId);
      }, 60000);
      
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
    const ninetySecondsAgo = new Date(this.getSynchronizedTime() - 90000).toISOString();
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
      const { data: dbSession } = await supabase
        .from('playback_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .maybeSingle();
        
      if (dbSession) {
        const localEpoch = PlaybackSessionManager.getInstance().getEpoch();
        const localSeq = PlaybackSessionManager.getInstance().getSequence();
        
        if (dbSession.session_epoch > localEpoch || 
           (dbSession.session_epoch === localEpoch && dbSession.sequence_number > localSeq)) {
          this.handleDurableUpdate(dbSession);
        }
      }
    } catch(e) {
      console.error("[DeviceSyncManager] Reconciliation failed", e);
    }
  }

  private handleCommand(cmd: PlaybackCommand) {
    if (this.processedCommands.has(cmd.commandId)) return;
    this.processedCommands.add(cmd.commandId);

    const store = usePlayerStore.getState();
    const currentEpoch = PlaybackSessionManager.getInstance().getEpoch();
    const currentSeq = PlaybackSessionManager.getInstance().getSequence();
    
    // Strict Validation
    if (cmd.sessionEpoch < currentEpoch) {
      return; // DROP
    }
    
    if (cmd.sessionEpoch > currentEpoch) {
      // ACCEPT + Reconcile
      this.reconcileState();
      return; 
    }
    
    if (cmd.sessionEpoch === currentEpoch) {
      if (cmd.sequenceNumber <= currentSeq) {
        return; // DROP duplicate or out of order
      }
      // Otherwise ACCEPT
    }

    this.isProcessingRemote = true;

    try {
      if (cmd.event === 'TRANSFER_REQUEST' || cmd.event === 'TRANSFER_ACCEPT') { // Mapped from old TRANSFER
        const amINowActive = cmd.payload?.transferToDeviceId === this.deviceId;
        store.setRemoteState({ 
          activeDeviceId: cmd.payload?.transferToDeviceId || null, 
          isActiveDevice: amINowActive,
          remoteDeviceName: amINowActive ? null : cmd.payload?.transferToDeviceName || null
        });
        
        if (amINowActive) {
          if (cmd.renderer) store.setRenderer(cmd.renderer);
          if (cmd.positionMs !== undefined) {
            store.setCurrentTime(cmd.positionMs / 1000, true);
            store.setSeekTarget(cmd.positionMs / 1000);
          }
          setTimeout(() => {
            store.setIsPlaying(cmd.payload?.status !== 'paused', true);
            PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
          }, 100);
        } else {
          store.setIsPlaying(false, true);
        }
      } 
      else if (store.isActiveDevice) {
        switch (cmd.event) {
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
            if (cmd.payload?.volumePercent !== undefined) store.setVolume(cmd.payload.volumePercent);
            break;
          case 'SHUFFLE':
             if (cmd.payload?.shuffleEnabled !== undefined) {
               usePlayerStore.setState({ isShuffle: cmd.payload.shuffleEnabled });
               PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
             }
             break;
          case 'REPEAT':
             if (cmd.payload?.repeatMode) {
               usePlayerStore.setState({ repeatMode: cmd.payload.repeatMode });
               PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
             }
             break;
          // Audio/Video Handoffs
          case 'HANDOFF_PREPARE':
             // Transitioning states
             break;
        }
      }
    } finally {
      setTimeout(() => { this.isProcessingRemote = false; }, 100);
    }
  }

  private handleDurableUpdate(dbSession: any) {
    const store = usePlayerStore.getState();
    const isActiveDevice = dbSession.active_device_id === this.deviceId;
    
    this.isProcessingRemote = true;
    
    let calculatedTimeSeconds = dbSession.position_ms / 1000;
    if (dbSession.status === 'playing' && !isActiveDevice && dbSession.server_timestamp) {
      const elapsedSeconds = (this.getSynchronizedTime() - dbSession.server_timestamp) / 1000;
      calculatedTimeSeconds += Math.max(0, elapsedSeconds);
    }

    store.setRemoteState({
      activeDeviceId: dbSession.active_device_id,
      isActiveDevice,
      remoteDeviceName: !isActiveDevice ? (store.onlineDevices.find(d => d.id === dbSession.active_device_id)?.name || 'Another Device') : null,
      currentSong: dbSession.song_data,
      currentTime: calculatedTimeSeconds,
      isPlaying: dbSession.status === 'playing',
      activeRenderer: dbSession.active_renderer,
      queue: dbSession.queue || [],
      queueIndex: dbSession.queue_index || 0,
      isShuffle: dbSession.shuffle,
      repeatMode: dbSession.repeat_mode,
      lastSyncDbTime: new Date(dbSession.server_timestamp).toISOString(),
      lastSyncPositionMs: dbSession.position_ms
    });

    setTimeout(() => { this.isProcessingRemote = false; }, 100);
  }

  public dispatchCommand(cmdType: PlaybackEventType, positionMs?: number, extraPayload?: any) {
    if (!this.channel || !this.sessionId) return;
    
    const manager = PlaybackSessionManager.getInstance();
    const store = usePlayerStore.getState();
    const pos = positionMs !== undefined ? positionMs : Math.floor(store.currentTime * 1000);
    
    const cmd: PlaybackCommand = {
      commandId: crypto.randomUUID(),
      sessionId: this.sessionId,
      senderDeviceId: this.deviceId,
      sessionEpoch: manager.getEpoch(),
      sequenceNumber: manager.getSequence(),
      serverTimestamp: this.getSynchronizedTime(),
      event: cmdType,
      positionMs: pos,
      renderer: store.activeRenderer,
      trackId: store.currentSong?.id,
      payload: extraPayload || {}
    };

    if (this.channel && this.channel.state === 'joined') {
      this.channel.send({
        type: 'broadcast',
        event: 'command',
        payload: cmd
      });
    }
  }
  
  public async requestLease(epoch: number) {
    try {
      const expires = new Date(this.getSynchronizedTime() + 1000 * 60 * 60 * 24); // 24hr lease
      await supabase.from('device_leases').upsert({
        session_id: this.sessionId,
        device_id: this.deviceId,
        lease_token: crypto.randomUUID(),
        epoch: epoch,
        expires_at: expires.toISOString()
      }, { onConflict: 'session_id' });
    } catch(e) {
      console.error("Failed to request device lease", e);
    }
  }

  public async takeOverPlayback() {
    const store = usePlayerStore.getState();
    const livePositionMs = store.lastSyncPositionMs ? 
      store.lastSyncPositionMs + (store.isPlaying && store.lastSyncDbTime ? (this.getSynchronizedTime() - new Date(store.lastSyncDbTime).getTime()) : 0) 
      : 0;

    const epoch = PlaybackSessionManager.getInstance().incrementEpoch();
    
    // Acquire DB lease first
    await this.requestLease(epoch);

    this.dispatchCommand('TRANSFER_REQUEST', livePositionMs, {
      transferToDeviceId: this.deviceId,
      transferToDeviceName: 'This Device',
      status: store.playbackStatus
    });

    store.setRemoteState({ activeDeviceId: this.deviceId, isActiveDevice: true, remoteDeviceName: null });
    store.setCurrentTime(livePositionMs / 1000, true);
    store.setSeekTarget(livePositionMs / 1000);
    store.setIsPlaying(true, true);
    PlaybackSessionManager.getInstance().persistDurableState(this.deviceId, this.sessionId!);
  }
}
