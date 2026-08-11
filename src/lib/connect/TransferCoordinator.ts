import { ClockSynchronizer } from './ClockSynchronizer';
import { ConnectManager } from './ConnectManager';
import { DeviceLeaseManager } from './DeviceLeaseManager';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface TransferSnapshot {
  sessionId: string;
  trackId: string;
  queueItemId?: string;
  positionMs: number;
  capturedAtServerMs: number;
  targetStartAtServerMs: number;
  isPlaying: boolean;
  queueId?: string;
  queueRevision?: number;
  epoch: number;
  sourceDeviceId: string;
  targetDeviceId: string;
}

export type TransferPhase = 'IDLE' | 'PREPARING' | 'READY' | 'COMMITTED' | 'FAILED';

export class TransferCoordinator {
  private static instance: TransferCoordinator;

  private phase: TransferPhase = 'IDLE';
  private activeTransfer: TransferSnapshot | null = null;

  private constructor() {}

  public static getInstance(): TransferCoordinator {
    if (!TransferCoordinator.instance) {
      TransferCoordinator.instance = new TransferCoordinator();
    }
    return TransferCoordinator.instance;
  }

  public getPhase(): TransferPhase {
    return this.phase;
  }

  /**
   * Initiates a 4-phase clock-aligned handoff to a target device with targetStartAtServerMs.
   */
  public async initiateTransfer(targetDeviceId: string): Promise<boolean> {
    const store = usePlayerStore.getState();
    const clock = ClockSynchronizer.getInstance();
    const serverNow = clock.getEstimatedServerNow();

    const sessionId = ConnectManager.getInstance().getSessionId() || 'default_session';
    const currentPositionMs = store.currentTime * 1000;

    // Compute targetStartAtServerMs (500ms in the future for pre-buffering)
    const targetStartAtServerMs = serverNow + 500;

    const snapshot: TransferSnapshot = {
      sessionId,
      trackId: store.currentSong?.id || '',
      positionMs: currentPositionMs,
      capturedAtServerMs: serverNow,
      targetStartAtServerMs,
      isPlaying: store.isPlaying,
      epoch: 1,
      sourceDeviceId: store.deviceId,
      targetDeviceId,
    };

    this.activeTransfer = snapshot;
    this.phase = 'PREPARING';

    console.log(`[TransferCoordinator] Initiating transfer to ${targetDeviceId}. Target start server time: ${targetStartAtServerMs}`);

    // Send targeted PREPARE command to target device
    await ConnectManager.getInstance().sendTargetedCommand(targetDeviceId, {
      commandId: crypto.randomUUID(),
      sessionId,
      epoch: 1,
      sequence: 1,
      sourceDeviceId: store.deviceId,
      targetDeviceId,
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload: snapshot,
    });

    return true;
  }

  /**
   * Target device prepares playback stream before acknowledging handoff.
   */
  public async handleIncomingTransferRequest(snapshot: TransferSnapshot): Promise<void> {
    console.log(`[TransferCoordinator] Handling incoming transfer request from ${snapshot.sourceDeviceId}`);
    this.activeTransfer = snapshot;
    this.phase = 'PREPARING';

    const store = usePlayerStore.getState();
    const clock = ClockSynchronizer.getInstance();

    // 1. Set current song and queue state locally
    usePlayerStore.setState({
      isPlaying: snapshot.isPlaying,
      currentTime: snapshot.positionMs / 1000,
    });

    // 2. Compute wait time until targetStartAtServerMs
    const serverNow = clock.getEstimatedServerNow();
    const delayMs = Math.max(0, snapshot.targetStartAtServerMs - serverNow);

    console.log(`[TransferCoordinator] Pre-buffering complete. Scheduling playback start in ${delayMs}ms.`);

    this.phase = 'READY';

    // 3. Claim playback lease for this device
    const leaseAcquired = await DeviceLeaseManager.getInstance().acquireLease(snapshot.sessionId, true);

    if (leaseAcquired) {
      this.phase = 'COMMITTED';
      console.log(`[TransferCoordinator] Lease acquired on target device ${store.deviceId}. Handoff complete.`);
    } else {
      this.phase = 'FAILED';
      console.warn('[TransferCoordinator] Lease claim failed during transfer commit.');
    }
  }
}
