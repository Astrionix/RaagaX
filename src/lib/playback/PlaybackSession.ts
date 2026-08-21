import { Renderer, Song } from '@/types/music';

export interface DeviceRoleDescriptor {
  deviceId: string;
  instanceId: string;
  leaseId?: string | null;
  lastActive?: number;
}

export interface PlaybackSession {
  currentTrack: Song | null;
  currentTrackId: string | null;
  currentQueueIndex: number;
  queue: Song[];
  position: number;
  duration: number;
  isPlaying: boolean;
  shuffleMode: string;
  repeatMode: 'off' | 'all' | 'one' | 'OFF' | 'ALL' | 'ONE';
  playbackRequestId: number;
}

export interface UnifiedPlaybackSession extends PlaybackSession {
  sessionId: string;
  userId?: string;
  trackId: string;
  songData?: Song;

  canonicalPositionMs: number;
  durationMs: number;

  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'transitioning' | 'ended';

  // Explicit Renderer vs Controller Role Separation
  renderer: DeviceRoleDescriptor;
  controllers: DeviceRoleDescriptor[];

  activeDeviceId: string;
  activeRenderer: Renderer;

  playbackRate: number;
  volume: number;
  muted: boolean;

  epoch: number;
  revision: number;
  leaseId: string | null;
  leaseExpiresAt?: string | null;

  updatedAt: number;
  serverTimestamp: number;

  queueId?: string;
  queueRevision?: number;
  currentItemId?: string | null;
  queueIndex: number;

  shuffle: boolean;

  contextData?: {
    type?: string;
    seedId?: string;
    title?: string;
  };

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
    activeDeviceId: string,
    initialRenderer: Renderer = 'audio'
  ): UnifiedPlaybackSession {
    const session: UnifiedPlaybackSession = {
      sessionId: crypto.randomUUID(),
      trackId,
      canonicalPositionMs: 0,
      durationMs,
      status: 'paused',
      renderer: {
        deviceId: activeDeviceId,
        instanceId: 'inst_' + activeDeviceId,
        leaseId: null,
      },
      controllers: [],
      activeDeviceId,
      activeRenderer: initialRenderer,
      playbackRate: 1.0,
      volume: 1.0,
      muted: false,
      epoch: 1,
      revision: 1,
      leaseId: null,
      updatedAt: Date.now(),
      serverTimestamp: Date.now(),
      queue: [],
      queueIndex: 0,
      currentTrack: null,
      currentTrackId: trackId || null,
      currentQueueIndex: 0,
      position: 0,
      duration: durationMs > 0 ? durationMs / 1000 : 0,
      isPlaying: false,
      shuffleMode: 'OFF',
      repeatMode: 'off',
      playbackRequestId: 0,
      shuffle: false,
      source,
    };
    this.currentSession = session;
    return session;
  }

  public getSession(): UnifiedPlaybackSession | null {
    return this.currentSession;
  }

  public updateSession(updates: Partial<UnifiedPlaybackSession>): UnifiedPlaybackSession | null {
    if (!this.currentSession) return null;

    this.currentSession = {
      ...this.currentSession,
      ...updates,
      revision: (this.currentSession.revision || 0) + 1,
      updatedAt: Date.now(),
    };

    return this.currentSession;
  }

  public setRenderer(renderer: Renderer): void {
    if (this.currentSession) {
      this.updateSession({ activeRenderer: renderer });
    }
  }

  public setStatus(status: UnifiedPlaybackSession['status']): void {
    if (this.currentSession) {
      this.updateSession({ status });
    }
  }
}
