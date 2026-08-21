import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConnectCommand, ConnectState } from './types';
import { CommandBus } from './CommandBus';
import { NetworkManager } from '../offline/NetworkManager';
import { DeviceRegistry } from './DeviceRegistry';
import { SessionReconciler } from './SessionReconciler';
import { CommandValidator } from './CommandValidator';
import { CommandSequencer } from './CommandSequencer';
import { ClockSynchronizer } from './ClockSynchronizer';
import { usePlayerStore, isOfflineMode } from '@/context/usePlayerStore';

export class ConnectManager {
  private static instance: ConnectManager;
  
  private userId: string | null = null;
  private deviceId: string | null = null;
  private deviceInstanceId: string | null = null;
  private sessionId: string | null = null;
  
  private inboxChannel: RealtimeChannel | null = null;
  private sessionChannel: RealtimeChannel | null = null;
  private targetChannels = new Map<string, RealtimeChannel>();
  private isCleaningUp: boolean = false;

  private currentState: ConnectState = 'OFFLINE';
  private recoveryQueue: ConnectCommand[] = [];
  private isRecovering: boolean = false;
  private pendingCommandResolvers = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();

  // Strict Manual Disconnect & Generation Token System
  private manualDisconnectRequested: boolean = false;
  private connectionGeneration: number = 0;
  private recoveryTimer: NodeJS.Timeout | null = null;

  private constructor() {
    NetworkManager.getInstance().subscribe((mode) => {
      if (mode === 'online') {
        this.handleNetworkOnline();
      } else {
        this.handleNetworkOffline();
      }
    });
  }

  public static getInstance(): ConnectManager {
    if (!ConnectManager.instance) {
      ConnectManager.instance = new ConnectManager();
    }
    return ConnectManager.instance;
  }

  public isManualDisconnectRequested(): boolean {
    return this.manualDisconnectRequested;
  }

  public getConnectionGeneration(): number {
    return this.connectionGeneration;
  }

  private stateChangeListeners: Array<(state: ConnectState) => void> = [];
  public onStateChange(listener: (state: ConnectState) => void) { this.stateChangeListeners.push(listener); }

  public async init(userId: string, deviceId: string) {
    this.manualDisconnectRequested = false;
    this.connectionGeneration++;
    this.userId = userId;
    this.deviceId = deviceId;
    this.deviceInstanceId = DeviceRegistry.getInstance().getOrCreateDeviceInstanceId();
    
    this.transitionState('CONNECTING');
    
    // 0. Register device identity and subscribe to real-time presence changes
    await DeviceRegistry.getInstance().registerDevice();
    await DeviceRegistry.getInstance().subscribeToUserDevices(userId);

    // 1. Subscribe to this device's persistent inbox (always, even as follower)
    this.subscribeInbox();
    
    // 2. Get or create the canonical playback session for this user
    const sessionId = await DeviceRegistry.getInstance().createOrJoinSession(userId);
    if (!sessionId) {
      console.error('[ConnectManager] Could not create/join playback session.');
      this.transitionState('READY');
      return;
    }
    this.sessionId = sessionId;

    // 3. Try to acquire the controller lease
    const { DeviceLeaseManager } = await import('./DeviceLeaseManager');
    const leaseAcquired = await DeviceLeaseManager.getInstance().acquireLease(sessionId, false);
    
    if (leaseAcquired) {
      console.log('[ConnectManager] Acquired lease — this device is the controller.');
    } else {
      console.log('[ConnectManager] No lease — this device is a follower.');
    }

    // 4. Always subscribe to the session channel to receive commands (controller or follower)
    this.subscribeSession(sessionId);

    // 5. Init downstream managers
    CommandBus.getInstance().init(deviceId, sessionId);
    
    const { PlaybackSessionManager } = await import('../sync/PlaybackSessionManager');
    PlaybackSessionManager.getInstance().init(sessionId);

    // 6. Connect State Machine to Global Player State
    this.onStateChange((state) => {
      const storeState = state === 'CONNECTED' ? 'CONNECTED' : (state === 'CONNECTING' || state === 'SUBSCRIBING' || state === 'RECOVERING' ? 'CONNECTING' : 'AVAILABLE');
      usePlayerStore.setState({ deviceConnectionState: storeState });
    });

    console.log(`[ConnectManager] Initialized for User: ${userId}, Device: ${deviceId}, Session: ${sessionId}`);
  }

  private transitionState(newState: ConnectState) {
    console.log(`[ConnectManager] State transition: ${this.currentState} -> ${newState}`);
    this.currentState = newState;
    this.stateChangeListeners.forEach(l => l(newState));
    
    // Additional state effects can be hooked here.
    if (newState === 'RECOVERING') {
      this.initiateRecovery();
    }
  }

  public getState(): ConnectState {
    return this.currentState;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public async handleNetworkOnline() {
    if (this.manualDisconnectRequested) {
      console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
      return;
    }
    console.log('[ConnectManager] Network online — restoring subscriptions...');
    if (this.sessionId) {
      this.subscribeSession(this.sessionId);
    } else if (this.userId && this.deviceId) {
      await this.init(this.userId, this.deviceId);
    }
  }

  public handleNetworkOffline() {
    console.log('[ConnectManager] Network offline — suspending real-time connections...');
    this.transitionState('OFFLINE');
  }

  public async initiateRecovery() {
    if (isOfflineMode()) {
      console.log('[ConnectManager] Suspending recovery - device is offline.');
      return;
    }

    if (this.manualDisconnectRequested) {
      console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
      return;
    }
    if (this.isRecovering) return;
    this.isRecovering = true;
    try {
      console.log('[ConnectManager] Initiating session recovery...');
      // 1. Fetch authoritative snapshot from DB
      if (this.sessionId) {
        const snapshot = await SessionReconciler.getInstance().fetchAuthoritativeSnapshot(this.sessionId);
        if (snapshot) {
          await SessionReconciler.getInstance().applySnapshot(snapshot);
        }
      }
      
      this.transitionState('READY');
      this.processRecoveryQueue();
    } catch (e) {
      console.error('[ConnectManager] Recovery failed, retrying...', e);
      this.transitionState('READY');
      // Exponential backoff for recovery would be ideal here if it continuously fails
    } finally {
      this.isRecovering = false;
    }
  }

  private processRecoveryQueue() {
    console.log(`[ConnectManager] Processing recovery queue: ${this.recoveryQueue.length} commands`);
    const toProcess = [...this.recoveryQueue];
    this.recoveryQueue = [];
    
    const validator = CommandValidator.getInstance();
    for (const cmd of toProcess) {
      if (validator.validate(cmd)) {
        CommandBus.getInstance().handleIncomingCommand(cmd);
      } else {
        console.log('[ConnectManager] Dropped stale recovery command:', cmd.type, cmd.commandId);
      }
    }
  }

  private reconnectTimer: NodeJS.Timeout | null = null;

  private scheduleReconnect() {
    if (this.manualDisconnectRequested) {
      console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
      return;
    }
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manualDisconnectRequested) {
        console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
        return;
      }
      this.handleNetworkOnline();
    }, 3000);
  }

  private subscribeInbox() {
    if (!this.userId || !this.deviceId) return;
    if (this.manualDisconnectRequested) {
      console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
      return;
    }
    if (this.inboxChannel && (this.currentState === 'CONNECTED' || this.currentState === 'SUBSCRIBING' || this.currentState === 'READY')) {
       return; // Already connecting or connected
    }
    if (this.inboxChannel) {
      const ch = this.inboxChannel;
      this.inboxChannel = null;
      try { supabase.removeChannel(ch); } catch (e) {}
    }

    const inboxTopic = `user:${this.userId}:device:${this.deviceId}`;
    const rawChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
    const channels = Array.isArray(rawChannels) ? rawChannels : [];
    const existing = channels.find((c: any) => c.topic === `realtime:${inboxTopic}` || c.topic === inboxTopic);
    if (existing) {
      try { supabase.removeChannel(existing); } catch (e) {}
    }

    const currentGen = this.connectionGeneration;
    console.log(`[ConnectManager] Subscribing to inbox: ${inboxTopic} (gen: ${currentGen})`);

    this.inboxChannel = supabase.channel(inboxTopic, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'COMMAND' }, (payload) => {
      if (currentGen !== this.connectionGeneration || this.manualDisconnectRequested) {
        console.log(`[ConnectManager] Ignoring stale callback from connection generation ${currentGen}`);
        return;
      }
      this.handleBroadcastCommand(payload);
    })
    .subscribe((status) => {
      if (currentGen !== this.connectionGeneration) {
        console.log(`[ConnectManager] Ignoring stale callback from connection generation ${currentGen}`);
        return;
      }
      if (status === 'SUBSCRIBED') {
         if (this.currentState === 'CONNECTING' || this.currentState === 'RECOVERING') {
           this.transitionState('SUBSCRIBING');
         }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
         this.inboxChannel = null;
         if (this.manualDisconnectRequested) {
           console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
           return;
         }
         console.warn('[ConnectManager] Inbox channel disconnected, scheduling single-flight reconnect...');
         this.transitionState('OFFLINE');
         this.scheduleReconnect();
      }
    });
  }

  public subscribeSession(sessionId: string) {
    if (this.manualDisconnectRequested) {
      console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
      return;
    }
    if (this.sessionChannel && this.sessionId === sessionId && (this.currentState === 'CONNECTED' || this.currentState === 'SUBSCRIBING' || this.currentState === 'READY')) {
       return; // Already connected to this session
    }
    
    this.unsubscribeSession();
    this.sessionId = sessionId;
    
    if (!this.userId) return;

    const sessionTopic = `user:${this.userId}:session:${sessionId}`;
    const rawChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
    const channels = Array.isArray(rawChannels) ? rawChannels : [];
    const existing = channels.find((c: any) => c.topic === `realtime:${sessionTopic}` || c.topic === sessionTopic);
    if (existing) {
      try { supabase.removeChannel(existing); } catch (e) {}
    }

    const currentGen = this.connectionGeneration;
    console.log(`[ConnectManager] Subscribing to session: ${sessionTopic} (gen: ${currentGen})`);

    this.sessionChannel = supabase.channel(sessionTopic, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'COMMAND' }, (payload) => {
      if (currentGen !== this.connectionGeneration || this.manualDisconnectRequested) {
        console.log(`[ConnectManager] Ignoring stale callback from connection generation ${currentGen}`);
        return;
      }
      this.handleBroadcastCommand(payload);
    })
    .on('broadcast', { event: 'STATE_UPDATE' }, (payload) => {
      if (currentGen !== this.connectionGeneration || this.manualDisconnectRequested) {
        console.log(`[ConnectManager] Ignoring stale callback from connection generation ${currentGen}`);
        return;
      }
      if (payload && payload.payload) {
        import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
          PlaybackStateSync.getInstance().handleRemoteStateUpdate(payload.payload);
        });
      }
    })
    .subscribe((status) => {
      if (currentGen !== this.connectionGeneration) {
        console.log(`[ConnectManager] Ignoring stale callback from connection generation ${currentGen}`);
        return;
      }
      if (status === 'SUBSCRIBED') {
         this.transitionState('CONNECTED');
         this.initiateRecovery();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
         this.sessionChannel = null;
         if (this.manualDisconnectRequested) {
           console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
           return;
         }
         console.warn('[ConnectManager] Session channel disconnected, scheduling resync...');
         if (this.currentState !== 'RECOVERING' && this.currentState !== 'CONNECTING') {
           this.transitionState('RECOVERING');
         }
      }
    });
  }

  private handleBroadcastCommand(payload: any) {
    const command = payload.payload as ConnectCommand;
    
    if (this.currentState === 'RECOVERING' || this.currentState === 'CONNECTING') {
      console.log('[ConnectManager] Queuing command during recovery state:', command.type);
      this.recoveryQueue.push(command);
      return;
    }

    CommandBus.getInstance().handleIncomingCommand(command);
  }

  public unsubscribeSession() {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;
    try {
      if (this.sessionChannel) {
        const ch = this.sessionChannel;
        this.sessionChannel = null;
        this.sessionId = null;
        try { supabase.removeChannel(ch); } catch {}
      }
    } finally {
      this.isCleaningUp = false;
    }
  }

  private async getOrCreateTargetChannel(targetDeviceId: string): Promise<RealtimeChannel | null> {
    if (!this.userId) return null;
    const targetTopic = `user:${this.userId}:device:${targetDeviceId}`;
    let channel = this.targetChannels.get(targetDeviceId);
    if (channel && (channel.state === 'joined' || channel.state === 'joining')) {
      return channel;
    }

    const rawChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
    const channels = Array.isArray(rawChannels) ? rawChannels : [];
    const existing = channels.find((c: any) => c.topic === `realtime:${targetTopic}` || c.topic === targetTopic);
    if (existing) {
      this.targetChannels.set(targetDeviceId, existing);
      return existing;
    }

    channel = supabase.channel(targetTopic, { config: { broadcast: { self: false } } });
    this.targetChannels.set(targetDeviceId, channel);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(channel), 3000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          this.targetChannels.delete(targetDeviceId);
          resolve(null);
        }
      });
    });
  }

  public async sendTargetedCommand(targetDeviceId: string, command: ConnectCommand) {
    if (!this.userId) return;

    // WebRTC signals are routed directly
    if (command.type === 'WEBRTC_SIGNAL') {
      try {
        const channel = await this.getOrCreateTargetChannel(targetDeviceId);
        if (channel) {
          await channel.send({ type: 'broadcast', event: 'COMMAND', payload: command });
        }
      } catch (e) {
        console.warn('[ConnectManager] Failed to send WebRTC signal:', e);
      }
      return;
    }

    // All other commands go through TransportRouter for LAN-first selection with cloud fallback
    const { TransportRouter } = await import('./TransportRouter');
    const cloudFallback = async (cmd: ConnectCommand) => {
      const channel = await this.getOrCreateTargetChannel(targetDeviceId);
      if (channel) {
        await channel.send({ type: 'broadcast', event: 'COMMAND', payload: cmd });
      }
    };

    const result = await TransportRouter.getInstance().dispatchTargeted(
      targetDeviceId,
      command,
      cloudFallback
    );

    if (result.sent) {
      console.log(`[ConnectManager] Targeted command ${command.type} sent via ${result.via}`);
    } else {
      console.error(`[ConnectManager] Failed to deliver command ${command.type}: ${result.reason}`);
    }
  }

  public async sendSessionCommand(command: ConnectCommand) {
    const { TransportRouter } = await import('./TransportRouter');
    const cloudFallback = async (cmd: ConnectCommand) => {
      if (!this.sessionChannel) return;
      await this.sessionChannel.send({ type: 'broadcast', event: 'COMMAND', payload: cmd });
    };
    await TransportRouter.getInstance().dispatchBroadcast(command, cloudFallback);
  }

  public async broadcastSessionState(statePayload: any) {
    try {
      const { LocalPeerConnection } = await import('./LocalPeerConnection');
      if (LocalPeerConnection && typeof LocalPeerConnection.getInstance === 'function') {
        LocalPeerConnection.getInstance()?.sendDirectBroadcast({
          type: 'STATE_UPDATE',
          event: 'STATE_UPDATE',
          payload: statePayload
        } as any);
      }
    } catch {}

    if (isOfflineMode()) {
      return;
    }

    if (!this.sessionChannel) return;
    await this.sessionChannel.send({
      type: 'broadcast',
      event: 'STATE_UPDATE',
      payload: statePayload
    });
  }

  public handleCommandAck(payload: any) {
    const resolver = this.pendingCommandResolvers.get(payload.commandId);
    if (resolver) {
      clearTimeout(resolver.timeout);
      this.pendingCommandResolvers.delete(payload.commandId);
      if (payload.status === 'APPLIED') {
        resolver.resolve({ success: true });
      } else {
        resolver.reject(new Error(payload.reason || payload.status));
      }
    }
    // Resolve the observability trace regardless of whether we have a resolver
    import('./CommandObservabilityStore').then(({ CommandObservabilityStore }) => {
      CommandObservabilityStore.getInstance().resolve(payload.commandId, {
        ackAt: Date.now(),
        result: payload.status,
      });
    }).catch(() => {});
  }

  public async connectToDevice(targetDeviceId: string): Promise<boolean> {
    console.log(`[ConnectManager] Connecting to remote device: ${targetDeviceId}`);
    const store = usePlayerStore.getState();
    if (targetDeviceId === store.deviceId) {
      console.log('[ConnectManager] Target is local device — skipping remote connect');
      return true;
    }

    usePlayerStore.setState({
      deviceConnectionState: 'CONNECTING',
      connectedDeviceId: targetDeviceId,
    });

    try {
      const { LocalPeerConnection } = await import('./LocalPeerConnection');
      // Attempt fast direct LAN connection handshake
      const lanConnected = await LocalPeerConnection.getInstance().connectToDevice(targetDeviceId);
      
      if (lanConnected) {
        console.log(`[ConnectManager] Fast local LAN channel established with ${targetDeviceId}`);
      } else {
        console.warn(`[ConnectManager] Direct LAN channel failed. Falling back to Cloud Relay for ${targetDeviceId}`);
        // Fallback: adopt optimistic state from cache
        const { PlaybackStateSync } = await import('./PlaybackStateSync');
        const cached = PlaybackStateSync.getInstance().getCachedRemoteState(targetDeviceId);
        if (cached) {
          PlaybackStateSync.getInstance().adoptRemoteState(cached);
        }
      }

      // Always subscribe to Supabase session channel as the cloud control/recovery layer
      if (this.sessionId) {
        this.subscribeSession(this.sessionId);
      }

      usePlayerStore.setState({
        deviceConnectionState: 'CONNECTED',
        connectedDeviceId: targetDeviceId,
        activeDeviceId: targetDeviceId,
        isActiveDevice: false,
      });

      return true;
    } catch (e) {
      console.error('[ConnectManager] Failed to connect to device:', e);
      usePlayerStore.setState({
        deviceConnectionState: 'AVAILABLE',
        connectedDeviceId: null,
      });
      return false;
    }
  }

  public async manualDisconnect(): Promise<void> {
    console.log('[ConnectManager] Manual disconnect requested');
    this.manualDisconnectRequested = true;

    this.connectionGeneration++;
    console.log('[ConnectManager] Old connection generation invalidated');

    this.transitionState('DISCONNECTING');

    // 1. Cancel all reconnect and recovery timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    // 2. Clear single-flight command queue and pending resolvers
    try {
      const { SingleFlightCommandQueue } = await import('./SingleFlightCommandQueue');
      SingleFlightCommandQueue.getInstance().clear();
    } catch {}

    for (const [id, resolver] of this.pendingCommandResolvers.entries()) {
      clearTimeout(resolver.timeout);
      resolver.resolve({ success: false, reason: 'manual_disconnect' });
    }
    this.pendingCommandResolvers.clear();
    this.recoveryQueue = [];

    // 3. Release device lease if this device currently owns it
    console.log('[ConnectManager] Releasing device lease');
    try {
      const { DeviceLeaseManager } = await import('./DeviceLeaseManager');
      await DeviceLeaseManager.getInstance().releaseLease(this.sessionId || undefined);
    } catch (e) {
      console.warn('[ConnectManager] Error releasing device lease:', e);
    }

    // 4. Unsubscribe inbox channel
    console.log('[ConnectManager] Unsubscribing inbox');
    if (this.inboxChannel) {
      try { supabase.removeChannel(this.inboxChannel); } catch (e) {}
      this.inboxChannel = null;
    }

    // 5. Unsubscribe session channel and target channels
    console.log('[ConnectManager] Unsubscribing session and target channels');
    this.unsubscribeSession();
    for (const [devId, ch] of this.targetChannels.entries()) {
      try { supabase.removeChannel(ch); } catch {}
    }
    this.targetChannels.clear();

    // 6. Cleanup local peer connections if any
    const store = usePlayerStore.getState();
    const targetId = store.connectedDeviceId;
    if (targetId) {
      try {
        const { LocalPeerConnection } = await import('./LocalPeerConnection');
        LocalPeerConnection.getInstance().cleanup(targetId);
      } catch {}
      try {
        const { TransportRouter } = await import('./TransportRouter');
        TransportRouter.getInstance().onLanChannelLost(targetId);
      } catch {}
    }

    // 7. Clear local session snapshot
    try {
      const { SessionReconciler } = await import('./SessionReconciler');
      SessionReconciler.getInstance().clearLocalSnapshot();
    } catch {}

    // 8. Reset local store state without stopping remote playback on target renderer
    usePlayerStore.setState({
      connectedDeviceId: null,
      activeDeviceId: null,
      remoteDeviceName: null,
      isActiveDevice: true,
      deviceConnectionState: 'AVAILABLE',
    });

    // 9. Reset CommandBus state
    CommandBus.getInstance().reset();

    // 10. Transition to DISCONNECTED
    this.transitionState('DISCONNECTED');
  }

  public disconnectFromDevice() {
    usePlayerStore.setState({
      connectedDeviceId: null,
      activeDeviceId: null,
      remoteDeviceName: null,
      isActiveDevice: true,
      deviceConnectionState: 'AVAILABLE',
    });
    this.manualDisconnect();
  }

  public async dispatchPlaybackCommand(type: ConnectCommand['type'], payload: any = {}): Promise<{ success: boolean; reason?: string }> {
    const store = usePlayerStore.getState();
    const targetDeviceId = store.connectedDeviceId || store.activeDeviceId || undefined;

    // Direct offline validation: only allow commands if network is online OR direct LAN is active
    const { ConnectivityRouter } = await import('./ConnectivityRouter');
    const router = ConnectivityRouter.getInstance();
    const activeTransport = router.getActiveTransport();

    if (activeTransport === 'CLOUD_RELAY' && !NetworkManager.getInstance().isOnline()) {
      console.warn(`[ConnectManager] Cannot dispatch ${type} command while offline.`);
      return { success: false, reason: 'offline' };
    }
    
    if (this.currentState === 'OFFLINE' && activeTransport === 'CLOUD_RELAY') {
      console.warn(`[ConnectManager] Cannot dispatch ${type} command while in state: ${this.currentState}`);
      return { success: false, reason: 'offline_state' };
    }
    
    if (targetDeviceId && ['PLAY', 'PAUSE', 'NEXT', 'PREV', 'SEEK'].includes(type)) {
      const { SingleFlightCommandQueue } = await import('./SingleFlightCommandQueue');
      return SingleFlightCommandQueue.getInstance().executeSingleFlight(
        targetDeviceId,
        type,
        payload,
        () => this.executeDispatchInternal(type, payload, targetDeviceId)
      );
    }

    return this.executeDispatchInternal(type, payload, targetDeviceId);
  }

  private async executeDispatchInternal(
    type: ConnectCommand['type'],
    payload: any,
    targetDeviceId?: string
  ): Promise<{ success: boolean; reason?: string }> {
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const clock = ClockSynchronizer.getInstance();
    const commandId = crypto.randomUUID();

    const command: ConnectCommand = {
      commandId,
      sessionId: this.sessionId || 'global',
      epoch: sequencer.getEpoch(),
      sequence: sequencer.nextSequence(),
      sourceDeviceId: this.deviceId || store.deviceId,
      targetDeviceId,
      type,
      sentAt: Date.now(),
      payload: {
        ...payload,
        songId: payload?.songId || store.currentSong?.id || undefined,
        serverTimestamp: clock.getEstimatedServerNow()
      }
    };

    if (type === 'PLAY' || type === 'PAUSE' || type === 'SEEK' || type === 'NEXT' || type === 'PREV' || type === 'SET_VOLUME') {
      const { PlaybackStateSync } = await import('./PlaybackStateSync');
      PlaybackStateSync.getInstance().recordSentCommand(
        type,
        store.currentSong?.id || null,
        store.queueIndex,
        payload?.positionMs,
        commandId
      );
    }
    
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommandResolvers.delete(commandId);
        resolve({ success: false, reason: 'timeout' });
      }, 5000);

      this.pendingCommandResolvers.set(commandId, {
        resolve,
        reject: (err) => resolve({ success: false, reason: String(err) }),
        timeout
      });

      try {
        const { TransportRouter } = await import('./TransportRouter');
        
        if (targetDeviceId) {
          // Targeted command — TransportRouter picks LAN or Cloud, same commandId either way
          const cloudFallback = async (cmd: ConnectCommand) => {
            await CommandBus.getInstance().dispatch(cmd);
          };

          const result = await TransportRouter.getInstance().dispatchTargeted(
            targetDeviceId,
            command,
            cloudFallback
          );

          if (result.sent && result.via !== 'CLOUD_RELAY') {
            // LAN delivery: optimistically resolve playback control commands immediately
            if (['PLAY', 'PAUSE', 'SEEK', 'SET_VOLUME', 'NEXT', 'PREV'].includes(type)) {
              clearTimeout(timeout);
              this.pendingCommandResolvers.delete(commandId);
              resolve({ success: true });
            }
            // For other commands wait for ACK from the renderer
          } else if (!result.sent) {
            clearTimeout(timeout);
            this.pendingCommandResolvers.delete(commandId);
            resolve({ success: false, reason: result.reason });
          }
          // If sent via Cloud, wait for ACK normally
        } else {
          // Broadcast (no specific target)
          const cloudFallback = async (cmd: ConnectCommand) => {
            await CommandBus.getInstance().dispatch(cmd);
          };
          await TransportRouter.getInstance().dispatchBroadcast(command, cloudFallback);
        }
      } catch (e) {
        clearTimeout(timeout);
        this.pendingCommandResolvers.delete(commandId);
        resolve({ success: false, reason: String(e) });
      }
    });
  }
}
