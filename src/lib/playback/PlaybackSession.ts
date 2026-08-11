import { Renderer, Song } from '@/types/music';

export interface DeviceRoleDescriptor {
  deviceId: string;
  instanceId: string;
  leaseId?: string | null;
  lastActive?: number;
}

export interface UnifiedPlaybackSession {
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

  queue: Song[];
  queueIndex: number;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';

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
    this.currentSession = {
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
      shuffle: false,
      repeatMode: 'off',
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
