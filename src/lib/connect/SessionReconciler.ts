import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandSequencer } from './CommandSequencer';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { CommandValidator } from './CommandValidator';

export interface PlaybackSnapshot {
  sessionId: string;
  sessionEpoch: number;
  revision: number;
  sequenceNumber: number;
  stateVersion: number;
  trackId: string;
  songData?: any;
  status: 'playing' | 'paused' | 'buffering';
  positionMs: number;
  serverTimestamp: number;
  ownerDeviceId: string;
  ownerInstanceId?: string;
  queue?: any[];
  queueIndex?: number;
}

export class SessionReconciler {
  private static instance: SessionReconciler;

  private constructor() {}

  public static getInstance(): SessionReconciler {
    if (!SessionReconciler.instance) {
      SessionReconciler.instance = new SessionReconciler();
    }
    return SessionReconciler.instance;
  }

  public async fetchAuthoritativeSnapshot(sessionId: string): Promise<PlaybackSnapshot | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    try {
      const { data, error } = await supabase
        .from('playback_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }

      return {
        sessionId: data.session_id,
        sessionEpoch: Number(data.epoch || data.session_epoch || 1),
        revision: Number(data.revision || 1),
        sequenceNumber: Number(data.sequence_number || 1),
        stateVersion: Number(data.state_version || 1),
        trackId: data.song_id || data.track_id,
        songData: data.song_data,
        status: data.is_playing ? 'playing' : (data.status || 'paused'),
        positionMs: Number(data.position_ms || data.canonical_position_ms || 0),
        serverTimestamp: new Date(data.updated_at || Date.now()).getTime(),
        ownerDeviceId: data.active_device_id,
        ownerInstanceId: data.owner_instance_id,
        queue: data.queue || [],
        queueIndex: data.queue_index || 0
      };
    } catch (e) {
      console.error('[SessionReconciler] fetch snapshot failed:', e);
      return null;
    }
  }

  public async applySnapshot(snapshot: PlaybackSnapshot): Promise<void> {
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    const validator = CommandValidator.getInstance();
    
    console.log(`[SessionReconciler] Applying snapshot: Epoch ${snapshot.sessionEpoch}, Revision ${snapshot.revision}`);
    
    sequencer.setEpoch(snapshot.sessionEpoch);
    validator.setRevision(snapshot.revision);
    
    const isOwner = snapshot.ownerDeviceId === store.deviceId;
    
    if (store.isActiveDevice && !isOwner) {
      console.warn('[SessionReconciler] Lost lease. Transitioning to remote controller.');
    }
    
    usePlayerStore.setState({ 
      isActiveDevice: isOwner,
      isPlaying: snapshot.status === 'playing',
      activeDeviceId: snapshot.ownerDeviceId
    });

    // If we are the active renderer device, apply state to PlaybackEngine
    if (isOwner) {
      const engine = PlaybackEngine.getInstance();
      const currentTrack = store.currentSong;
      
      // Calculate server time signed drift: target = positionMs + (serverNow - serverTimestamp)
      let expectedPosition = snapshot.positionMs;
      if (snapshot.status === 'playing') {
        const clock = require('./ClockSynchronizer').ClockSynchronizer.getInstance();
        const now = clock.getEstimatedServerNow();
        const drift = now - snapshot.serverTimestamp;
        expectedPosition += drift;
      }
      
      if (currentTrack?.id === snapshot.trackId) {
        await engine.seekCanonical(Math.max(0, expectedPosition));
        if (snapshot.status === 'playing') {
           await engine.play();
        } else {
           await engine.pause();
        }
      } else if (snapshot.trackId) {
        const queue = snapshot.queue && snapshot.queue.length > 0 ? snapshot.queue : store.queue;
        const queueIdx = queue.findIndex((s: any) => s.id === snapshot.trackId);
        
        if (queueIdx !== -1) {
          store.playSong(queue[queueIdx], queue);
          setTimeout(() => {
            engine.seekCanonical(Math.max(0, expectedPosition));
            if (snapshot.status === 'playing') engine.play();
          }, 600);
        } else if (snapshot.songData) {
          store.playSong(snapshot.songData, [snapshot.songData]);
          setTimeout(() => {
            engine.seekCanonical(Math.max(0, expectedPosition));
            if (snapshot.status === 'playing') engine.play();
          }, 600);
        }
      }
    }
  }
}
