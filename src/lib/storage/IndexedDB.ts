const DB_NAME = 'raagaX';
const DB_VERSION = 2;

export const STORES = {
  LIKED_SONGS: 'liked_songs',
  PLAYLISTS: 'playlists',
  PLAYLIST_ITEMS: 'playlist_items',
  PLAYBACK_SNAPSHOT: 'playback_snapshot',
  DEVICES: 'devices',
  LIBRARY_META: 'library_meta',
  SYNC_OUTBOX: 'sync_outbox',
  BROWSE_CACHE: 'browse_cache',
  RECOMMENDATIONS_SNAPSHOT: 'recommendations_snapshot',
  PENDING_MUTATIONS: 'pending_mutations',
} as const;

export class RaagaDB {
  private db: IDBDatabase | null = null;
  private static instance: RaagaDB;

  private constructor() {}

  public static getInstance(): RaagaDB {
    if (!RaagaDB.instance) {
      RaagaDB.instance = new RaagaDB();
    }
    return RaagaDB.instance;
  }

  public async init(): Promise<void> {
    if (this.db) return;
    if (typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORES.LIKED_SONGS)) {
          db.createObjectStore(STORES.LIKED_SONGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
          db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PLAYLIST_ITEMS)) {
          const store = db.createObjectStore(STORES.PLAYLIST_ITEMS, { keyPath: 'id' });
          store.createIndex('playlist_id', 'playlist_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.PLAYBACK_SNAPSHOT)) {
          db.createObjectStore(STORES.PLAYBACK_SNAPSHOT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.DEVICES)) {
          db.createObjectStore(STORES.DEVICES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.LIBRARY_META)) {
          db.createObjectStore(STORES.LIBRARY_META, { keyPath: 'id' }); // id: 'revision'
        }
        if (!db.objectStoreNames.contains(STORES.SYNC_OUTBOX)) {
          const store = db.createObjectStore(STORES.SYNC_OUTBOX, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.BROWSE_CACHE)) {
          db.createObjectStore(STORES.BROWSE_CACHE, { keyPath: 'id' }); // id: 'language'
        }
        if (!db.objectStoreNames.contains(STORES.RECOMMENDATIONS_SNAPSHOT)) {
          db.createObjectStore(STORES.RECOMMENDATIONS_SNAPSHOT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PENDING_MUTATIONS)) {
          const store = db.createObjectStore(STORES.PENDING_MUTATIONS, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  public async get<T>(storeName: string, key: string): Promise<T | undefined> {
    await this.init();
    if (!this.db) return undefined;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  public async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  public async put(storeName: string, value: any): Promise<void> {
    await this.init();
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  public async delete(storeName: string, key: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
