'use client';

import { ActiveTab } from '@/types/music';
import { ScrollManager } from './ScrollManager';

export interface NavigationEntry {
  id: string;
  activeTab: ActiveTab;
  selectedAlbumId: string | null;
  selectedArtistId: string | null;
  selectedPlaylistId: string | null;
  isPlayerExpanded: boolean;
  fromPlayer?: boolean;
  timestamp: number;
}

export class NavigationStack {
  private static instance: NavigationStack;
  private stack: NavigationEntry[] = [];
  private forwardStack: NavigationEntry[] = [];
  private isNavigatingBack: boolean = false;
  private isNavigatingForward: boolean = false;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.resetToInitial('home');
  }

  public static getInstance(): NavigationStack {
    if (!NavigationStack.instance) {
      NavigationStack.instance = new NavigationStack();
    }
    return NavigationStack.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }

  public resetToInitial(tab: ActiveTab = 'home') {
    this.stack = [
      {
        id: `root_${Date.now()}`,
        activeTab: tab,
        selectedAlbumId: null,
        selectedArtistId: null,
        selectedPlaylistId: null,
        isPlayerExpanded: false,
        timestamp: Date.now(),
      },
    ];
    this.forwardStack = [];
    this.notify();
  }

  public getCurrent(): NavigationEntry | null {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1];
  }

  public getStack(): NavigationEntry[] {
    return [...this.stack];
  }

  public canGoBack(): boolean {
    return this.stack.length > 1 || Boolean(this.getCurrent()?.isPlayerExpanded);
  }

  public canGoForward(): boolean {
    return this.forwardStack.length > 0;
  }

  /**
   * Pushes a new navigation state onto the stack.
   */
  public push(entry: Omit<NavigationEntry, 'id' | 'timestamp'>) {
    if (this.isNavigatingBack || this.isNavigatingForward) return;

    const current = this.getCurrent();
    // Deduplicate if identical to top of stack
    if (
      current &&
      current.activeTab === entry.activeTab &&
      current.selectedAlbumId === entry.selectedAlbumId &&
      current.selectedArtistId === entry.selectedArtistId &&
      current.selectedPlaylistId === entry.selectedPlaylistId &&
      current.isPlayerExpanded === entry.isPlayerExpanded
    ) {
      return;
    }

    // If player is expanding, ensure we record the expanded state
    const newEntry: NavigationEntry = {
      ...entry,
      id: `nav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    this.stack.push(newEntry);
    this.forwardStack = []; // New navigation clears forward history
    this.notify();
    console.log(`[NavigationStack] Pushed: tab=${entry.activeTab} album=${entry.selectedAlbumId} artist=${entry.selectedArtistId} pl=${entry.selectedPlaylistId} playerExpanded=${entry.isPlayerExpanded} fromPlayer=${entry.fromPlayer} (Depth: ${this.stack.length})`);
  }

  /**
   * Helper to navigate to a related content destination from the Expanded Player.
   * Collapses the player overlay temporarily while preserving fromPlayer in the stack.
   */
  public navigateFromPlayer(destination: {
    tab: ActiveTab;
    albumId?: string | null;
    artistId?: string | null;
    playlistId?: string | null;
  }) {
    const current = this.getCurrent();
    
    // Ensure expanded player state is preserved in the stack before pushing destination
    if (!current?.isPlayerExpanded) {
      this.push({
        activeTab: current?.activeTab || 'home',
        selectedAlbumId: current?.selectedAlbumId && current.selectedAlbumId !== 'offline' ? current.selectedAlbumId : null,
        selectedArtistId: current?.selectedArtistId && current.selectedArtistId !== 'offline' ? current.selectedArtistId : null,
        selectedPlaylistId: current?.selectedPlaylistId || null,
        isPlayerExpanded: true,
      });
    }

    const cleanAlbumId = destination.albumId && destination.albumId !== 'offline' ? destination.albumId : null;
    const cleanArtistId = destination.artistId && destination.artistId !== 'offline' ? destination.artistId : null;

    this.push({
      activeTab: destination.tab,
      selectedAlbumId: cleanAlbumId,
      selectedArtistId: cleanArtistId,
      selectedPlaylistId: destination.playlistId || null,
      isPlayerExpanded: false,
      fromPlayer: true,
    });
  }

  /**
   * Executes back navigation.
   * Returns true if back navigation was handled, false if at root (e.g. ready to minimize/exit).
   */
  public goBack(applyStateCallback?: (target: NavigationEntry) => void): boolean {
    if (this.stack.length <= 1) {
      const root = this.getCurrent();
      // If root has modals/expanded player open, collapse them
      if (root?.isPlayerExpanded) {
        root.isPlayerExpanded = false;
        if (applyStateCallback) applyStateCallback(root);
        this.notify();
        return true;
      }
      return false;
    }

    this.isNavigatingBack = true;
    try {
      const popped = this.stack.pop();
      if (popped) {
        this.forwardStack.push(popped);
      }
      console.log(`[NavigationStack] Popped: tab=${popped?.activeTab} fromPlayer=${popped?.fromPlayer} (Remaining: ${this.stack.length})`);

      const target = this.getCurrent();
      if (!target) return false;

      // If the popped screen came directly from the Expanded Player, restore the Expanded Player!
      if (popped?.fromPlayer) {
        target.isPlayerExpanded = true;
      }

      if (applyStateCallback) {
        applyStateCallback(target);
      }

      // Restore the target route's exact scroll position (Spotify-style scroll restoration)
      if (typeof window !== 'undefined') {
        const targetKey = ScrollManager.getInstance().getRouteKey({
          activeTab: target.activeTab,
          selectedAlbumId: target.selectedAlbumId,
          selectedArtistId: target.selectedArtistId,
          selectedPlaylistId: target.selectedPlaylistId,
        });
        ScrollManager.getInstance().navigateTo(targetKey);
      }

      this.notify();
      return true;
    } finally {
      this.isNavigatingBack = false;
    }
  }

  /**
   * Executes forward navigation.
   */
  public goForward(applyStateCallback?: (target: NavigationEntry) => void): boolean {
    if (this.forwardStack.length === 0) return false;

    this.isNavigatingForward = true;
    try {
      const nextEntry = this.forwardStack.pop();
      if (!nextEntry) return false;

      this.stack.push(nextEntry);
      console.log(`[NavigationStack] Forward: tab=${nextEntry.activeTab} (Depth: ${this.stack.length})`);

      if (applyStateCallback) {
        applyStateCallback(nextEntry);
      }

      if (typeof window !== 'undefined') {
        const targetKey = ScrollManager.getInstance().getRouteKey({
          activeTab: nextEntry.activeTab,
          selectedAlbumId: nextEntry.selectedAlbumId,
          selectedArtistId: nextEntry.selectedArtistId,
          selectedPlaylistId: nextEntry.selectedPlaylistId,
        });
        ScrollManager.getInstance().navigateTo(targetKey);
      }

      this.notify();
      return true;
    } finally {
      this.isNavigatingForward = false;
    }
  }
}
