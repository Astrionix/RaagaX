/**
 * RaagaX Connect — Reactive Zustand Store
 *
 * Exposes device discovery state, active target device, remote playback session,
 * and remote control actions for the Connect UI.
 */

import { create } from 'zustand';
import { ConnectDevice, ConnectPlaybackSession } from '@/types/connect';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';

interface ConnectStoreState {
  devices: ConnectDevice[];
  activePlaybackDevice: ConnectDevice | null;
  remoteSession: ConnectPlaybackSession | null;
  isConnectModalOpen: boolean;
  isRemoteMode: boolean;
  isScanning: boolean;

  // UI modal toggles
  toggleConnectModal: (open?: boolean) => void;

  // Actions
  scanDevices: () => void;
  transferPlayback: (targetDevice: ConnectDevice) => Promise<boolean>;
  disconnectAndPlayLocally: () => Promise<boolean>;
  getInterpolatedPosition: () => number;

  // Remote Controller RPCs
  sendPlay: () => Promise<boolean>;
  sendPause: () => Promise<boolean>;
  sendSeek: (positionMs: number) => Promise<boolean>;
  sendNext: () => Promise<boolean>;
  sendPrev: () => Promise<boolean>;
  sendVolume: (volume: number) => Promise<boolean>;
}

export const useConnectStore = create<ConnectStoreState>((set, get) => {
  // Initialize listeners if in client environment
  if (typeof window !== 'undefined') {
    const discovery = ConnectDiscoveryEngine.getInstance();
    const client = ConnectClientManager.getInstance();

    discovery.subscribe((devices) => {
      set({ devices });
    });

    client.subscribe((session) => {
      set({
        remoteSession: session,
        isRemoteMode: client.isRemoteMode(),
        activePlaybackDevice: client.getActiveTargetDevice(),
      });
    });
  }

  return {
    devices: [],
    activePlaybackDevice: null,
    remoteSession: null,
    isConnectModalOpen: false,
    isRemoteMode: false,
    isScanning: false,

    toggleConnectModal: (open) => {
      const nextState = typeof open === 'boolean' ? open : !get().isConnectModalOpen;
      if (nextState) {
        get().scanDevices();
      }
      set({ isConnectModalOpen: nextState });
    },

    scanDevices: () => {
      set({ isScanning: true });
      const discovery = ConnectDiscoveryEngine.getInstance();
      const freshDevices = discovery.scanNow();
      set({ devices: freshDevices, isScanning: false });
    },

    transferPlayback: async (targetDevice: ConnectDevice) => {
      const client = ConnectClientManager.getInstance();
      const success = await client.transferPlaybackTo(targetDevice);
      if (success) {
        set({
          activePlaybackDevice: client.getActiveTargetDevice(),
          isRemoteMode: client.isRemoteMode(),
          isConnectModalOpen: false,
        });
      }
      return success;
    },

    disconnectAndPlayLocally: async () => {
      const client = ConnectClientManager.getInstance();
      const success = await client.disconnectAndPlayLocally();
      if (success) {
        set({
          activePlaybackDevice: null,
          isRemoteMode: false,
          remoteSession: null,
          isConnectModalOpen: false,
        });
      }
      return success;
    },

    getInterpolatedPosition: () => {
      return ConnectClientManager.getInstance().getInterpolatedPosition();
    },

    sendPlay: async () => {
      return ConnectClientManager.getInstance().sendCommand('PLAY');
    },

    sendPause: async () => {
      return ConnectClientManager.getInstance().sendCommand('PAUSE');
    },

    sendSeek: async (positionMs: number) => {
      return ConnectClientManager.getInstance().sendCommand('SEEK', { positionMs });
    },

    sendNext: async () => {
      return ConnectClientManager.getInstance().sendCommand('SKIP_NEXT');
    },

    sendPrev: async () => {
      return ConnectClientManager.getInstance().sendCommand('SKIP_PREV');
    },

    sendVolume: async (volume: number) => {
      return ConnectClientManager.getInstance().sendCommand('SET_VOLUME', { volume });
    },
  };
});
