import { supabase } from '@/lib/supabaseClient';

export interface JamParticipant {
  deviceId: string;
  deviceName: string;
  isHost: boolean;
  joinedAt: number;
}

export interface JamStateMessage {
  type: 'SYNC_STATE' | 'TRACK_CHANGE' | 'SEEK' | 'PLAY_PAUSE';
  trackId: string;
  currentTrack?: any;
  positionMs: number;
  isPlaying: boolean;
  scheduledTime?: number;
  revision: number;
}

export class JamService {
  private channel: any = null;
  private jamId: string | null = null;
  private isHost: boolean = false;
  private currentDeviceId: string;

  constructor(deviceId: string) {
    this.currentDeviceId = deviceId;
  }

  // 1. Create Jam (No Render 404 call)
  public async createJam(deviceName: string, onStateReceived: (state: JamStateMessage) => void): Promise<string> {
    this.isHost = true;
    this.jamId = `jam_${Math.random().toString(36).substring(2, 9)}`;
    await this.joinChannel(this.jamId, deviceName, true, onStateReceived);
    return this.jamId;
  }

  // 2. Join Jam via Room ID / QR
  public async joinJam(jamId: string, deviceName: string, onStateReceived: (state: JamStateMessage) => void): Promise<string> {
    this.isHost = false;
    this.jamId = jamId;
    await this.joinChannel(jamId, deviceName, false, onStateReceived);
    return this.jamId;
  }

  private async joinChannel(
    jamId: string,
    deviceName: string,
    isHost: boolean,
    onStateReceived: (state: JamStateMessage) => void
  ) {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    this.channel = supabase.channel(`jam_room_${jamId}`, {
      config: {
        presence: { key: this.currentDeviceId },
        broadcast: { ack: false, self: false } // REST fallback avoided, pure WebSocket
      }
    });

    // Realtime Broadcast Listener for Play/Pause/Sync
    this.channel.on('broadcast', { event: 'jam_event' }, (payload: { payload: JamStateMessage }) => {
      onStateReceived(payload.payload);
    });

    // Device Presence Tracking
    this.channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          deviceId: this.currentDeviceId,
          deviceName,
          isHost,
          joinedAt: Date.now()
        });
      }
    });
  }

  // 3. Broadcast Commands (Zero Egress, Pure WebSocket)
  public broadcastCommand(state: JamStateMessage) {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'jam_event',
      payload: state
    });
  }

  public async leaveJam() {
    if (this.channel) {
      await this.channel.untrack();
      await supabase.removeChannel(this.channel);
      this.channel = null;
      this.jamId = null;
    }
  }
}
