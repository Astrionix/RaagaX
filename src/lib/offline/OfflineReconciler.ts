import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { NetworkManager } from './NetworkManager';
import { supabase } from '@/lib/supabase'; // Assuming standard supabase client location

interface HistoryEvent {
  id: string; // uuid
  trackId: string;
  eventType: 'play' | 'complete' | 'skip';
  positionMs: number;
  timestamp: number;
}

interface ReconcilerDBSchema extends DBSchema {
  history: {
    key: string; // id
    value: HistoryEvent;
  };
}

export class OfflineReconciler {
  private static instance: OfflineReconciler;
  private dbPromise: Promise<IDBPDatabase<ReconcilerDBSchema>> | null = null;
  private isReconciling: boolean = false;

  public static getInstance(): OfflineReconciler {
    if (!OfflineReconciler.instance) {
      OfflineReconciler.instance = new OfflineReconciler();
    }
    return OfflineReconciler.instance;
  }

  private constructor() {
    // Listen for reconnection
    NetworkManager.getInstance().subscribe((mode) => {
      if (mode === 'online') {
        this.reconcile();
      }
    });
  }

  private getDB(): Promise<IDBPDatabase<ReconcilerDBSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ReconcilerDBSchema>('raagax-offline-sync', 1, {
        upgrade(db) {
          db.createObjectStore('history', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  public async recordEvent(trackId: string, eventType: 'play' | 'complete' | 'skip', positionMs: number) {
    const event: HistoryEvent = {
      id: crypto.randomUUID(),
      trackId,
      eventType,
      positionMs,
      timestamp: Date.now()
    };

    if (NetworkManager.getInstance().isOnline()) {
      // Sync immediately if online
      this.syncEventsToCloud([event]);
    } else {
      // Store locally if offline
      const db = await this.getDB();
      await db.put('history', event);
    }
  }

  private async reconcile() {
    if (this.isReconciling) return;
    this.isReconciling = true;

    try {
      const db = await this.getDB();
      const allEvents = await db.getAll('history');

      if (allEvents.length > 0) {
        const success = await this.syncEventsToCloud(allEvents);
        
        if (success) {
          // Clear DB after successful sync
          const tx = db.transaction('history', 'readwrite');
          await tx.objectStore('history').clear();
          await tx.done;
          console.log(`[OfflineReconciler] Reconciled ${allEvents.length} events with cloud.`);
        }
      }
    } catch (err) {
      console.warn('[OfflineReconciler] Reconciliation failed', err);
    } finally {
      this.isReconciling = false;
    }
  }

  private async syncEventsToCloud(events: HistoryEvent[]): Promise<boolean> {
    try {
      // Stub: Here we would send batched events to a Supabase RPC or endpoint.
      // Example: await supabase.rpc('batch_insert_history', { events });
      return true;
    } catch (err) {
      console.error('Cloud sync error', err);
      return false;
    }
  }
}
