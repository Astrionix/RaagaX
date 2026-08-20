import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from './PlaybackService';
import { RendererManager } from './RendererManager';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { MediaSessionManager } from './MediaSessionManager';
import { VideoResolver } from '@/lib/video/VideoResolver';

/**
 * MediaHandoffManager
 *
 * Enforces the invariant: **Only one media source may produce audio at any time.**
 *
 * Rules:
 *   ACTIVE = AUDIO  → Audio plays,  Video MUST NOT play
 *   ACTIVE = VIDEO  → Video plays,  Audio MUST NOT play
 *   SWITCHING       → Both MUST be silenced until the target is confirmed ready
 */
export class MediaHandoffManager {
  private static instance: MediaHandoffManager;
  private transitionId = 0;
  private isTransitioning = false;

  private constructor() {}

  public static getInstance(): MediaHandoffManager {
    if (!MediaHandoffManager.instance) {
      MediaHandoffManager.instance = new MediaHandoffManager();
    }
    return MediaHandoffManager.instance;
  }

  public getIsTransitioning(): boolean {
    return this.isTransitioning;
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  /** Hard-pauses ALL audio elements managed by PlaybackService. Returns a resolved promise once done. */
  private async killAudio(): Promise<void> {
    PlaybackService.getInstance().pauseAudioElementOnly();
    // Brief micro-task to let the browser flush the pause command
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /** Pauses the registered video element (HTMLVideoElement or YouTube iframe via postMessage). */
  private killVideo(): void {
    const videoEl = RendererManager.getInstance().getRendererElement('video') as HTMLVideoElement | null;
    if (videoEl && !videoEl.paused) {
      try { videoEl.pause(); } catch {}
    }
    // Also send a postMessage to the YouTube iframe in case it's an embed
    if (typeof window !== 'undefined') {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((frame) => {
        try {
          frame.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
        } catch {}
      });
    }
  }

  /** Silences EVERYTHING — use during switching window */
  private async killAll(): Promise<void> {
    this.killVideo();
    await this.killAudio();
  }

  // ─── SWITCH TO VIDEO ────────────────────────────────────────────────────────

  /**
   * Seamlessly switches playback from Audio → Video.
   * Step sequence:
   *   1. Capture position + wasPlaying
   *   2. Kill audio (hard pause + mute)
   *   3. Acquire video renderer lease
   *   4. Set store renderer = 'video', position, isPlaying
   *   5. Sync Lyrics Engine
   */
  public async switchToVideo(videoDuration?: number): Promise<boolean> {
    if (this.isTransitioning) {
      console.warn('[MediaHandoffManager] switchToVideo skipped — already transitioning');
      return false;
    }
    this.isTransitioning = true;
    const transitionId = ++this.transitionId;

    const store = usePlayerStore.getState();
    const capturedPos = store.currentTime;
    const wasPlaying = store.isPlaying;

    try {
      console.log(`[MediaHandoffManager] AUDIO→VIDEO pos=${capturedPos.toFixed(2)}s wasPlaying=${wasPlaying}`);

      // STEP 1 — Kill audio completely before anything else
      await this.killAll();

      // Guard: abort if superseded
      if (this.transitionId !== transitionId) return false;

      // STEP 2 — Resolve video offset (video_position = audio_position + offsetSec)
      const currentSong = store.currentSong;
      const videoInfo = currentSong ? VideoResolver.getInstance().resolveSync(currentSong) : null;
      const offsetSec = videoInfo?.offsetSec ?? 0;
      const rawVideoPos = capturedPos + offsetSec;

      // Clamp target position within video duration if known
      const safePos = videoDuration && videoDuration > 0
        ? Math.min(rawVideoPos, Math.max(0, videoDuration - 1))
        : rawVideoPos;

      // STEP 3 — Acquire exclusive video renderer lease
      RendererManager.getInstance().acquireLease('video');

      // STEP 4 — Update store atomically (fromRemote=true prevents PlaybackService.play() re-trigger)
      store.setRenderer('video');
      store.setCurrentTime(safePos);
      store.setIsPlaying(wasPlaying, true);

      // STEP 5 — Sync Lyrics Engine
      LyricsEngine.getInstance().seek(safePos);
      LyricsEngine.getInstance().setPlaying(wasPlaying);

      // STEP 6 — Update OS media session
      MediaSessionManager.getInstance().setPlaybackState(wasPlaying ? 'playing' : 'paused');

      console.log(`[MediaHandoffManager] AUDIO→VIDEO ✓ audioPos=${capturedPos.toFixed(2)}s offsetSec=${offsetSec} videoPos=${safePos.toFixed(2)}s`);
      return true;
    } catch (err) {
      console.error('[MediaHandoffManager] Error switching to video:', err);
      this.onVideoError('Video transition failed');
      return false;
    } finally {
      if (this.transitionId === transitionId) {
        this.isTransitioning = false;
      }
    }
  }

  // ─── SWITCH TO AUDIO ────────────────────────────────────────────────────────

  /**
   * Seamlessly switches playback from Video → Audio.
   * Step sequence:
   *   1. Capture position + wasPlaying
   *   2. Kill video (pause iframe)
   *   3. Kill audio elements (stale buffer from before video)
   *   4. Acquire audio renderer lease
   *   5. Set store renderer = 'audio', position, isPlaying
   *   6. Load + seek audio to captured position, play if wasPlaying
   *   7. Sync Lyrics Engine
   */
  public async switchToAudio(audioDuration?: number): Promise<boolean> {
    if (this.isTransitioning) {
      console.warn('[MediaHandoffManager] switchToAudio skipped — already transitioning');
      return false;
    }
    this.isTransitioning = true;
    const transitionId = ++this.transitionId;

    const store = usePlayerStore.getState();
    const capturedPos = store.currentTime;
    const wasPlaying = store.isPlaying;
    const currentSong = store.currentSong;

    try {
      console.log(`[MediaHandoffManager] VIDEO→AUDIO pos=${capturedPos.toFixed(2)}s wasPlaying=${wasPlaying}`);

      // STEP 1 — Kill all active media before switching
      await this.killAll();

      // Guard: abort if superseded
      if (this.transitionId !== transitionId) return false;

      // STEP 2 — Resolve offset (audio_position = video_position - offsetSec)
      const videoInfo = currentSong ? VideoResolver.getInstance().resolveSync(currentSong) : null;
      const offsetSec = videoInfo?.offsetSec ?? 0;
      const rawAudioPos = Math.max(0, capturedPos - offsetSec);

      // Clamp position within audio duration
      const totalDuration = audioDuration || store.duration || currentSong?.duration || 0;
      const safePos = totalDuration > 0
        ? Math.min(rawAudioPos, Math.max(0, totalDuration - 0.5))
        : rawAudioPos;

      // STEP 3 — Acquire exclusive audio renderer lease
      RendererManager.getInstance().acquireLease('audio');

      // STEP 4 — Update store atomically (fromRemote=true to prevent re-triggering setIsPlaying → PlaybackService chain)
      store.setRenderer('audio');
      store.setCurrentTime(safePos);
      console.log(`[MediaHandoffManager] VIDEO→AUDIO videoPos=${capturedPos.toFixed(2)}s offsetSec=${offsetSec} audioPos=${safePos.toFixed(2)}s`);

      // STEP 5 — Start audio playback for the CURRENT song (the song active in the queue now, not what was playing before video)
      if (currentSong) {
        if (wasPlaying) {
          // playTrack handles: source resolution → buffer → seek → play
          await PlaybackService.getInstance().playTrack(currentSong, true);
          if (safePos > 0.5) {
            PlaybackService.getInstance().seek(safePos);
          }
          store.setIsPlaying(true, true);
        } else {
          // Prepare the audio at position without playing (buffer + seek only)
          await PlaybackService.getInstance().prepareTrack(currentSong, safePos);
          store.setIsPlaying(false, true);
        }
      } else {
        store.setIsPlaying(false, true);
      }

      // STEP 6 — Sync Lyrics Engine
      LyricsEngine.getInstance().seek(safePos);
      LyricsEngine.getInstance().setPlaying(wasPlaying);

      // STEP 7 — Update OS media session
      MediaSessionManager.getInstance().setPlaybackState(wasPlaying ? 'playing' : 'paused');

      console.log(`[MediaHandoffManager] VIDEO→AUDIO ✓ pos=${safePos.toFixed(2)}s`);
      return true;
    } catch (err) {
      console.error('[MediaHandoffManager] Error switching to audio:', err);
      return false;
    } finally {
      if (this.transitionId === transitionId) {
        this.isTransitioning = false;
      }
    }
  }

  // ─── TOGGLE ─────────────────────────────────────────────────────────────────

  public async toggleMediaMode(videoDuration?: number, audioDuration?: number): Promise<void> {
    const activeRenderer = usePlayerStore.getState().activeRenderer;
    if (activeRenderer === 'video') {
      await this.switchToAudio(audioDuration);
    } else {
      await this.switchToVideo(videoDuration);
    }
  }

  // ─── VIDEO ERROR RECOVERY ───────────────────────────────────────────────────

  /**
   * Graceful failure recovery: If video fails to load, falls back to audio without interruption.
   */
  public onVideoError(reason?: string) {
    const store = usePlayerStore.getState();
    console.warn('[MediaHandoffManager] Video failed:', reason);

    // Kill video silence
    this.killVideo();

    // Revert to audio renderer
    store.setRenderer('audio');
    store.setToastMessage("Video couldn't be loaded. Continuing audio.");
    RendererManager.getInstance().acquireLease('audio');

    if (store.isPlaying && store.currentSong) {
      PlaybackService.getInstance().resume().catch(() => {});
    }
  }
}
