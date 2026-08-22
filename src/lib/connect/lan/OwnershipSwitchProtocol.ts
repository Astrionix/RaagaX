'use client';

import {
  LANSwitchRequestMessage,
  LANSwitchOfferMessage,
  LANSwitchReadyMessage,
  LANSwitchCommitMessage,
  LANSwitchFailedMessage,
} from './types';
import { DirectLANTransport } from './DirectLANTransport';
import { LocalDiscoveryService } from './LocalDiscoveryService';
import { PlaybackOwnerEngine } from './PlaybackOwnerEngine';
import { ConnectAuthManager } from './ConnectAuthManager';
import { usePlayerStore } from '@/context/usePlayerStore';

export type SwitchProgressCallback = (step: number, stepName: string) => void;

export class OwnershipSwitchProtocol {
  private static instance: OwnershipSwitchProtocol;
  private activeTransfers = new Map<string, {
    sourceDeviceId: string;
    targetDeviceId: string;
    status: 'REQUESTED' | 'OFFERED' | 'READY' | 'COMMITTED' | 'FAILED';
    snapshot?: any;
    resolve?: (success: boolean) => void;
    reject?: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private constructor() {
    DirectLANTransport.getInstance().onMessage((msg) => {
      switch (msg.type) {
        case 'SWITCH_REQUEST':
          this.handleSwitchRequest(msg as LANSwitchRequestMessage);
          break;
        case 'SWITCH_OFFER':
          this.handleSwitchOffer(msg as LANSwitchOfferMessage);
          break;
        case 'SWITCH_READY':
          this.handleSwitchReady(msg as LANSwitchReadyMessage);
          break;
        case 'SWITCH_COMMIT':
          this.handleSwitchCommit(msg as LANSwitchCommitMessage);
          break;
        case 'SWITCH_FAILED':
          this.handleSwitchFailed(msg as LANSwitchFailedMessage);
          break;
      }
    });
  }

  public static getInstance(): OwnershipSwitchProtocol {
    if (!OwnershipSwitchProtocol.instance) {
      OwnershipSwitchProtocol.instance = new OwnershipSwitchProtocol();
    }
    return OwnershipSwitchProtocol.instance;
  }

  /**
   * Initiates atomic ownership transfer.
   * If local device is Owner: Pushes playback to target by sending SWITCH_OFFER directly.
   * If local device is Controller: Requests transfer from current owner via SWITCH_REQUEST.
   */
  public async switchPlayback(
    targetDeviceId: string,
    onProgress?: SwitchProgressCallback
  ): Promise<boolean> {
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    const isOwner = PlaybackOwnerEngine.getInstance().isOwner();
    const currentOwnerId = PlaybackOwnerEngine.getInstance().getActiveOwnerId();
    const transferId = 'tr_' + Math.random().toString(36).substring(2, 10);

    onProgress?.(1, 'Connecting to target...');

    if (isOwner) {
      // ── Case A: Local device is OWNER -> Push playback to target ──────────
      console.log(`[OwnershipSwitchProtocol] Owner pushing playback to ${targetDeviceId}`);
      const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();

      const offerMsg: LANSwitchOfferMessage = {
        id: 'sw_off_' + Date.now(),
        type: 'SWITCH_OFFER',
        sourceDeviceId: localId,
        targetDeviceId,
        transferId,
        snapshot: {
          song: snapshot.song,
          queue: snapshot.queue,
          queueIndex: snapshot.queueIndex,
          positionMs: snapshot.positionMs,
          durationMs: snapshot.durationMs,
          isPlaying: snapshot.isPlaying,
          playbackRate: snapshot.playbackRate,
          stateVersion: snapshot.stateVersion,
        },
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn(`[OwnershipSwitchProtocol] Transfer ${transferId} timed out waiting for SWITCH_READY`);
          this.activeTransfers.delete(transferId);
          resolve(false);
        }, 7000);

        this.activeTransfers.set(transferId, {
          sourceDeviceId: localId,
          targetDeviceId,
          status: 'OFFERED',
          resolve,
          reject,
          timeout,
        });

        DirectLANTransport.getInstance().sendMessage(targetDeviceId, offerMsg);
      });
    } else {
      // ── Case B: Local device is CONTROLLER -> Pull playback from owner ────
      console.log(`[OwnershipSwitchProtocol] Controller pulling playback from owner ${currentOwnerId}`);
      const requestMsg: LANSwitchRequestMessage = {
        id: 'sw_req_' + Date.now(),
        type: 'SWITCH_REQUEST',
        sourceDeviceId: localId,
        targetDeviceId: currentOwnerId,
        transferId,
        initiatorDeviceId: localId,
        timestamp: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn(`[OwnershipSwitchProtocol] Transfer ${transferId} timed out waiting for SWITCH_OFFER`);
          this.activeTransfers.delete(transferId);
          resolve(false);
        }, 7000);

        this.activeTransfers.set(transferId, {
          sourceDeviceId: currentOwnerId,
          targetDeviceId: localId,
          status: 'REQUESTED',
          resolve,
          reject,
          timeout,
        });

        DirectLANTransport.getInstance().sendMessage(currentOwnerId, requestMsg);
      });
    }
  }

  /**
   * Source Device: Receives SWITCH_REQUEST from Target
   */
  private handleSwitchRequest(req: LANSwitchRequestMessage) {
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    const isOwner = PlaybackOwnerEngine.getInstance().isOwner();

    // If this device is the owner, verify switch permission
    if (isOwner) {
      if (!ConnectAuthManager.getInstance().canSwitch(req.sourceDeviceId)) {
        console.warn(`[OwnershipSwitchProtocol] Switch request from ${req.sourceDeviceId} rejected: switching not permitted`);
        const failMsg: LANSwitchFailedMessage = {
          id: 'sw_fail_' + Date.now(),
          type: 'SWITCH_FAILED',
          sourceDeviceId: localId,
          targetDeviceId: req.sourceDeviceId,
          transferId: req.transferId,
          errorCode: 'REJECTED',
          reason: 'Playback switching permission was not granted by device owner',
          timestamp: Date.now(),
        };
        DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, failMsg);
        return;
      }

      const snapshot = PlaybackOwnerEngine.getInstance().getStateSnapshot();

      const offerMsg: LANSwitchOfferMessage = {
        id: 'sw_off_' + Date.now(),
        type: 'SWITCH_OFFER',
        sourceDeviceId: localId,
        targetDeviceId: req.sourceDeviceId,
        transferId: req.transferId,
        snapshot: {
          song: snapshot.song,
          queue: snapshot.queue,
          queueIndex: snapshot.queueIndex,
          positionMs: snapshot.positionMs,
          durationMs: snapshot.durationMs,
          isPlaying: snapshot.isPlaying,
          playbackRate: snapshot.playbackRate,
          stateVersion: snapshot.stateVersion,
        },
        timestamp: Date.now(),
      };

      DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, offerMsg);
    }
  }

  /**
   * Target Device: Receives SWITCH_OFFER with playback snapshot from Source
   */
  private async handleSwitchOffer(offer: LANSwitchOfferMessage) {
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    const { song, queue, queueIndex, positionMs, isPlaying } = offer.snapshot;

    try {
      if (!song) {
        throw new Error('Empty song in switch offer');
      }

      // Pre-load track in player
      const { PlaybackService } = await import('@/lib/playback/PlaybackService');
      const seekSec = (positionMs || 0) / 1000;

      // Prepare local store
      usePlayerStore.setState({
        currentSong: song,
        queue: queue || [song],
        queueIndex: queueIndex || 0,
        currentTime: seekSec,
        duration: (offer.snapshot.durationMs || 0) / 1000,
      });

      // Confirm ready
      const readyMsg: LANSwitchReadyMessage = {
        id: 'sw_rdy_' + Date.now(),
        type: 'SWITCH_READY',
        sourceDeviceId: localId,
        targetDeviceId: offer.sourceDeviceId,
        transferId: offer.transferId,
        readyPositionMs: positionMs,
        timestamp: Date.now(),
      };

      DirectLANTransport.getInstance().sendMessage(offer.sourceDeviceId, readyMsg);
    } catch (err: any) {
      console.error('[OwnershipSwitchProtocol] Pre-load failed:', err);
      // Failure protection: notify source to stay owner without interruption
      const failedMsg: LANSwitchFailedMessage = {
        id: 'sw_fail_' + Date.now(),
        type: 'SWITCH_FAILED',
        sourceDeviceId: localId,
        targetDeviceId: offer.sourceDeviceId,
        transferId: offer.transferId,
        reason: err?.message || 'Preload failed',
        errorCode: 'PLAYBACK_ERROR',
        timestamp: Date.now(),
      };
      DirectLANTransport.getInstance().sendMessage(offer.sourceDeviceId, failedMsg);
    }
  }

  /**
   * Source Device: Receives SWITCH_READY from Target -> releases player and commits
   */
  private handleSwitchReady(ready: LANSwitchReadyMessage) {
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;

    // 1. Release local player execution
    try {
      import('@/lib/playback/PlaybackService').then(({ PlaybackService }) => {
        PlaybackService.getInstance().pause();
      });
    } catch {}

    // 2. Transition this device from OWNER to CONTROLLER
    PlaybackOwnerEngine.getInstance().setOwner(ready.sourceDeviceId, false);
    usePlayerStore.setState({
      activeDeviceId: ready.sourceDeviceId,
      connectedDeviceId: ready.sourceDeviceId,
      isActiveDevice: false,
    });
    
    // Authorize new owner for reciprocal control & state updates
    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: ready.sourceDeviceId,
      deviceName: 'Paired Owner',
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    // 3. Send commit to target
    const commitMsg: LANSwitchCommitMessage = {
      id: 'sw_cmt_' + Date.now(),
      type: 'SWITCH_COMMIT',
      sourceDeviceId: localId,
      targetDeviceId: ready.sourceDeviceId,
      transferId: ready.transferId,
      newOwnerDeviceId: ready.sourceDeviceId,
      finalPositionMs: ready.readyPositionMs,
      stateVersion: 1,
      timestamp: Date.now(),
    };

    DirectLANTransport.getInstance().sendMessage(ready.sourceDeviceId, commitMsg);

    const pending = this.activeTransfers.get(ready.transferId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve?.(true);
      this.activeTransfers.delete(ready.transferId);
    }
  }

  /**
   * Target Device: Receives SWITCH_COMMIT -> becomes OWNER and starts playback
   */
  private async handleSwitchCommit(commit: LANSwitchCommitMessage) {
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;

    // 1. Become active owner
    PlaybackOwnerEngine.getInstance().setOwner(localId, true);
    usePlayerStore.setState({
      activeDeviceId: localId,
      connectedDeviceId: null,
      isActiveDevice: true,
      remoteDeviceName: undefined,
      deviceConnectionState: 'AVAILABLE',
    });

    // Authorize previous owner as active controller
    ConnectAuthManager.getInstance().addTrustedPeer({
      deviceId: commit.sourceDeviceId,
      deviceName: 'Paired Controller',
      permissions: { allowControl: true, allowSwitch: true },
      pairedAt: Date.now(),
      expiresAt: null,
    });

    // 2. Start native playback at exact target position
    try {
      const store = usePlayerStore.getState();
      if (store.currentSong) {
        await store.switchTrack(store.currentSong, store.queueIndex, true);
        const seekSec = commit.finalPositionMs / 1000;
        store.setCurrentTime(seekSec);
        store.setSeekTarget(seekSec);
        try {
          const { PlaybackService } = await import('@/lib/playback/PlaybackService');
          PlaybackService.getInstance().seek(seekSec);
        } catch {}
      }
    } catch (e) {
      console.warn('[OwnershipSwitchProtocol] Playback start error on commit:', e);
    }

    // 3. Broadcast authoritative state version 1 as new owner
    PlaybackOwnerEngine.getInstance().publishAuthoritativePlaybackState();

    const pending = this.activeTransfers.get(commit.transferId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve?.(true);
      this.activeTransfers.delete(commit.transferId);
    }
  }

  /**
   * Failure Rollback Handler: Target failed, Source keeps playing seamlessly
   */
  private handleSwitchFailed(failed: LANSwitchFailedMessage) {
    console.warn(`[OwnershipSwitchProtocol] Switch failed (${failed.reason}). Rollback engaged: current owner continues.`);

    const pending = this.activeTransfers.get(failed.transferId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve?.(false);
      this.activeTransfers.delete(failed.transferId);
    }
  }

  /**
   * Cancel all in-flight switches on disconnect.
   * Only transfers in REQUESTED or OFFERED phase are cancelled — READY→COMMIT is atomic
   * and has already executed, so we never undo a completed handover.
   * The current owner retains playback and the session remains unchanged.
   */
  public cancelAllTransfers() {
    for (const [transferId, transfer] of this.activeTransfers.entries()) {
      if (transfer.status === 'REQUESTED' || transfer.status === 'OFFERED') {
        console.log(`[OwnershipSwitchProtocol] Cancelling in-flight transfer ${transferId} (status: ${transfer.status}) due to disconnect`);
        clearTimeout(transfer.timeout);
        transfer.resolve?.(false);

        // Notify the remote device to cancel as well if we are the initiator
        const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
        try {
          const cancelMsg = {
            id: 'sw_cancel_' + Date.now(),
            type: 'SWITCH_CANCEL' as const,
            sourceDeviceId: localId,
            targetDeviceId: transfer.targetDeviceId,
            transferId,
            timestamp: Date.now(),
          };
          DirectLANTransport.getInstance().sendMessage(transfer.targetDeviceId, cancelMsg as any);
        } catch {}

        this.activeTransfers.delete(transferId);
      }
    }
  }
}

