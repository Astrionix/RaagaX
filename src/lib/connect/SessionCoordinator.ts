import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { CommandSequencer } from './CommandSequencer';

export class SessionCoordinator {
  private static instance: SessionCoordinator;

  private constructor() {}

  public static getInstance(): SessionCoordinator {
    if (!SessionCoordinator.instance) {
      SessionCoordinator.instance = new SessionCoordinator();
    }
    return SessionCoordinator.instance;
  }

  /**
   * Triggers a durable snapshot of the playback session to Postgres.
   * Only the active renderer should call this (e.g. on Track Change, Pause, App Close).
   */
  public async snapshot(sessionId: string): Promise<void> {
    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return; // Only active device snapshots

    const engine = PlaybackEngine.getInstance();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const state = engine.getPlaybackState();
      const sequencer = CommandSequencer.getInstance();
      
      await supabase.from('playback_sessions').upsert({
        user_id: session.user.id,
        session_id: sessionId,
        track_id: state.trackId || 'unknown',
        status: state.isPlaying ? 'playing' : 'paused',
        canonical_position_ms: state.positionMs,
        active_renderer: store.activeRenderer,
        active_device_id: store.deviceId,
        session_epoch: sequencer.getEpoch(),
        sequence_number: sequencer.nextSequence(),
        server_timestamp: Date.now() // Ideally use estimated server time
      }, { onConflict: 'session_id' });
      
      console.log(`[SessionCoordinator] Snapshot taken for session ${sessionId}`);
    } catch (e) {
      console.error('[SessionCoordinator] Snapshot failed:', e);
    }
  }
}
