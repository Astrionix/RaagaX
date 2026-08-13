import { QueueHistoryEntry, QueueSource, QueueItem } from './types';
import { QueuePersistence } from './QueuePersistence';

export class QueueHistory {
  private static instance: QueueHistory;
  private history: QueueHistoryEntry[] = [];
  private loadPromise: Promise<void> | null = null;
  
  // Keep up to 200 items in memory
  private readonly MAX_HISTORY_ITEMS = 200;

  public static getInstance(): QueueHistory {
    if (!QueueHistory.instance) {
      QueueHistory.instance = new QueueHistory();
    }
    return QueueHistory.instance;
  }

  private constructor() {
    this.loadPromise = this.loadHistory();
  }

  public async ensureLoaded(): Promise<QueueHistoryEntry[]> {
    if (this.loadPromise) {
      await this.loadPromise;
    }
    return [...this.history];
  }

  private async loadHistory() {
    try {
      const saved = await QueuePersistence.getInstance().loadHistory();
      this.history = saved.slice(-this.MAX_HISTORY_ITEMS);
    } catch {
      this.history = [];
    }
  }

  public recordPlay(item: QueueItem) {
    const entry: QueueHistoryEntry = {
      trackId: item.trackId,
      song: item.song,
      source: item.source,
      startedAt: Date.now(),
      playedPercentage: 0
    };
    
    // Avoid immediate duplicate of the exact same track ID right next to each other
    if (this.history.length > 0 && this.history[this.history.length - 1].trackId === item.trackId) {
      this.history[this.history.length - 1].startedAt = Date.now();
    } else {
      this.history.push(entry);
    }
    
    if (this.history.length > this.MAX_HISTORY_ITEMS) {
      this.history.shift(); // Remove oldest
    }

    QueuePersistence.getInstance().saveHistory(this.history);
  }

  public updatePlayCompletion(trackId: string, percentage: number) {
    // Find the most recent entry for this track
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].trackId === trackId) {
        this.history[i].playedPercentage = Math.max(this.history[i].playedPercentage, percentage);
        if (percentage >= 90) {
          this.history[i].completedAt = Date.now();
        }
        break;
      }
    }
    
    QueuePersistence.getInstance().saveHistory(this.history);
  }

  public getHistory(): QueueHistoryEntry[] {
    return [...this.history];
  }

  public getRecentlyPlayed(count: number = 20): QueueHistoryEntry[] {
    return this.history.slice(-count);
  }

  public wasRecentlyPlayed(trackId: string, withinMs: number = 2 * 60 * 60 * 1000): boolean {
    const now = Date.now();
    return this.history.some(entry => 
      entry.trackId === trackId && (now - entry.startedAt) < withinMs
    );
  }
}
