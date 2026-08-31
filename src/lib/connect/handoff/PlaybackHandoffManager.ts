/**
 * RaagaX Connect — Playback Handoff Manager
 *
 * Exposes device switching and playback transfer workflows.
 */

import { ConnectDevice, ConnectPlaybackSession } from '@/types/connect';
import { HandoffCoordinator } from './HandoffCoordinator';

export class PlaybackHandoffManager {
  private static instance: PlaybackHandoffManager;

  private constructor() {}

  public static getInstance(): PlaybackHandoffManager {
    if (!PlaybackHandoffManager.instance) {
      PlaybackHandoffManager.instance = new PlaybackHandoffManager();
    }
    return PlaybackHandoffManager.instance;
  }

  public async handoff(
    fromDevice: ConnectDevice,
    toDevice: ConnectDevice,
    session: ConnectPlaybackSession,
    exactPositionMs: number
  ): Promise<boolean> {
    return HandoffCoordinator.getInstance().coordinateHandoff(fromDevice, toDevice, session, exactPositionMs);
  }
}
