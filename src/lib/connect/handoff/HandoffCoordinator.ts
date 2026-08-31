/**
 * RaagaX Connect — Handoff Coordinator
 *
 * Enforces Handoff Safety Invariant:
 * TARGET PREPARES & CONFIRMS READY -> TARGET STARTS -> AUTHORITY TRANSFERS -> SOURCE STOPS.
 * Never stop the old player before the new player is ready.
 */

import { ConnectDevice, ConnectPlaybackSession } from '@/types/connect';
import { CommandRouter } from '../commands/CommandRouter';

export type HandoffState = 'IDLE' | 'PREPARING_TARGET' | 'TRANSFERRING_AUTHORITY' | 'COMMITTED' | 'FAILED';

export class HandoffCoordinator {
  private static instance: HandoffCoordinator;
  private state: HandoffState = 'IDLE';

  private constructor() {}

  public static getInstance(): HandoffCoordinator {
    if (!HandoffCoordinator.instance) {
      HandoffCoordinator.instance = new HandoffCoordinator();
    }
    return HandoffCoordinator.instance;
  }

  public getState(): HandoffState {
    return this.state;
  }

  public async coordinateHandoff(
    fromDevice: ConnectDevice,
    toDevice: ConnectDevice,
    session: ConnectPlaybackSession,
    exactPositionMs: number
  ): Promise<boolean> {
    if (!session || !session.currentSong) return false;
    this.state = 'PREPARING_TARGET';

    console.log(`[CONNECT_HANDOFF]\nfromDevice=${fromDevice.deviceId}\ntoDevice=${toDevice.deviceId}\npositionMs=${exactPositionMs}`);

    // 1. Prepare target device
    const transferCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      senderDeviceId: fromDevice.deviceId,
      targetDeviceId: toDevice.deviceId,
      action: 'TRANSFER_PLAYBACK' as const,
      payload: {
        song: session.currentSong,
        queue: session.queue,
        queueIndex: session.queueIndex,
        positionMs: exactPositionMs,
        isPlaying: session.isPlaying,
        volume: session.volume,
        timelineId: `TL_${Date.now().toString(36)}`,
      },
      timestamp: Date.now(),
    };

    this.state = 'TRANSFERRING_AUTHORITY';
    const dispatched = await CommandRouter.getInstance().route(transferCommand);
    if (!dispatched) {
      this.state = 'FAILED';
      return false;
    }

    // 2. Stop old source device only after target received transfer
    if (fromDevice.deviceId !== toDevice.deviceId) {
      const pauseCommand = {
        commandId: `cmd_${Date.now().toString(36)}`,
        requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        senderDeviceId: toDevice.deviceId,
        targetDeviceId: fromDevice.deviceId,
        action: 'PAUSE' as const,
        timestamp: Date.now(),
      };
      await CommandRouter.getInstance().route(pauseCommand);
    }

    this.state = 'COMMITTED';
    return true;
  }
}
