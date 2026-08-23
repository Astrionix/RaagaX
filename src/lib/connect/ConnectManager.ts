import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConnectCommand, ConnectState, ConnectionAttempt } from './types';
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
  private currentAttempt: ConnectionAttempt | null = null;
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

  public getCurrentAttempt(): ConnectionAttempt | null {
    return this.currentAttempt;
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
  private globalPlaybackStateChannel: any = null;

  public initGlobalPlaybackStateChannel() {
    if (this.globalPlaybackStateChannel) return;
    try {
      this.globalPlaybackStateChannel = supabase.channel('raagax:playback_state', {
        config: { broadcast: { self: false } }
      })
      .on('broadcast', { event: 'STATE_UPDATE' }, (payload: any) => {
        if (payload && payload.payload) {
          import('./PlaybackStateSync').then(({ PlaybackStateSync }) => {
            PlaybackStateSync.getInstance().handleRemoteStateUpdate(payload.payload);
          });
        }
      })
      .subscribe();
    } catch {}
  }

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
    if (this.manualDisconnectRequested) {
      console.log('[ConnectManager] Reconnect cancelled: manual disconnect');
      return;
    }
    if (this.inboxChannel && (this.inboxChannel.state === 'joined' || this.inboxChannel.state === 'joining')) {
      return; // Already subscribed
    }
    
    this.initGlobalPlaybackStateChannel();

    if (this.inboxChannel) {
      const ch = this.inboxChannel;
      this.inboxChannel = null;
      try { supabase.removeChannel(ch); } catch (e) {}
    }

    const inboxTopic = this.userId 
      ? `user:${this.userId}:device:${this.deviceId}` 
      : `device:${this.deviceId}:inbox`;

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
    this.initGlobalPlaybackStateChannel();
    
    if (!this.userId) return;

    const sessionTopic = this.userId 
      ? `user:${this.userId}:session:${sessionId}` 
      : `session:${sessionId}`;
      
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
    const targetTopic = this.userId ? `user:${this.userId}:device:${targetDeviceId}` : `device:${targetDeviceId}:inbox`;
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
    // WebRTC signals are routed directly
    if (command.type === 'WEBRTC_SIGNAL') {
      try {
        const channel = await this.getOrCreateTargetChannel(targetDeviceId);
        if (channel) {
          const payload = { type: 'broadcast' as const, event: 'COMMAND', payload: command };
          if (channel.state === 'joined') {
            await channel.send(payload).catch(() => {});
          } else if (typeof (channel as any).httpSend === 'function') {
            await (channel as any).httpSend('COMMAND', command).catch(() => {});
          }
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
        const payload = { type: 'broadcast' as const, event: 'COMMAND', payload: cmd };
        if (channel.state === 'joined') {
          console.log('[Transport] Using realtime channel');
          await channel.send(payload).catch(() => {});
        } else if (typeof (channel as any).httpSend === 'function') {
          console.log('[Transport] Using explicit HTTP delivery');
          await (channel as any).httpSend('COMMAND', cmd).catch(() => {});
        }
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
      const payload = { type: 'broadcast' as const, event: 'COMMAND', payload: cmd };
      if (this.sessionChannel.state === 'joined') {
        console.log('[Transport] Using realtime channel');
        await this.sessionChannel.send(payload).catch(() => {});
      } else if (typeof (this.sessionChannel as any).httpSend === 'function') {
        console.log('[Transport] Using explicit HTTP delivery');
        await (this.sessionChannel as any).httpSend('COMMAND', cmd).catch(() => {});
      }
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

    if (!this.globalPlaybackStateChannel) {
      this.initGlobalPlaybackStateChannel();
    }

    const payload = {
      type: 'broadcast' as const,
      event: 'STATE_UPDATE',
      payload: statePayload
    };

    if (this.globalPlaybackStateChannel) {
      try {
        if (this.globalPlaybackStateChannel.state === 'joined') {
          this.globalPlaybackStateChannel.send(payload).catch(() => {});
        } else if (typeof (this.globalPlaybackStateChannel as any).httpSend === 'function') {
          (this.globalPlaybackStateChannel as any).httpSend('STATE_UPDATE', statePayload).catch(() => {});
        }
      } catch {}
    }

    if (this.sessionChannel) {
      try {
        if (this.sessionChannel.state === 'joined') {
          await this.sessionChannel.send(payload).catch(() => {});
        } else if (typeof (this.sessionChannel as any).httpSend === 'function') {
          await (this.sessionChannel as any).httpSend('STATE_UPDATE', statePayload).catch(() => {});
        }
      } catch {}
    }
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
    const store = usePlayerStore.getState();
    if (targetDeviceId === store.deviceId) {
      console.log('[ConnectManager] Target is local device — skipping remote connect');
      return true;
    }

    this.manualDisconnectRequested = false;
    if (this.currentAttempt) {
      this.currentAttempt.cancelled = true;
    }

    const gen = ++this.connectionGeneration;
    const attempt: ConnectionAttempt = {
      id: crypto.randomUUID(),
      generation: gen,
      deviceId: targetDeviceId,
      startedAt: Date.now(),
      transport: 'NONE',
      status: 'LOCAL_CONNECTING',
      completed: false,
      failed: false,
      fallbackStarted: false,
      cancelled: false,
      cleanedUp: false,
    };
    this.currentAttempt = attempt;

    console.log(`[ConnectManager][gen=${gen}][device=${targetDeviceId}] Starting connection`);

    usePlayerStore.setState({
      deviceConnectionState: 'CONNECTING',
      connectedDeviceId: targetDeviceId,
    });
    this.transitionState('LOCAL_CONNECTING');

    try {
      const { LocalPeerConnection } = await import('./LocalPeerConnection');
      console.log(`[LocalPeer][gen=${gen}] Starting LAN handshake`);
      
      const lanConnected = await LocalPeerConnection.getInstance().connectToDevice(targetDeviceId, gen);

      // Check if attempt was cancelled or superseded by a newer generation or manual disconnect
      if (this.connectionGeneration !== gen || attempt.cancelled || this.manualDisconnectRequested) {
        console.log(`[ConnectManager][gen=${gen}] Ignoring stale connection result; current generation = ${this.connectionGeneration}`);
        return false;
      }

      if (lanConnected) {
        console.log(`[LocalPeer][gen=${gen}] Handshake successful`);
        attempt.status = 'LOCAL_CONNECTED';
        attempt.transport = 'LOCAL_DIRECT';
        const { ConnectivityRouter } = await import('./ConnectivityRouter');
        ConnectivityRouter.getInstance().setLocalPeerAvailable(true);
        console.log(`[TransportRouter][gen=${gen}] Active transport = LOCAL`);
      } else {
        // Single owner transport fallback
        if (attempt.fallbackStarted) {
          return false;
        }
        attempt.fallbackStarted = true;
        attempt.status = 'CLOUD_CONNECTING';
        console.warn(`[TransportRouter][gen=${gen}] LOCAL failed; starting CLOUD fallback`);
        
        const { ConnectivityRouter } = await import('./ConnectivityRouter');
        ConnectivityRouter.getInstance().setLocalPeerAvailable(false);
        console.log(`[TransportRouter][gen=${gen}] Active transport = CLOUD`);

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

      attempt.completed = true;
      attempt.status = lanConnected ? 'LOCAL_CONNECTED' : 'CLOUD_CONNECTED';
      this.transitionState('READY');

      usePlayerStore.setState({
        deviceConnectionState: 'CONNECTED',
        connectedDeviceId: targetDeviceId,
        activeDeviceId: targetDeviceId,
        isActiveDevice: false,
      });

      console.log(`[ConnectManager][gen=${gen}] Connection READY`);

      // Request state snapshot over the established transport path
      if (!lanConnected) {
        this.sendTargetedCommand(targetDeviceId, {
          commandId: 'cmd_state_' + Date.now(),
          sessionId: this.sessionId || 'local_session',
          sourceDeviceId: store.deviceId,
          targetDeviceId,
          type: 'GET_STATE' as any,
          epoch: 1,
          sequence: 1,
          revision: 1,
          sentAt: Date.now(),
          payload: { generation: gen },
        }).catch(() => {});
      } else {
        try {
          const { DirectLANTransport } = await import('./lan/DirectLANTransport');
          DirectLANTransport.getInstance().sendMessage(targetDeviceId, {
            id: 'lan_state_req_' + Date.now(),
            type: 'CMD_STATE_REQUEST' as any,
            sourceDeviceId: store.deviceId,
            targetDeviceId,
            timestamp: Date.now(),
            generation: gen,
          } as any);
        } catch {}
      }

      return true;
    } catch (e) {
      if (this.connectionGeneration !== gen) {
        console.log(`[ConnectManager][gen=${gen}] Ignoring error from obsolete generation; current generation = ${this.connectionGeneration}`);
        return false;
      }

      console.error(`[ConnectManager][gen=${gen}] Failed to connect to device:`, e);
      attempt.failed = true;
      attempt.status = 'FAILED';

      usePlayerStore.setState({
        deviceConnectionState: 'AVAILABLE',
        connectedDeviceId: null,
      });
      this.transitionState('DISCONNECTED');
      return false;
    }
  }

  public async manualDisconnect(): Promise<void> {
    const oldGen = this.connectionGeneration;
    console.log(`[ConnectManager][gen=${oldGen}] Manual disconnect requested`);
    this.manualDisconnectRequested = true;

    if (this.currentAttempt) {
      this.currentAttempt.cancelled = true;
      this.currentAttempt.status = 'DISCONNECTING';
    }

    this.connectionGeneration++;
    console.log(`[ConnectManager][gen=${oldGen}] Invalidating generation`);

    this.transitionState('DISCONNECTING');

    // 1. Cancel all recovery timers
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
    console.log(`[ConnectManager][gen=${oldGen}] Releasing device lease`);
    try {
      const { DeviceLeaseManager } = await import('./DeviceLeaseManager');
      await DeviceLeaseManager.getInstance().releaseLease(this.sessionId || undefined);
    } catch (e) {
      console.warn('[ConnectManager] Error releasing device lease:', e);
    }

    // 4. Unsubscribe inbox channel
    console.log(`[ConnectManager][gen=${oldGen}] Unsubscribing inbox`);
    if (this.inboxChannel) {
      try { supabase.removeChannel(this.inboxChannel); } catch (e) {}
      this.inboxChannel = null;
    }

    // 5. Unsubscribe session channel and target channels
    console.log(`[ConnectManager][gen=${oldGen}] Unsubscribing session and target channels`);
    this.unsubscribeSession();
    for (const [devId, ch] of this.targetChannels.entries()) {
      try { supabase.removeChannel(ch); } catch {}
    }
    this.targetChannels.clear();

    // 6. Cleanup local peer connections (without triggering false fallbacks!)
    const store = usePlayerStore.getState();
    const targetId = store.connectedDeviceId;
    if (targetId) {
      try {
        const { LocalPeerConnection } = await import('./LocalPeerConnection');
        LocalPeerConnection.getInstance().cleanup(targetId, oldGen, 'MANUAL_DISCONNECT');
      } catch {}
      try {
        const { ConnectivityRouter } = await import('./ConnectivityRouter');
        ConnectivityRouter.getInstance().setLocalPeerAvailable(false);
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
    if (this.currentAttempt) {
      this.currentAttempt.status = 'DISCONNECTED';
      this.currentAttempt.cleanedUp = true;
      this.currentAttempt = null;
    }
    this.transitionState('DISCONNECTED');
  }

  public async disconnectFromDevice(): Promise<void> {
    usePlayerStore.setState({
      connectedDeviceId: null,
      activeDeviceId: null,
      remoteDeviceName: null,
      isActiveDevice: true,
      deviceConnectionState: 'AVAILABLE',
    });
    await this.manualDisconnect();
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
    
    if (targetDeviceId && ['PLAY', 'PAUSE', 'NEXT', 'PREV', 'PREVIOUS', 'SEEK', 'SET_VOLUME', 'ADD_TO_QUEUE', 'REMOVE_FROM_QUEUE', 'MOVE_QUEUE_ITEM', 'CLEAR_QUEUE', 'PLAY_TRACK', 'STOP'].includes(type)) {
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

    if (type === 'PLAY' || type === 'PAUSE' || type === 'SEEK' || type === 'NEXT' || type === 'PREV' || type === 'PREVIOUS' || type === 'SET_VOLUME' || type === 'ADD_TO_QUEUE' || type === 'REMOVE_FROM_QUEUE' || type === 'MOVE_QUEUE_ITEM' || type === 'CLEAR_QUEUE' || type === 'PLAY_TRACK' || type === 'STOP') {
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
            // LAN delivery: optimistically resolve playback and queue commands immediately
            if (['PLAY', 'PAUSE', 'SEEK', 'SET_VOLUME', 'NEXT', 'PREV', 'PREVIOUS', 'ADD_TO_QUEUE', 'REMOVE_FROM_QUEUE', 'MOVE_QUEUE_ITEM', 'CLEAR_QUEUE', 'PLAY_TRACK', 'STOP'].includes(type)) {
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
