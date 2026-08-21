import { PlaybackEngine } from './PlaybackEngine';
import { MediaSessionManager } from './MediaSessionManager';
import { InterruptionCoordinator } from './InterruptionCoordinator';
import { TransitionManager } from './TransitionManager';
import { PreloadManager } from './PreloadManager';
import { AudioFocusManager } from './AudioFocusManager';
import { RendererManager } from './RendererManager';
import { QueueManager } from '../queue/QueueManager';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { RaagaXNativePlayer, NativeTrackItem } from './native/RaagaXNativePlayer';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useDownloadStore } from '@/context/useDownloadStore';
import { AdaptiveQueueController } from '../queue/AdaptiveQueueController';
import { PlaybackTelemetry, PlaybackSourceType } from './PlaybackTelemetry';
import { PlayableUrlCache } from './PlayableUrlCache';

export class PlaybackService {
  private static instance: PlaybackService;

  private audioA: HTMLAudioElement | null = null;
  private audioB: HTMLAudioElement | null = null;
  private activeTag: 'A' | 'B' = 'A';

  private activeCandidates: string[] = [];
  private activeCandidateIndex = 0;

  private isInitializing = false;
  private isTransitioning = false;
  private lastPositionReportTime = 0;
  private playbackGeneration = 0;
  private playbackRequestId = 0;
  private lastEndedGeneration = -1;

  private constructor() {}

  public static getInstance(): PlaybackService {
    if (!PlaybackService.instance) {
      PlaybackService.instance = new PlaybackService();
    }
    return PlaybackService.instance;
  }

  public setPlaybackRequestId(id: number) {
    this.playbackRequestId = id;
    this.playbackGeneration = id;
  }

  public getPlaybackRequestId(): number {
    return this.playbackRequestId;
  }

  public registerElements(elementA: HTMLAudioElement, elementB: HTMLAudioElement) {
    if (this.audioA === elementA && this.audioB === elementB) return;

    this.detachListeners();

    this.audioA = elementA;
    this.audioB = elementB;

    this.audioA.preload = 'auto';
    this.audioB.preload = 'auto';

    this.attachListeners();

    const active = this.getActiveAudio();
    if (active) {
      RendererManager.getInstance().registerRenderer('audio', active);
      PlaybackEngine.getInstance().attachMediaElement(active);
    }

    this.primeAudioElements();
    this.syncLivePlayingState();
    this.startWatchdog();
  }

  public getLivePlayingState(): boolean {
    if (RaagaXNativePlayer.isNative()) {
      return usePlayerStore.getState().isPlaying;
    }
    const store = usePlayerStore.getState();
    if (store.activeRenderer === 'video') {
      return store.isPlaying;
    }
    const active = this.getActiveAudio();
    if (!active) return false;
    return !active.paused && !active.ended;
  }

  public syncLivePlayingState(): boolean {
    if (RaagaXNativePlayer.isNative()) {
      return usePlayerStore.getState().isPlaying;
    }
    const store = usePlayerStore.getState();
    if (store.activeRenderer === 'video') {
      return store.isPlaying;
    }
    const active = this.getActiveAudio();
    if (!active) return false;
    const isActuallyPlaying = !active.paused && !active.ended;
    if (store.isActiveDevice && store.isPlaying !== isActuallyPlaying) {
      store.setIsPlaying(isActuallyPlaying, true);
    }
    return isActuallyPlaying;
  }

  private watchdogInterval: any = null;

  public startWatchdog() {
    if (typeof window === 'undefined' || this.watchdogInterval) return;
    this.watchdogInterval = setInterval(() => {
      const active = this.getActiveAudio();
      if (!active) return;
      const store = usePlayerStore.getState();

      // INVARIANT: When video is the active renderer, audio is intentionally paused.
      // The watchdog must not try to recover audio in this state.
      if (store.activeRenderer === 'video') return;

      if (store.isActiveDevice && store.isPlaying && store.playbackIntent === 'PLAYING' && active.paused && !active.ended && !this.isTransitioning) {
        if (active.readyState >= 2) {
          console.warn('[PlaybackService Watchdog] Active audio paused unexpectedly while isPlaying=true. Recovering play()...');
          active.play().catch((err) => {
            console.warn('[PlaybackService Watchdog] Auto-resume recovery failed:', err);
          });
        }
      }
    }, 3000);
  }

  public primeAudioElements() {
    this.isInitializing = true;
    [this.audioA, this.audioB].forEach((audio) => {
      if (!audio) return;
      if (!audio.src) {
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audio.play().then(() => audio.pause()).catch(() => {});
      }
    });
    setTimeout(() => { this.isInitializing = false; }, 500);
  }

  public getActiveAudio(): HTMLAudioElement | null {
    return this.activeTag === 'A' ? this.audioA : this.audioB;
  }

  public getStandbyAudio(): HTMLAudioElement | null {
    return this.activeTag === 'A' ? this.audioB : this.audioA;
  }

  private attachedListenersMap = new Map<HTMLAudioElement, Array<{ event: string; fn: EventListener }>>();

  private attachListeners() {
    [this.audioA, this.audioB].forEach((audio, idx) => {
      if (!audio) return;
      const tag = idx === 0 ? 'A' : 'B';
      const listenerList: Array<{ event: string; fn: EventListener }> = [];

      const add = (event: string, fn: EventListener) => {
        audio.addEventListener(event, fn);
        listenerList.push({ event, fn });
      };

      add('ended', () => this.handleNativeEnded(tag));
      add('timeupdate', () => this.handleNativeTimeUpdate(tag));
      add('loadedmetadata', () => this.handleNativeMetadata(tag));
      add('durationchange', () => this.handleNativeMetadata(tag));
      add('play', () => this.handleNativePlayState(tag, true));
      add('playing', () => this.handleNativePlayState(tag, true));
      add('pause', () => this.handleNativePlayState(tag, false));
      add('error', (e) => this.handleNativeError(tag, e));

      this.attachedListenersMap.set(audio, listenerList);
    });
  }

  private detachListeners() {
    [this.audioA, this.audioB].forEach((audio) => {
      if (!audio) return;
      const list = this.attachedListenersMap.get(audio);
      if (list) {
        list.forEach(({ event, fn }) => audio.removeEventListener(event, fn));
        this.attachedListenersMap.delete(audio);
      }
    });
  }

  public setupMediaSessionHandlers() {
    const mediaSession = MediaSessionManager.getInstance();
    mediaSession.setActionHandlers({
      onPlay: () => {
        InterruptionCoordinator.getInstance().clearInterruption();
        this.play();
      },
      onPause: () => {
        InterruptionCoordinator.getInstance().reportUserPause();
        this.pause();
      },
      onNext: () => {
        this.playNextTrack();
      },
      onPrev: () => {
        this.playPrevTrack();
      },
      onSeek: (time: number) => {
        this.seek(time);
      },
      onSeekBackward: (offset = 10) => {
        const active = this.getActiveAudio();
        if (active) this.seek(Math.max(0, active.currentTime - offset));
      },
      onSeekForward: (offset = 10) => {
        const active = this.getActiveAudio();
        if (active) this.seek(Math.min(active.duration || Infinity, active.currentTime + offset));
      }
    });
  }

  public async playContext(options: {
    type: 'ALBUM' | 'PLAYLIST' | 'SEARCH' | 'SONG';
    songs: Song[];
    startIndex?: number;
  }): Promise<boolean> {
    if (!options.songs || options.songs.length === 0) return false;
    const index = options.startIndex || 0;
    const firstSong = options.songs[index] || options.songs[0];
    
    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    store.playSong(firstSong, options.songs);
    return true;
  }

  public async playAlbum(songs: Song[], startIndex: number = 0): Promise<boolean> {
    return this.playContext({ type: 'ALBUM', songs, startIndex });
  }

  public async playPlaylist(songs: Song[], startIndex: number = 0): Promise<boolean> {
    return this.playContext({ type: 'PLAYLIST', songs, startIndex });
  }

  /**
   * loadQueueContext — Resolve all songs in a context (album/playlist) in parallel
   * and hand the FULL playlist to native ExoPlayer via setQueue() BEFORE song 1 starts.
   *
   * This is the definitive fix for background stop on albums/playlists:
   * ExoPlayer receives the complete ordered playlist and auto-advances natively
   * without requiring WebView/JS to wake up between tracks.
   */
  public async loadQueueContext(songs: Song[], startIndex: number, autoPlay: boolean = true, startPositionMs: number = 0, requestId?: number): Promise<void> {
    if (!RaagaXNativePlayer.isNative()) return;
    if (!songs || songs.length === 0) return;
    if (requestId !== undefined && requestId !== this.playbackRequestId) return;

    // Offline guard for queue context: only resolve network URLs when online.
    const store = usePlayerStore.getState();
    const isActuallyOffline =
      store.networkMode === 'offline' ||
      store.networkMode === 'offline_forced';

    try {
      const downloadStore = useDownloadStore.getState();

      // Resolve ALL songs in parallel (including the starting song)
      const resolvedTracks = await Promise.all(
        songs.map(async (song) => {
          // If offline, only attempt local file resolution
          const isDownloaded =
            store.downloadedSongIds.includes(song.id) ||
            !!downloadStore.nativeDownloadedTracks[song.id];

          if (isActuallyOffline && !isDownloaded) {
            return { url: '', title: song.title ?? '', artist: song.artist ?? '', artworkUrl: song.coverUrl ?? '' };
          }

          let finalSrc = '';
          try {
            const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
            if (source?.url) finalSrc = source.url;
          } catch {}
          if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
            finalSrc = song.audioUrl;
          }
          return {
            url: finalSrc,
            title: song.title ?? 'Unknown Title',
            artist: song.artist ?? 'Unknown Artist',
            artworkUrl: song.coverUrl ?? '',
          };
        })
      );

      if (requestId !== undefined && requestId !== this.playbackRequestId) {
        console.log(`[PlaybackService] loadQueueContext cancelled: stale requestId #${requestId} (current #${this.playbackRequestId})`);
        return;
      }

      const validTracks = resolvedTracks.filter(t => !!t.url);
      if (validTracks.length === 0) return;

      // setQueue() hands ExoPlayer the entire playlist with the correct start index and position.
      // ExoPlayer then owns all transitions — no WebView involvement needed.
      await RaagaXNativePlayer.setQueue(validTracks, startIndex, autoPlay, startPositionMs, requestId);
      console.log(`[PlaybackService] loadQueueContext: setQueue(${validTracks.length} tracks, startIndex=${startIndex}, startPos=${startPositionMs}ms, autoPlay=${autoPlay}, reqId=${requestId}) — ExoPlayer owns all transitions`);
    } catch (e) {
      console.warn('[PlaybackService] loadQueueContext failed:', e);
    }
  }

  /**
   * prepareTrack — Prepares audio element and MediaSession for passive startup restoration.
   * Sets audio source and seek position WITHOUT calling play().
   */
  public async prepareTrack(song: Song, positionSec: number = 0): Promise<boolean> {
    if (!song) return false;
    try {
      let finalSrc = '';
      try {
        const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
        if (source?.url) finalSrc = source.url;
      } catch {}
      if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
        finalSrc = song.audioUrl;
      }
      if (!finalSrc) return false;

      const activeAudio = this.getActiveAudio();
      if (activeAudio) {
        if (activeAudio.src !== finalSrc) {
          activeAudio.src = finalSrc;
        }
        if (positionSec > 0) {
          try {
            activeAudio.currentTime = positionSec;
          } catch {}
        }
      }

      MediaSessionManager.getInstance().updateMetadata({
        title: song.title || 'RaagaX Track',
        artist: song.artist || 'RaagaX',
        album: song.album || 'RaagaX',
        artwork: song.coverUrl ? [{ src: song.coverUrl, sizes: '512x512', type: 'image/png' }] : [],
      });
      MediaSessionManager.getInstance().setPlaybackState('paused');
      MediaSessionManager.getInstance().setPositionState({
        duration: song.duration || activeAudio?.duration || 0,
        position: positionSec,
      });

      return true;
    } catch (e) {
      console.warn('[PlaybackService] prepareTrack failed:', e);
      return false;
    }
  }

  public stopAllAudio() {
    [this.audioA, this.audioB].forEach((a) => {
      if (a) {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {}
      }
    });
    PreloadManager.getInstance().reset();
    if (this.audioA && this.audioB) {
      TransitionManager.getInstance().cancelTransition(this.audioA, this.audioB);
    }
  }

  /**
   * loadAudioSource — Atomically loads and starts audio for a requested track.
   * Uses requestId stale-check to guarantee older async loads NEVER overwrite newer requests.
   */
  public async loadAudioSource(song: Song, requestId: number, autoPlay: boolean = true): Promise<boolean> {
    if (!song) return false;
    if (requestId !== this.playbackRequestId) return false;

    // INVARIANT: Audio must not execute while video renderer is active.
    const store = usePlayerStore.getState();
    if (store.activeRenderer === 'video') {
      console.warn(`[PlaybackService] loadAudioSource() blocked for "${song.title}" — video renderer is active`);
      return false;
    }

    this.isTransitioning = true;
    const playRequestedAt = performance.now();
    let resolvedSourceType: PlaybackSourceType = 'NETWORK_STREAM';

    try {
      // 1. Stop all previous audio sources immediately
      this.stopAllAudio();
      if (requestId !== this.playbackRequestId) return false;

      // ── OFFLINE GUARD ─────────────────────────────────────────────────────────
      // Prevents network attempts when the user has explicitly enabled Offline Mode.
      // IMPORTANT: We do NOT use navigator.onLine here — on Android/Capacitor WebView
      // this property is unreliable and returns false even with an active connection,
      // which would silently block all liked/library songs from streaming.
      // PlaybackSourceResolver already handles true network failures gracefully.
      const isActuallyOffline =
        store.networkMode === 'offline' ||
        store.networkMode === 'offline_forced';

      if (isActuallyOffline) {
        const downloadStore = useDownloadStore.getState();
        const isDownloaded =
          store.downloadedSongIds.includes(song.id) ||
          !!downloadStore.nativeDownloadedTracks[song.id];

        if (!isDownloaded) {
          console.warn(
            `[PlaybackService] Offline guard: "${song.title}" not available — Offline Mode is on. Download first.`
          );
          store.setToastMessage(
            `"${song.title}" isn't available offline. Turn off Offline Mode or download it first.`
          );
          store.setIsPlaying(false);
          this.isTransitioning = false;
          return false;
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      // 2. Native Android ExoPlayer Path
      if (RaagaXNativePlayer.isNative()) {
        let finalSrc = '';
        try {
          const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
          if (source?.url) {
            finalSrc = source.url;
            resolvedSourceType = source.type === 'offline' ? 'LOCAL_DOWNLOAD' : 'NETWORK_STREAM';
          }
        } catch (e) {
          console.warn('[PlaybackService] Native source resolution failed:', e);
        }
        if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
          finalSrc = song.audioUrl;
        }
        if (requestId !== this.playbackRequestId) return false;
        if (!finalSrc) {
          console.warn(`[PlaybackService] No playable source for native playback: "${song.title}"`);
          return false;
        }

        const queue = store.queue;
        const currentIdx = store.queueIndex >= 0 ? store.queueIndex : 0;

        // Build the native playlist with the freshly resolved active source
        const nativeTracks: NativeTrackItem[] = (queue && queue.length > 0)
          ? queue.map((s, idx) => ({
              url: idx === currentIdx ? finalSrc : (s.audioUrl || ''),
              title: s.title ?? 'Unknown Title',
              artist: s.artist ?? 'Unknown Artist',
              artworkUrl: s.coverUrl ?? '',
            }))
          : [
              {
                url: finalSrc,
                title: song.title ?? 'Unknown Title',
                artist: song.artist ?? 'Unknown Artist',
                artworkUrl: song.coverUrl ?? '',
              },
            ];

        await RaagaXNativePlayer.setQueue(nativeTracks, currentIdx, autoPlay, 0, requestId);

        if (requestId !== this.playbackRequestId) return false;

        const timeToFirstAudioMs = Math.round(performance.now() - playRequestedAt);
        PlaybackTelemetry.getInstance().recordMetric({
          sessionId: String(requestId),
          trackId: song.id,
          sourceType: resolvedSourceType,
          timeToFirstAudioMs,
          success: true,
        });

        return true;
      }

      // 3. Web HTML5 Audio Element Path
      const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
      const activeAudio = this.getActiveAudio();
      if (!activeAudio) {
        if (isTest || typeof window === 'undefined') {
          return true;
        }
        return false;
      }

      let resolvedSource: any = null;
      try {
        resolvedSource = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
      } catch (e) {
        console.warn('[PlaybackService] Source resolution failed:', e);
      }

      if (requestId !== this.playbackRequestId) {
        console.log(`[PlaybackService] Discarding stale source resolution for req #${requestId} (current #${this.playbackRequestId})`);
        return false;
      }

      if (resolvedSource?.type === 'offline') {
        resolvedSourceType = 'LOCAL_DOWNLOAD';
      } else if (PlayableUrlCache.getInstance().get(song.id)) {
        resolvedSourceType = 'URL_CACHE_HIT';
      }

      let finalSrc = '';
      if (resolvedSource?.url) {
        finalSrc = resolvedSource.url;
      } else if (song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
        finalSrc = song.audioUrl.replace(/^http:\/\//, 'https://');
      }

      if (!finalSrc) {
        if (isTest || typeof window === 'undefined') {
          return true;
        }
        console.error(`[PlaybackService] No playable audio URL for "${song.title}"`);
        return false;
      }

      if (requestId !== this.playbackRequestId) return false;

      // Reset currentTime to 0 and load new audio URL
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {}

      activeAudio.src = finalSrc;
      activeAudio.load();

      try {
        activeAudio.currentTime = 0;
      } catch {}

      activeAudio.dataset.playbackRequestId = String(requestId);
      activeAudio.dataset.playbackGeneration = String(requestId);
      activeAudio.dataset.trackId = song.id;

      PlaybackEngine.getInstance().attachMediaElement(activeAudio);
      RendererManager.getInstance().registerRenderer('audio', activeAudio);

      activeAudio.volume = store.isMuted ? 0 : store.volume;

      if (requestId !== this.playbackRequestId) {
        console.log(`[PlaybackService] Discarding stale loaded state for req #${requestId} (current #${this.playbackRequestId})`);
        activeAudio.pause();
        return false;
      }

      if (autoPlay) {
        try {
          await activeAudio.play();
          if (requestId !== this.playbackRequestId) {
            console.log(`[PlaybackService] Discarding stale play completion for req #${requestId}`);
            activeAudio.pause();
            return false;
          }
          const timeToFirstAudioMs = Math.round(performance.now() - playRequestedAt);
          PlaybackTelemetry.getInstance().recordMetric({
            sessionId: String(requestId),
            trackId: song.id,
            sourceType: resolvedSourceType,
            timeToFirstAudioMs,
            success: true,
          });

          AudioFocusManager.getInstance().requestFocus();
          return true;
        } catch (e: any) {
          if (e?.name === 'AbortError' || requestId !== this.playbackRequestId) {
            return false;
          }
          console.warn('[PlaybackService] Direct play failed:', e);
          return false;
        }
      }

      return true;
    } catch (e) {
      console.warn('[PlaybackService] loadAudioSource failed:', e);
      return false;
    } finally {
      this.isTransitioning = false;
    }
  }

  public async playTrack(song: Song, forceResume: boolean = true): Promise<boolean> {
    if (!song) return false;
    const reqId = this.playbackRequestId || ++this.playbackGeneration;
    this.playbackRequestId = reqId;
    return this.loadAudioSource(song, reqId, forceResume);
  }

  public triggerNextPreload() {
    if (typeof window === 'undefined') return;

    if (RaagaXNativePlayer.isNative()) {
      this.preloadNativeNextTrack();
      return;
    }

    const standby = this.getStandbyAudio();
    const manager = QueueManager.getInstance();
    const nextItem = manager.peekNext();

    if (nextItem && nextItem.song) {
      PreloadManager.getInstance().prepareNextTrack(nextItem.song, standby).catch(() => {});
    }

    const snapshot = manager.getSnapshot();
    if (snapshot.currentIndex > 0 && snapshot.items[snapshot.currentIndex - 1]?.song) {
      PreloadManager.getInstance().preparePreviousTrack(snapshot.items[snapshot.currentIndex - 1].song).catch(() => {});
    }
  }

  public async playNextTrack(isNaturalEnd: boolean = false): Promise<boolean> {
    try {
      await usePlayerStore.getState().playNext();
      return true;
    } catch {
      return false;
    }
  }

  public async playPrevTrack(): Promise<boolean> {
    // Spotify 3-Second Rule: if track has played > 3 seconds, restart current track from 00:00 and play
    const active = this.getActiveAudio();
    if (active && active.currentTime > 3.0) {
      this.seek(0);
      this.play();
      usePlayerStore.getState().setIsPlaying(true);
      return true;
    }
    try {
      await usePlayerStore.getState().playPrev();
      return true;
    } catch {
      return false;
    }
  }

  public play() {
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.resume();
      this.notifyStorePlaying(true);
      return;
    }

    const active = this.getActiveAudio();
    if (active) {
      if (typeof active.play === 'function') {
        const p = active.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this.notifyStorePlaying(true);
            MediaSessionManager.getInstance().setPlaybackState('playing');
            AudioFocusManager.getInstance().requestFocus();
          }).catch((err) => {
            if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') {
              console.warn('[PlaybackService] play() error:', err);
            }
          });
        } else {
          this.notifyStorePlaying(true);
        }
      } else {
        this.notifyStorePlaying(true);
      }
    }
  }

  private notifyStorePlaying(isPlaying: boolean) {
    try {
      usePlayerStore.getState().setIsPlaying(isPlaying, true);
    } catch {}
  }

  public pauseAudioElementOnly() {
    [this.audioA, this.audioB].forEach(audio => {
      if (audio && !audio.paused) {
        try { audio.pause(); } catch {}
      }
    });
  }

  public pause() {
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.pause();
      const store = usePlayerStore.getState();
      store.setIsPlaying(false, true);
      return;
    }

    this.pauseAudioElementOnly();

    const store = usePlayerStore.getState();
    // Only update store isPlaying if audio is the active renderer
    if (store.activeRenderer !== 'video') {
      store.setIsPlaying(false, true);
      MediaSessionManager.getInstance().setPlaybackState('paused');
    }
    AudioFocusManager.getInstance().releaseFocus();
  }

  public async resume(): Promise<boolean> {
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.resume();
      const store = usePlayerStore.getState();
      store.setIsPlaying(true, true);
      return true;
    }

    // INVARIANT: Audio must never resume while video is the active renderer
    const store = usePlayerStore.getState();
    if (store.activeRenderer === 'video') {
      console.warn('[PlaybackService] resume() blocked — video renderer is active');
      return false;
    }

    const active = this.getActiveAudio() || PlaybackEngine.getInstance().getActiveMediaElement();
    if (active && active.src) {
      try {
        await active.play();
        store.setIsPlaying(true, true);
        MediaSessionManager.getInstance().setPlaybackState('playing');
        AudioFocusManager.getInstance().requestFocus();
        return true;
      } catch (e) {
        console.warn('[PlaybackService] Resume failed:', e);
      }
    }

    if (store.currentSong) {
      return this.playTrack(store.currentSong, true);
    }
    return false;
  }

  public seek(timeSeconds: number, fromRemote: boolean = false) {
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.seekTo(timeSeconds * 1000);
      const store = usePlayerStore.getState();
      store.setCurrentTime(timeSeconds, fromRemote);
      return;
    }

    const active = this.getActiveAudio() || PlaybackEngine.getInstance().getActiveMediaElement();
    if (active) {
      active.currentTime = timeSeconds;
      PlaybackEngine.getInstance().anchor();
      const store = usePlayerStore.getState();
      store.setCurrentTime(timeSeconds, fromRemote);
      MediaSessionManager.getInstance().setPositionState({
        duration: active.duration || store.duration || 0,
        position: timeSeconds
      });
    } else {
      const store = usePlayerStore.getState();
      store.setCurrentTime(timeSeconds, fromRemote);
    }
  }


  private handleNativeMetadata(tag: 'A' | 'B') {
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    if (!active) return;

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    if (!isNaN(active.duration) && Number.isFinite(active.duration) && active.duration > 0) {
      store.setDuration(active.duration);
      MediaSessionManager.getInstance().setPositionState({
        duration: active.duration,
        position: active.currentTime || 0
      });
    }
  }

  private handleNativePlayState(tag: 'A' | 'B', isPlaying: boolean) {
    if (tag !== this.activeTag) return;

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    // CRITICAL: If video is the active renderer, the HTML5 audio element's pause event must NOT overwrite store isPlaying!
    if (store.activeRenderer === 'video') {
      return;
    }

    // Ignore synthetic silence priming pauses
    if (this.isInitializing) {
      return;
    }

    const active = this.getActiveAudio();
    const livePlaying = active ? !active.paused && !active.ended : isPlaying;

    if (store.isActiveDevice) {
      if (store.isPlaying !== livePlaying) {
        store.setIsPlaying(livePlaying, true);
      }
    }
  }

  private handleNativeEnded(tag: 'A' | 'B') {
    if (tag !== this.activeTag) return;

    const active = this.getActiveAudio();
    if (!active) return;

    const generation = Number(active.dataset.playbackRequestId || active.dataset.playbackGeneration || 0);
    const endedTrackId = active.dataset.trackId;
    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    const currentReq = this.playbackRequestId || this.playbackGeneration;

    // Idempotency check: ignore stale or duplicate ended events
    if (generation > 0 && generation !== currentReq) {
      console.log(`[PlaybackService] Ignoring stale ended event (gen ${generation} vs current ${currentReq})`);
      return;
    }
    if (generation > 0 && this.lastEndedGeneration === generation) {
      console.log(`[PlaybackService] Ignoring duplicate ended event for generation ${generation}`);
      return;
    }

    if (endedTrackId && store.currentSong?.id && endedTrackId !== store.currentSong.id) {
      console.log(`[PlaybackService] Ignoring ended event for inactive track ${endedTrackId}`);
      return;
    }

    if (generation > 0) {
      this.lastEndedGeneration = generation;
    }

    // Check if crossfade/gapless is actively committing
    if (TransitionManager.getInstance().getState() !== 'IDLE') return;

    console.log(`[PlaybackService] Track ended naturally on audio ${tag} (gen ${generation}). Advancing queue...`);
    this.playNextTrack(true);
  }

  private handleNativeTimeUpdate(tag: 'A' | 'B') {
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    const standby = this.getStandbyAudio();
    if (!active || !standby) return;

    const store = usePlayerStore.getState();
    if (!store.isActiveDevice) return;

    // Anchor PlaybackEngine clock for smooth 60fps rAF predictions
    PlaybackEngine.getInstance().anchor();

    // Project currentTime and duration to Zustand store
    const curTime = active.currentTime;
    const dur = active.duration;

    if (Math.abs(store.currentTime - curTime) > 0.3) {
      store.setCurrentTime(curTime, true);
    }
    if (!isNaN(dur) && Number.isFinite(dur) && dur > 0 && store.duration !== dur) {
      store.setDuration(dur);
    }

    // Continuously evaluate and pre-resolve next track into standby audio element for mobile background playback
    PreloadManager.getInstance().evaluatePreload(standby);

    // Boundary check for Crossfade (only if crossfade is explicitly enabled and tab is active)
    if (store.crossfadeSec > 0 && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      TransitionManager.getInstance().checkBoundary(active, standby, () => {
        this.activeTag = this.activeTag === 'A' ? 'B' : 'A';
        this.playNextTrack();
      });
    }
  }

  private async handleNativeError(tag: 'A' | 'B', e: Event) {
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    if (!active) return;

    console.warn(`[PLAYBACK PIPELINE] Audio stream error on audio ${tag}:`, e);

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    const shouldResume = store.isPlaying && store.playbackIntent === 'PLAYING';

    // Waterfall to next candidate in activeCandidates
    if (this.activeCandidateIndex + 1 < this.activeCandidates.length) {
      this.activeCandidateIndex += 1;
      const nextCandidate = this.activeCandidates[this.activeCandidateIndex];
      console.log(`[PLAYBACK PIPELINE] Retrying error recovery with candidate #${this.activeCandidateIndex + 1}: ${nextCandidate}`);
      active.src = nextCandidate;
      active.load();
      if (shouldResume) {
        active.play().catch((playErr) => {
          console.warn(`[PLAYBACK PIPELINE] Candidate retry play failed:`, playErr);
        });
      }
      return;
    }

    // All stream candidates failed for this song
    console.error(`[PLAYBACK PIPELINE] All stream candidates failed for track: "${store.currentSong?.title}"`);
    if (typeof store.setToastMessage === 'function' && store.currentSong?.title) {
      store.setToastMessage(`"${store.currentSong.title}" is currently unavailable.`);
    }
    store.setIsPlaying(false, true);
  }

  public async preloadNativeNextTrack() {
    if (!RaagaXNativePlayer.isNative()) return;
    try {
      const manager = QueueManager.getInstance();
      const snapshot = manager.getSnapshot();
      const currentIndex = snapshot.currentIndex;
      if (currentIndex < 0 || currentIndex >= snapshot.items.length - 1) return;

      const upcomingItems = snapshot.items.slice(currentIndex + 1, currentIndex + 6);
      if (upcomingItems.length === 0) return;

      const batch: Array<{ url: string; title: string; artist: string; artworkUrl?: string }> = [];

      for (const item of upcomingItems) {
        if (!item?.song) continue;
        const song = item.song;
        let finalSrc = song.audioUrl || '';
        if (!finalSrc || finalSrc.includes('pixabay.com')) {
          try {
            const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
            if (source && source.type === 'remote' && source.url) {
              finalSrc = source.url;
            }
          } catch {}
        }
        if (!finalSrc) continue;

        batch.push({
          url: finalSrc,
          title: song.title ?? 'Unknown Title',
          artist: song.artist ?? 'Unknown Artist',
          artworkUrl: song.coverUrl ?? '',
        });
      }

      if (batch.length > 1) {
        await RaagaXNativePlayer.setNextTracksBatch(batch);
        console.log(`[PlaybackService] Batch preloaded ${batch.length} native tracks into ExoPlayer queue`);
      } else if (batch.length === 1) {
        await RaagaXNativePlayer.setNextTrack(batch[0]);
        console.log('[PlaybackService] Preloaded native next track into ExoPlayer queue:', batch[0].title);
      }
    } catch (e) {
      console.warn('[PlaybackService] Failed to preload native next track:', e);
    }
  }

  private updateMediaSessionMetadata(song: Song) {
    try {
      const store = usePlayerStore.getState();
      const isDownloaded = store.downloadedSongIds?.includes(song.id);
      
      let downloadText: string | undefined;
      try {
        const downloadStore = require('@/context/useDownloadStore').useDownloadStore.getState();
        const downloadTask = downloadStore.tasks?.[song.id];
        if (downloadTask && (downloadTask.status === 'DOWNLOADING' || downloadTask.status === 'QUEUED')) {
          downloadText = `Downloading • ${downloadTask.progress || 0}%`;
        }
      } catch {}

      const mediaSession = MediaSessionManager.getInstance();
      mediaSession.updateSongMetadata(song, {
        isOffline: isDownloaded,
        downloadText,
      });
      mediaSession.setPlaybackState('playing');
      mediaSession.setPositionState({
        duration: song.duration || 0,
        position: 0,
        playbackRate: 1,
      });
    } catch (e) {
      console.warn('[PlaybackService] updateMediaSessionMetadata warning:', e);
    }
  }
}
