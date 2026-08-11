import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ConnectCommand } from './types';
import { CommandBus } from './CommandBus';

export class ConnectManager {
  private static instance: ConnectManager;
  
  private userId: string | null = null;
  private deviceId: string | null = null;
  private sessionId: string | null = null;
  
  private inboxChannel: RealtimeChannel | null = null;
  private sessionChannel: RealtimeChannel | null = null;

  private constructor() {}

  public static getInstance(): ConnectManager {
    if (!ConnectManager.instance) {
      ConnectManager.instance = new ConnectManager();
    }
    return ConnectManager.instance;
  }

  public init(userId: string, deviceId: string) {
    this.userId = userId;
    this.deviceId = deviceId;
    
    // Subscribe to persistent device inbox
    this.subscribeInbox();
  }

  private subscribeInbox() {
    if (this.inboxChannel) return;
    if (!this.userId || !this.deviceId) return;

    const inboxTopic = `user:${this.userId}:device:${this.deviceId}`;
    console.log(`[ConnectManager] Subscribing to inbox: ${inboxTopic}`);

    this.inboxChannel = supabase.channel(inboxTopic, {
      config: { broadcast: { self: false } }
    })
    .on('broadcast', { event: 'COMMAND' }, (payload) => {
       const command = payload.payload as ConnectCommand;
       CommandBus.getInstance().handleIncomingCommand(command);
    })
    .subscribe();
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
    .on('broadcast', { event: 'COMMAND' }, (payload) => {
       const command = payload.payload as ConnectCommand;
       CommandBus.getInstance().handleIncomingCommand(command);
    })
    .subscribe();
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
