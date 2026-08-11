import { RaagaDB, STORES } from './IndexedDB';

export interface SyncOperation {
  id: string; // Unique UUID for the operation
  type: 'LIKE_ADD' | 'LIKE_REMOVE' | 'PLAYLIST_CREATE' | 'PLAYLIST_DELETE';
  entityId: string;
  createdAt: number;
  retryCount: number;
  payload?: any;
}

export class SyncOutbox {
  private static instance: SyncOutbox;
  private db: RaagaDB;
  private isProcessing = false;

  private constructor() {
    this.db = RaagaDB.getInstance();
  }

  public static getInstance(): SyncOutbox {
    if (!SyncOutbox.instance) {
      SyncOutbox.instance = new SyncOutbox();
    }
    return SyncOutbox.instance;
  }

  public async push(operation: Omit<SyncOperation, 'retryCount'>) {
    const fullOp: SyncOperation = {
      ...operation,
      retryCount: 0
    };
    await this.db.put(STORES.SYNC_OUTBOX, fullOp);
    
    // We attempt to process immediately, but it runs in background
    this.processOutbox().catch(e => console.error('[SyncOutbox] Initial processing failed', e));
  }

  public async getPendingOperations(): Promise<SyncOperation[]> {
    const all = await this.db.getAll<SyncOperation>(STORES.SYNC_OUTBOX);
    // Sort by createdAt ascending
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  public async processOutbox() {
    if (this.isProcessing) return;
    
    // Check if we have a network connection before processing
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[SyncOutbox] Offline, skipping processing');
      return;
    }

    this.isProcessing = true;
    try {
      const pending = await this.getPendingOperations();
      if (pending.length === 0) return;

      console.log(`[SyncOutbox] Processing ${pending.length} pending operations...`);

      for (const op of pending) {
        try {
          await this.executeOperation(op);
          // If successful, remove from outbox
          await this.db.delete(STORES.SYNC_OUTBOX, op.id);
        } catch (error) {
          console.error(`[SyncOutbox] Failed to process operation ${op.id}`, error);
          // Increment retry count
          op.retryCount++;
          await this.db.put(STORES.SYNC_OUTBOX, op);
          
          // Stop processing further operations to maintain ordering
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeOperation(op: SyncOperation): Promise<void> {
    // This is where we would call Supabase to persist the change.
    // For now, we just simulate a successful network request.
    // Actual implementation will be wired up to the Supabase client.
    console.log(`[SyncOutbox] Executing ${op.type} for entity ${op.entityId}`);
    
    // Mock network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // In a real implementation:
    // if (op.type === 'LIKE_ADD') {
    //   await supabase.from('liked_songs').insert({ ... })
    // }
  }
}

// Automatically try to process when we come back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncOutbox] Back online, triggering processing...');
    SyncOutbox.getInstance().processOutbox();
  });
}
