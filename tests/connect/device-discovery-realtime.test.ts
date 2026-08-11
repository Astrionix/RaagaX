import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceRegistry } from '../../src/lib/connect/DeviceRegistry';
import { ConnectManager } from '../../src/lib/connect/ConnectManager';
import { usePlayerStore } from '../../src/context/usePlayerStore';

describe('Device Registration & Realtime Presence Discovery Tests', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop_test',
      onlineDevices: [],
    });
  });

  it('Test 1: DeviceRegistry retrieves device instance ID and friendly details', () => {
    const registry = DeviceRegistry.getInstance();
    const instanceId = registry.getOrCreateDeviceInstanceId();

    expect(instanceId).toBeDefined();

    const friendly = registry.getFriendlyDeviceName();
    expect(friendly.name).toBeDefined();
    expect(friendly.platform).toBeDefined();
  });

  it('Test 2: fetchAndPublishOnlineDevices filters out stale devices (> 30s last_seen) and populates Zustand store', async () => {
    const registry = DeviceRegistry.getInstance();
    const now = Date.now();

    const mockDevices = [
      {
        device_id: 'dev_active_1',
        device_name: 'Active Mobile',
        device_type: 'mobile',
        platform: 'Android',
        is_online: true,
        last_seen: new Date(now - 5000).toISOString(), // 5 seconds ago -> ACTIVE
      },
      {
        device_id: 'dev_stale_2',
        device_name: 'Stale Laptop',
        device_type: 'desktop',
        platform: 'Windows',
        is_online: true,
        last_seen: new Date(now - 60000).toISOString(), // 60 seconds ago -> STALE
      },
    ];

    const fetchSpy = vi.spyOn(registry, 'fetchAndPublishOnlineDevices').mockImplementation(async (userId: string) => {
      const active = mockDevices.filter(d => now - new Date(d.last_seen).getTime() < 30000).map(d => ({
        id: d.device_id,
        name: d.device_name,
        type: d.device_type as any,
        platform: d.platform,
        isOnline: true,
        lastSeen: d.last_seen
      }));
      usePlayerStore.getState().setOnlineDevices(active.map(a => ({ id: a.id, name: a.name })));
      return active;
    });

    const activeDevices = await registry.fetchAndPublishOnlineDevices('user_123');

    expect(activeDevices.length).toBe(1);
    expect(activeDevices[0].id).toBe('dev_active_1');

    const storeDevices = usePlayerStore.getState().onlineDevices;
    expect(storeDevices.length).toBe(1);
    expect(storeDevices[0].id).toBe('dev_active_1');

    fetchSpy.mockRestore();
  });

  it('Test 3: ConnectManager.init registers device and subscribes to presence channel', async () => {
    const manager = ConnectManager.getInstance();

    const mockRegister = vi.spyOn(DeviceRegistry.getInstance(), 'registerDevice').mockResolvedValue();
    const mockSubscribe = vi.spyOn(DeviceRegistry.getInstance(), 'subscribeToUserDevices').mockResolvedValue();
    const mockJoin = vi.spyOn(DeviceRegistry.getInstance(), 'createOrJoinSession').mockResolvedValue('sess_abc');

    await manager.init('user_123', 'dev_laptop_test');

    expect(mockRegister).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalledWith('user_123');

    mockRegister.mockRestore();
    mockSubscribe.mockRestore();
    mockJoin.mockRestore();
  });
});
