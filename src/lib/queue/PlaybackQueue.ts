import { QueueItem, RepeatMode, ShuffleState, PlaybackQueueContext } from './types';

export class PlaybackQueue {
  public readonly queueId: string;
  public revision: number;
  public items: QueueItem[];
  public currentItemId: string | null;
  public shuffle: ShuffleState;
  public repeatMode: RepeatMode;
  public context: PlaybackQueueContext;

  constructor(
    queueId?: string,
    items: QueueItem[] = [],
    currentItemId: string | null = null,
    context: PlaybackQueueContext = { type: 'USER' }
  ) {
    this.queueId = queueId || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.revision = 1;
    this.items = items;
    this.currentItemId = currentItemId || (items.length > 0 ? items[0].queueItemId : null);
    this.shuffle = {
      enabled: false,
      seed: '',
      order: [],
      cursor: 0,
    };
    this.repeatMode = 'OFF';
    this.context = context;
  }

  public getCurrentItem(): QueueItem | null {
    if (!this.currentItemId) return null;
    return this.items.find(item => item.queueItemId === this.currentItemId) || null;
  }

  public getCurrentIndex(): number {
    if (!this.currentItemId) return -1;
    return this.items.findIndex(item => item.queueItemId === this.currentItemId);
  }

  public setCurrentItemById(queueItemId: string): boolean {
    const item = this.items.find(i => i.queueItemId === queueItemId);
    if (item) {
      this.currentItemId = queueItemId;
      this.revision++;
      return true;
    }
    return false;
  }

  public getNextItemId(): string | null {
    if (this.items.length === 0) return null;

    if (this.shuffle.enabled && this.shuffle.order.length > 0) {
      const currentShuffleIdx = this.shuffle.order.indexOf(this.currentItemId || '');
      if (currentShuffleIdx !== -1 && currentShuffleIdx + 1 < this.shuffle.order.length) {
        return this.shuffle.order[currentShuffleIdx + 1];
      } else if (this.repeatMode === 'CONTEXT' && this.shuffle.order.length > 0) {
        return this.shuffle.order[0];
      }
      return null;
    }

    const currIdx = this.getCurrentIndex();
    if (currIdx !== -1 && currIdx + 1 < this.items.length) {
      return this.items[currIdx + 1].queueItemId;
    } else if (this.repeatMode === 'CONTEXT' && this.items.length > 0) {
      return this.items[0].queueItemId;
    }

    return null;
  }

  public getPreviousItemId(): string | null {
    if (this.items.length === 0) return null;

    if (this.shuffle.enabled && this.shuffle.order.length > 0) {
      const currentShuffleIdx = this.shuffle.order.indexOf(this.currentItemId || '');
      if (currentShuffleIdx > 0) {
        return this.shuffle.order[currentShuffleIdx - 1];
      }
      return null;
    }

    const currIdx = this.getCurrentIndex();
    if (currIdx > 0) {
      return this.items[currIdx - 1].queueItemId;
    }

    return null;
  }

  public enableShuffle(seed?: string): ShuffleState {
    const activeSeed = seed || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const currentItem = this.getCurrentItem();

    // Filter out current item from candidates to keep active item at cursor 0
    const candidates = this.items.filter(item => item.queueItemId !== this.currentItemId);

    // Deterministic shuffle algorithm based on seed
    let seedValue = 0;
    for (let i = 0; i < activeSeed.length; i++) {
      seedValue = (seedValue << 5) - seedValue + activeSeed.charCodeAt(i);
      seedValue |= 0;
    }

    const shuffledCandidates = [...candidates];
    for (let i = shuffledCandidates.length - 1; i > 0; i--) {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      const rnd = Math.abs(seedValue) / 233280;
      const j = Math.floor(rnd * (i + 1));
      const temp = shuffledCandidates[i];
      shuffledCandidates[i] = shuffledCandidates[j];
      shuffledCandidates[j] = temp;
    }

    const order = currentItem
      ? [currentItem.queueItemId, ...shuffledCandidates.map(c => c.queueItemId)]
      : shuffledCandidates.map(c => c.queueItemId);

    this.shuffle = {
      enabled: true,
      seed: activeSeed,
      order,
      cursor: 0,
    };

    this.revision++;
    return this.shuffle;
  }

  public disableShuffle() {
    this.shuffle = {
      enabled: false,
      seed: '',
      order: [],
      cursor: 0,
    };
    this.revision++;
  }
}
