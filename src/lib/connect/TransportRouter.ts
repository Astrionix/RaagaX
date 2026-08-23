/**
 * TransportRouter — sits between CommandBus and the physical transports (LAN DataChannel / Cloud Relay).
 *
 * Command classification (from COMMAND_CLASS_MAP in types.ts):
 *
 *   CRITICAL       → Send over best transport + shadow-copy to Cloud (same commandId).
 *                    Renderer's CommandValidator deduplicates — executes exactly once.
 *                    Used for: PLAY, PAUSE, SEEK, NEXT, PREV, TRANSFER_*, CONTROLLER_*
 *
 *   INTERACTIVE    → Best transport only. Rapid identical types coalesced within 50ms.
 *                    Used for: SET_VOLUME, SET_SHUFFLE, SET_REPEAT, QUEUE_SHUFFLE_COMMIT
 *
 *   HIGH_FREQUENCY → Blocked from any transport. Local UI only.
 *                    Used for: SEEK_DRAG, POSITION_PREVIEW, HEARTBEAT, HEARTBEAT_ACK
 *
 * Predictive transport switching (Phase 2 integration):
 *   When TransportHealthMonitor flags LAN as DEGRADING, the Cloud shadow is already
 *   warm, so switching transport has zero perceived latency.
 *
 * Seamless bidirectional switching:
 *   LAN → Cloud: onLanChannelLost() called by LocalPeerConnection on heartbeat timeout.
 *   Cloud → LAN: onLanChannelAvailable() called when WebRTC handshake completes.
 */

import { ConnectCommand, COMMAND_CLASS_MAP, TransportMode } from './types';
import { ConnectivityRouter } from './ConnectivityRouter';

export type TransportDispatchResult =
  | { sent: true; via: TransportMode }
  | { sent: false; reason: string };

// Coalescing state for INTERACTIVE commands — per target device, per command type
type CoalesceKey = string; // ${targetDeviceId}:
interface PendingCoalesce {
  command: ConnectCommand;
  cloudFallback: (cmd: ConnectCommand) => Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}

export class TransportRouter {
  private static instance: TransportRouter;

  /** Pending coalesced INTERACTIVE commands waiting to be flushed */
  private coalescePending = new Map<CoalesceKey, PendingCoalesce>();

  private constructor() {}

  public static getInstance(): TransportRouter {
    if (!TransportRouter.instance) {
      TransportRouter.instance = new TransportRouter();
    }
    return TransportRouter.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public dispatch API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Routes a targeted command to a specific device.
   * Applies command classification before dispatching.
   */
  public async dispatchTargeted(
    targetDeviceId: string,
    command: ConnectCommand,
    cloudFallback: (cmd: ConnectCommand) => Promise<void>
  ): Promise<TransportDispatchResult> {
    const cls = COMMAND_CLASS_MAP[command.type] ?? 'INTERACTIVE';

    // HIGH_FREQUENCY: reject — should never reach the transport layer
    if (cls === 'HIGH_FREQUENCY') {
      console.warn(`[TransportRouter] Blocking HIGH_FREQUENCY command ${command.type} from transport`);
      return { sent: false, reason: 'HIGH_FREQUENCY commands are local only' };
    }

    // INTERACTIVE: coalesce rapid identical commands, then dispatch once
    if (cls === 'INTERACTIVE') {
      return this.coalesceAndDispatch(targetDeviceId, command, cloudFallback);
    }

    // CRITICAL: send over best transport + shadow to Cloud
    return this.dispatchCritical(targetDeviceId, command, cloudFallback);
  }

  /**
   * Routes a broadcast command (no specific target — all session devices).
   */
  public async dispatchBroadcast(
    command: ConnectCommand,
    cloudFallback: (cmd: ConnectCommand) => Promise<void>
  ): Promise<TransportDispatchResult> {
    const cls = COMMAND_CLASS_MAP[command.type] ?? 'INTERACTIVE';

    if (cls === 'HIGH_FREQUENCY') {
      return { sent: false, reason: 'HIGH_FREQUENCY commands are local only' };
    }

    const router = ConnectivityRouter.getInstance();
    const activeTransport = router.getActiveTransport();

    if (activeTransport === 'LOCAL_DIRECT' || activeTransport === 'HOTSPOT_DIRECT') {
      const { LocalPeerConnection } = await import('./LocalPeerConnection');
      const sentDirect = LocalPeerConnection.getInstance().sendDirectBroadcast(command);
      if (sentDirect) {
        // CRITICAL broadcasts also cloud-shadow
        if (cls === 'CRITICAL') {
          cloudFallback(command).catch(() => {});
        }
        return { sent: true, via: activeTransport };
      }
      router.setLocalPeerAvailable(false);
    }

    try {
      await cloudFallback(command);
      return { sent: true, via: 'CLOUD_RELAY' };
    } catch (e) {
      return { sent: false, reason: String(e) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal routing helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * CRITICAL dispatch: send over best transport, then independently fire cloud shadow.
   * Both paths carry the same commandId — renderer deduplicates.
   */
  private async dispatchCritical(
    targetDeviceId: string,
    command: ConnectCommand,
    cloudFallback: (cmd: ConnectCommand) => Promise<void>
  ): Promise<TransportDispatchResult> {
    const router = ConnectivityRouter.getInstance();
    const activeTransport = router.getActiveTransport();

    if (activeTransport === 'LOCAL_DIRECT' || activeTransport === 'HOTSPOT_DIRECT') {
      const { LocalPeerConnection } = await import('./LocalPeerConnection');
      const sentDirect = LocalPeerConnection.getInstance().sendDirectCommand(targetDeviceId, command);

      if (sentDirect) {
        // Primary delivery via LAN. Cloud shadow fires in parallel for redundancy.
        cloudFallback(command).catch((e) =>
          console.warn(`[TransportRouter] Cloud shadow for ${command.type} failed (non-fatal):`, e)
        );
        return { sent: true, via: activeTransport };
      }

      // LAN channel failed mid-send — shift immediately
      console.warn(
        `[TransportRouter] LAN channel for ${targetDeviceId} unreachable. ` +
        `Failing over to CLOUD_RELAY for ${command.type} (id=${command.commandId})`
      );
      router.setLocalPeerAvailable(false);
    }

    // Cloud-only path (LAN unavailable or failed)
    try {
      await cloudFallback(command);
      return { sent: true, via: 'CLOUD_RELAY' };
    } catch (e) {
      return { sent: false, reason: String(e) };
    }
  }

  /**
   * INTERACTIVE coalescing: if the same command type to the same device arrives
   * within 50ms, only the last one is sent. Prevents volume slider spam.
   */
  private coalesceAndDispatch(
    targetDeviceId: string,
    command: ConnectCommand,
    cloudFallback: (cmd: ConnectCommand) => Promise<void>
  ): Promise<TransportDispatchResult> {
    const key: CoalesceKey = `${targetDeviceId}:${command.type}`;

    return new Promise((resolve) => {
      const existing = this.coalescePending.get(key);
      if (existing) {
        clearTimeout(existing.timer);
      }

      const timer = setTimeout(async () => {
        this.coalescePending.delete(key);
        const result = await this.dispatchCritical(targetDeviceId, command, cloudFallback);
        resolve(result);
      }, 50);

      this.coalescePending.set(key, { command, cloudFallback, timer });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAN channel lifecycle callbacks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called by LocalPeerConnection when a new direct channel becomes available.
   * Cloud → LAN automatic upgrade path.
   */
  public onLanChannelAvailable(deviceId: string, isHotspot = false) {
    console.log(`[TransportRouter] LAN channel available for ${deviceId}. Upgrading transport.`);
    ConnectivityRouter.getInstance().setLocalPeerAvailable(true, isHotspot);
  }

  /**
   * Called by LocalPeerConnection when a direct channel is lost.
   * LAN → Cloud automatic failover path.
   */
  public onLanChannelLost(deviceId: string) {
    import('./ConnectManager').then(({ ConnectManager }) => {
      if (ConnectManager.getInstance().isManualDisconnectRequested()) {
        return;
      }
      const gen = ConnectManager.getInstance().getConnectionGeneration();
      console.warn(`[TransportRouter][gen=${gen}] Established LAN channel lost for ${deviceId}. Falling back to CLOUD_RELAY.`);
      ConnectivityRouter.getInstance().setLocalPeerAvailable(false);
    }).catch(() => {
      ConnectivityRouter.getInstance().setLocalPeerAvailable(false);
    });
  }


  /**
   * Returns a human-friendly connection label (for diagnostics/debug only, not user-facing).
   */
  public getTransportLabel(): string {
    const transport = ConnectivityRouter.getInstance().getActiveTransport();
    switch (transport) {
      case 'LOCAL_DIRECT':   return 'Connected · Local';
      case 'HOTSPOT_DIRECT': return 'Connected · Hotspot';
      case 'CLOUD_RELAY':    return 'Connected · Remote';
      default:               return 'Connected';
    }
  }
}
