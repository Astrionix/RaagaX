/**
 * RaagaX Connect — Reactive Zustand Store
 *
 * Exposes device discovery state, active target device, remote playback session,
 * speaker-side remote control status, Same-User clustering, and remote control actions.
 */

import { create } from 'zustand';
import { ConnectDevice, ConnectPlaybackSession, UserConnectSession, DeviceNode } from '@/types/connect';
import { ConnectDiscoveryEngine } from '@/lib/connect/ConnectDiscoveryEngine';
import { ConnectClientManager } from '@/lib/connect/ConnectClientManager';
import { ConnectServerEngine } from '@/lib/connect/ConnectServerEngine';

interface ConnectStoreState {
  // Identity & User clustering
  localDeviceId: string;
  localDeviceName: string;
  userId: string;
  clockOffsetMs: number;

  devices: ConnectDevice[];
  activePlaybackDevice: ConnectDevice | null;
  remoteSession: ConnectPlaybackSession | null;
  speakerSession: ConnectPlaybackSession | null;
  isConnectModalOpen: boolean;
  isRemoteMode: boolean;
  isControlledByRemote: boolean;
  controllerDeviceId: string | null;
  controllerDeviceName: string | null;
  isScanning: boolean;

  // Computed state helpers
  isSpeaker: () => boolean;
  isController: () => boolean;
  getInterpolatedPosition: () => number;

  // Identity actions
  initDevice: (userId: string, name: string, type?: DeviceNode['type']) => void;
  setClockOffset: (offsetMs: number) => void;

  // UI modal toggles
  toggleConnectModal: (open?: boolean) => void;

  // Actions
  scanDevices: () => void;
  transferPlayback: (targetDevice: ConnectDevice) => Promise<boolean>;
  /** Detach this controller — the speaker KEEPS PLAYING, local enters idle/silent mode */
  disconnect: () => Promise<boolean>;
  disconnectAndPlayLocally: () => Promise<boolean>;
  /** Speaker action: detach any remote controller driving playback on this speaker */
  disconnectRemoteControllerFromSpeaker: () => Promise<boolean>;

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
    const server = ConnectServerEngine.getInstance();
    const local = discovery.getLocalDevice();

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

    server.subscribe((s) => {
      const localDevice = discovery.getLocalDevice();
      const isControlled =
        !client.isRemoteMode() &&
        !!s.controllerDeviceId &&
        s.controllerDeviceId !== localDevice.deviceId &&
        s.controllerDeviceId !== 'dev_local';

      set({
        speakerSession: s,
        isControlledByRemote: isControlled,
        controllerDeviceId: isControlled ? (s.controllerDeviceId || null) : null,
        controllerDeviceName: isControlled ? (s.controllerDeviceName || 'Remote Device') : null,
      });
    });
  }

  // Load or generate initial persistent local device identity
  const initialLocalId =
    typeof window !== 'undefined'
      ? localStorage.getItem('connect_device_id') ||
        ConnectDiscoveryEngine.getInstance().getLocalDevice().deviceId
      : 'dev_local';

  const initialLocalName =
    typeof window !== 'undefined'
      ? ConnectDiscoveryEngine.getInstance().getLocalDevice().deviceName
      : 'RaagaX Device';

  return {
    localDeviceId: initialLocalId,
    localDeviceName: initialLocalName,
    userId: '',
    clockOffsetMs: 0,

    devices: [],
    activePlaybackDevice: null,
    remoteSession: null,
    speakerSession: null,
    isConnectModalOpen: false,
    isRemoteMode: false,
    isControlledByRemote: false,
    controllerDeviceId: null,
    controllerDeviceName: null,
    isScanning: false,

    initDevice: (userId: string, name: string, _type?: DeviceNode['type']) => {
      let storedId = typeof window !== 'undefined' ? localStorage.getItem('connect_device_id') : null;
      if (!storedId) {
        storedId = `dev_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
        if (typeof window !== 'undefined') localStorage.setItem('connect_device_id', storedId);
      }
      set({
        localDeviceId: storedId,
        localDeviceName: name || get().localDeviceName,
        userId,
      });
    },

    setClockOffset: (clockOffsetMs: number) => set({ clockOffsetMs }),

    isSpeaker: () => {
      return !get().isRemoteMode;
    },

    isController: () => {
      return get().isRemoteMode;
    },

    getInterpolatedPosition: () => {
      const { clockOffsetMs } = get();
      const basePos = ConnectClientManager.getInstance().getInterpolatedPosition();
      return Math.max(0, basePos + clockOffsetMs / 1000);
    },

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
      if (!targetDevice || !targetDevice.deviceId) return false;
      const client = ConnectClientManager.getInstance();
      const success = await client.transferPlaybackTo(targetDevice);
      if (success) {
        set({
          activePlaybackDevice: client.getActiveTargetDevice(),
          isRemoteMode: client.isRemoteMode(),
        });
      }
      return success;
    },

    /**
     * Detach this device as a controller.
     * The speaker KEEPS PLAYING. This device enters idle/silent mode.
     */
    disconnect: async () => {
      const client = ConnectClientManager.getInstance();
      const success = await client.disconnect(false);
      if (success) {
        set({
          activePlaybackDevice: null,
          isRemoteMode: false,
          remoteSession: null,
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

    /**
     * Speaker action: Detach remote controller. Speaker continues playing locally.
     */
    disconnectRemoteControllerFromSpeaker: async () => {
      const server = ConnectServerEngine.getInstance();
      const success = server.disconnectRemoteController();
      if (success) {
        set({
          isControlledByRemote: false,
          controllerDeviceId: null,
          controllerDeviceName: null,
        });
      }
      return success;
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
