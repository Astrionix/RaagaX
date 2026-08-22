'use client';

import { LocalDiscoveryService } from './LocalDiscoveryService';
import { DirectLANTransport } from './DirectLANTransport';
import { ConnectAuthManager } from './ConnectAuthManager';
import { PlaybackOwnerEngine } from './PlaybackOwnerEngine';
import { RemoteControlClient } from './RemoteControlClient';
import { OwnershipSwitchProtocol, SwitchProgressCallback } from './OwnershipSwitchProtocol';
import { DiscoveredLANDevice, LANRemoteCommandMessage } from './types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';

export class RaagaXConnectV2 {
  private static instance: RaagaXConnectV2;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): RaagaXConnectV2 {
    if (!RaagaXConnectV2.instance) {
      RaagaXConnectV2.instance = new RaagaXConnectV2();
    }
    return RaagaXConnectV2.instance;
  }

  public async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[RaagaXConnectV2] Initializing Direct LAN Architecture...');

    // 1. Start Local Discovery
    await LocalDiscoveryService.getInstance().startDiscovery();

    // 2. Subscribe discovery to store
    LocalDiscoveryService.getInstance().subscribe((devices) => {
      this.syncDiscoveredDevicesToStore(devices);
    });

    // 3. Initialize transport and auth manager
    DirectLANTransport.getInstance();
    ConnectAuthManager.getInstance();
    PlaybackOwnerEngine.getInstance();
    RemoteControlClient.getInstance();
    OwnershipSwitchProtocol.getInstance();
  }

  public getDiscoveredDevices(): DiscoveredLANDevice[] {
    return LocalDiscoveryService.getInstance().getDiscoveredDevices();
  }

  public async connectAndControl(targetDeviceId: string): Promise<boolean> {
    const devices = this.getDiscoveredDevices();
    const target = devices.find((d) => d.deviceId === targetDeviceId);
    if (!target) {
      console.warn(`[RaagaXConnectV2] Target device ${targetDeviceId} not found in discovery`);
      return false;
    }

    // 1. Connect direct LAN socket
    await DirectLANTransport.getInstance().connectToDevice(target);

    // 2. Initiate cryptographic / session handshake
    const authTier = await ConnectAuthManager.getInstance().initiateHandshake(targetDeviceId);

    const canControl = authTier === 'SAME_ACCOUNT' || ConnectAuthManager.getInstance().canControl(targetDeviceId);
    if (canControl) {
      // Set as remote controller
      PlaybackOwnerEngine.getInstance().setOwner(targetDeviceId, false);
      usePlayerStore.setState({
        isActiveDevice: false,
        activeDeviceId: targetDeviceId,
        connectedDeviceId: targetDeviceId,
        remoteDeviceName: target.deviceName,
      });
      return true;
    }

    console.log(`[RaagaXConnectV2] Device ${target.deviceName} is on ${authTier} (view only)`);
    return false;
  }

  public async switchPlaybackTo(
    targetDeviceId: string,
    onProgress?: SwitchProgressCallback
  ): Promise<boolean> {
    const devices = this.getDiscoveredDevices();
    const target = devices.find((d) => d.deviceId === targetDeviceId);
    if (!target) return false;

    // Ensure connected first
    if (!DirectLANTransport.getInstance().isConnected(targetDeviceId)) {
      await DirectLANTransport.getInstance().connectToDevice(target);
      await ConnectAuthManager.getInstance().initiateHandshake(targetDeviceId);
    }

    return OwnershipSwitchProtocol.getInstance().switchPlayback(targetDeviceId, onProgress);
  }

  public sendCommand(
    type: LANRemoteCommandMessage['type'],
    payload?: LANRemoteCommandMessage['payload']
  ) {
    const store = usePlayerStore.getState();
    const isLocalActive = store.isActiveDevice && !store.connectedDeviceId;

    if (isLocalActive) {
      // Local owner executes directly
      PlaybackOwnerEngine.getInstance().handleRemoteCommand({
        id: 'local_cmd_' + Date.now(),
        type,
        sourceDeviceId: 'local',
        targetDeviceId: 'local',
        commandId: 'cmd_' + Date.now(),
        payload,
        timestamp: Date.now(),
      });
    } else {
      // Controller sends over LAN
      RemoteControlClient.getInstance().sendCommand(type, payload);
    }
  }

  public disconnect() {
    const ownerId = PlaybackOwnerEngine.getInstance().getActiveOwnerId();
    DirectLANTransport.getInstance().disconnectFromDevice(ownerId);

    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    PlaybackOwnerEngine.getInstance().setOwner(localId, true);

    usePlayerStore.setState({
      connectedDeviceId: null,
      activeDeviceId: localId,
      isActiveDevice: true,
      remoteDeviceName: undefined,
    });
  }

  private syncDiscoveredDevicesToStore(devices: DiscoveredLANDevice[]) {
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    const currentUserId = useAuthStore.getState().user?.id;

    const mapped = devices.map((d) => ({
      id: d.deviceId,
      name: d.deviceName,
      platform: d.platform,
      isOnline: true,
      type: d.deviceType,
      capabilities: d.capabilities,
      isSameAccount: Boolean(currentUserId && d.userId && currentUserId === d.userId),
      userId: d.userId,
      activity: d.currentActivity,
      activeSongTitle: d.activeSongTitle,
    }));

    usePlayerStore.setState({
      onlineDevices: mapped as any,
    });
  }
}
