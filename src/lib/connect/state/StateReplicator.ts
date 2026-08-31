/**
 * RaagaX Connect — State Replicator
 *
 * Broadcasts authoritative state to all controllers and computes smooth timeline positions.
 */

import { ConnectEvent, ConnectPlaybackSession } from '@/types/connect';
import { SnapshotManager } from './SnapshotManager';

export class StateReplicator {
  private static instance: StateReplicator;
  private broadcastChannel: BroadcastChannel | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('raaga_connect_rpc_channel');
      } catch {}
    }
  }

  public static getInstance(): StateReplicator {
    if (!StateReplicator.instance) {
      StateReplicator.instance = new StateReplicator();
    }
    return StateReplicator.instance;
  }

  public replicate(session: ConnectPlaybackSession): void {
    SnapshotManager.getInstance().saveSnapshot(session);

    if (this.broadcastChannel) {
      try {
        const event: ConnectEvent = {
          eventId: `EV_${Date.now().toString(36)}`,
          type: 'SESSION_STATE_CHANGED',
          senderDeviceId: session.playbackDeviceId,
          session,
          serverTimestamp: Date.now(),
        };
        this.broadcastChannel.postMessage(event);
      } catch {}
    }

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      fetch('/api/connect/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      }).catch(() => {});
    }
  }

  public calculateInterpolatedPosition(session: ConnectPlaybackSession | null): number {
    if (!session) return 0;
    if (!session.isPlaying) {
      return session.positionMs / 1000;
    }

    const elapsedMs = Math.max(0, Date.now() - session.anchorTimeMs);
    const totalPosMs = session.anchorPositionMs + elapsedMs;
    const clampedMs = session.durationMs > 0
      ? Math.min(session.durationMs, totalPosMs)
      : totalPosMs;

    return clampedMs / 1000;
  }
}
