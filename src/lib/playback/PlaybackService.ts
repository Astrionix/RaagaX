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
import { WakeLockManager } from './WakeLockManager';

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
  private lastReportedReadyGen = -1;
  private lastReportedStartedGen = -1;
  private lastReadyTrackKey = '';
  private lastStartedTrackKey = '';

  private emitPlaybackReady(trackId: string, duration: number, generation: number) {
    const key = `${trackId}_${generation}`;
    if (this.lastReadyTrackKey === key && generation > 0) return;
    this.lastReadyTrackKey = key;
    this.lastReportedReadyGen = generation;
    console.log(`[PLAYBACK_READY] trackId=${trackId} duration=${duration}`);
  }

  private emitPlaybackStarted(trackId: string, position: number, generation: number) {
    const key = `${trackId}_${generation}`;
    if (this.lastStartedTrackKey === key && generation > 0) return;
    this.lastStartedTrackKey = key;
    this.lastReportedStartedGen = generation;
    console.log(`[PLAYBACK_STARTED] trackId=${trackId} position=${position}`);
  }

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
    this.lastReportedReadyGen = -1;
    this.lastReportedStartedGen = -1;
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
    const active = this.getActiveAudio();
    if (!active) return false;
    return !active.paused && !active.ended;
  }

  public syncLivePlayingState(): boolean {
    if (RaagaXNativePlayer.isNative()) {
      return usePlayerStore.getState().isPlaying;
    }
    const store = usePlayerStore.getState();
    const active = this.getActiveAudio();
    if (!active) return false;
    const isActuallyPlaying = !active.paused && !active.ended;
    if (store.isPlaying !== isActuallyPlaying) {
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

      if (store.isPlaying && store.playbackIntent === 'PLAYING' && active.paused && !active.ended && !this.isTransitioning) {
        // CONNECT SAFETY: Do NOT recover playback if this device is acting as a remote controller
        try {
          const { ConnectClientManager } = require('@/lib/connect/ConnectClientManager');
          if (ConnectClientManager.getInstance().isRemoteMode()) {
            return;
          }
        } catch {}

        if (active.readyState >= 2) {
          // WATCHDOG JAM SAFETY (Phase 4):
          // Do NOT recover playback if the Jam session is in a transient lifecycle state.
          // During JOINING, PREPARING, SCHEDULED, CLOCK_SYNCING, SNAPSHOT_RECEIVED, or RECONNECTING
          // the DriftCorrectionEngine / ScheduledStart is in control of play() timing.
          // Triggering play() here would interfere with the scheduled start and cause a premature
          // audio start before the correct timeline position has been seeked.
          try {
            const { JamClientManager } = require('@/lib/jam/client/JamClientManager');
            const jamManager = JamClientManager.getInstance();
            const activeJam = jamManager.getActiveSession();
            if (activeJam) {
              if (activeJam.state !== 'PLAYING') {
                return;
              }
              const jamState = jamManager.getParticipantState();
              const JAM_TRANSIENT_STATES = new Set([
                'JOINING', 'JOIN_REQUESTED', 'AUTHORIZED', 'SNAPSHOT_RECEIVED',
                'CLOCK_SYNCING', 'PREPARING', 'SCHEDULED', 'RECONNECTING',
              ]);
              if (JAM_TRANSIENT_STATES.has(jamState)) {
                console.log(`[WATCHDOG_SKIPPED] reason=JAM_LIFECYCLE_STATE state=${jamState} trackId=${active.dataset?.trackId || 'unknown'}`);
                return;
              }
            }
          } catch {
            // If JamClientManager is not available, proceed with normal watchdog
          }

          console.warn('[PlaybackService Watchdog] Active audio paused unexpectedly while isPlaying=true. Recovering play()...');
          active.play().catch((err) => {
            console.warn('[PlaybackService Watchdog] Auto-resume recovery failed:', err);
          });
        }
      }
    }, 3000);
  }


  public primeAudioElements() {
    // Zero automatic play calls on initialization to prevent unwanted autoplay
    this.isInitializing = false;
  }

  public getActiveAudio(): HTMLAudioElement | null {
    return this.activeTag === 'A' ? this.audioA : this.audioB;
  }

  public getStandbyAudio(): HTMLAudioElement | null {
    return this.activeTag === 'A' ? this.audioB : this.audioA;
  }

  private bufferingCount = 0;

  public getBufferingCount(): number {
    return this.bufferingCount;
  }

  public getBufferDiagnostics() {
    const active = this.getActiveAudio();
    if (!active) {
      return {
        bufferedAheadMs: 0,
        readyState: 0,
        paused: true,
        networkState: 0,
        error: null,
      };
    }

    const curTime = typeof active.currentTime === 'number' ? active.currentTime : 0;
    const buffered = active.buffered;
    let bufferedEnd = curTime;
    if (buffered) {
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) <= curTime && curTime <= buffered.end(i)) {
          bufferedEnd = buffered.end(i);
          break;
        }
      }
    }

    const bufferedAheadSec = Math.max(0, bufferedEnd - curTime);
    return {
      bufferedAheadMs: Math.round(bufferedAheadSec * 1000),
      readyState: active.readyState,
      paused: active.paused,
      networkState: active.networkState,
      error: active.error ? (active.error.message || `MediaError ${active.error.code}`) : null,
    };
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
      add('waiting', () => { this.bufferingCount++; });
      add('stalled', () => { this.bufferingCount++; });
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
    
    const store = usePlayerStore.getState();

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

    const store = usePlayerStore.getState();

    const isActuallyOffline =
      store.networkMode === 'offline' ||
      store.networkMode === 'offline_forced';

    try {
      // ── OFFLINE PATH: hand song IDs to Android OfflineQueueResolver ────────
      // No URL resolution attempted here. Android looks up Room DB directly,
      // verifies each file exists, and builds the ExoPlayer queue natively.
      // This is restart-safe: does not depend on downloadedSongIds being in memory.
      if (isActuallyOffline) {
        const songIds = songs.map(s => s.id).filter(Boolean);
        if (songIds.length === 0) return;

        console.log(`[PlaybackService] loadQueueContext OFFLINE: delegating ${songIds.length} songIds to setOfflineQueue (startIndex=${startIndex})`);
        const plugin = (window as any)?.Capacitor?.Plugins?.RaagaXPlayer;
        if (plugin) {
          await plugin.setOfflineQueue({ songIds, startIndex, autoPlay });
        }
        return;
      }

      // ── ONLINE PATH: resolve network URLs and call setQueue ─────────────────
      // Lazy resolution: only resolve starting track, use placeholders for the rest
      const resolvedTracks = await Promise.all(
        songs.map(async (song, index) => {
          let finalSrc = '';
          if (index === startIndex) {
            try {
              const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
              if (source?.url) finalSrc = source.url;
            } catch {}
            if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
              finalSrc = song.audioUrl;
            }
          } else {
            // Check cache first to avoid network requests
            const cached = PlayableUrlCache.getInstance().get(song.id);
            if (cached && cached.url) {
              finalSrc = cached.url;
            } else {
              // Lazy placeholder URL
              finalSrc = `lazy://${song.id}`;
            }
          }
          return {
            trackId:    song.id,
            url:        finalSrc,
            title:      song.title ?? 'Unknown Title',
            artist:     song.artist ?? 'Unknown Artist',
            artworkUrl: song.coverUrl ?? '',
            loudness:   (song as any).loudness ?? null,
          };
        })
      );

      if (requestId !== undefined && requestId !== this.playbackRequestId) {
        console.log(`[PlaybackService] loadQueueContext cancelled: stale requestId #${requestId} (current #${this.playbackRequestId})`);
        return;
      }

      const startingSongId = songs[startIndex]?.id;
      const validTracks: any[] = [];
      let newStartIndex = 0;

      for (let i = 0; i < resolvedTracks.length; i++) {
        const t = resolvedTracks[i];
        if (t.url) {
          if (songs[i]?.id === startingSongId) {
            newStartIndex = validTracks.length;
          }
          validTracks.push(t);
        }
      }

      if (validTracks.length === 0) return;

      // setQueue() hands ExoPlayer the entire playlist with the correct start index and position.
      // ExoPlayer then owns all transitions — no WebView involvement needed.
      await RaagaXNativePlayer.setQueue(validTracks, newStartIndex, autoPlay, startPositionMs, requestId);
      console.log(`[PlaybackService] loadQueueContext: setQueue(${validTracks.length} tracks, startIndex=${newStartIndex} (original=${startIndex}), startPos=${startPositionMs}ms, autoPlay=${autoPlay}, reqId=${requestId}) — ExoPlayer owns all transitions`);
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
        activeAudio.pause();
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
          a.removeAttribute('src');
          a.currentTime = 0;
          if (typeof a.load === 'function') {
            a.load();
          }
        } catch {}
      }
    });
    if (RaagaXNativePlayer.isNative()) {
      try {
        RaagaXNativePlayer.pause();
      } catch {}
    }
    PreloadManager.getInstance().reset();
    if (this.audioA && this.audioB) {
      TransitionManager.getInstance().cancelTransition(this.audioA, this.audioB);
    }
  }

  /**
   * Atomic Hard Reset of Audio Pipeline:
   * Instantly kills previous song sound in 0ms, removes src attribute to flush
   * memory buffer and aborts in-flight network downloads.
   */
  public hardResetAudioPipeline() {
    this.stopAllAudio();
  }

  /**
   * loadAudioSource — Atomically loads and starts audio for a requested track.
   * Uses requestId stale-check to guarantee older async loads NEVER overwrite newer requests.
   */
  public async loadAudioSource(song: Song, requestId: number, autoPlay: boolean = true, initialPositionSec: number = 0): Promise<boolean> {
    if (!song) return false;
    if (requestId !== this.playbackRequestId) return false;

    // CONNECT SAFETY: Do NOT load or play local audio on a remote controller device
    try {
      const { ConnectClientManager } = require('@/lib/connect/ConnectClientManager');
      if (ConnectClientManager.getInstance().isRemoteMode()) {
        return false;
      }
    } catch {}

    const store = usePlayerStore.getState();
    this.isTransitioning = true;
    const playRequestedAt = performance.now();
    let resolvedSourceType: PlaybackSourceType = 'NETWORK_STREAM';

    try {
      // 1. Stop all previous audio sources immediately
      this.stopAllAudio();
      if (requestId !== this.playbackRequestId) return false;

      // ── OFFLINE GUARD ─────────────────────────────────────────────────────────
      // When offline on native Android: delegate directly to setOfflineQueue([songId]).
      // This bypasses all URL resolution and uses Room DB + file verification natively.
      // No dependency on downloadedSongIds being in memory — restart-safe.
      const isActuallyOffline =
        store.networkMode === 'offline' ||
        store.networkMode === 'offline_forced';

      if (isActuallyOffline && RaagaXNativePlayer.isNative()) {
        console.log(`[PlaybackService] Offline single-track play: delegating "${song.title}" (${song.id}) to setOfflineQueue`);
        const plugin = (window as any)?.Capacitor?.Plugins?.RaagaXPlayer;
        if (plugin) {
          await plugin.setOfflineQueue({ songIds: [song.id], startIndex: 0, autoPlay });
        }
        this.isTransitioning = false;
        return true;
      }

      if (isActuallyOffline && !RaagaXNativePlayer.isNative()) {
        // Web/PWA offline guard: check local blob storage
        const downloadStore = useDownloadStore.getState();
        const isDownloaded =
          store.downloadedSongIds.includes(song.id) ||
          !!downloadStore.nativeDownloadedTracks[song.id];
        if (!isDownloaded) {
          console.warn(`[PlaybackService] Offline guard: "${song.title}" not available — Offline Mode is on. Download first.`);
          store.setToastMessage(`"${song.title}" isn't available offline. Turn off Offline Mode or download it first.`);
          store.setIsPlaying(false);
          this.isTransitioning = false;
          return false;
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      // 2. Native Android ExoPlayer Path (online)

      if (RaagaXNativePlayer.isNative()) {
        let finalSrc = '';
        try {
          const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
          if (source?.url) {
            finalSrc = source.url;
            resolvedSourceType = source.type === 'offline' ? 'LOCAL_DOWNLOAD' : 'NETWORK_STREAM';
            // Update native player queue URL just-in-time
            await RaagaXNativePlayer.updateQueueUrl(song.id, finalSrc);
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

        await RaagaXNativePlayer.play({
          trackId: song.id,
          url: finalSrc,
          title: song.title ?? 'Unknown Title',
          artist: song.artist ?? 'Unknown Artist',
          artworkUrl: song.coverUrl ?? '',
          loudness: (song as any).loudness ?? null,
        }, requestId);

        if (initialPositionSec > 0) {
          await RaagaXNativePlayer.seekTo(Math.round(initialPositionSec * 1000));
        }

        if (!autoPlay) {
          await RaagaXNativePlayer.pause();
        }

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
      let finalSrc = '';
      let isCachedSource = false;
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();

      // Fast-path: If track already contains direct CDN stream URL, use it immediately (0ms round-trip latency)
      const hasDirectCdnUrl = Boolean(
        song.audioUrl &&
        (song.audioUrl.startsWith('https://') || song.audioUrl.startsWith('http://')) &&
        !song.audioUrl.includes('pixabay.com') &&
        (!isNative || (!song.audioUrl.includes('media3_cache') && !song.audioUrl.startsWith('media3://') && !song.audioUrl.startsWith('file://')))
      );

      if (hasDirectCdnUrl && song.audioUrl) {
        finalSrc = song.audioUrl.replace(/^http:\/\//, 'https://');
        resolvedSourceType = 'NETWORK_STREAM';
        isCachedSource = false;
      } else {
        try {
          resolvedSource = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
        } catch (e) {
          console.warn('[PlaybackService] Source resolution failed:', e);
        }

        if (requestId !== this.playbackRequestId) {
          console.log(`[PlaybackService] Discarding stale source resolution for req #${requestId} (current #${this.playbackRequestId})`);
          return false;
        }

        isCachedSource = Boolean(resolvedSource?.isCached || (resolvedSource?.type !== 'offline' && PlayableUrlCache.getInstance().get(song.id)));
        if (resolvedSource?.type === 'offline') {
          resolvedSourceType = 'LOCAL_DOWNLOAD';
        } else if (isCachedSource) {
          resolvedSourceType = 'URL_CACHE_HIT';
        }

        const isInvalidWebScheme = !isNative && (
          Boolean(resolvedSource?.url && (resolvedSource.url.includes('media3_cache') || resolvedSource.url.startsWith('media3://') || resolvedSource.url.startsWith('file://')))
        );

        if (resolvedSource?.url && !isInvalidWebScheme) {
          finalSrc = resolvedSource.url;
        } else if (song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
          const isSongInvalidWeb = !isNative && (song.audioUrl.includes('media3_cache') || song.audioUrl.startsWith('media3://') || song.audioUrl.startsWith('file://'));
          if (!isSongInvalidWeb) {
            finalSrc = song.audioUrl.replace(/^http:\/\//, 'https://');
          }
        }
      }

      console.log(`[PLAYBACK_SOURCE_ATTEMPT] trackId=${song.id} sourceType=${resolvedSourceType} isFastPath=${hasDirectCdnUrl}`);

      if (!finalSrc) {
        if (isTest || typeof window === 'undefined') {
          return true;
        }
        console.error(`[PlaybackService] No playable audio URL for "${song.title}"`);
        return false;
      }

      if (requestId !== this.playbackRequestId) return false;

      this.activeCandidates = resolvedSource?.candidates && resolvedSource.candidates.length > 0 ? resolvedSource.candidates : [finalSrc];
      this.activeCandidateIndex = 0;

      // Reset currentTime to initialPositionSec (or 0) and load new audio URL
      try {
        if (typeof activeAudio.pause === 'function') activeAudio.pause();
        activeAudio.currentTime = initialPositionSec > 0 ? initialPositionSec : 0;
      } catch {}

      activeAudio.preload = 'auto';
      activeAudio.src = finalSrc;
      try {
        if (typeof activeAudio.load === 'function') activeAudio.load();
      } catch {}

      if (initialPositionSec > 0) {
        let seekApplied = false;
        const applyInitialSeek = () => {
          if (seekApplied) return;
          seekApplied = true;
          try {
            activeAudio.currentTime = initialPositionSec;
          } catch {}
        };
        if (typeof activeAudio.readyState === 'number' && activeAudio.readyState >= 1) {
          applyInitialSeek();
        } else if (typeof activeAudio.addEventListener === 'function') {
          activeAudio.addEventListener('loadeddata', applyInitialSeek, { once: true });
          activeAudio.addEventListener('loadedmetadata', applyInitialSeek, { once: true });
          activeAudio.addEventListener('canplay', applyInitialSeek, { once: true });
        } else {
          applyInitialSeek();
        }
      }

      if (!activeAudio.dataset) {
        (activeAudio as any).dataset = {};
      }

      activeAudio.dataset.playbackRequestId = String(requestId);
      activeAudio.dataset.playbackGeneration = String(requestId);
      activeAudio.dataset.trackId = song.id;
      activeAudio.dataset.isCached = isCachedSource ? 'true' : 'false';

      PlaybackEngine.getInstance().attachMediaElement(activeAudio);
      RendererManager.getInstance().registerRenderer('audio', activeAudio);

      let volumeMultiplier = 1.0;
      if (store.loudnessNormalizationEnabled && song && (song as any).loudness !== undefined && (song as any).loudness !== null) {
        const targetLoudness = -14.0;
        const dbGain = targetLoudness - (song as any).loudness;
        const clampedDbGain = Math.min(6.0, dbGain); // Limit boost to +6dB
        volumeMultiplier = Math.pow(10, clampedDbGain / 20);
      }
      activeAudio.volume = Math.max(0, Math.min(1, (store.isMuted ? 0 : store.volume) * volumeMultiplier));

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
          this.emitPlaybackReady(song.id, activeAudio.duration || song.duration || 0, requestId);
          this.emitPlaybackStarted(song.id, activeAudio.currentTime, requestId);

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

          // ── DIRECT CANONICAL FALLBACK ON CACHE/SOURCE REJECTION ───────────
          // If browser rejects the cached/preloaded source (e.g. ERR_CACHE_OPERATION_NOT_SUPPORTED, NotSupportedError),
          // immediately bypass cache, invalidate broken cache entry, resolve direct canonical URL, and play.
          if (isCachedSource || e?.name === 'NotSupportedError' || e?.message?.includes('supported source') || e?.message?.includes('CACHE')) {
            console.log(`[PLAYBACK_CACHE_FAILED] trackId=${song.id} error=${e?.message || e?.name || e}`);
            PlayableUrlCache.getInstance().invalidate(song.id);
            PreloadManager.getInstance().reset();

            try {
              const directSource = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song, { bypassCache: true });
              if (directSource?.url && requestId === this.playbackRequestId) {
                console.log(`[PLAYBACK_DIRECT_FALLBACK] trackId=${song.id} url=${directSource.url}`);
                this.activeCandidates = directSource.candidates && directSource.candidates.length > 0 ? directSource.candidates : [directSource.url];
                this.activeCandidateIndex = 0;

                activeAudio.pause();
                activeAudio.currentTime = 0;
                activeAudio.src = directSource.url;
                activeAudio.load();
                activeAudio.dataset.playbackRequestId = String(requestId);
                activeAudio.dataset.playbackGeneration = String(requestId);
                activeAudio.dataset.trackId = song.id;
                activeAudio.dataset.isCached = 'false';

                await activeAudio.play();
                if (requestId !== this.playbackRequestId) {
                  activeAudio.pause();
                  return false;
                }

                console.log(`[PLAYBACK_CACHE_FALLBACK_SUCCESS] trackId=${song.id}`);
                this.emitPlaybackReady(song.id, activeAudio.duration || song.duration || 0, requestId);
                this.emitPlaybackStarted(song.id, activeAudio.currentTime, requestId);

                const timeToFirstAudioMs = Math.round(performance.now() - playRequestedAt);
                PlaybackTelemetry.getInstance().recordMetric({
                  sessionId: String(requestId),
                  trackId: song.id,
                  sourceType: 'NETWORK_STREAM',
                  timeToFirstAudioMs,
                  success: true,
                });

                AudioFocusManager.getInstance().requestFocus();
                return true;
              }
            } catch (fallbackErr) {
              console.warn('[PlaybackService] Direct canonical fallback failed:', fallbackErr);
            }
          }

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
      const store = usePlayerStore.getState();
      if (isNaturalEnd || store.isPlaying || store.playbackIntent === 'PLAYING') {
        usePlayerStore.setState({ isPlaying: true, playbackIntent: 'PLAYING' });
      }
      // AUTO_NEXT SINGLE OWNER (Phase 6):
      // Pass isNaturalEnd=true so usePlayerStore.playNext knows this is an automatic
      // end-of-track advance (not a user gesture). In Jam mode, only the host may
      // send SKIP_NEXT for auto-next; participants wait for TRACK_CHANGED from server.
      await usePlayerStore.getState().playNext(isNaturalEnd);
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
    // CONNECT SAFETY: Do NOT play local audio if this device is acting as a remote controller
    try {
      const { ConnectClientManager } = require('@/lib/connect/ConnectClientManager');
      if (ConnectClientManager.getInstance().isRemoteMode()) {
        return;
      }
    } catch {}

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
            WakeLockManager.getInstance().acquireWakeLock();
          }).catch((err) => {
            if (err?.name === 'NotAllowedError') {
              console.warn('[PlaybackService] Autoplay blocked by browser policy. Attaching user gesture unlocker.');
              const unlock = () => {
                window.removeEventListener('pointerdown', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
                active.play().catch(() => {});
              };
              window.addEventListener('pointerdown', unlock, { once: true });
              window.addEventListener('keydown', unlock, { once: true });
              window.addEventListener('touchstart', unlock, { once: true });
            } else if (err?.name !== 'AbortError') {
              console.warn('[PlaybackService] play() error:', err);
            }
          });
        } else {
          this.notifyStorePlaying(true);
          WakeLockManager.getInstance().acquireWakeLock();
        }
      } else {
        this.notifyStorePlaying(true);
        WakeLockManager.getInstance().acquireWakeLock();
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
      WakeLockManager.getInstance().releaseWakeLock();
      return;
    }

    this.pauseAudioElementOnly();

    const store = usePlayerStore.getState();
    store.setIsPlaying(false, true);
    MediaSessionManager.getInstance().setPlaybackState('paused');
    AudioFocusManager.getInstance().releaseFocus();
    WakeLockManager.getInstance().releaseWakeLock();
  }

  public async resume(): Promise<boolean> {
    WakeLockManager.getInstance().acquireWakeLock();
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.resume();
      const store = usePlayerStore.getState();
      store.setIsPlaying(true, true);
      return true;
    }

    const store = usePlayerStore.getState();

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
    if (RaagaXNativePlayer.isNative()) return;
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    if (!active) return;

    const store = usePlayerStore.getState();

    if (!isNaN(active.duration) && Number.isFinite(active.duration) && active.duration > 0) {
      store.setDuration(active.duration);
      if (active.dataset.trackId) {
        const gen = parseInt(active.dataset.playbackGeneration || '0', 10);
        this.emitPlaybackReady(active.dataset.trackId, active.duration, gen);
      }
      MediaSessionManager.getInstance().setPositionState({
        duration: active.duration,
        position: active.currentTime || 0
      });
    }
  }

  private handleNativePlayState(tag: 'A' | 'B', isPlaying: boolean) {
    if (RaagaXNativePlayer.isNative()) return;
    if (tag !== this.activeTag) return;

    const store = usePlayerStore.getState();

    // Ignore synthetic silence priming pauses
    if (this.isInitializing) {
      return;
    }

    const active = this.getActiveAudio();
    const livePlaying = active ? !active.paused && !active.ended : isPlaying;

    if (livePlaying && active?.dataset.trackId) {
      const gen = parseInt(active.dataset.playbackGeneration || '0', 10);
      this.emitPlaybackStarted(active.dataset.trackId, active.currentTime || 0, gen);
    }

    // Guard: Ignore browser pause events during active track transitions/loading
    if (this.isTransitioning && !livePlaying) {
      console.log(`[PlaybackService] Guarded handleNativePlayState pause event during active track transition for tag ${tag}`);
      return;
    }

    if (store.isPlaying !== livePlaying) {
      store.setIsPlaying(livePlaying, true);
    }

  }

  private handleNativeEnded(tag: 'A' | 'B') {
    if (RaagaXNativePlayer.isNative()) return;
    if (tag !== this.activeTag) return;

    const active = this.getActiveAudio();
    if (!active) return;

    const generation = Number(active.dataset.playbackRequestId || active.dataset.playbackGeneration || 0);
    const endedTrackId = active.dataset.trackId;
    const store = usePlayerStore.getState();
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

    console.log(`[PLAYBACK_ENDED] trackId=${endedTrackId} generation=${generation} tag=${tag}`);
    console.log(`[PlaybackService] Track ended naturally on audio ${tag} (gen ${generation}). Advancing queue...`);
    // Pass isNaturalEnd=true so Jam-aware playNext suppresses auto-next for non-host participants
    this.playNextTrack(true);
  }

  private handleNativeTimeUpdate(tag: 'A' | 'B') {
    if (RaagaXNativePlayer.isNative()) return;
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    const standby = this.getStandbyAudio();
    if (!active || !standby) return;

    const store = usePlayerStore.getState();

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
    if (RaagaXNativePlayer.isNative()) return;
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    if (!active) return;

    const currentReq = Number(active.dataset.playbackRequestId || active.dataset.playbackGeneration || 0);
    if (currentReq > 0 && currentReq !== this.playbackRequestId) {
      console.log(`[PlaybackService] Ignoring stale audio error (req ${currentReq} vs current ${this.playbackRequestId})`);
      return;
    }

    console.warn(`[PLAYBACK PIPELINE] Audio stream error on audio ${tag}:`, e);

    const store = usePlayerStore.getState();

    const currentSong = store.currentSong;
    const shouldResume = store.isPlaying && store.playbackIntent === 'PLAYING';

    // Check if error occurred on a cached / preloaded source
    const isCached = active.dataset.isCached === 'true' || Boolean(currentSong && PlayableUrlCache.getInstance().get(currentSong.id));
    if (isCached && currentSong) {
      console.log(`[PLAYBACK_CACHE_FAILED] trackId=${currentSong.id} error=AudioElementError`);
      PlayableUrlCache.getInstance().invalidate(currentSong.id);
      PreloadManager.getInstance().reset();

      try {
        const directSource = await PlaybackSourceResolver.getInstance().resolvePlayableSource(currentSong, { bypassCache: true });
        if (directSource?.url && (currentReq === this.playbackRequestId || this.playbackRequestId === 0)) {
          console.log(`[PLAYBACK_DIRECT_FALLBACK] trackId=${currentSong.id} url=${directSource.url}`);
          this.activeCandidates = directSource.candidates && directSource.candidates.length > 0 ? directSource.candidates : [directSource.url];
          this.activeCandidateIndex = 0;

          active.dataset.isCached = 'false';
          active.src = directSource.url;
          active.load();
          if (shouldResume) {
            await active.play();
            console.log(`[PLAYBACK_CACHE_FALLBACK_SUCCESS] trackId=${currentSong.id}`);
            this.emitPlaybackReady(currentSong.id, active.duration || currentSong.duration || 0, currentReq);
            this.emitPlaybackStarted(currentSong.id, active.currentTime, currentReq);
          }
          return;
        }
      } catch (err) {
        console.warn('[PlaybackService] Direct fallback on audio error failed:', err);
      }
    }

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
      const store = usePlayerStore.getState();
      const isOffline = store.networkMode === 'offline' || store.networkMode === 'offline_forced' || (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (isOffline) {
        console.log('[PlaybackService] Offline mode active: skipping native batch preload to preserve single local MediaItem playback');
        return;
      }

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
        let finalSrc = '';
        try {
          const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
          if (source?.url) {
            finalSrc = source.url;
          }
        } catch {}
        if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
          if (typeof navigator === 'undefined' || navigator.onLine !== false) {
            finalSrc = song.audioUrl;
          }
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
