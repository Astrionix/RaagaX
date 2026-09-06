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

import { Capacitor, registerPlugin } from '@capacitor/core';

export const RaagaXPlayerPlugin = registerPlugin<any>('RaagaXPlayer');

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
    const plat = Capacitor.getPlatform();
    if (plat === 'android' || plat === 'ios') return true;
  } catch {}
  const cap = (window as any).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return true;
  }
  if (typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform();
    if (p === 'android' || p === 'ios') return true;
  }
  if ((window as any).androidBridge) return true;
  return false;
}

function getPlugin() {
  if (!isCapacitorNative()) return null;
  const cap = (window as any).Capacitor;
  return cap?.Plugins?.RaagaXPlayer || RaagaXPlayerPlugin || null;
}

export interface NativeTrackItem {
  trackId?: string;
  url: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  loudness?: number | null;
}

export interface NativePlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  bufferedPositionMs?: number;
  title?: string;
  artist?: string;
}

let lastCachedNativeState: NativePlaybackState = { isPlaying: false, positionMs: 0, durationMs: 0 };

export const RaagaXNativePlayer = {
  isNative(): boolean {
    return isCapacitorNative();
  },

  /**
   * PRIMARY API — hands the complete playlist to ExoPlayer.
   * ExoPlayer auto-advances through all items natively in the background.
   * The WebView does NOT need to wake up for each track transition.
   */
  async setQueue(tracks: NativeTrackItem[], startIndex: number = 0, autoPlay: boolean = true, startPositionMs: number = 0, requestId?: number): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin || !tracks || tracks.length === 0) return;
    try {
      await plugin.setQueue({ tracks, startIndex, autoPlay, startPositionMs, requestId: requestId || 0 });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setQueue error:', e);
    }
  },

  // ── Legacy single-track API (kept for compatibility) ──────────────────────

  async play(options: NativeTrackItem, requestId?: number): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.play({ ...options, requestId: requestId || 0 });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] play error:', e);
    }
  },

  async setNextTrack(options: NativeTrackItem): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.setNextTrack(options);
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setNextTrack error:', e);
    }
  },

  async setNextTracksBatch(tracks: NativeTrackItem[]): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin || !tracks || tracks.length === 0) return;
    try {
      await plugin.setNextTracksBatch({ tracks });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setNextTracksBatch error:', e);
    }
  },

  // ── Playback controls ─────────────────────────────────────────────────────

  async pause(): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    lastCachedNativeState.isPlaying = false;
    try {
      await plugin.pause();
    } catch (e) {
      console.warn('[RaagaXNativePlayer] pause error:', e);
    }
  },

  async resume(): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    lastCachedNativeState.isPlaying = true;
    try {
      await plugin.resume();
    } catch (e) {
      console.warn('[RaagaXNativePlayer] resume error:', e);
    }
  },

  async next(): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.next();
    } catch (e) {
      console.warn('[RaagaXNativePlayer] next error:', e);
    }
  },

  async previous(): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.previous();
    } catch (e) {
      console.warn('[RaagaXNativePlayer] previous error:', e);
    }
  },

  async prev(): Promise<void> {
    return this.previous();
  },

  async seekTo(positionMs: number, isPlaying: boolean = true): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    lastCachedNativeState.positionMs = positionMs;
    lastCachedNativeState.isPlaying = isPlaying;
    try {
      await plugin.seekTo({ positionMs, isPlaying });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] seekTo error:', e);
    }
  },

  async setVolume(volume: number): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.setVolume({ volume });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setVolume error:', e);
    }
  },

  async setPlaybackRate(rate: number): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.setPlaybackRate({ rate });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setPlaybackRate error:', e);
    }
  },

  async updateQueueUrl(trackId: string, url: string): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.updateQueueUrl({ trackId, url });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] updateQueueUrl error:', e);
    }
  },

  async setLoudnessNormalizationEnabled(enabled: boolean): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.setLoudnessNormalizationEnabled({ enabled });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setLoudnessNormalizationEnabled error:', e);
    }
  },

  async setRepeatMode(repeatMode: string): Promise<void> {
    if (!isCapacitorNative()) return;
    const plugin = getPlugin();
    if (!plugin) return;
    try {
      await plugin.setRepeatMode({ repeatMode });
    } catch (e) {
      console.warn('[RaagaXNativePlayer] setRepeatMode error:', e);
    }
  },

  async getPlaybackState(): Promise<NativePlaybackState> {
    if (!isCapacitorNative()) return lastCachedNativeState;
    const plugin = getPlugin();
    if (!plugin) return lastCachedNativeState;
    try {
      const res = (await plugin.getPlaybackState()) as NativePlaybackState;
      if (res && typeof res.positionMs === 'number') {
        lastCachedNativeState = res;
      }
      return res;
    } catch {
      return lastCachedNativeState;
    }
  },

  getCachedPlaybackState(): NativePlaybackState {
    return lastCachedNativeState;
  },

  async updateRemotePlayback(data: {
    trackId?: string;
    title: string;
    artist: string;
    artworkUrl?: string;
    isPlaying: boolean;
    deviceName?: string;
    durationMs?: number;
    positionMs?: number;
  }): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.updateRemotePlayback(data);
  },

  async setRemotePlayback(isRemote: boolean, deviceName: string = ''): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.setRemotePlayback({ isRemote, deviceName });
  },

  async getNetworkState(): Promise<boolean> {
    const plugin = getPlugin();
    if (!plugin) return typeof navigator !== 'undefined' ? navigator.onLine : true;
    try {
      const res = await plugin.getNetworkState();
      return Boolean(res?.isOnline);
    } catch {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
  },

  async clearRemotePlayback(): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.clearRemotePlayback();
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
  addTrackChangedListener(callback: (data: {
    oldTrackId?: string;
    trackId?: string;
    title?: string;
    artist?: string;
    artworkUrl?: string;
    url?: string;
    index?: number;
    queueIndex?: number;
    totalItems?: number;
    positionMs?: number;
    durationMs?: number;
    isPlaying?: boolean;
    timestamp?: number;
    requestId?: number;
  }) => void): () => void {
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

  addActionTogglePlayListener(callback: () => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('actionTogglePlay', callback);
    return () => plugin.removeAllListeners('actionTogglePlay');
  },

  addActionSeekListener(callback: (data: { positionMs: number }) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('actionSeek', callback);
    return () => plugin.removeAllListeners('actionSeek');
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
