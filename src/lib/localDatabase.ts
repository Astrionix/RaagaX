import { Song } from '@/types/music';

const DB_NAME = 'RaagaX_LocalDB';
const DB_VERSION = 3;

export interface PlaybackSessionCache {
  currentSong: Song | null;
  currentTime: number;
  queue: Song[];
  queueIndex: number;
  historySongIds: string[];
  likedSongIds?: string[];
  searchHistory: string[];
  preferredLanguage?: string;
}

export class LocalDatabase {
  private static instance: LocalDatabase;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.dbPromise = this.initDB();
    }
  }

  public static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session');
        }
        if (!db.objectStoreNames.contains('lyrics')) {
          db.createObjectStore('lyrics', { keyPath: 'songId' });
        }
        if (!db.objectStoreNames.contains('search_history')) {
          db.createObjectStore('search_history', { autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('artwork')) {
          db.createObjectStore('artwork');
        }
        if (!db.objectStoreNames.contains('download_tasks')) {
          db.createObjectStore('download_tasks', { keyPath: 'song.id' });
        }
        if (!db.objectStoreNames.contains('liked_songs')) {
          db.createObjectStore('liked_songs', { keyPath: 'songId' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlist_items')) {
          db.createObjectStore('playlist_items', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_operations')) {
          db.createObjectStore('sync_operations', { keyPath: 'operationId' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB failed to open:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Save instant session snapshot (Current song, position, queue, history)
   */
  public async savePlaybackSession(session: PlaybackSessionCache): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('session', 'readwrite');
      const store = tx.objectStore('session');
      store.put(session, 'latest_session');
    } catch (e) {
      console.warn('Could not save playback session to IndexedDB:', e);
    }
  }

  /**
   * Load playback session for instant startup restore
   */
  public async loadPlaybackSession(): Promise<PlaybackSessionCache | null> {
    if (!this.dbPromise) return null;
    try {
      const db = await this.dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction('session', 'readonly');
        const store = tx.objectStore('session');
        const req = store.get('latest_session');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Cache lyrics for instant offline viewing
   */
  public async cacheLyrics(songId: string, lyrics: any): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('lyrics', 'readwrite');
      tx.objectStore('lyrics').put({ songId, lyrics, cachedAt: Date.now() });
    } catch (e) {
      console.warn('Could not cache lyrics:', e);
    }
  }

  /**
   * Get cached lyrics instantly
   */
  public async getCachedLyrics(songId: string): Promise<any | null> {
    if (!this.dbPromise) return null;
    try {
      const db = await this.dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction('lyrics', 'readonly');
        const req = tx.objectStore('lyrics').get(songId);
        req.onsuccess = () => resolve(req.result ? req.result.lyrics : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Add term to search history
   */
  public async addSearchHistory(term: string): Promise<void> {
    if (!term.trim() || typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(localStorage.getItem('raagax_search_history') || '[]');
      const updated = Array.from(new Set([term.trim(), ...existing])).slice(0, 15);
      localStorage.setItem('raagax_search_history', JSON.stringify(updated));
    } catch (e) {}
  }

  /**
   * Save all download tasks
   */
  public async saveDownloadTasks(tasks: Record<string, any>): Promise<void> {
    if (!this.dbPromise) return;
    try {
      const db = await this.dbPromise;
      const tx = db.transaction('download_tasks', 'readwrite');
      const store = tx.objectStore('download_tasks');
      
      // Clear existing to sync deletes
      store.clear();
      Object.values(tasks).forEach(task => {
        // Exclude transient data like AbortController
        const { abortController, ...persistTask } = task as any;
        store.put(persistTask);
      });
    } catch (e) {
      console.warn('Could not save download tasks:', e);
    }
  }

  /**
   * Load download tasks
   */
  public async loadDownloadTasks(): Promise<Record<string, any>> {
    if (!this.dbPromise) return {};
    try {
      const db = await this.dbPromise;
      return new Promise((resolve) => {
        const tx = db.transaction('download_tasks', 'readonly');
        const store = tx.objectStore('download_tasks');
        const req = store.getAll();
        
        req.onsuccess = () => {
          const tasks: Record<string, any> = {};
          req.result.forEach((task: any) => {
            tasks[task.song.id] = task;
          });
          resolve(tasks);
        };
        req.onerror = () => resolve({});
      });
    } catch (e) {
      return {};
    }
  }

  /**
   * Get search history
   */
  public getSearchHistory(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('raagax_search_history') || '[]');
    } catch (e) {
      return [];
    }
  }
}
