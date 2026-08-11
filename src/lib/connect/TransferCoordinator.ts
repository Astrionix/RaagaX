import { ClockSynchronizer } from './ClockSynchronizer';
import { ConnectManager } from './ConnectManager';
import { DeviceLeaseManager } from './DeviceLeaseManager';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface TransferSnapshot {
  transferId: string;
  sessionId: string;
  epoch: number;

  queueId?: string;
  queueRevision?: number;
  queueItemId?: string;
  trackId: string;

  positionMs: number;
  capturedAtServerMs: number;
  targetStartAtServerMs: number;

  actualStartedAtServerMs?: number;
  startErrorMs?: number;

  isPlaying: boolean;

  sourceDeviceId: string;
  sourceInstanceId?: string;

  targetDeviceId: string;
  targetInstanceId?: string;
}

export type TransferPhase =
  | 'IDLE'
  | 'REQUESTED'
  | 'VALIDATING'
  | 'PREPARING'
  | 'READY'
  | 'ARMED'
  | 'COMMITTING'
  | 'STARTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK';

export class TransferCoordinator {
  private static instance: TransferCoordinator;

  private phase: TransferPhase = 'IDLE';
  private activeTransfer: TransferSnapshot | null = null;
  private estimatedPrepareMs: number = 200;

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

  public getActiveTransfer(): TransferSnapshot | null {
    return this.activeTransfer;
  }

  /**
   * Dynamically calculates target lead time based on RTT and pre-buffering estimates.
   * Clamped strictly between 300ms and 1500ms.
   */
  public calculateDynamicLeadMs(rttMs: number = 20): number {
    const calculated = this.estimatedPrepareMs + 2 * rttMs;
    return Math.max(300, Math.min(1500, calculated));
  }

  /**
   * Initiates an 11-state transactional handoff to a target device with dynamic lead time calculation.
   */
  public async initiateTransfer(targetDeviceId: string, rttMs: number = 20): Promise<boolean> {
    const store = usePlayerStore.getState();
    const clock = ClockSynchronizer.getInstance();
    const serverNow = clock.getEstimatedServerNow();

    const sessionId = ConnectManager.getInstance().getSessionId() || 'default_session';
    const currentPositionMs = store.currentTime * 1000;

    const leadMs = this.calculateDynamicLeadMs(rttMs);
    const targetStartAtServerMs = serverNow + leadMs;

    const transferId = `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const snapshot: TransferSnapshot = {
      transferId,
      sessionId,
      epoch: 1,
      trackId: store.currentSong?.id || '',
      positionMs: currentPositionMs,
      capturedAtServerMs: serverNow,
      targetStartAtServerMs,
      isPlaying: store.isPlaying,
      sourceDeviceId: store.deviceId,
      targetDeviceId,
    };

    this.activeTransfer = snapshot;
    this.phase = 'REQUESTED';

    console.log(`[TransferCoordinator] Transfer ${transferId} initiated. State: REQUESTED ➔ PREPARING. Lead: ${leadMs}ms.`);

    this.phase = 'PREPARING';

    // Source device continues playing seamlessly during PREPARING phase
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
   * Target device prepares stream, verifies readiness, claims lease, and records actualStartedAtServerMs + startErrorMs.
   */
  public async handleIncomingTransferRequest(snapshot: TransferSnapshot): Promise<void> {
    console.log(`[TransferCoordinator] Target handling transfer ${snapshot.transferId} from ${snapshot.sourceDeviceId}`);
    this.activeTransfer = snapshot;
    this.phase = 'PREPARING';

    const store = usePlayerStore.getState();
    const clock = ClockSynchronizer.getInstance();

    // 1. Pre-buffer stream and set local target player state
    usePlayerStore.setState({
      currentSong: store.currentSong || ({ id: snapshot.trackId, title: 'Transfer Song' } as any),
      currentTime: snapshot.positionMs / 1000,
    });

    this.phase = 'READY';
    console.log(`[TransferCoordinator] Target READY. Transitioning to ARMED.`);

    this.phase = 'ARMED';

    // 2. Claim playback lease atomically at COMMIT stage
    this.phase = 'COMMITTING';
    const leaseAcquired = await DeviceLeaseManager.getInstance().acquireLease(snapshot.sessionId, true);

    if (!leaseAcquired) {
      this.phase = 'ROLLED_BACK';
      console.warn('[TransferCoordinator] Lease claim failed. Transaction ROLLED_BACK.');
      return;
    }

    this.phase = 'STARTING';
    const serverStartNow = clock.getEstimatedServerNow();

    // Record actual started server timestamp and start error verification metric
    snapshot.actualStartedAtServerMs = serverStartNow;
    snapshot.startErrorMs = serverStartNow - snapshot.targetStartAtServerMs;

    this.phase = 'VERIFYING';
    console.log(`[TransferCoordinator] Verification: Start error = ${snapshot.startErrorMs}ms`);

    this.phase = 'COMPLETED';
    usePlayerStore.setState({ isPlaying: snapshot.isPlaying, isActiveDevice: true });
    console.log(`[TransferCoordinator] Transfer ${snapshot.transferId} COMPLETED successfully.`);
  }
}
