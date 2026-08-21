/**
 * RaagaXNativePlayer
 *
 * TypeScript adapter that routes playback through the native Android
 * Media3 ExoPlayer foreground service when running inside the Capacitor APK.
 * Falls back to HTMLAudioElement on web/PWA.
 *
 * ── Contract ────────────────────────────────────────────────────────────────
 * The primary API is now setQueue() — which hands ExoPlayer the FULL playlist
 * upfront so it can auto-advance natively in the background without requiring
 * the WebView to wake up on every song transition.
 *
 * play() / setNextTrack() / setNextTracksBatch() are kept for compatibility
 * but should be considered deprecated in favour of setQueue().
 */

const IS_CAPACITOR_NATIVE =
  typeof window !== 'undefined' &&
  (window as any).Capacitor &&
  typeof (window as any).Capacitor.isNativePlatform === 'function' &&
  (window as any).Capacitor.isNativePlatform();

function getPlugin() {
  if (!IS_CAPACITOR_NATIVE) return null;
  const cap = (window as any).Capacitor;
  return cap?.Plugins?.RaagaXPlayer ?? null;
}

export interface NativeTrackItem {
  trackId?: string;
  url: string;
  title: string;
  artist: string;
  artworkUrl?: string;
}

export interface NativePlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  bufferedPositionMs?: number;
  title?: string;
  artist?: string;
}

export const RaagaXNativePlayer = {
  isNative(): boolean {
    return IS_CAPACITOR_NATIVE && getPlugin() !== null;
  },

  /**
   * PRIMARY API — hands the complete playlist to ExoPlayer.
   * ExoPlayer auto-advances through all items natively in the background.
   * The WebView does NOT need to wake up for each track transition.
   *
   * @param tracks  Full ordered list of tracks for this playback session
   * @param startIndex  Index of the track to start playing immediately
   * @param autoPlay  Whether to start playing immediately
   * @param startPositionMs Initial position offset
   * @param requestId  Unique transition/generation identifier
   */
  async setQueue(tracks: NativeTrackItem[], startIndex: number = 0, autoPlay: boolean = true, startPositionMs: number = 0, requestId?: number): Promise<void> {
    const plugin = getPlugin();
    if (!plugin || !tracks || tracks.length === 0) return;
    await plugin.setQueue({ tracks, startIndex, autoPlay, startPositionMs, requestId: requestId || 0 });
  },

  // ── Legacy single-track API (kept for compatibility) ──────────────────────

  async play(options: NativeTrackItem, requestId?: number): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.play({ ...options, requestId: requestId || 0 });
  },

  async setNextTrack(options: NativeTrackItem): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.setNextTrack(options);
  },

  async setNextTracksBatch(tracks: NativeTrackItem[]): Promise<void> {
    const plugin = getPlugin();
    if (!plugin || !tracks || tracks.length === 0) return;
    await plugin.setNextTracksBatch({ tracks });
  },

  // ── Playback controls ─────────────────────────────────────────────────────

  async pause(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.pause();
  },

  async resume(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.resume();
  },

  async next(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.next();
  },

  async previous(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.previous();
  },

  async prev(): Promise<void> {
    return this.previous();
  },

  async seekTo(positionMs: number): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    console.log('[SEEK] RaagaXNativePlayer plugin.seekTo:', positionMs);
    await plugin.seekTo({ positionMs });
  },

  async setVolume(volume: number): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.setVolume({ volume });
  },

  async setRepeatMode(repeatMode: string): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.setRepeatMode({ repeatMode });
  },

  async getPlaybackState(): Promise<NativePlaybackState> {
    const plugin = getPlugin();
    if (!plugin) return { isPlaying: false, positionMs: 0, durationMs: 0 };
    try {
      const res = await plugin.getPlaybackState();
      return res as NativePlaybackState;
    } catch {
      return { isPlaying: false, positionMs: 0, durationMs: 0 };
    }
  },

  // ── Event listeners ───────────────────────────────────────────────────────

  /** Fires when the native queue is completely exhausted (not per-track) */
  addQueueEndedListener(callback: () => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('queueEnded', callback);
    return () => plugin.removeAllListeners('queueEnded');
  },

  /** Fires on every track change (auto-advance or manual next/prev) */
  addTrackChangedListener(callback: (data: { trackId?: string; title?: string; artist?: string; artworkUrl?: string; url?: string; index?: number; requestId?: number }) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('trackChanged', callback);
    return () => plugin.removeAllListeners('trackChanged');
  },

  /** @deprecated Use addQueueEndedListener instead */
  addTrackEndedListener(callback: () => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('trackEnded', callback);
    return () => plugin.removeAllListeners('trackEnded');
  },

  addPlaybackStateListener(callback: (state: { isPlaying: boolean; positionMs?: number; durationMs?: number }) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('playbackStateChanged', callback);
    return () => plugin.removeAllListeners('playbackStateChanged');
  },

  addActionNextListener(callback: () => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('actionNext', callback);
    return () => plugin.removeAllListeners('actionNext');
  },

  addActionPrevListener(callback: () => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('actionPrev', callback);
    return () => plugin.removeAllListeners('actionPrev');
  },

  /**
   * Fires when ExoPlayer has confirmed a seek — provides the authoritative
   * settled positionMs. Use this to immediately update the UI after a seek
   * instead of waiting for the next 1-second poll tick.
   */
  addSeekCompleteListener(callback: (data: { positionMs: number; wasPlaying: boolean }) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('seekComplete', callback);
    return () => plugin.removeAllListeners('seekComplete');
  },
};
