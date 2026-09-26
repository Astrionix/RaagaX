/**
 * CanvasEngine — BitChord Architecture Inspired Animated Canvas & Video Artwork System
 * Retrieves and caches motion video artwork (Spotify Canvas / Apple Music Motion Art)
 * for the currently playing track.
 */

export interface CanvasData {
  canvasUrl: string;
  type: 'video' | 'motion';
  source: 'spotify' | 'apple-music' | 'motion-ambient';
}

export class CanvasEngine {
  private static instance: CanvasEngine;
  private cache = new Map<string, CanvasData | null>();
  private inFlight = new Map<string, Promise<CanvasData | null>>();

  private constructor() {}

  public static getInstance(): CanvasEngine {
    if (!CanvasEngine.instance) {
      CanvasEngine.instance = new CanvasEngine();
    }
    return CanvasEngine.instance;
  }

  public async getCanvas(
    trackId: string,
    title: string,
    artist: string,
    album?: string
  ): Promise<CanvasData | null> {
    if (!trackId || !title) return null;

    if (this.cache.has(trackId)) {
      return this.cache.get(trackId) || null;
    }

    if (this.inFlight.has(trackId)) {
      return this.inFlight.get(trackId)!;
    }

    const fetchPromise = this.fetchCanvas(trackId, title, artist, album);
    this.inFlight.set(trackId, fetchPromise);

    try {
      const result = await fetchPromise;
      this.cache.set(trackId, result);
      return result;
    } finally {
      this.inFlight.delete(trackId);
    }
  }

  private async fetchCanvas(
    trackId: string,
    title: string,
    artist: string,
    album?: string
  ): Promise<CanvasData | null> {
    try {
      const url = new URL('/api/canvas', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      url.searchParams.set('trackId', trackId);
      url.searchParams.set('title', title);
      url.searchParams.set('artist', artist);
      if (album) url.searchParams.set('album', album);

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.available && data.canvasUrl) {
          return {
            canvasUrl: data.canvasUrl,
            type: data.type || 'video',
            source: data.source || 'spotify',
          };
        }
      }
    } catch (e) {
      // Quiet failover to static artwork
    }

    return null;
  }
}
