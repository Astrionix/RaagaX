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
    
    // Calculate server time signed drift: expected = positionMs + (serverNow - serverTimestamp)
    let expectedPositionMs = snapshot.positionMs;
    if (snapshot.status === 'playing') {
      const clock = require('./ClockSynchronizer').ClockSynchronizer.getInstance();
      const now = clock.getEstimatedServerNow();
      const signedDrift = now - snapshot.serverTimestamp;
      expectedPositionMs += signedDrift;
    }
    const derivedTimeSec = Math.max(0, expectedPositionMs / 1000);

    // Find song object from snapshot or queue
    const targetSong = snapshot.songData || 
      (snapshot.queue ? snapshot.queue.find((s: any) => s.id === snapshot.trackId) : null) ||
      (store.queue ? store.queue.find((s: any) => s.id === snapshot.trackId) : null) ||
      store.currentSong;

    // Find device name for display
    const activeDeviceObj = store.onlineDevices.find((d: any) => d.id === snapshot.ownerDeviceId);
    const remoteName = activeDeviceObj ? activeDeviceObj.name : 'Remote Device';

    // 1. ALL DEVICES (Followers + Renderer) synchronize UI State
    usePlayerStore.setState({ 
      isActiveDevice: isOwner,
      isPlaying: snapshot.status === 'playing',
      activeDeviceId: snapshot.ownerDeviceId,
      remoteDeviceName: isOwner ? null : remoteName,
      currentSong: targetSong || store.currentSong,
      currentTime: derivedTimeSec,
      queue: snapshot.queue && snapshot.queue.length > 0 ? snapshot.queue : store.queue
    });

    // 2. ACTIVE RENDERER DEVICE: Synchronize local HTMLAudioElement / PlaybackEngine
    if (isOwner) {
      const engine = PlaybackEngine.getInstance();
      const currentTrack = store.currentSong;
      
      if (currentTrack?.id === snapshot.trackId) {
        await engine.seekCanonical(Math.max(0, expectedPositionMs));
        if (snapshot.status === 'playing') {
           await engine.play();
        } else {
           await engine.pause();
        }
      } else if (snapshot.trackId) {
        if (targetSong) {
          store.playSong(targetSong, snapshot.queue || store.queue);
          setTimeout(() => {
            engine.seekCanonical(Math.max(0, expectedPositionMs));
            if (snapshot.status === 'playing') engine.play();
          }, 500);
        }
      }
    } else {
      // FOLLOWER DEVICE: Ensure local engine is muted/paused so it acts purely as controller
      PlaybackEngine.getInstance().pause();
    }
  }
}
