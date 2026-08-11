import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PlaybackCommand } from './CommandValidator';
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
       const command = payload.payload as PlaybackCommand;
       CommandBus.getInstance().handleIncomingCommand(command);
    })
    .subscribe((status) => {
      console.log(`[ConnectManager] Inbox channel status: ${status}`);
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
    .on('broadcast', { event: 'COMMAND' }, (payload) => {
       const command = payload.payload as PlaybackCommand;
       CommandBus.getInstance().handleIncomingCommand(command);
    })
    .subscribe((status) => {
       console.log(`[ConnectManager] Session channel status: ${status}`);
    });
  }

  public unsubscribeSession() {
    if (this.sessionChannel) {
      supabase.removeChannel(this.sessionChannel);
      this.sessionChannel = null;
      this.sessionId = null;
    }
  }

  public async sendTargetedCommand(targetDeviceId: string, command: PlaybackCommand) {
    if (!this.userId) return;
    const targetTopic = `user:${this.userId}:device:${targetDeviceId}`;
    
    // Use the inbox channel to send the targeted command
    // Realtime allows sending messages to other channels if configured, or we just create a temporary send channel
    // but the easiest is using our established inboxChannel to broadcast OUT to a specific topic
    
    // Actually, in Supabase, you must send ON the channel that matches the topic.
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

  public async sendSessionCommand(command: PlaybackCommand) {
    if (!this.sessionChannel) return;
    
    await this.sessionChannel.send({
      type: 'broadcast',
      event: 'COMMAND',
      payload: command
    });
  }
}
