/**
 * RaagaX Connect — Unified Device Discovery Service
 *
 * Coordinates Local LAN and Cloud discovery, manages registration of the local device,
 * and maintains the active device list with deduplication and state updates.
 */

import { ConnectDevice } from '@/types/connect';
import { DeviceIdentity } from '../identity/DeviceIdentity';
import { DeviceRegistry } from '../identity/DeviceRegistry';
import { LocalLanDiscovery } from './LocalLanDiscovery';
import { CloudPresenceDiscovery } from './CloudPresenceDiscovery';

export class DeviceDiscoveryService {
  private static instance: DeviceDiscoveryService;
  private isRunning: boolean = false;

  private constructor() {
    // Register local device immediately
    const localDevice = DeviceIdentity.getInstance().toConnectDevice();
    DeviceRegistry.getInstance().registerOrUpdateDevice(localDevice);
  }

  public static getInstance(): DeviceDiscoveryService {
    if (!DeviceDiscoveryService.instance) {
      DeviceDiscoveryService.instance = new DeviceDiscoveryService();
    }
    return DeviceDiscoveryService.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    LocalLanDiscovery.getInstance().start();
    CloudPresenceDiscovery.getInstance().start();
  }

  public stop(): void {
    this.isRunning = false;
    LocalLanDiscovery.getInstance().stop();
    CloudPresenceDiscovery.getInstance().stop();
  }

  public async scan(): Promise<ConnectDevice[]> {
    await LocalLanDiscovery.getInstance().scan();
    return DeviceRegistry.getInstance().getAllActiveDevices();
  }

  public getDiscoveredDevices(): ConnectDevice[] {
    return DeviceRegistry.getInstance().getAllActiveDevices();
  }

  public getLocalDevice(): ConnectDevice {
    return DeviceIdentity.getInstance().toConnectDevice();
  }
}
