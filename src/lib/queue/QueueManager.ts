import { QueueEngine } from './QueueEngine';
import { QueueHistory } from './QueueHistory';
import { SmartQueue } from './SmartQueue';
import { QueuePersistence } from './QueuePersistence';
import { QueueItem, QueueSource, RepeatMode } from './types';
import { Song } from '@/types/music';

// Event bus for UI updates
type QueueListener = (items: QueueItem[], currentIndex: number) => void;

export class QueueManager {
  private static instance: QueueManager;
  
  private engine: QueueEngine;
  private history: QueueHistory;
  private smartQueue: SmartQueue;
  private persistence: QueuePersistence;
  
  private listeners: Set<QueueListener> = new Set();
  private initialized: boolean = false;

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  private constructor() {
    this.engine = new QueueEngine();
    this.history = QueueHistory.getInstance();
    this.smartQueue = SmartQueue.getInstance();
    this.persistence = QueuePersistence.getInstance();
  }

  public async init() {
    if (this.initialized) return;
    
    // Attempt to load previous session from IndexedDB
    // We'll use a fixed 'default' queueId for the main app session for now
    const snapshot = await this.persistence.loadSnapshot('default');
    if (snapshot) {
      await this.engine.loadFromSnapshot(snapshot);
    } else {
      // Force initial persist so we have a queueId
      this.engine = new QueueEngine();
      // Set to 'default' ID
      const newSnap = this.engine.getSnapshot();
      newSnap.queueId = 'default';
      this.engine.loadFromSnapshot(newSnap);
      this.persistence.saveSnapshot(newSnap);
    }
    
    this.initialized = true;
    this.notify();
  }

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    // Send immediate state
    listener(this.engine.getAllItems(), this.engine.getCurrentIndex());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const items = this.engine.getAllItems();
    const index = this.engine.getCurrentIndex();
    for (const listener of this.listeners) {
      listener(items, index);
    }
  }

  // --- API ---

  public createQueueItem(song: Song, source: QueueSource): QueueItem {
    return {
      queueItemId: crypto.randomUUID(),
      trackId: song.id,
      song,
      source,
      addedAt: Date.now(),
      playable: true,
      offlineAvailable: false // Resolvable offline state
    };
  }

  public playNow(song: Song, source: QueueSource = 'USER') {
    const item = this.createQueueItem(song, source);
    this.engine.playNow(item);
    this.history.recordPlay(item);
    this.smartQueue.evaluateRefill(this.engine);
    this.notify();
    return item;
  }

  public playNext(song: Song, source: QueueSource = 'USER') {
    this.engine.playNext(this.createQueueItem(song, source));
    this.notify();
  }

  public addToQueue(song: Song, source: QueueSource = 'USER') {
    this.engine.addToQueue(this.createQueueItem(song, source));
    this.smartQueue.evaluateRefill(this.engine);
    this.notify();
  }

  public replaceQueue(songs: Song[], startIndex: number = 0, source: QueueSource = 'PLAYLIST') {
    const items = songs.map(s => this.createQueueItem(s, source));
    this.engine.replaceQueue(items, startIndex);
    
    const current = this.engine.getCurrentItem();
    if (current) this.history.recordPlay(current);
    
    this.smartQueue.evaluateRefill(this.engine);
    this.notify();
  }

  public clearQueue() {
    this.engine.clearQueue();
    this.notify();
  }

  public removeItem(queueItemId: string) {
    this.engine.removeItem(queueItemId);
    this.smartQueue.evaluateRefill(this.engine);
    this.notify();
  }

  public getNext(): QueueItem | null {
    const item = this.engine.getNextItem();
    if (item) {
      this.history.recordPlay(item);
      this.smartQueue.evaluateRefill(this.engine);
    }
    this.notify();
    return item;
  }

  public getPrevious(): QueueItem | null {
    const item = this.engine.getPreviousItem();
    if (item) {
      this.history.recordPlay(item);
    }
    this.notify();
    return item;
  }

  public peekNext(): QueueItem | null {
    // Doesn't mutate the state
    const items = this.engine.getAllItems();
    const current = this.engine.getCurrentIndex();
    if (current + 1 < items.length) {
      return items[current + 1];
    }
    return null;
  }

  public getCurrentItem(): QueueItem | null {
    return this.engine.getCurrentItem();
  }
  
  public getAllItems(): QueueItem[] {
    return this.engine.getAllItems();
  }
  
  public getCurrentIndex(): number {
    return this.engine.getCurrentIndex();
  }

  // --- Toggles ---

  public async toggleShuffle() {
    await this.engine.toggleShuffle();
    this.notify();
  }
  public getShuffleMode() { return this.engine.getShuffleMode(); }

  public setRepeatMode(mode: RepeatMode) {
    this.engine.setRepeatMode(mode);
    this.notify();
  }
  public getRepeatMode() { return this.engine.getRepeatMode(); }

  public toggleAutoplay() {
    this.engine.toggleAutoplay();
    this.smartQueue.evaluateRefill(this.engine);
    this.notify();
  }
  public isAutoplayEnabled() { return this.engine.isAutoplayEnabled(); }

  // Record playback completion percentage (called by PlaybackEngine)
  public recordProgress(percentage: number) {
    const current = this.engine.getCurrentItem();
    if (current) {
      this.history.updatePlayCompletion(current.trackId, percentage);
    }
  }
}
