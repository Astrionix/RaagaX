import { PlaybackEngine } from './PlaybackEngine';
import { MediaSessionManager } from './MediaSessionManager';
import { InterruptionCoordinator } from './InterruptionCoordinator';
import { TransitionManager } from './TransitionManager';
import { PreloadManager } from './PreloadManager';
import { AudioFocusManager } from './AudioFocusManager';
import { RendererManager } from './RendererManager';
import { QueueManager } from '../queue/QueueManager';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { RaagaXNativePlayer } from './native/RaagaXNativePlayer';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/context/usePlayerStore';

const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

export class PlaybackService {
  private static instance: PlaybackService;

  private audioA: HTMLAudioElement | null = null;
  private audioB: HTMLAudioElement | null = null;
  private activeTag: 'A' | 'B' = 'A';

  private isInitializing = false;
  private isTransitioning = false;
  private lastPositionReportTime = 0;
  private playbackGeneration = 0;
  private lastEndedGeneration = -1;

  private constructor() {}

  public static getInstance(): PlaybackService {
    if (!PlaybackService.instance) {
      PlaybackService.instance = new PlaybackService();
    }
    return PlaybackService.instance;
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
    this.startWatchdog();
  }

  private watchdogInterval: any = null;

  public startWatchdog() {
    if (typeof window === 'undefined' || this.watchdogInterval) return;
    this.watchdogInterval = setInterval(() => {
      const active = this.getActiveAudio();
      if (!active) return;
      const store = usePlayerStore.getState();
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
  public async loadQueueContext(songs: Song[], startIndex: number, autoPlay: boolean = true, startPositionMs: number = 0): Promise<void> {
    if (!RaagaXNativePlayer.isNative()) return;
    if (!songs || songs.length === 0) return;

    try {
      // Resolve ALL songs in parallel (including the starting song)
      const resolvedTracks = await Promise.all(
        songs.map(async (song) => {
          let finalSrc = '';
          try {
            const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
            if (source?.url) finalSrc = source.url;
          } catch {}
          if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
            finalSrc = song.audioUrl;
          }
          return {
            url: finalSrc || FALLBACK_AUDIO_URL,
            title: song.title ?? 'Unknown Title',
            artist: song.artist ?? 'Unknown Artist',
            artworkUrl: song.coverUrl ?? '',
          };
        })
      );

      const validTracks = resolvedTracks.filter(t => !!t.url);
      if (validTracks.length === 0) return;

      // setQueue() hands ExoPlayer the entire playlist with the correct start index and position.
      // ExoPlayer then owns all transitions — no WebView involvement needed.
      await RaagaXNativePlayer.setQueue(validTracks, startIndex, autoPlay, startPositionMs);
      console.log(`[PlaybackService] loadQueueContext: setQueue(${validTracks.length} tracks, startIndex=${startIndex}, startPos=${startPositionMs}ms, autoPlay=${autoPlay}) — ExoPlayer owns all transitions`);
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
      if (!finalSrc) finalSrc = FALLBACK_AUDIO_URL;

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

  public async playTrack(song: Song, forceResume: boolean = true): Promise<boolean> {
    if (!song) return false;
    this.isTransitioning = true;

    try {
      // ── Native Android Path: single-song fallback only ───────────────────────
      if (RaagaXNativePlayer.isNative()) {
        let finalSrc = '';
        try {
          const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
          if (source?.url) {
            finalSrc = source.url;
          }
        } catch (e) {
          console.warn('[PlaybackService] Native source resolution failed:', e);
        }
        if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
          finalSrc = song.audioUrl;
        }
        if (!finalSrc) finalSrc = FALLBACK_AUDIO_URL;

        const store = require('@/context/usePlayerStore').usePlayerStore.getState();
        store.setIsPlaying(true, true);

        await RaagaXNativePlayer.play({
          url: finalSrc,
          title: song.title ?? 'Unknown Title',
          artist: song.artist ?? 'Unknown Artist',
          artworkUrl: song.coverUrl ?? '',
        });

        // Preload upcoming tracks into native ExoPlayer queue
        this.preloadNativeNextTrack();
        return true;
      }

      const activeAudio = this.getActiveAudio();
      const standbyAudio = this.getStandbyAudio();
      if (!activeAudio) return false;

      const currentGen = ++this.playbackGeneration;

      const store = usePlayerStore.getState();
      if (!store.isActiveDevice) return false;

      // Check if standby audio is already preloaded with this song (only when crossfade/gapless is enabled)
      const preloader = PreloadManager.getInstance();
      const preloadedId = preloader.getPreloadedTrackId();
      const transitionMode = TransitionManager.getInstance().getMode();
      const isPreloadedInStandby = transitionMode !== 'NONE' && !!(standbyAudio && standbyAudio.src && (preloadedId === song.id || (song.audioUrl && standbyAudio.src.includes(song.audioUrl))));

      let targetAudio = activeAudio;

      if (isPreloadedInStandby && standbyAudio) {
        // Swap to standby audio element seamlessly
        targetAudio = standbyAudio;
        this.activeTag = this.activeTag === 'A' ? 'B' : 'A';
        
        // Pause former active audio & reset preload state
        activeAudio.pause();
        try { activeAudio.currentTime = 0; } catch {}
        preloader.reset();
      } else {
        // Stop standby audio element if running
        if (standbyAudio) {
          try {
            standbyAudio.pause();
            standbyAudio.currentTime = 0;
          } catch {}
        }

        // Always resolve playable source (offline local Blob URL vs dynamic CDN stream)
        let finalSrc = '';
        let resolvedSource: any = null;
        try {
          resolvedSource = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
          if (this.playbackGeneration !== currentGen) {
            console.warn(`[PlaybackService] Discarding stale source resolution for gen ${currentGen} (current ${this.playbackGeneration})`);
            return false;
          }
          if (resolvedSource?.url) {
            finalSrc = resolvedSource.url;
          }
        } catch (e) {
          console.warn('[PlaybackService] Source resolution failed:', e);
        }

        const isDeviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const isStoreOffline = store.networkMode === 'offline' || store.networkMode === 'offline_forced';
        const isOffline = isDeviceOffline || isStoreOffline;

        if (isOffline && (!resolvedSource || resolvedSource.type !== 'offline')) {
          console.warn(`[PlaybackService] Track "${song.title}" is unavailable offline. Skipping to next downloaded track.`);
          if (typeof store.setToastMessage === 'function') {
            store.setToastMessage(`"${song.title}" is not available offline — skipped`);
          }
          const downloadedIds = store.downloadedSongIds || [];
          const manager = QueueManager.getInstance();
          const snapshot = manager.getSnapshot();
          const nextDownloaded = snapshot.items.slice(snapshot.currentIndex + 1).find((item: any) => item.song && downloadedIds.includes(item.song.id));
          if (nextDownloaded && nextDownloaded.song) {
            return this.playTrack(nextDownloaded.song, forceResume);
          } else {
            store.setIsPlaying(false, true);
            return false;
          }
        }

        if (!finalSrc && song.audioUrl && !song.audioUrl.includes('pixabay.com')) {
          finalSrc = song.audioUrl;
        }
        if (!finalSrc) {
          finalSrc = FALLBACK_AUDIO_URL;
        }

        if (this.playbackGeneration !== currentGen) return false;

        // Force pause, reset currentTime to 00:00, and load new audio URL
        try {
          targetAudio.pause();
          targetAudio.currentTime = 0;
        } catch {}

        targetAudio.src = finalSrc;
        targetAudio.load();

        try {
          targetAudio.currentTime = 0;
        } catch {}
      }

      // Reset store position to 0 — but respect any pending seek target
      // (user may have dragged seekbar before this playTrack completed)
      const pendingSeek = usePlayerStore.getState().seekTarget;
      if (pendingSeek === null) {
        store.setCurrentTime(0, true);
      }
      // If there's a pending seek, apply it now to the audio element
      if (pendingSeek !== null) {
        try { targetAudio.currentTime = pendingSeek; } catch {}
        store.setCurrentTime(pendingSeek, true);
        usePlayerStore.setState({ seekTarget: null });
      }

      targetAudio.dataset.playbackGeneration = String(currentGen);
      targetAudio.dataset.trackId = song.id;

      PlaybackEngine.getInstance().attachMediaElement(targetAudio);
      RendererManager.getInstance().registerRenderer('audio', targetAudio);

      // Update MediaSession Metadata
      this.updateMediaSessionMetadata(song);

      targetAudio.volume = store.isMuted ? 0 : store.volume;

      if (forceResume) {
        try {
          await targetAudio.play();
          if (this.playbackGeneration !== currentGen) {
            console.warn(`[PlaybackService] Discarding stale play completion for gen ${currentGen}`);
            return false;
          }
          store.setIsPlaying(true, true);
          AudioFocusManager.getInstance().requestFocus();
          
          // Proactively preload the NEXT track in standby element
          this.triggerNextPreload();
          return true;
        } catch (e: any) {
          if (e?.name === 'AbortError' || this.playbackGeneration !== currentGen) {
            console.warn('[PlaybackService] Play request interrupted or stale:', e);
            return false;
          }
          console.warn('[PlaybackService] Play failed:', e);
          // Retry play once after brief delay
          try {
            await new Promise(r => setTimeout(r, 250));
            if (this.playbackGeneration !== currentGen) return false;
            await targetAudio.play();
            if (this.playbackGeneration !== currentGen) return false;
            store.setIsPlaying(true, true);
            this.triggerNextPreload();
            return true;
          } catch (retryErr: any) {
            if (retryErr?.name === 'AbortError' || this.playbackGeneration !== currentGen) {
              console.warn('[PlaybackService] Play retry interrupted or stale:', retryErr);
              return false;
            }
            console.error('[PlaybackService] Play retry failed for song:', song.title, retryErr);
            // Skip broken/unplayable track and continue queue playback
            this.playNextTrack(false);
            return false;
          }
        }
      }

      return true;
    } finally {
      this.isTransitioning = false;
    }
  }

  public async playNextTrack(isNaturalEnd: boolean = false): Promise<boolean> {
    if (this.isTransitioning) return false;
    this.isTransitioning = true;

    try {
      const manager = QueueManager.getInstance();
      const nextItem = manager.getNext(isNaturalEnd);
      if (nextItem && nextItem.song) {
        const snapshot = manager.getSnapshot();
        import('../../context/usePlayerStore').then(({ usePlayerStore }) => {
          usePlayerStore.getState().commitPlaybackTransition(nextItem.song, snapshot.currentIndex, snapshot.items.map((i: any) => i.song));
        }).catch(() => {});
        const success = await this.playTrack(nextItem.song, true);
        return success;
      } else {
        // Queue completed. Check autoplay policy.
        if (manager.isAutoplayEnabled()) {
          const { AdaptiveQueueController } = await import('../queue/AdaptiveQueueController');
          const autoplaySongs = await AdaptiveQueueController.getInstance().fetchAutoplayForCompletedQueue();
          if (autoplaySongs && autoplaySongs.length > 0) {
            manager.replaceQueue(autoplaySongs, 0, 'AUTOPLAY');
            const autoplayFirst = manager.getCurrentItem();
            if (autoplayFirst && autoplayFirst.song) {
              import('../../context/usePlayerStore').then(({ usePlayerStore }) => {
                usePlayerStore.getState().commitPlaybackTransition(autoplayFirst.song, 0, autoplaySongs);
              }).catch(() => {});
              return await this.playTrack(autoplayFirst.song, true);
            }
          }
        }

        import('../../context/usePlayerStore').then(({ usePlayerStore }) => {
          usePlayerStore.getState().setIsPlaying(false, true);
        }).catch(() => {});
        MediaSessionManager.getInstance().setPlaybackState('paused');
        return false;
      }
    } finally {
      this.isTransitioning = false;
    }
  }

  public async playPrevTrack(): Promise<boolean> {
    if (this.isTransitioning) return false;

    // Spotify 3-Second Rule: if track has played > 3 seconds, restart current track from 00:00
    const active = this.getActiveAudio();
    if (active && active.currentTime > 3.0) {
      this.seek(0);
      this.play();
      return true;
    }

    this.isTransitioning = true;

    try {
      const manager = QueueManager.getInstance();
      const prevItem = manager.getPrevious();
      if (prevItem && prevItem.song) {
        const store = require('@/context/usePlayerStore').usePlayerStore.getState();
        const snapshot = manager.getSnapshot();
        store.commitPlaybackTransition(prevItem.song, snapshot.currentIndex, snapshot.items.map((i: any) => i.song));
        const success = await this.playTrack(prevItem.song, true);
        return success;
      }
      return false;
    } finally {
      this.isTransitioning = false;
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

  public pause() {
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.pause();
      const store = usePlayerStore.getState();
      store.setIsPlaying(false, true);
      return;
    }

    const active = this.getActiveAudio();
    if (active) {
      if (typeof active.pause === 'function') {
        active.pause();
      }
      const store = usePlayerStore.getState();
      store.setIsPlaying(false, true);
      MediaSessionManager.getInstance().setPlaybackState('paused');
      AudioFocusManager.getInstance().releaseFocus();
    }
  }

  public seek(timeSeconds: number, fromRemote: boolean = false) {
    if (RaagaXNativePlayer.isNative()) {
      RaagaXNativePlayer.seekTo(timeSeconds * 1000);
      const store = usePlayerStore.getState();
      store.setCurrentTime(timeSeconds, fromRemote);
      return;
    }

    const active = this.getActiveAudio();
    if (active) {
      active.currentTime = timeSeconds;
      PlaybackEngine.getInstance().anchor();
      const store = usePlayerStore.getState();
      store.setCurrentTime(timeSeconds, fromRemote);
      MediaSessionManager.getInstance().setPositionState({
        duration: active.duration || store.duration || 0,
        position: timeSeconds
      });
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

    // Ignore native pause events caused by track ending, during transition/initialization, or while loading (readyState < 2)
    const active = this.getActiveAudio();
    if (!isPlaying && (this.isTransitioning || this.isInitializing || (active && (active.ended || active.readyState < 2)))) {
      return;
    }

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    if (store.isActiveDevice) {
      if (isPlaying && (!store.isPlaying || store.playbackIntent === 'PAUSED' || store.playbackIntent === 'IDLE')) {
        // Element began playing unexpectedly while store is in PAUSED / IDLE intent -> immediately suppress!
        active?.pause();
        return;
      }
      if (store.isPlaying !== isPlaying) {
        store.setIsPlaying(isPlaying, true);
      }
    }
  }

  private handleNativeEnded(tag: 'A' | 'B') {
    if (tag !== this.activeTag) return;

    const active = this.getActiveAudio();
    if (!active) return;

    const generation = Number(active.dataset.playbackGeneration || 0);
    const endedTrackId = active.dataset.trackId;
    const store = require('@/context/usePlayerStore').usePlayerStore.getState();

    // Idempotency check: ignore stale or duplicate ended events
    if (generation > 0 && generation !== this.playbackGeneration) {
      console.log(`[PlaybackService] Ignoring stale ended event (gen ${generation} vs current ${this.playbackGeneration})`);
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

    console.warn(`[PlaybackService] Audio stream error on audio ${tag}:`, e);

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    const shouldResume = store.isPlaying && store.playbackIntent === 'PLAYING';

    if (active.src === FALLBACK_AUDIO_URL) {
      store.setIsPlaying(false, true);
      return;
    }

    // Try bitrates / resolution fallback
    try {
      if (active.src.includes('320')) {
        active.src = active.src.replace('320', '160');
        if (shouldResume) active.play().catch(() => {});
        return;
      }
      if (active.src.includes('160')) {
        active.src = active.src.replace('160', '96');
        if (shouldResume) active.play().catch(() => {});
        return;
      }
    } catch {}

    // Fallback URL
    active.src = FALLBACK_AUDIO_URL;
    if (shouldResume) {
      active.play().catch(() => {
        store.setIsPlaying(false, true);
      });
    } else {
      store.setIsPlaying(false, true);
    }
  }

  private triggerNextPreload() {
    const standby = this.getStandbyAudio();
    if (!standby) return;

    const nextItem = QueueManager.getInstance().peekNext();
    if (nextItem && nextItem.song) {
      PreloadManager.getInstance().preloadTrack(nextItem.song, standby);
    }
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
        if (!finalSrc) finalSrc = FALLBACK_AUDIO_URL;

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
    const mediaSession = MediaSessionManager.getInstance();
    mediaSession.updateMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album || 'RaagaX',
      artwork: [
        { src: song.coverUrl || '', sizes: '96x96', type: 'image/jpeg' },
        { src: song.coverUrl || '', sizes: '256x256', type: 'image/jpeg' },
        { src: song.coverUrl || '', sizes: '512x512', type: 'image/jpeg' },
      ]
    });
    mediaSession.setPlaybackState('playing');
  }
}
