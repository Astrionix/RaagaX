import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LyricsResolver } from './LyricsResolver';

export class LyricsEngine {
  private static instance: LyricsEngine;
  private animationFrameId: number | null = null;
  private isPlaying = false;
  
  // Local cache of the currently active lines for fast binary search
  private activeLines: import('./LyricsTypes').LyricsLine[] = [];
  private lastFoundIndex: number = -1;
  private currentTrackId: string | null = null;
  private isSubscribedToStore = false;

  private constructor() {
    this.initStoreSubscription();
  }

  public static getInstance(): LyricsEngine {
    if (!LyricsEngine.instance) {
      LyricsEngine.instance = new LyricsEngine();
    }
    return LyricsEngine.instance;
  }

  private initStoreSubscription() {
    if (typeof window === 'undefined' || this.isSubscribedToStore) return;
    this.isSubscribedToStore = true;

    usePlayerStore.subscribe((state, prevState) => {
      // 1. Sync Play/Pause state
      if (state.isPlaying !== prevState.isPlaying) {
        this.setPlaying(state.isPlaying);
      }
      
      // 2. Continuous time sync fallback (crucial for Native Android & Remote Connect)
      if (state.currentTime !== prevState.currentTime && this.activeLines.length > 0) {
        this.evaluatePosition(state.currentTime * 1000);
      }
    });
  }

  public getEffectivePositionMs(): number {
    const store = usePlayerStore.getState();

    // Tier 1: Web audio element with sub-millisecond precision via PlaybackEngine (Local Player)
    if (store.isActiveDevice) {
      try {
        const engine = PlaybackEngine.getInstance();
        const mediaMs = engine.getMediaPositionMs();
        if (mediaMs > 0) return mediaMs;
      } catch {}

      try {
        const { PlaybackService } = require('@/lib/playback/PlaybackService');
        const active = PlaybackService.getInstance().getActiveAudio();
        if (active && !isNaN(active.currentTime) && active.currentTime > 0) {
          return active.currentTime * 1000;
        }
      } catch {}
    } else {
      // Tier 2: Remote Connect Controller — Interpolate from remote anchor timestamp for 0ms lag
      if (store.remoteAnchorPositionMs !== undefined && store.remoteAnchorTimeMs) {
        const elapsed = Date.now() - store.remoteAnchorTimeMs;
        const liveRemoteMs = store.remoteAnchorPositionMs + (store.isPlaying ? elapsed : 0);
        if (liveRemoteMs >= 0) return liveRemoteMs;
      }
    }

    // Tier 3: Universal centralized usePlayerStore (ExoPlayer Native, Offline fallback)
    try {
      const storeTime = store.currentTime;
      if (storeTime !== undefined && !isNaN(storeTime) && storeTime > 0) {
        return storeTime * 1000;
      }
    } catch {}

    return 0;
  }

  public async loadTrack(trackId: string) {
    if (this.currentTrackId === trackId && this.activeLines.length > 0) {
      const store = usePlayerStore.getState();
      if (store.isPlaying) {
        this.setPlaying(true);
      }
      this.evaluatePosition(this.getEffectivePositionMs());
      return;
    }
    
    this.currentTrackId = trackId;
    this.activeLines = [];
    this.lastFoundIndex = -1;
    this.stopLoop();
    
    useLyricsStore.getState().setLyricsData(trackId, null, 'loading');

    // Get metadata from player store
    const { currentSong, isPlaying } = usePlayerStore.getState();
    const metadata = currentSong && currentSong.id === trackId ? {
      title: currentSong.title,
      artist: currentSong.artist,
      album: currentSong.album,
      durationMs: currentSong.duration ? currentSong.duration * 1000 : undefined
    } : undefined;

    const data = await LyricsResolver.getInstance().fetchLyrics(trackId, metadata);
    
    // Ensure the track hasn't changed while fetching
    if (this.currentTrackId !== trackId) return;

    if (data && data.lines.length > 0) {
      this.activeLines = data.lines;
      useLyricsStore.getState().setLyricsData(trackId, data, 'ready');
      
      const latestStore = usePlayerStore.getState();
      if (this.isPlaying || latestStore.isPlaying) {
        this.isPlaying = true;
        this.startLoop();
      }
      // Instant position evaluation
      this.evaluatePosition(this.getEffectivePositionMs());
    } else {
      useLyricsStore.getState().setLyricsData(trackId, null, 'unavailable');
    }
  }

  public setPlaying(playing: boolean) {
    this.isPlaying = playing;
    if (playing && this.activeLines.length > 0) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  public seek(positionMs: number) {
    this.evaluatePosition(positionMs);
    const store = usePlayerStore.getState();
    if (store.isPlaying && this.activeLines.length > 0) {
      this.isPlaying = true;
      this.startLoop();
    }
  }

  public clear() {
    this.currentTrackId = null;
    this.activeLines = [];
    this.lastFoundIndex = -1;
    this.stopLoop();
    useLyricsStore.getState().reset();
  }

  private startLoop() {
    if (this.animationFrameId !== null) return;
    
    const loop = () => {
      const store = usePlayerStore.getState();
      if (!this.isPlaying && !store.isPlaying) {
        this.stopLoop();
        return;
      }
      
      const positionMs = this.getEffectivePositionMs();
      this.evaluatePosition(positionMs);
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public evaluatePosition(positionMs: number) {
    if (this.activeLines.length === 0) return;

    const offsetMs = useLyricsStore.getState().userOffsetMs;
    const adjustedMs = Math.max(0, positionMs + offsetMs);

    const index = this.findLineIndex(adjustedMs);
    
    if (index !== this.lastFoundIndex) {
      this.lastFoundIndex = index;
      useLyricsStore.getState().setCurrentLineIndex(index);
    }
  }

  /**
   * Binary search for the active line index based on current time.
   */
  private findLineIndex(timeMs: number): number {
    let low = 0;
    let high = this.activeLines.length - 1;
    let bestMatch = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const line = this.activeLines[mid];

      if (timeMs >= line.startMs) {
        bestMatch = mid;
        low = mid + 1; // Keep searching right
      } else {
        high = mid - 1; // Search left
      }
    }

    return bestMatch;
  }
}
