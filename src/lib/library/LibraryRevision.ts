import { RaagaDB, STORES } from '../storage/IndexedDB';

export interface LibraryChangeEvent {
  event: 'LIBRARY_CHANGE';
  revision: number;
  entity: 'liked_song' | 'playlist';
  id: string;
  operation: 'add' | 'remove' | 'update';
}

export class LibraryRevisionManager {
  private static instance: LibraryRevisionManager;
  private db: RaagaDB;
  private currentRevision = 0;

  private constructor() {
    this.db = RaagaDB.getInstance();
  }

  public static getInstance(): LibraryRevisionManager {
    if (!LibraryRevisionManager.instance) {
      LibraryRevisionManager.instance = new LibraryRevisionManager();
    }
    return LibraryRevisionManager.instance;
  }

  public async init() {
    const meta = await this.db.get<{ id: string; value: number }>(STORES.LIBRARY_META, 'revision');
    if (meta) {
      this.currentRevision = meta.value;
    }
  }

  public getRevision(): number {
    return this.currentRevision;
  }

  public async incrementRevision(): Promise<number> {
    this.currentRevision++;
    await this.db.put(STORES.LIBRARY_META, { id: 'revision', value: this.currentRevision });
    return this.currentRevision;
  }

  public async setRevision(revision: number): Promise<void> {
    this.currentRevision = revision;
    await this.db.put(STORES.LIBRARY_META, { id: 'revision', value: this.currentRevision });
  }

  public async applyRemoteChange(event: LibraryChangeEvent): Promise<boolean> {
    // If the remote revision is exactly what we expect next, apply it directly
    if (event.revision === this.currentRevision + 1) {
      console.log(`[LibraryRevision] Applying remote change for revision ${event.revision}`);
      await this.setRevision(event.revision);
      // We would update the local IndexedDB state here (e.g., add to liked_songs store)
      return true;
    }
    
    // If the remote revision is older than what we have, we ignore it (we already have a newer state)
    if (event.revision <= this.currentRevision) {
      console.log(`[LibraryRevision] Ignoring stale change (local: ${this.currentRevision}, remote: ${event.revision})`);
      return false;
    }

    // If the remote revision is further ahead, we missed events. We need to trigger a full delta reconcile.
    console.warn(`[LibraryRevision] Missed events! Local: ${this.currentRevision}, Remote: ${event.revision}. Triggering reconcile.`);
    this.triggerReconcile();
    return false;
  }

  private triggerReconcile() {
    // This would make an HTTP call to Supabase to fetch everything that changed since this.currentRevision
    // e.g. GET /api/library/delta?since=104
    console.log('[LibraryRevision] Reconciling library delta...');
  }
}
