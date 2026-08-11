import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandSequencer } from './CommandSequencer';

export class SessionReconciler {
  private static instance: SessionReconciler;

  private constructor() {}

  public static getInstance(): SessionReconciler {
    if (!SessionReconciler.instance) {
      SessionReconciler.instance = new SessionReconciler();
    }
    return SessionReconciler.instance;
  }

  /**
   * Fetches the latest durable session from Postgres and reconciles local state.
   */
  public async reconcile(sessionId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const { data, error } = await supabase
        .from('playback_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') return; // No rows found
        throw error;
      }

      const store = usePlayerStore.getState();
      const sequencer = CommandSequencer.getInstance();
      
      const serverEpoch = data.session_epoch;
      const localEpoch = sequencer.getEpoch();

      if (serverEpoch > localEpoch) {
        console.log(`[SessionReconciler] Reconciling: Server epoch ${serverEpoch} > Local ${localEpoch}`);
        
        sequencer.setEpoch(serverEpoch);
        
        // If we thought we were the active device but the server snapshot says otherwise,
        // we must strip ownership.
        if (store.isActiveDevice && data.active_device_id !== store.deviceId) {
          console.warn('[SessionReconciler] Lost lease. Transitioning to controller.');
          usePlayerStore.setState({ isActiveDevice: false });
        }
        
        // Update local UI state (optimistic projection)
        usePlayerStore.setState({
          activeRenderer: data.active_renderer as any,
          isPlaying: data.status === 'playing',
          // Position would need to be updated via PlaybackEngine if this device is the renderer,
          // but if it's just a controller, we just update the store's trackId/status.
        });
      }
    } catch (e) {
      console.error('[SessionReconciler] Reconcile failed:', e);
    }
  }
}
