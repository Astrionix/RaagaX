'use client';

import { ConnectCommandType, ConnectCommand } from './types';

export interface PendingPlaybackIntent {
  type: ConnectCommandType;
  targetDeviceId: string;
  payload?: any;
  createdAt: number;
  resolve: (res: { success: boolean; reason?: string }) => void;
}

export class SingleFlightCommandQueue {
  private static instance: SingleFlightCommandQueue;
  private inFlightPerTarget = new Map<string, boolean>();
  private pendingIntentPerTarget = new Map<string, PendingPlaybackIntent>();

  private constructor() {}

  public static getInstance(): SingleFlightCommandQueue {
    if (!SingleFlightCommandQueue.instance) {
      SingleFlightCommandQueue.instance = new SingleFlightCommandQueue();
    }
    return SingleFlightCommandQueue.instance;
  }

  /**
   * Enqueues a playback command with single-flight execution and latest-intent coalescing.
   */
  public async executeSingleFlight(
    targetDeviceId: string,
    type: ConnectCommandType,
    payload: any,
    dispatchFn: () => Promise<{ success: boolean; reason?: string }>
  ): Promise<{ success: boolean; reason?: string }> {
    const isBusy = this.inFlightPerTarget.get(targetDeviceId) || false;

    if (isBusy) {
      console.log(`[SingleFlightQueue] Target ${targetDeviceId} has command in-flight. Coalescing intent: ${type}`);
      return new Promise((resolve) => {
        // Coalesce or update the pending next intent (Latest Intent Wins)
        this.pendingIntentPerTarget.set(targetDeviceId, {
          type,
          targetDeviceId,
          payload,
          createdAt: Date.now(),
          resolve,
        });
      });
    }

    // Mark target as in-flight
    this.inFlightPerTarget.set(targetDeviceId, true);

    try {
      const result = await dispatchFn();
      return result;
    } finally {
      this.inFlightPerTarget.set(targetDeviceId, false);

      // Check if a coalesced intent was queued while we were in-flight
      const nextIntent = this.pendingIntentPerTarget.get(targetDeviceId);
      if (nextIntent) {
        this.pendingIntentPerTarget.delete(targetDeviceId);
        console.log(`[SingleFlightQueue] Executing coalesced next intent for ${targetDeviceId}: ${nextIntent.type}`);
        
        // Execute next intent asynchronously
        this.executeSingleFlight(
          nextIntent.targetDeviceId,
          nextIntent.type,
          nextIntent.payload,
          dispatchFn
        ).then(nextIntent.resolve);
      }
    }
  }

  public clear(targetDeviceId?: string) {
    if (targetDeviceId) {
      this.inFlightPerTarget.delete(targetDeviceId);
      this.pendingIntentPerTarget.delete(targetDeviceId);
    } else {
      this.inFlightPerTarget.clear();
      this.pendingIntentPerTarget.clear();
    }
  }
}
