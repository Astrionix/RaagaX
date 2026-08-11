import { PlaybackEngine } from '@/lib/playback/PlaybackEngine';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LyricsResolver } from './LyricsResolver';

export class LyricsEngine {
  private static instance: LyricsEngine;
  private animationFrameId: number | null = null;
  private isPlaying = false;
  
  // Local cache of the currently active lines for fast binary search
  // without needing to read from Zustand store every frame.
  private activeLines: import('./LyricsTypes').LyricsLine[] = [];
  private lastFoundIndex: number = -1;
  private currentTrackId: string | null = null;

  private constructor() {}

  public static getInstance(): LyricsEngine {
    if (!LyricsEngine.instance) {
      LyricsEngine.instance = new LyricsEngine();
    }
    return LyricsEngine.instance;
  }

  public async loadTrack(trackId: string) {
    if (this.currentTrackId === trackId) return;
    
    this.currentTrackId = trackId;
    this.activeLines = [];
    this.lastFoundIndex = -1;
    this.stopLoop();
    
    useLyricsStore.getState().setLyricsData(trackId, null, 'loading');

    // Get metadata from player store
    const { currentSong } = usePlayerStore.getState();
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
      if (this.isPlaying) {
        this.startLoop();
      }
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
      if (!this.isPlaying) return;
      
      const engine = PlaybackEngine.getInstance();
      const positionMs = engine.getMediaPositionMs();
      
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

  private evaluatePosition(positionMs: number) {
    if (this.activeLines.length === 0) return;

    const offsetMs = useLyricsStore.getState().userOffsetMs;
    const adjustedMs = positionMs + offsetMs;

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
        // This line is a candidate. But is it the LAST valid candidate?
        bestMatch = mid;
        low = mid + 1; // Keep searching right
      } else {
        high = mid - 1; // Search left
      }
    }

    return bestMatch;
  }
}
