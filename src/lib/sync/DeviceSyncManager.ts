import { ConnectManager } from '../connect/ConnectManager';
import { CommandBus } from '../connect/CommandBus';
import { PlaybackSessionManager } from './PlaybackSessionManager';
import { CommandValidator } from '../connect/CommandValidator';
import { useAuthStore } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { supabase } from '../supabase';

export class DeviceSyncManager {
  private static instance: DeviceSyncManager;
  private isInitializing = false;
  private deviceId: string;

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

  public async initSync() {
    if (this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        this.isInitializing = false;
        return;
      }
      
      const user = sessionData.session.user;
      const sessionId = `session_${user.id}`; 

      // Register device in DB
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const deviceName = isMobile ? 'Mobile App' : 'Desktop Web';
      
      // We don't await this so it doesn't block startup
      supabase.from('devices').upsert({
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
      }, { onConflict: 'device_id' }).then(() => {});

      // Initialize New Architecture Managers
      const connectManager = ConnectManager.getInstance();
      connectManager.init(user.id, this.deviceId);

      const commandBus = CommandBus.getInstance();
      commandBus.init(this.deviceId, sessionId);

      const validator = CommandValidator.getInstance();
      // Initially set local state. We would fetch the epoch/sequence from the DB snapshot.
      validator.setLocalState(0, 0);

      const sessionManager = PlaybackSessionManager.getInstance();
      sessionManager.init(sessionId);

      console.log('[DeviceSyncManager] Successfully initialized hybrid architecture');

    } catch (error) {
      console.error('[DeviceSyncManager] Initialization failed:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  public async dispatchCommand(type: import('../connect/CommandValidator').PlaybackCommand['type'] | string, positionMs?: number, payload?: any) {
    const bus = CommandBus.getInstance();
    const store = usePlayerStore.getState();
    const sessionId = `session_${store.activeDeviceId || this.deviceId}`; // Or fetch properly
    
    // Create the full command
    const command: import('../connect/CommandValidator').PlaybackCommand = {
      commandId: crypto.randomUUID(),
      sessionId: sessionId,
      type: type as any,
      canonicalPositionMs: positionMs,
      senderDeviceId: this.deviceId,
      targetDeviceId: payload?.transferToDeviceId,
      epoch: 1, // Ideally from snapshot
      sequence: Date.now(), // Rough approximation for strictly increasing sequence
      createdAt: Date.now(),
    };
    
    await bus.dispatch(command);
  }

  public async takeOverPlayback() {
    // A simplified takeOver that can be fleshed out, essentially asking for a handoff
    await this.dispatchCommand('HANDOFF', undefined, { transferToDeviceId: this.deviceId });
  }
}

