/**
 * RaagaXNativePlayer
 * 
 * TypeScript adapter that routes playback through the native Android
 * Media3 ExoPlayer foreground service when running inside the Capacitor APK.
 * Falls back to HTMLAudioElement on web/PWA.
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

export interface NativePlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

export const RaagaXNativePlayer = {
  isNative(): boolean {
    return IS_CAPACITOR_NATIVE && getPlugin() !== null;
  },

  async play(options: {
    url: string;
    title: string;
    artist: string;
    artworkUrl?: string;
  }): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.play(options);
  },

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

  async seekTo(positionMs: number): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.seekTo({ positionMs });
  },

  async setVolume(volume: number): Promise<void> {
    const plugin = getPlugin();
    if (!plugin) return;
    await plugin.setVolume({ volume });
  },

  async getPlaybackState(): Promise<NativePlaybackState | null> {
    const plugin = getPlugin();
    if (!plugin) return null;
    return plugin.getPlaybackState();
  },

  addTrackEndedListener(callback: () => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('trackEnded', callback);
    return () => plugin.removeAllListeners('trackEnded');
  },

  addPlaybackStateListener(callback: (state: { isPlaying: boolean }) => void): () => void {
    const plugin = getPlugin();
    if (!plugin) return () => {};
    plugin.addListener('playbackStateChanged', callback);
    return () => plugin.removeAllListeners('playbackStateChanged');
  },
};
