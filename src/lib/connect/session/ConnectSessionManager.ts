/**
 * RaagaX Connect — Connect Session Manager
 *
 * Coordinates active session lifecycle, survives React screen navigation,
 * and maintains continuous connection across Home, Search, Album, and Library.
 */

import { ConnectPlaybackSession } from '@/types/connect';
import { ConnectServerEngine } from '../ConnectServerEngine';
import { StateReplicator } from '../state/StateReplicator';

export class ConnectSessionManager {
  private static instance: ConnectSessionManager;

  private constructor() {}

  public static getInstance(): ConnectSessionManager {
    if (!ConnectSessionManager.instance) {
      ConnectSessionManager.instance = new ConnectSessionManager();
    }
    return ConnectSessionManager.instance;
  }

  public getSession(): ConnectPlaybackSession {
    return ConnectServerEngine.getInstance().getSession();
  }

  public publishPeriodicSync(): void {
    const session = this.getSession();
    if (session.isPlaying) {
      StateReplicator.getInstance().replicate(session);
    }
  }
}
