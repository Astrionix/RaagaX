import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { QueueSnapshot, QueueHistoryEntry } from './types';

interface QueueDBSchema extends DBSchema {
  queue_state: {
    key: string;
    value: QueueSnapshot;
  };
  queue_history: {
    key: string; // 'recent'
    value: { id: string, entries: QueueHistoryEntry[] };
  };
}

export class QueuePersistence {
  private static instance: QueuePersistence;
  private dbPromise: Promise<IDBPDatabase<QueueDBSchema>> | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  public static getInstance(): QueuePersistence {
    if (!QueuePersistence.instance) {
      QueuePersistence.instance = new QueuePersistence();
    }
    return QueuePersistence.instance;
  }

  private getDB(): Promise<IDBPDatabase<QueueDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<QueueDBSchema>('raagax-queue', 1, {
        upgrade(db) {
          db.createObjectStore('queue_state', { keyPath: 'queueId' });
          db.createObjectStore('queue_history', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  public async saveSnapshot(snapshot: QueueSnapshot) {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    // Fast synchronous cache for instant restoration
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('raagax_active_queue_snapshot', JSON.stringify(snapshot));
      } catch {}
    }
    
    // Throttle saves slightly so we don't spam IndexedDB on rapid reorders
    this.saveTimeout = setTimeout(async () => {
      try {
        const db = await this.getDB();
        await db.put('queue_state', snapshot);
        // Also save canonical active_session and default records
        if (snapshot.queueId !== 'active_session') {
          await db.put('queue_state', { ...snapshot, queueId: 'active_session' });
        }
        if (snapshot.queueId !== 'default') {
          await db.put('queue_state', { ...snapshot, queueId: 'default' });
        }
      } catch (e) {
        console.warn('[QueuePersistence] Failed to save snapshot', e);
      }
    }, 250);
  }

  public async loadSnapshot(queueId: string = 'active_session'): Promise<QueueSnapshot | null> {
    try {
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        const db = await this.getDB();
        let snapshot = await db.get('queue_state', queueId);
        if (!snapshot && queueId !== 'active_session') {
          snapshot = await db.get('queue_state', 'active_session');
        }
        if (!snapshot && queueId !== 'default') {
          snapshot = await db.get('queue_state', 'default');
        }
        if (snapshot && snapshot.items && snapshot.items.length > 0) {
          return snapshot;
        }
      }
    } catch (e) {
      console.warn('[QueuePersistence] Failed to load snapshot from IDB:', e);
    }

    // Fast tier fallback
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('raagax_active_queue_snapshot');
        if (raw) {
          return JSON.parse(raw);
        }
      } catch {}
    }

    return null;
  }

  public async saveHistory(entries: QueueHistoryEntry[]) {
    try {
      const db = await this.getDB();
      await db.put('queue_history', { id: 'recent', entries });
    } catch (e) {
      console.warn('[QueuePersistence] Failed to save history', e);
    }
  }

  public async loadHistory(): Promise<QueueHistoryEntry[]> {
    try {
      const db = await this.getDB();
      const record = await db.get('queue_history', 'recent');
      return record ? record.entries : [];
    } catch (e) {
      console.warn('[QueuePersistence] Failed to load history', e);
      return [];
    }
  }
}
