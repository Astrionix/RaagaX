/**
 * RaagaXPlayer — Canonical Unified Player Engine
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 * All playback controls across RaagaX (UI components, Bluetooth, MediaSession,
 * lock screen, notifications, and Connect devices) interact with this single facade.
 *
 * It decouples UI rendering from underlying audio engines (ExoPlayer vs HTMLAudio),
 * manages context & track window state, and executes versioned commands via PlayerCommandBus.
 */

import { Song } from '@/types/music';
import { PlaybackContext, QueueItem } from '../queue/types';
import { PlayerCommandBus } from './PlayerCommandBus';
import { RestrictionsEngine } from './RestrictionsEngine';
import { QueueManager } from '../queue/QueueManager';
import { PlaybackService } from './PlaybackService';
import { RaagaXNativePlayer } from './native/RaagaXNativePlayer';
import { PlayerCommandType, PlayerRestrictions, PlayerQueueWindow, AdvanceReason } from './types';
import { PlaybackSnapshot, calculateLivePositionMs } from '../connect/types';

export interface RaagaXPlayerState {
  sessionId: string;
  playbackId: string;
  deviceId: string;
  context: PlaybackContext | null;
  queueId: string;
  queueRevision: number;

  previousTracks: Song[];
  currentTrack: Song | null;
  nextTracks: Song[];

  positionMs: number;
  positionTimestamp: number;
  playbackRate: number;

  status:
    | 'IDLE'
    | 'LOADING'
    | 'PLAYING'
    | 'PAUSED'
    | 'BUFFERING'
    | 'TRANSITIONING'
    | 'ERROR'
    | 'RECOVERING';

  shuffle: boolean;
  repeat: 'OFF' | 'ONE' | 'ALL';
  restrictions: PlayerRestrictions;
}

export type RaagaXPlayerListener = (state: RaagaXPlayerState) => void;

export class RaagaXPlayer {
  private static instance: RaagaXPlayer;

  private listeners: Set<RaagaXPlayerListener> = new Set();
  private playbackId: string = crypto.randomUUID();

  private constructor() {
    // Listen for queue engine updates to broadcast canonical state
    QueueManager.getInstance().subscribe(() => {
      this.notifyListeners();
    });
  }

  public static getInstance(): RaagaXPlayer {
    if (!RaagaXPlayer.instance) {
      RaagaXPlayer.instance = new RaagaXPlayer();
    }
    return RaagaXPlayer.instance;
  }

  // ── Unified Read-Only Attachment ──────────────────────────────────────────

  /**
   * READ-ONLY ATTACHMENT — Connects to the underlying native or web player
   * and returns the live state snapshot WITHOUT issuing any playback commands.
   */
  public async connectAndAttach(): Promise<RaagaXPlayerState> {
    if (RaagaXNativePlayer.isNative()) {
      const nativeState = await RaagaXNativePlayer.getPlaybackState();
      if (nativeState) {
        const manager = QueueManager.getInstance();
        const currentItem = manager.getCurrentItem();
        if (currentItem?.song) {
          const store = require('@/context/usePlayerStore').usePlayerStore.getState();
          store.setState({
            isPlaying: nativeState.isPlaying,
            currentSong: currentItem.song,
            currentTime: nativeState.positionMs / 1000,
          });
        }
      }
    }
    const state = this.getState();
    this.notifyListeners();
    return state;
  }

  // ── Unified Playback Controls ─────────────────────────────────────────────

  public async play(): Promise<void> {
    PlaybackService.getInstance().play();
    this.notifyListeners();
  }

  public async pause(): Promise<void> {
    PlaybackService.getInstance().pause();
    this.notifyListeners();
  }

  public async togglePlayPause(): Promise<void> {
    const state = this.getState();
    if (state.status === 'PLAYING') {
      await this.pause();
    } else {
      await this.play();
    }
  }

  public async next(origin?: 'HOME' | 'SEARCH' | 'ALBUM' | 'PLAYLIST' | 'RECOMMENDATION' | 'AUTOPLAY'): Promise<boolean> {
    const bus = PlayerCommandBus.getInstance();
    const cmd = bus.createCommand('SKIP_TO_NEXT', { reason: 'USER_NEXT' as AdvanceReason }, origin);
    const result = await bus.executeCommand(cmd);
    this.notifyListeners();
    return result.success;
  }

  public async previous(): Promise<boolean> {
    const bus = PlayerCommandBus.getInstance();
    const cmd = bus.createCommand('SKIP_TO_PREV', { reason: 'USER_PREV' as AdvanceReason });
    const result = await bus.executeCommand(cmd);
    this.notifyListeners();
    return result.success;
  }

  public async seek(positionMs: number): Promise<void> {
    PlaybackService.getInstance().seek(positionMs / 1000);
    this.notifyListeners();
  }

  public async setQueue(songs: Song[], startIndex: number = 0, context?: PlaybackContext): Promise<void> {
    const bus = PlayerCommandBus.getInstance();
    const cmd = bus.createCommand('SET_QUEUE', { songs, startIndex, context });
    await bus.executeCommand(cmd);
    this.notifyListeners();
  }

  public async shufflePlay(songs: Song[], context?: PlaybackContext): Promise<void> {
    if (!songs || songs.length === 0) return;
    const manager = QueueManager.getInstance();
    manager.replaceQueue(songs, 0, 'PLAYLIST', context);
    await manager.toggleShuffle();

    const snapshot = manager.getSnapshot();
    const syncedSongs = snapshot.items.map(i => i.song);
    const firstSong = syncedSongs[0] || songs[0];

    if (RaagaXNativePlayer.isNative()) {
      await PlaybackService.getInstance().loadQueueContext(syncedSongs, 0);
    } else {
      await PlaybackService.getInstance().playTrack(firstSong, true);
    }
    this.notifyListeners();
  }

  public async addToQueue(song: Song): Promise<void> {
    const bus = PlayerCommandBus.getInstance();
    const cmd = bus.createCommand('ADD_TO_QUEUE', song);
    await bus.executeCommand(cmd);
    this.notifyListeners();
  }

  public async playNext(song: Song): Promise<void> {
    const bus = PlayerCommandBus.getInstance();
    const cmd = bus.createCommand('PLAY_AS_NEXT', song);
    await bus.executeCommand(cmd);
    this.notifyListeners();
  }

  public async setShuffle(enabled: boolean): Promise<void> {
    const manager = QueueManager.getInstance();
    if (enabled && manager.getShuffleMode() === 'OFF') {
      await manager.toggleShuffle();
    } else if (!enabled && manager.getShuffleMode() !== 'OFF') {
      await manager.toggleShuffle();
    }
    this.notifyListeners();
  }

  public async setRepeat(mode: 'OFF' | 'ONE' | 'ALL'): Promise<void> {
    const manager = QueueManager.getInstance();
    const mappedMode = mode === 'ONE' ? 'TRACK' : mode === 'ALL' ? 'CONTEXT' : 'OFF';
    manager.setRepeatMode(mappedMode);
    this.notifyListeners();
  }

  public setContext(context: PlaybackContext): void {
    QueueManager.getInstance().setPlaybackContext(context);
    this.notifyListeners();
  }

  // ── Canonical State Snapshot ──────────────────────────────────────────────

  public getState(): RaagaXPlayerState {
    const manager = QueueManager.getInstance();
    const window = manager.getWindow();
    const snapshot = manager.getSnapshot();
    const restrictions = manager.getRestrictions();

    const storeState = require('@/context/usePlayerStore').usePlayerStore.getState();
    const isPlaying = storeState.isPlaying;

    const currentTrack = window.currentTrack;
    const context = manager.getPlaybackContext() || null;

    return {
      sessionId: snapshot.queueId || 'global-session',
      playbackId: this.playbackId,
      deviceId: typeof window !== 'undefined' ? (localStorage.getItem('raagax_device_id') || 'local') : 'server',
      context,
      queueId: snapshot.queueId,
      queueRevision: window.revision,

      previousTracks: window.prevTracks,
      currentTrack,
      nextTracks: window.nextTracks,

      positionMs: (storeState.currentTime || 0) * 1000,
      positionTimestamp: Date.now(),
      playbackRate: 1.0,

      status: isPlaying ? 'PLAYING' : currentTrack ? 'PAUSED' : 'IDLE',

      shuffle: snapshot.shuffleMode !== 'OFF',
      repeat: snapshot.repeatMode === 'TRACK' ? 'ONE' : snapshot.repeatMode === 'CONTEXT' ? 'ALL' : 'OFF',
      restrictions,
    };
  }

  // ── Subscription Bus ──────────────────────────────────────────────────────

  public subscribe(listener: RaagaXPlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[RaagaXPlayer] Error in subscriber listener:', err);
      }
    }
  }
}
