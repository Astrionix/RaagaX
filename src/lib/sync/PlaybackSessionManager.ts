import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceSyncManager } from './DeviceSyncManager';

export class PlaybackSessionManager {
  private static instance: PlaybackSessionManager;
  private unsubscribeZustand: (() => void) | null = null;
  private currentSessionEpoch = 1;
  private currentSequenceNumber = 0;

  private constructor() {}

  public static getInstance(): PlaybackSessionManager {
    if (!PlaybackSessionManager.instance) {
      PlaybackSessionManager.instance = new PlaybackSessionManager();
    }
    return PlaybackSessionManager.instance;
  }

  public init(deviceId: string, sessionId: string, initialEpoch: number, initialSequence: number) {
    if (this.unsubscribeZustand) {
      this.unsubscribeZustand();
    }

    this.currentSessionEpoch = initialEpoch || 1;
    this.currentSequenceNumber = initialSequence || 0;
    let lastState = usePlayerStore.getState();

    // Only active device writes to Postgres. Remote devices update via Broadcast or Reconnection snapshot.
    this.unsubscribeZustand = usePlayerStore.subscribe((state) => {
      if (!state.isActiveDevice) {
        lastState = state;
        return;
      }

      const isDurableStateChange = 
        state.currentSong?.id !== lastState.currentSong?.id ||
        state.queue.length !== lastState.queue.length ||
        state.queueIndex !== lastState.queueIndex ||
        state.isShuffle !== lastState.isShuffle ||
        state.repeatMode !== lastState.repeatMode ||
        (state.playbackStatus !== lastState.playbackStatus && state.playbackStatus === 'paused'); // PAUSE is durable

      // Note: USER_SEEK is a durable event, but it's triggered explicitly by the UI or Broadcast, 
      // not easily caught purely by state diff without catching continuous time updates.
      // So SEEK persistence will be triggered explicitly by the components or CommandQueue.
      
      if (isDurableStateChange) {
        this.persistDurableState(deviceId, sessionId);
      }
      
      lastState = state;
    });
  }

  public async persistDurableState(deviceId: string, sessionId: string, explicitSeekMs?: number) {
    const store = usePlayerStore.getState();
    if (!sessionId || !store.isActiveDevice) return;

    this.currentSequenceNumber++;
    const positionToPersist = explicitSeekMs !== undefined ? explicitSeekMs : Math.floor(store.currentTime * 1000);

    try {
      const { data } = await supabase.auth.getSession();
      await supabase.from('playback_sessions').upsert({
        session_id: sessionId,
        user_id: data.session?.user?.id,
        active_device_id: deviceId,
        active_renderer: store.activeRenderer,
        status: store.playbackStatus,
        song_id: store.currentSong?.id || null,
        song_data: store.currentSong,
        position_ms: positionToPersist,
        duration_ms: Math.floor(store.duration * 1000),
        queue: store.queue,
        queue_index: store.queueIndex,
        shuffle: store.isShuffle,
        repeat_mode: store.repeatMode,
        session_epoch: this.currentSessionEpoch,
        sequence_number: this.currentSequenceNumber,
        server_timestamp: DeviceSyncManager.getInstance().getSynchronizedTime(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id' });
    } catch(e) {
      console.error("Failed to persist durable playback state", e);
    }
  }

  public incrementEpoch() {
    this.currentSessionEpoch++;
    this.currentSequenceNumber = 0;
    return this.currentSessionEpoch;
  }

  public getEpoch() {
    return this.currentSessionEpoch;
  }
  
  public getSequence() {
    return this.currentSequenceNumber;
  }
}
