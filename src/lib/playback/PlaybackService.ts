import { PlaybackEngine } from './PlaybackEngine';
import { MediaSessionManager } from './MediaSessionManager';
import { InterruptionCoordinator } from './InterruptionCoordinator';
import { TransitionManager } from './TransitionManager';
import { PreloadManager } from './PreloadManager';
import { AudioFocusManager } from './AudioFocusManager';
import { RendererManager } from './RendererManager';
import { QueueManager } from '../queue/QueueManager';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { Song } from '@/types/music';

const FALLBACK_AUDIO_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';

export class PlaybackService {
  private static instance: PlaybackService;

  private audioA: HTMLAudioElement | null = null;
  private audioB: HTMLAudioElement | null = null;
  private activeTag: 'A' | 'B' = 'A';

  private isInitializing = false;
  private isTransitioning = false;
  private lastPositionReportTime = 0;

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
  }

  public primeAudioElements() {
    [this.audioA, this.audioB].forEach((audio) => {
      if (!audio) return;
      if (!audio.src) {
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audio.play().then(() => audio.pause()).catch(() => {});
      }
    });
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

  public async playTrack(song: Song, forceResume: boolean = true): Promise<boolean> {
    if (!song) return false;

    const activeAudio = this.getActiveAudio();
    const standbyAudio = this.getStandbyAudio();
    if (!activeAudio) return false;

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    if (!store.isActiveDevice) return false;

    // Check if standby audio is already preloaded with this song
    const preloader = PreloadManager.getInstance();
    const preloadedId = preloader.getPreloadedTrackId();
    const isPreloadedInStandby = !!(standbyAudio && standbyAudio.src && (preloadedId === song.id || (song.audioUrl && standbyAudio.src.includes(song.audioUrl))));

    let targetAudio = activeAudio;

    if (isPreloadedInStandby && standbyAudio) {
      // Swap to standby audio element seamlessly
      targetAudio = standbyAudio;
      this.activeTag = this.activeTag === 'A' ? 'B' : 'A';
      
      // Pause former active audio
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } else {
      // Resolve source for active audio only if audioUrl is missing or fallback
      let finalSrc = song.audioUrl || '';
      if (!finalSrc || finalSrc.includes('pixabay.com')) {
        try {
          const source = await PlaybackSourceResolver.getInstance().resolvePlayableSource(song);
          if (source && source.type === 'remote' && source.url) {
            finalSrc = source.url;
          }
        } catch (e) {
          console.warn('[PlaybackService] Source resolution failed, using fallback:', e);
        }
      }
      if (!finalSrc) {
        finalSrc = FALLBACK_AUDIO_URL;
      }

      if (targetAudio.src !== finalSrc) {
        targetAudio.src = finalSrc;
        targetAudio.load();
      }
    }

    PlaybackEngine.getInstance().attachMediaElement(targetAudio);
    RendererManager.getInstance().registerRenderer('audio', targetAudio);

    // Update MediaSession Metadata
    this.updateMediaSessionMetadata(song);

    targetAudio.volume = store.isMuted ? 0 : store.volume;

    if (forceResume) {
      try {
        await targetAudio.play();
        store.setIsPlaying(true);
        AudioFocusManager.getInstance().requestFocus();
        
        // Proactively preload the NEXT track in standby element
        this.triggerNextPreload();
        return true;
      } catch (e) {
        console.warn('[PlaybackService] Play failed:', e);
        // Retry play once after brief delay
        try {
          await new Promise(r => setTimeout(r, 250));
          await targetAudio.play();
          store.setIsPlaying(true);
          this.triggerNextPreload();
          return true;
        } catch (retryErr) {
          console.error('[PlaybackService] Play retry failed for song:', song.title, retryErr);
          // Skip broken/unplayable track and continue queue playback
          this.playNextTrack();
          return false;
        }
      }
    }

    return true;
  }

  public async playNextTrack(): Promise<boolean> {
    if (this.isTransitioning) return false;
    this.isTransitioning = true;

    try {
      const nextItem = QueueManager.getInstance().getNext();
      if (nextItem && nextItem.song) {
        const store = require('@/context/usePlayerStore').usePlayerStore.getState();
        store.setCurrentTime(0);
        const success = await this.playTrack(nextItem.song, true);
        return success;
      } else {
        const store = require('@/context/usePlayerStore').usePlayerStore.getState();
        store.setIsPlaying(false);
        MediaSessionManager.getInstance().setPlaybackState('paused');
        return false;
      }
    } finally {
      this.isTransitioning = false;
    }
  }

  public async playPrevTrack(): Promise<boolean> {
    if (this.isTransitioning) return false;
    this.isTransitioning = true;

    try {
      const prevItem = QueueManager.getInstance().getPrevious();
      if (prevItem && prevItem.song) {
        const store = require('@/context/usePlayerStore').usePlayerStore.getState();
        store.setCurrentTime(0);
        const success = await this.playTrack(prevItem.song, true);
        return success;
      }
      return false;
    } finally {
      this.isTransitioning = false;
    }
  }

  public play() {
    const active = this.getActiveAudio();
    if (active) {
      active.play().then(() => {
        const store = require('@/context/usePlayerStore').usePlayerStore.getState();
        store.setIsPlaying(true);
        MediaSessionManager.getInstance().setPlaybackState('playing');
        AudioFocusManager.getInstance().requestFocus();
      }).catch(console.warn);
    }
  }

  public pause() {
    const active = this.getActiveAudio();
    if (active) {
      active.pause();
      const store = require('@/context/usePlayerStore').usePlayerStore.getState();
      store.setIsPlaying(false, true);
      MediaSessionManager.getInstance().setPlaybackState('paused');
      AudioFocusManager.getInstance().releaseFocus();
    }
  }

  public seek(timeSeconds: number) {
    const active = this.getActiveAudio();
    if (active) {
      active.currentTime = timeSeconds;
      PlaybackEngine.getInstance().anchor();
      const store = require('@/context/usePlayerStore').usePlayerStore.getState();
      store.setCurrentTime(timeSeconds);
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
    }
  }

  private handleNativePlayState(tag: 'A' | 'B', isPlaying: boolean) {
    if (tag !== this.activeTag) return;
    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
    if (store.isActiveDevice && store.isPlaying !== isPlaying) {
      store.setIsPlaying(isPlaying, true);
    }
  }

  private handleNativeEnded(tag: 'A' | 'B') {
    if (tag !== this.activeTag) return;

    // Check if crossfade/gapless is actively committing
    if (TransitionManager.getInstance().getState() !== 'IDLE') return;

    console.log(`[PlaybackService] Active track ended naturally on audio ${tag}. Triggering next track...`);
    this.playNextTrack();
  }

  private handleNativeTimeUpdate(tag: 'A' | 'B') {
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    const standby = this.getStandbyAudio();
    if (!active || !standby) return;

    const store = require('@/context/usePlayerStore').usePlayerStore.getState();
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

    // Boundary check for Crossfade / Gapless
    TransitionManager.getInstance().checkBoundary(active, standby, () => {
      this.activeTag = this.activeTag === 'A' ? 'B' : 'A';
      this.playNextTrack();
    });

    // Report Position State to MediaSession lockscreen every 2s
    const now = Date.now();
    if (now - this.lastPositionReportTime > 2000) {
      this.lastPositionReportTime = now;
      if (!isNaN(active.duration) && active.duration > 0) {
        MediaSessionManager.getInstance().setPositionState({
          duration: active.duration,
          position: active.currentTime
        });
      }
    }
  }

  private async handleNativeError(tag: 'A' | 'B', e: Event) {
    if (tag !== this.activeTag) return;
    const active = this.getActiveAudio();
    if (!active) return;

    console.warn(`[PlaybackService] Audio stream error on audio ${tag}:`, e);

    if (active.src === FALLBACK_AUDIO_URL) {
      const store = require('@/context/usePlayerStore').usePlayerStore.getState();
      store.setIsPlaying(false);
      return;
    }

    // Try bitrates / resolution fallback
    try {
      if (active.src.includes('320')) {
        active.src = active.src.replace('320', '160');
        active.play().catch(() => {});
        return;
      }
      if (active.src.includes('160')) {
        active.src = active.src.replace('160', '96');
        active.play().catch(() => {});
        return;
      }
    } catch {}

    // Fallback URL
    active.src = FALLBACK_AUDIO_URL;
    active.play().catch(() => {
      const store = require('@/context/usePlayerStore').usePlayerStore.getState();
      store.setIsPlaying(false);
    });
  }

  private triggerNextPreload() {
    const standby = this.getStandbyAudio();
    if (!standby) return;

    const nextItem = QueueManager.getInstance().peekNext();
    if (nextItem && nextItem.song) {
      PreloadManager.getInstance().preloadTrack(nextItem.song, standby);
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
