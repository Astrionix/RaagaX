import { Renderer } from '@/types/music';

export interface UnifiedPlaybackSession {
  sessionId: string;
  trackId: string;

  canonicalPositionMs: number;
  durationMs: number;

  status: 'playing' | 'paused' | 'buffering' | 'transitioning' | 'ended';

  renderer: Renderer;

  playbackRate: number;
  volume: number;
  muted: boolean;

  epoch: number;
  sequence: number;

  updatedAt: number;

  source: {
    audioUrl?: string;
    videoUrl?: string;
    coverUrl?: string;
  };
}

export class SessionManager {
  private static instance: SessionManager;
  private currentSession: UnifiedPlaybackSession | null = null;

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  public createSession(
    trackId: string,
    durationMs: number,
    source: UnifiedPlaybackSession['source'],
    initialRenderer: Renderer = 'audio'
  ): UnifiedPlaybackSession {
    this.currentSession = {
      sessionId: crypto.randomUUID(),
      trackId,
      canonicalPositionMs: 0,
      durationMs,
      status: 'paused',
      renderer: initialRenderer,
      playbackRate: 1.0,
      volume: 1.0,
      muted: false,
      epoch: 1,
      sequence: 1,
      updatedAt: Date.now(),
      source,
    };
    return this.currentSession;
  }

  public getSession(): UnifiedPlaybackSession | null {
    return this.currentSession;
  }

  public updateSession(updates: Partial<UnifiedPlaybackSession>): UnifiedPlaybackSession | null {
    if (!this.currentSession) return null;

    this.currentSession = {
      ...this.currentSession,
      ...updates,
      sequence: this.currentSession.sequence + 1,
      updatedAt: Date.now(),
    };

    return this.currentSession;
  }

  public setRenderer(renderer: Renderer): void {
    if (this.currentSession) {
      this.updateSession({ renderer });
    }
  }

  public setStatus(status: UnifiedPlaybackSession['status']): void {
    if (this.currentSession) {
      this.updateSession({ status });
    }
  }
}
