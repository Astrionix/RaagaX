import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConnectCommand, ConnectState } from './types';
import { CommandBus } from './CommandBus';
import { NetworkManager } from '../offline/NetworkManager';
import { DeviceRegistry } from './DeviceRegistry';
import { SessionReconciler } from './SessionReconciler';

export class ConnectManager {
  private static instance: ConnectManager;
  
  private userId: string | null = null;
  private deviceId: string | null = null;
  private deviceInstanceId: string | null = null;
  private sessionId: string | null = null;
  
  private inboxChannel: RealtimeChannel | null = null;
  private sessionChannel: RealtimeChannel | null = null;

  private currentState: ConnectState = 'OFFLINE';
  private recoveryQueue: ConnectCommand[] = [];

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

  public async init(userId: string, deviceId: string) {
    this.userId = userId;
    this.deviceId = deviceId;
    this.deviceInstanceId = DeviceRegistry.getInstance().getOrCreateDeviceInstanceId();
    
    this.transitionState('CONNECTING');
    
    // 1. Subscribe to this device's persistent inbox (always, even as follower)
    this.subscribeInbox();
    
    // 2. Get or create the canonical playback session for this user
    const sessionId = await DeviceRegistry.getInstance().createOrJoinSession(userId);
    if (!sessionId) {
      console.error('[ConnectManager] Could not create/join playback session.');
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
    const { CommandBus } = await import('./CommandBus');
    CommandBus.getInstance().init(deviceId, sessionId);
    
    const { PlaybackSessionManager } = await import('../sync/PlaybackSessionManager');
    PlaybackSessionManager.getInstance().init(sessionId);
  }

  private transitionState(newState: ConnectState) {
    console.log(`[ConnectManager] State transition: ${this.currentState} -> ${newState}`);
    this.currentState = newState;
    
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

  private handleNetworkOffline() {
    if (this.currentState !== 'OFFLINE') {
      this.transitionState('OFFLINE');
    }
  }

  private handleNetworkOnline() {
    if (this.currentState === 'OFFLINE' && this.userId) {
      this.transitionState('CONNECTING');
      this.subscribeInbox();
      if (this.sessionId) {
        this.subscribeSession(this.sessionId);
      }
    }
  }

  private async initiateRecovery() {
    if (!this.sessionId || !this.userId) return;

    try {
      console.log('[ConnectManager] Initiating session recovery...');
      // 1. Fetch authoritative snapshot from DB
      const snapshot = await SessionReconciler.getInstance().fetchAuthoritativeSnapshot(this.sessionId);
      
      if (snapshot) {
        // 2. Apply snapshot to local player
        await SessionReconciler.getInstance().applySnapshot(snapshot);
      }
      
      this.transitionState('READY');
      this.processRecoveryQueue();
    } catch (e) {
      console.error('[ConnectManager] Recovery failed, retrying...', e);
      setTimeout(() => {
        if (this.currentState === 'RECOVERING') this.initiateRecovery();
      }, 5000);
    }
  }

  private processRecoveryQueue() {
    console.log(`[ConnectManager] Processing recovery queue: ${this.recoveryQueue.length} commands`);
    const toProcess = [...this.recoveryQueue];
    this.recoveryQueue = [];
    
    const validator = require('./CommandValidator').CommandValidator.getInstance();
    for (const cmd of toProcess) {
      if (validator.validate(cmd)) {
        CommandBus.getInstance().handleIncomingCommand(cmd);
      } else {
        console.log('[ConnectManager] Dropped stale recovery command:', cmd.type, cmd.commandId);
      }
    }
  }

  private subscribeInbox() {
    if (this.inboxChannel) return;
    if (!this.userId || !this.deviceId) return;

    const inboxTopic = `user:${this.userId}:device:${this.deviceId}`;
    console.log(`[ConnectManager] Subscribing to inbox: ${inboxTopic}`);

    this.inboxChannel = supabase.channel(inboxTopic, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'COMMAND' }, (payload) => this.handleBroadcastCommand(payload))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
         if (this.currentState === 'CONNECTING' || this.currentState === 'RECOVERING') {
           this.transitionState('SUBSCRIBING');
         }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
         console.warn('[ConnectManager] Inbox channel disconnected, attempting reconnect...');
         this.transitionState('OFFLINE');
         this.inboxChannel = null;
         setTimeout(() => this.handleNetworkOnline(), 3000);
      }
    });
  }

  public subscribeSession(sessionId: string) {
    if (this.sessionChannel && this.sessionId === sessionId) return;
    
    this.unsubscribeSession();
    this.sessionId = sessionId;
    
    if (!this.userId) return;

    const sessionTopic = `user:${this.userId}:session:${sessionId}`;
    console.log(`[ConnectManager] Subscribing to session: ${sessionTopic}`);

    this.sessionChannel = supabase.channel(sessionTopic, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'COMMAND' }, (payload) => this.handleBroadcastCommand(payload))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
         this.transitionState('CONNECTED');
         this.initiateRecovery();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
         console.warn('[ConnectManager] Session channel disconnected, scheduling resync...');
         this.sessionChannel = null;
         this.transitionState('RECOVERING');
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
    if (this.sessionChannel) {
      supabase.removeChannel(this.sessionChannel);
      this.sessionChannel = null;
      this.sessionId = null;
    }
  }

  public async sendTargetedCommand(targetDeviceId: string, command: ConnectCommand) {
    if (!this.userId) return;
    const targetTopic = `user:${this.userId}:device:${targetDeviceId}`;
    
    const tempChannel = supabase.channel(targetTopic, { config: { broadcast: { self: false } } });
    tempChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
         await tempChannel.send({
           type: 'broadcast',
           event: 'COMMAND',
           payload: command
         });
         supabase.removeChannel(tempChannel); // Cleanup immediately
      }
    });
  }

  public async sendSessionCommand(command: ConnectCommand) {
    if (!this.sessionChannel) return;
    
    await this.sessionChannel.send({
      type: 'broadcast',
      event: 'COMMAND',
      payload: command
    });
  }

  public async dispatchPlaybackCommand(type: ConnectCommand['type'], payload: any = {}) {
    if (!NetworkManager.getInstance().isOnline()) {
      console.warn(`[ConnectManager] Cannot dispatch ${type} command while offline.`);
      return;
    }
    
    if (this.currentState === 'OFFLINE') {
      console.warn(`[ConnectManager] Cannot dispatch ${type} command while in state: ${this.currentState}`);
      return;
    }
    
    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    const sequencer = require('./CommandSequencer').CommandSequencer.getInstance();
    const clock = require('./ClockSynchronizer').ClockSynchronizer.getInstance();
    
    const command: ConnectCommand = {
      commandId: crypto.randomUUID(),
      sessionId: this.sessionId || 'global',
      epoch: sequencer.getEpoch(),
      sequence: sequencer.nextSequence(),
      sourceDeviceId: this.deviceId || store.deviceId,
      type,
      sentAt: Date.now(),
      payload: {
        ...payload,
        serverTimestamp: clock.getEstimatedServerNow()
      }
    };
    
    await CommandBus.getInstance().dispatch(command);
  }
}
