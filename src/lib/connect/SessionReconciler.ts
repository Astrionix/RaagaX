import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandSequencer } from './CommandSequencer';
import { PlaybackEngine } from '../playback/PlaybackEngine';

export interface PlaybackSnapshot {
  sessionId: string;
  sessionEpoch: number;
  sequenceNumber: number;
  stateVersion: number;
  trackId: string;
  status: 'playing' | 'paused' | 'buffering';
  positionMs: number;
  serverTimestamp: number;
  ownerDeviceId: string;
  ownerInstanceId: string;
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
        sessionEpoch: data.session_epoch,
        sequenceNumber: data.sequence_number,
        stateVersion: data.state_version || 1,
        trackId: data.track_id,
        status: data.status,
        positionMs: data.canonical_position_ms,
        serverTimestamp: data.server_timestamp,
        ownerDeviceId: data.active_device_id,
        ownerInstanceId: data.owner_instance_id
      };
    } catch (e) {
      console.error('[SessionReconciler] fetch snapshot failed:', e);
      return null;
    }
  }

  public async applySnapshot(snapshot: PlaybackSnapshot): Promise<void> {
    const store = usePlayerStore.getState();
    const sequencer = CommandSequencer.getInstance();
    
    console.log(`[SessionReconciler] Applying snapshot: Epoch ${snapshot.sessionEpoch}, Seq ${snapshot.sequenceNumber}, StateVersion ${snapshot.stateVersion}`);
    
    sequencer.setEpoch(snapshot.sessionEpoch);
    sequencer.setSequence(snapshot.sequenceNumber);
    
    const isOwner = snapshot.ownerDeviceId === store.deviceId && snapshot.ownerInstanceId === store.deviceInstanceId;
    
    if (store.isActiveDevice && !isOwner) {
      console.warn('[SessionReconciler] Lost lease. Transitioning to controller.');
    }
    
    usePlayerStore.setState({ 
      isActiveDevice: isOwner,
      isPlaying: snapshot.status === 'playing'
    });

    // If we are the owner, we update the local engine
    if (isOwner) {
      const engine = PlaybackEngine.getInstance();
      const currentTrack = store.currentSong;
      
      // Calculate elapsed time if playing
      let expectedPosition = snapshot.positionMs;
      if (snapshot.status === 'playing') {
        // Very basic server time delta interpolation
        const clock = require('./ClockSynchronizer').ClockSynchronizer.getInstance();
        const now = clock.getEstimatedServerNow();
        expectedPosition += Math.max(0, now - snapshot.serverTimestamp);
      }
      
      if (currentTrack?.id === snapshot.trackId) {
        await engine.seekCanonical(expectedPosition);
        if (snapshot.status === 'playing') {
           await engine.play();
        } else {
           await engine.pause();
        }
      } else if (snapshot.trackId) {
        // Track has changed — find it in queue first, then fall back to Supabase fetch
        const queue = store.queue;
        const queueIdx = queue.findIndex(s => s.id === snapshot.trackId);
        
        if (queueIdx !== -1) {
          // Track is already in the queue — play that Song object directly
          store.playSong(queue[queueIdx], queue);
          // Seek after a short delay to let the player load
          setTimeout(() => {
            engine.seekCanonical(expectedPosition);
            if (snapshot.status === 'playing') engine.play();
          }, 800);
        } else {
          // Track is not in queue — fetch from Supabase canonical_songs
          try {
            const { data } = await supabase
              .from('canonical_songs')
              .select('*')
              .eq('id', snapshot.trackId)
              .single();
              
            if (data) {
              store.playSong(data, [data]);
              setTimeout(() => {
                engine.seekCanonical(expectedPosition);
                if (snapshot.status === 'playing') engine.play();
              }, 800);
            }
          } catch (e) {
            console.error('[SessionReconciler] Could not fetch track for snapshot recovery:', e);
          }
        }
      }
    }
  }
}
