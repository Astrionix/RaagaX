import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalDiscoveryService } from '../../src/lib/connect/lan/LocalDiscoveryService';
import { LANDeviceAdvertisement } from '../../src/lib/connect/lan/types';
import { useAuthStore } from '../../src/context/useAuthStore';

describe('RaagaX Connect V2: Local LAN Discovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    LocalDiscoveryService.getInstance().clearDiscoveredDevices();
    useAuthStore.setState({
      user: { id: 'usr_ram', email: 'ram@raagax.test', user_metadata: { name: 'Ram' } } as any,
    });
  });

  afterEach(() => {
    LocalDiscoveryService.getInstance().stopDiscovery();
    vi.useRealTimers();
  });

  it('advertises local device identity with protocol 2.0.0 and correct port', () => {
    const service = LocalDiscoveryService.getInstance();
    const identity = service.getLocalIdentity();

    expect(identity.deviceId).toBeDefined();
    expect(identity.protocolVersion).toBe('2.0.0');
    expect(identity.port).toBeGreaterThanOrEqual(47100);
    expect(identity.userId).toBe('usr_ram');
  });

  it('discovers both same-account and other-account devices on the same Wi-Fi without filtering', () => {
    const service = LocalDiscoveryService.getInstance();

    const sameAccountDevice: LANDeviceAdvertisement = {
      deviceId: 'dev_phone_ram',
      deviceName: "Ram's Phone",
      deviceType: 'mobile',
      platform: 'android',
      protocolVersion: '2.0.0',
      host: '192.168.1.110',
      port: 47104,
      capabilities: ['playback', 'remote_control'],
      userId: 'usr_ram',
      currentActivity: 'playing',
      activeSongTitle: 'Nuvvostanante',
      timestamp: Date.now(),
    };

    const otherAccountDevice: LANDeviceAdvertisement = {
      deviceId: 'dev_laptop_rahul',
      deviceName: "Rahul's Laptop",
      deviceType: 'desktop',
      platform: 'windows',
      protocolVersion: '2.0.0',
      host: '192.168.1.120',
      port: 47104,
      capabilities: ['playback', 'remote_control'],
      userId: 'usr_rahul_other',
      currentActivity: 'playing',
      activeSongTitle: 'Samajavaragamana',
      timestamp: Date.now(),
    };

    service.handleAdvertisement(sameAccountDevice);
    service.handleAdvertisement(otherAccountDevice);

    const discovered = service.getDiscoveredDevices();
    expect(discovered.length).toBe(2);

    const ramDevice = discovered.find((d) => d.deviceId === 'dev_phone_ram');
    expect(ramDevice).toBeDefined();
    expect(ramDevice?.isSameAccount).toBe(true);
    expect(ramDevice?.authTier).toBe('SAME_ACCOUNT');

    const rahulDevice = discovered.find((d) => d.deviceId === 'dev_laptop_rahul');
    expect(rahulDevice).toBeDefined();
    expect(rahulDevice?.isSameAccount).toBe(false);
    expect(rahulDevice?.authTier).toBe('OTHER_ACCOUNT');
  });

  it('prunes stale devices after 10s TTL expiration', () => {
    const service = LocalDiscoveryService.getInstance();

    const staleDevice: LANDeviceAdvertisement = {
      deviceId: 'dev_stale_device',
      deviceName: 'Old Tablet',
      deviceType: 'tablet',
      platform: 'android',
      protocolVersion: '2.0.0',
      host: '192.168.1.130',
      port: 47104,
      capabilities: ['playback'],
      timestamp: Date.now(),
      currentActivity: 'idle',
    };

    service.handleAdvertisement(staleDevice);
    expect(service.getDiscoveredDevices().length).toBe(1);

    // Fast forward 12 seconds
    vi.advanceTimersByTime(12000);

    // Trigger prune check
    (service as any).pruneStaleDevices();

    expect(service.getDiscoveredDevices().length).toBe(0);
  });
});
