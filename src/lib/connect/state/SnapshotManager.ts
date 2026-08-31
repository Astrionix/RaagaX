/**
 * RaagaX Connect — Snapshot Manager
 *
 * Persists and provides instant authoritative state snapshots on foregrounding/reconnection.
 */

import { ConnectPlaybackSession } from '@/types/connect';

export class SnapshotManager {
  private static instance: SnapshotManager;
  private latestSnapshot: ConnectPlaybackSession | null = null;

  private constructor() {}

  public static getInstance(): SnapshotManager {
    if (!SnapshotManager.instance) {
      SnapshotManager.instance = new SnapshotManager();
    }
    return SnapshotManager.instance;
  }

  public saveSnapshot(session: ConnectPlaybackSession): void {
    this.latestSnapshot = { ...session };
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('rx_connect_last_session', JSON.stringify(session));
      } catch {}
    }
  }

  public getSnapshot(): ConnectPlaybackSession | null {
    if (this.latestSnapshot) return { ...this.latestSnapshot };
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('rx_connect_last_session');
        if (raw) {
          this.latestSnapshot = JSON.parse(raw);
          return this.latestSnapshot;
        }
      } catch {}
    }
    return null;
  }
}
