import { QueueItem, QueueSnapshot, RepeatMode, ShuffleMode, PlaybackContext, ContextType } from './types';
import { QueuePersistence } from './QueuePersistence';

export class QueueEngine {
  private queueId: string;
  private revision: number = 0;
  private items: QueueItem[] = [];
  private currentIndex: number = -1;
  
  private autoplayEnabled: boolean = true;
  private shuffleMode: ShuffleMode = 'OFF';
  private repeatMode: RepeatMode = 'OFF';
  
  private context?: PlaybackContext;
  private shuffleSeed: string = '';
  private originalItems: QueueItem[] = []; // For unshuffling

  constructor() {
    this.queueId = crypto.randomUUID();
  }

  public async loadFromSnapshot(snapshot: QueueSnapshot) {
    this.queueId = snapshot.queueId;
    this.revision = snapshot.revision;
    this.items = snapshot.items;
    this.currentIndex = snapshot.currentIndex;
    this.autoplayEnabled = snapshot.autoplayEnabled;
    this.shuffleMode = snapshot.shuffleMode || 'OFF';
    this.repeatMode = snapshot.repeatMode;
    this.shuffleSeed = snapshot.shuffleSeed || '';
    this.context = snapshot.context;
    
    if (this.shuffleMode !== 'OFF') {
      this.originalItems = [...this.items]; 
    }
  }

  public setPlaybackContext(context: PlaybackContext) {
    this.context = context;
    this.mutate();
  }

  public getPlaybackContext(): PlaybackContext | undefined {
    return this.context;
  }

  public getSnapshot(): QueueSnapshot {
    return {
      queueId: this.queueId,
      revision: this.revision,
      currentItemId: this.items[this.currentIndex]?.queueItemId || null,
      currentIndex: this.currentIndex,
      items: [...this.items],
      autoplayEnabled: this.autoplayEnabled,
      shuffleMode: this.shuffleMode,
      repeatMode: this.repeatMode,
      shuffleSeed: this.shuffleSeed,
      context: this.context,
    };
  }

  public getWindow(): import('../playback/types').PlayerQueueWindow {
    const prevTracks = this.currentIndex > 0 ? this.items.slice(0, this.currentIndex).map(i => i.song) : [];
    const currentTrack = this.getCurrentItem()?.song || null;
    const nextTracks = this.currentIndex < this.items.length - 1 ? this.items.slice(this.currentIndex + 1).map(i => i.song) : [];

    return {
      revision: this.revision,
      prevTracks,
      currentTrack,
      nextTracks,
    };
  }

  public getRestrictions(): import('../playback/types').PlayerRestrictions {
    const { RestrictionsEngine } = require('../playback/RestrictionsEngine');
    return RestrictionsEngine.getInstance().evaluate({
      queueItems: this.items.map(i => i.song),
      currentIndex: this.currentIndex,
      isPlaying: true,
      isOffline: false,
      repeatMode: this.repeatMode,
    });
  }

  private mutate() {
    this.revision++;
    QueuePersistence.getInstance().saveSnapshot(this.getSnapshot());
  }

  private normalizeRepeat(mode?: string | null): RepeatMode {
    if (!mode) return 'OFF';
    const m = mode.toUpperCase();
    if (m === 'ONE' || m === 'TRACK') return 'ONE';
    if (m === 'ALL' || m === 'CONTEXT') return 'ALL';
    return 'OFF';
  }

  public isAutoplayEnabled() { return this.autoplayEnabled; }
  public toggleAutoplay() { 
    this.autoplayEnabled = !this.autoplayEnabled; 
    this.mutate();
  }

  public setRepeatMode(mode: RepeatMode) {
    this.repeatMode = this.normalizeRepeat(mode);
    this.mutate();
  }
  public getRepeatMode(): RepeatMode { return this.normalizeRepeat(this.repeatMode); }

  public async toggleShuffle() {
    if (this.shuffleMode === 'OFF') {
      this.shuffleMode = 'STANDARD';
    } else if (this.shuffleMode === 'STANDARD') {
      this.shuffleMode = 'SMART';
    } else {
      this.shuffleMode = 'OFF';
    }
    
    if (this.shuffleMode === 'STANDARD') {
      this.shuffleSeed = crypto.randomUUID();
      this.originalItems = [...this.items];
      
      if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
        const currentItem = this.items[this.currentIndex];
        const remaining = this.items.filter((_, i) => i !== this.currentIndex);
        
        let seed = this.shuffleSeed.charCodeAt(0);
        remaining.sort(() => {
          seed = (seed * 9301 + 49297) % 233280;
          return (seed / 233280) - 0.5;
        });
        
        this.items = [currentItem, ...remaining];
        this.currentIndex = 0;
      }
    } else if (this.shuffleMode === 'SMART') {
      this.shuffleSeed = crypto.randomUUID();
      if (this.originalItems.length === 0) {
        this.originalItems = [...this.items];
      }
      
      if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
        const currentItem = this.items[this.currentIndex];
        const remaining = this.items.filter((_, i) => i !== this.currentIndex);
        
        // Let SmartShuffleEngine do the heavy lifting with active user preferred language
        const { usePlayerStore } = await import('@/context/usePlayerStore');
        const activeLang = usePlayerStore.getState().preferredLanguage || (currentItem?.song as any)?.language || 'Telugu';
        
        const smartSequence = await import('./SmartShuffleEngine').then(m => 
          m.SmartShuffleEngine.generateSmartSequence(remaining, this.shuffleSeed, activeLang)
        );
        
        this.items = [currentItem, ...smartSequence];
        this.currentIndex = 0;
      }
    } else {
      // Unshuffle
      if (this.originalItems.length > 0) {
        const currentItem = this.items[this.currentIndex];
        this.items = [...this.originalItems];
        this.currentIndex = this.items.findIndex(i => i.queueItemId === currentItem?.queueItemId);
        if (this.currentIndex === -1) this.currentIndex = 0;
      }
    }
    
    this.mutate();
  }
    
  public async setShuffleMode(mode: ShuffleMode) {
    if (this.shuffleMode === mode) return;
    this.shuffleMode = mode;
    if (this.shuffleMode === 'STANDARD') {
      this.shuffleSeed = crypto.randomUUID();
      this.originalItems = [...this.items];
      
      if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
        const currentItem = this.items[this.currentIndex];
        const remaining = this.items.filter((_, i) => i !== this.currentIndex);
        
        let seed = this.shuffleSeed.charCodeAt(0);
        remaining.sort(() => {
          seed = (seed * 9301 + 49297) % 233280;
          return (seed / 233280) - 0.5;
        });
        
        this.items = [currentItem, ...remaining];
        this.currentIndex = 0;
      }
    } else if (this.shuffleMode === 'SMART') {
      this.shuffleSeed = crypto.randomUUID();
      if (this.originalItems.length === 0) {
        this.originalItems = [...this.items];
      }
      
      if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
        const currentItem = this.items[this.currentIndex];
        const remaining = this.items.filter((_, i) => i !== this.currentIndex);
        
        const { usePlayerStore } = await import('@/context/usePlayerStore');
        const activeLang = usePlayerStore.getState().preferredLanguage || (currentItem?.song as any)?.language || 'Telugu';
        
        const smartSequence = await import('./SmartShuffleEngine').then(m => 
          m.SmartShuffleEngine.generateSmartSequence(remaining, this.shuffleSeed, activeLang)
        );
        
        this.items = [currentItem, ...smartSequence];
        this.currentIndex = 0;
      }
    } else {
      if (this.originalItems.length > 0) {
        const currentItem = this.items[this.currentIndex];
        this.items = [...this.originalItems];
        this.currentIndex = this.items.findIndex(i => i.queueItemId === currentItem?.queueItemId);
        if (this.currentIndex === -1) this.currentIndex = 0;
      }
    }
    
    this.mutate();
  }
  public getShuffleMode() { return this.shuffleMode; }

  public getCurrentItem(): QueueItem | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
      return this.items[this.currentIndex];
    }
    return null;
  }

  /**
   * Advances to next queue item based on repeat and shuffle modes.
   */
  public getNextItem(isNaturalEnd: boolean = false): QueueItem | null {
    if (this.items.length === 0) return null;

    const normRepeat = this.normalizeRepeat(this.repeatMode);
    if (normRepeat === 'ONE') {
      return this.getCurrentItem();
    }

    if (this.currentIndex + 1 < this.items.length) {
      this.currentIndex++;
      this.mutate();
      return this.items[this.currentIndex];
    }

    if (normRepeat === 'ALL' && this.items.length > 0) {
      this.currentIndex = 0;
      this.mutate();
      return this.items[0];
    }

    return null;
  }

  public skipTo(index: number): QueueItem | null {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
      this.mutate();
      return this.items[this.currentIndex];
    }
    return null;
  }

  public getPreviousItem(): QueueItem | null {
    if (this.items.length === 0) return null;

    const normRepeat = this.normalizeRepeat(this.repeatMode);
    if (normRepeat === 'ONE') {
      return this.getCurrentItem();
    }

    if (this.currentIndex - 1 >= 0) {
      this.currentIndex--;
      this.mutate();
      return this.items[this.currentIndex];
    }

    if (normRepeat === 'ALL' && this.items.length > 0) {
      this.currentIndex = this.items.length - 1;
      this.mutate();
      return this.items[this.currentIndex];
    }

    return null;
  }

  public playNow(item: QueueItem) {
    if (this.items.length === 0 || this.currentIndex < 0) {
      this.items = [item];
      this.currentIndex = 0;
      this.mutate();
      return;
    }

    // If the song is already currently playing, keep position
    if (this.items[this.currentIndex]?.song?.id === item.song.id) {
      this.mutate();
      return;
    }

    // Check if the track already exists in upcoming queue ahead of currentIndex
    const existingUpcomingIndex = this.items.findIndex(
      (it, idx) => idx > this.currentIndex && it.song.id === item.song.id
    );

    if (existingUpcomingIndex !== -1) {
      // If it's already upcoming in the queue, skip directly to it
      this.currentIndex = existingUpcomingIndex;
    } else {
      // Ad-hoc selection: Insert immediately after current song and make active
      // When this song finishes, playback will naturally resume at the original upcoming track
      this.items.splice(this.currentIndex + 1, 0, item);
      this.currentIndex++;
    }
    this.mutate();
  }

  public playNext(item: QueueItem) {
    // Current -> selected song -> existing next
    this.items.splice(this.currentIndex + 1, 0, item);
    this.mutate();
  }

  public addToQueue(item: QueueItem) {
    // Current -> existing queue -> selected song
    this.items.push(item);
    this.mutate();
  }

  public replaceQueue(items: QueueItem[], startIndex: number = 0) {
    this.items = [...items];
    this.currentIndex = startIndex;
    if (this.shuffleMode !== 'OFF') {
      this.originalItems = [...this.items];
      // Perform initial shuffle logic here if needed, keeping startIndex at top
    }
    this.mutate();
  }

  public appendAutoplayItems(items: QueueItem[]) {
    this.items.push(...items);
    this.mutate();
  }

  public clearQueue() {
    const current = this.getCurrentItem();
    this.items = current ? [current] : [];
    this.currentIndex = current ? 0 : -1;
    this.mutate();
  }

  public removeItem(queueItemId: string) {
    const idx = this.items.findIndex(i => i.queueItemId === queueItemId);
    if (idx > -1) {
      this.items.splice(idx, 1);
      if (idx < this.currentIndex) {
        this.currentIndex--;
      }
      this.mutate();
    }
  }

  public getRemainingCount(): number {
    if (this.currentIndex < 0) return 0;
    return this.items.length - 1 - this.currentIndex;
  }

  public getRecentItems(count: number): QueueItem[] {
    if (this.currentIndex < 0) return [];
    const start = Math.max(0, this.currentIndex - count + 1);
    return this.items.slice(start, this.currentIndex + 1);
  }

  public getAllItems(): QueueItem[] {
    return [...this.items];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }
}
