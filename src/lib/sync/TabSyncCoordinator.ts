import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { MediaSessionManager } from '@/lib/playback/MediaSessionManager';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { PlaybackService } from '@/lib/playback/PlaybackService';

export interface TabSyncMessage {
  type: 'TAB_METADATA_UPDATE' | 'TAB_REQUEST_SYNC' | 'TAB_SYNC_RESPONSE';
  originTabId: string;
  song?: Song | null;
  isPlaying?: boolean;
  queueIndex?: number;
  currentTime?: number;
  duration?: number;
  queue?: Song[];
  timestamp: number;
}

export interface LiveTabSnapshot {
  song: Song | null;
  isPlaying: boolean;
  queueIndex: number;
  currentTime: number;
  duration: number;
  queue?: Song[];
  timestamp: number;
}

export class TabSyncCoordinator {
  private static instance: TabSyncCoordinator;
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isInitialized = false;
  public static readonly LIVE_METADATA_KEY = 'raagax_live_tab_metadata';

  private constructor() {
    this.tabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'tab_' + Math.random().toString(36).slice(2, 11);
  }

  public static getInstance(): TabSyncCoordinator {
    if (!TabSyncCoordinator.instance) {
      TabSyncCoordinator.instance = new TabSyncCoordinator();
    }
    return TabSyncCoordinator.instance;
  }

  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }
    this.isInitialized = true;

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('raagax_tab_metadata_sync');
        this.channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
          const msg = event.data;
          if (!msg || typeof msg !== 'object' || msg.originTabId === this.tabId) {
            return;
          }
          this.handleIncomingMessage(msg);
        };
      }

      // Cross-tab storage event: Fires on ALL other background/open tabs when localStorage changes
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === TabSyncCoordinator.LIVE_METADATA_KEY && e.newValue) {
          try {
            const data: LiveTabSnapshot = JSON.parse(e.newValue);
            this.handleStorageUpdate(data);
          } catch { }
        }
      });

      // When this tab becomes visible or gains focus (user switches back / opens the tab),
      // instantly reconcile from storage and broadcast request
      const handleReentry = () => {
        this.reconcileOnForeground();
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleReentry();
        }
      });
      window.addEventListener('focus', handleReentry);

      // Announce and request sync on initial boot
      setTimeout(() => this.reconcileOnForeground(), 150);
    } catch (e) {
      console.warn('[TabSyncCoordinator] Initialization warning:', e);
    }
  }

  /**
   * Returns true if THIS tab is actively playing local HTML5 audio elements.
   * If true, this tab is authoritative and should NOT overwrite itself with background snapshots.
   */
  public isAuthoritativeLocalPlayer(): boolean {
    const store = usePlayerStore.getState();
    if (!store.isLocalPlayback) return false;
    const active = PlaybackService.getInstance().getActiveAudio();
    return Boolean(active && !active.paused && active.src && active.src !== 'about:blank');
  }

  /**
   * Called whenever user switches to / opens this tab ('visibilitychange' or 'focus').
   * Guarantees 0ms instant catch-up to the live song instead of showing old metadata!
   */
  public reconcileOnForeground(): void {
    if (typeof window === 'undefined') return;

    // 1. If this tab is the authoritative local audio player, broadcast our fresh state to all other tabs
    if (this.isAuthoritativeLocalPlayer()) {
      const store = usePlayerStore.getState();
      if (store.currentSong) {
        this.broadcastLiveState('TAB_METADATA_UPDATE');
      }
      return;
    }

    // 2. Otherwise (this tab is a background tab, remote controller, or passive viewer),
    // immediately read the latest snapshot from localStorage for 0ms instant UI reconciliation
    try {
      const raw = localStorage.getItem(TabSyncCoordinator.LIVE_METADATA_KEY);
      if (raw) {
        const snap: LiveTabSnapshot = JSON.parse(raw);
        if (snap && snap.song && snap.song.id) {
          const store = usePlayerStore.getState();
          const current = store.currentSong;
          const isOlder = snap.timestamp && snap.timestamp > (Date.now() - 3600000); // within 1 hour

          // CRITICAL ZERO-AUTOPLAY RULE:
          // Reconciling from localStorage on startup / foreground must NEVER restore isPlaying = true or playbackIntent = 'PLAYING'!
          // Only an active live handshake via BroadcastChannel (TAB_SYNC_RESPONSE) from an alive playing tab may assert isPlaying = true.
          if (isOlder && (!current || current.id !== snap.song.id)) {
            usePlayerStore.setState({
              currentSong: snap.song,
              queueIndex: typeof snap.queueIndex === 'number' ? snap.queueIndex : store.queueIndex,
              isPlaying: false, // Strict Rule: Always false when reading static persisted localStorage
              playbackIntent: 'PAUSED',
              currentTime: typeof snap.currentTime === 'number' ? snap.currentTime : store.currentTime,
              duration: typeof snap.duration === 'number' && snap.duration > 0 ? snap.duration : (snap.song.duration || store.duration),
              queue: snap.queue && snap.queue.length > 0 ? snap.queue : store.queue,
              lastPositionTimestamp: null,
            });

            MediaSessionManager.getInstance().updateSongMetadata(snap.song);
            this.updateDocumentTitle(snap.song, false);
          }
        }
      }
    } catch { }

    // 3. Send BroadcastChannel request so the active player can send exact sub-second position
    this.requestSync();
  }

  private handleStorageUpdate(data: LiveTabSnapshot): void {
    // If this tab is the one actively playing audio, don't overwrite from storage
    if (this.isAuthoritativeLocalPlayer()) {
      return;
    }

    if (data.song && data.song.id) {
      const store = usePlayerStore.getState();
      const current = store.currentSong;
      const isDiff = !current || current.id !== data.song.id;

      if (isDiff || store.isPlaying !== data.isPlaying) {
        usePlayerStore.setState({
          currentSong: data.song,
          queueIndex: typeof data.queueIndex === 'number' ? data.queueIndex : store.queueIndex,
          isPlaying: Boolean(data.isPlaying),
          playbackIntent: data.isPlaying ? 'PLAYING' : 'PAUSED',
          currentTime: typeof data.currentTime === 'number' ? data.currentTime : store.currentTime,
          duration: typeof data.duration === 'number' && data.duration > 0 ? data.duration : (data.song.duration || store.duration),
          queue: data.queue && data.queue.length > 0 ? data.queue : store.queue,
          lastPositionTimestamp: data.isPlaying ? performance.now() : null,
        });

        MediaSessionManager.getInstance().updateSongMetadata(data.song);
        this.updateDocumentTitle(data.song, Boolean(data.isPlaying));
      }
    }
  }

  private handleIncomingMessage(msg: TabSyncMessage): void {
    const store = usePlayerStore.getState();

    switch (msg.type) {
      case 'TAB_REQUEST_SYNC': {
        // If this tab is the one actively playing audio or holding authoritative state, answer with current metadata
        if (store.currentSong && (store.isPlaying || store.playbackIntent === 'PLAYING' || this.isAuthoritativeLocalPlayer())) {
          this.broadcastLiveState('TAB_SYNC_RESPONSE');
        }
        break;
      }

      case 'TAB_METADATA_UPDATE':
      case 'TAB_SYNC_RESPONSE': {
        // If this tab is the authoritative local audio player, do not accept external tab overrides
        if (this.isAuthoritativeLocalPlayer()) {
          return;
        }

        if (msg.song && msg.song.id) {
          const current = store.currentSong;
          const isDifferentSong = !current || current.id !== msg.song.id;

          // If another tab has advanced the track or updated state, update our store silently
          if (isDifferentSong || store.isPlaying !== msg.isPlaying) {
            usePlayerStore.setState({
              currentSong: msg.song,
              queueIndex: typeof msg.queueIndex === 'number' ? msg.queueIndex : store.queueIndex,
              isPlaying: Boolean(msg.isPlaying),
              playbackIntent: msg.isPlaying ? 'PLAYING' : 'PAUSED',
              currentTime: typeof msg.currentTime === 'number' ? msg.currentTime : store.currentTime,
              duration: typeof msg.duration === 'number' && msg.duration > 0 ? msg.duration : (msg.song.duration || store.duration),
              queue: msg.queue && msg.queue.length > 0 ? msg.queue : store.queue,
              lastPositionTimestamp: msg.isPlaying ? performance.now() : null,
            });

            // Update MediaSession & Document Title on this tab as well
            MediaSessionManager.getInstance().updateSongMetadata(msg.song);
            this.updateDocumentTitle(msg.song, Boolean(msg.isPlaying));
          }
        }
        break;
      }
    }
  }

  public broadcastTrackChange(
    song: Song,
    isPlaying: boolean,
    queueIndex: number,
    currentTime: number = 0,
    duration: number = 0,
    queue?: Song[]
  ): void {
    const now = Date.now();

    // 1. Send via BroadcastChannel
    if (this.channel) {
      try {
        const payload: TabSyncMessage = {
          type: 'TAB_METADATA_UPDATE',
          originTabId: this.tabId,
          song,
          isPlaying,
          queueIndex,
          currentTime,
          duration,
          queue,
          timestamp: now,
        };
        this.channel.postMessage(payload);
      } catch { }
    }

    // 2. Persist to localStorage for 100% reliable cross-tab wake-up & instant re-entry
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const snapshot: LiveTabSnapshot = {
          song,
          isPlaying,
          queueIndex,
          currentTime,
          duration,
          queue,
          timestamp: now,
        };
        localStorage.setItem(TabSyncCoordinator.LIVE_METADATA_KEY, JSON.stringify(snapshot));
      } catch { }
    }

    // 3. Update tab title
    this.updateDocumentTitle(song, isPlaying);
  }

  public broadcastPlaybackState(isPlaying: boolean, currentTime?: number): void {
    const store = usePlayerStore.getState();
    const now = Date.now();
    const currentSong = store.currentSong;

    if (this.channel) {
      try {
        const payload: TabSyncMessage = {
          type: 'TAB_METADATA_UPDATE',
          originTabId: this.tabId,
          song: currentSong,
          isPlaying,
          queueIndex: store.queueIndex,
          currentTime: currentTime !== undefined ? currentTime : store.currentTime,
          duration: store.duration,
          timestamp: now,
        };
        this.channel.postMessage(payload);
      } catch { }
    }

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && currentSong) {
      try {
        const snapshot: LiveTabSnapshot = {
          song: currentSong,
          isPlaying,
          queueIndex: store.queueIndex,
          currentTime: currentTime !== undefined ? currentTime : store.currentTime,
          duration: store.duration,
          queue: store.queue,
          timestamp: now,
        };
        localStorage.setItem(TabSyncCoordinator.LIVE_METADATA_KEY, JSON.stringify(snapshot));
      } catch { }
    }

    if (currentSong) {
      this.updateDocumentTitle(currentSong, isPlaying);
    }
  }

  public requestSync(): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage({
        type: 'TAB_REQUEST_SYNC',
        originTabId: this.tabId,
        timestamp: Date.now(),
      });
    } catch { }
  }

  private broadcastLiveState(type: 'TAB_SYNC_RESPONSE' | 'TAB_METADATA_UPDATE'): void {
    const store = usePlayerStore.getState();
    if (!store.currentSong) return;
    const now = Date.now();

    if (this.channel) {
      try {
        this.channel.postMessage({
          type,
          originTabId: this.tabId,
          song: store.currentSong,
          isPlaying: store.isPlaying,
          queueIndex: store.queueIndex,
          currentTime: store.currentTime,
          duration: store.duration,
          queue: store.queue,
          timestamp: now,
        });
      } catch { }
    }

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const snapshot: LiveTabSnapshot = {
          song: store.currentSong,
          isPlaying: store.isPlaying,
          queueIndex: store.queueIndex,
          currentTime: store.currentTime,
          duration: store.duration,
          queue: store.queue,
          timestamp: now,
        };
        localStorage.setItem(TabSyncCoordinator.LIVE_METADATA_KEY, JSON.stringify(snapshot));
      } catch { }
    }
  }

  public updateDocumentTitle(song?: Song | null, isPlaying?: boolean): void {
    if (typeof document === 'undefined') return;

    if (song && song.title) {
      const cleanTitle = SongFormatter.cleanSongTitle(song.title);
      const cleanArtist = SongFormatter.decodeHtml(song.artist) || song.artist || '';
      const artistPart = cleanArtist ? ` • ${cleanArtist}` : '';
      const icon = isPlaying ? '🎵 ' : '⏸️ ';
      document.title = `${icon}${cleanTitle}${artistPart} | RaagaX`;
    } else {
      document.title = 'RaagaX - Futuristic Music Streaming Platform';
    }
  }
}
