import { supabase } from '@/lib/supabase';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackEngine } from '../playback/PlaybackEngine';

export class PlaybackSessionManager {
  private static instance: PlaybackSessionManager;
  
  private sessionId: string | null = null;
  private lastCheckpointTime = 0;
  private lastCheckpointPosition = 0;
  private isDirty = false;
  
  // Clean up any intervals
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.setupLifecycleHooks();
    this.setupAdaptiveTimer();
  }

  public static getInstance(): PlaybackSessionManager {
    if (!PlaybackSessionManager.instance) {
      PlaybackSessionManager.instance = new PlaybackSessionManager();
    }
    return PlaybackSessionManager.instance;
  }

  public init(sessionId: string) {
    this.sessionId = sessionId;
  }
  
  public markDirty() {
    this.isDirty = true;
  }

  // Adaptive checkpointing - explicit triggers
  public async checkpoint(force = false) {
    if (!this.sessionId) return;
    
    const engine = PlaybackEngine.getInstance();
    const currentPosition = engine.getCanonicalPositionMs();
    
    // Only write if forced, dirty, or position drifted significantly (>60s)
    const positionDrift = Math.abs(currentPosition - this.lastCheckpointPosition);
    if (!force && !this.isDirty && positionDrift < 60000) {
      return;
    }

    const store = usePlayerStore.getState();
    const status = store.isPlaying ? 'playing' : 'paused';
    const sequencer = (await import('../connect/CommandSequencer')).CommandSequencer.getInstance();
    
    try {
      const authRes = await supabase.auth.getSession();
      const userId = authRes.data.session?.user?.id;
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        // Skip Supabase database writes for unauthenticated guest sessions
        return;
      }

      console.log(`[PlaybackSessionManager] Checkpointing durable state... (force=${force})`);
      const { error } = await supabase
        .from('playback_sessions')
        .upsert({
          session_id: this.sessionId,
          user_id: userId,
          status,
          canonical_position_ms: currentPosition,
          session_epoch: sequencer.getEpoch(),
          sequence_number: sequencer.getLastAppliedSequence(),
          server_timestamp: Date.now(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' });
        
      if (error) {
        console.error('[PlaybackSessionManager] Upsert error:', error.message, error.details, error.hint);
      } else {
        this.lastCheckpointTime = Date.now();
        this.lastCheckpointPosition = currentPosition;
        this.isDirty = false;
      }
    } catch (error) {
      console.error('[PlaybackSessionManager] Checkpoint failed:', error);
    }
  }

  private setupAdaptiveTimer() {
    // We run a timer every 30s, but it only checkpoints if position drifted > 60s
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    
    this.checkpointTimer = setInterval(() => {
       const store = usePlayerStore.getState();
       if (store.isPlaying) {
          this.checkpoint(false); // will only write if >60s drifted
       }
    }, 30000);
  }

  private setupLifecycleHooks() {
    if (typeof window === 'undefined') return;
    
    const performUrgentCheckpoint = () => {
      // Use navigator.sendBeacon if possible for true pagehide guarantees, 
      // but await checkpoint() is best effort
      if (this.isDirty || usePlayerStore.getState().isPlaying) {
         this.checkpoint(true);
      }
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        performUrgentCheckpoint();
      }
    });

    window.addEventListener('pagehide', performUrgentCheckpoint);
  }
}
