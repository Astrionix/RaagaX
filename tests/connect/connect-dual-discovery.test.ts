/**
 * RaagaX Connect — Dual Discovery & Authorization Engine Test Suite
 *
 * Verifies the exact priority & authorization matrix:
 * 1. Same account + Same Wi-Fi -> LOCAL_LAN + AUTO_AUTHORIZED
 * 2. Same account + Different network -> CLOUD_RELAY + AUTO_AUTHORIZED
 * 3. Different account + Same Wi-Fi -> LOCAL_LAN + REQUIRES_PAIRING
 * 4. Different account + Different network -> Filtered out (Zero leakage)
 * 5. Guest Pairing & Approval Workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';
import { SessionAuth } from '@/lib/connect/authorization/SessionAuth';
import { PairingManager } from '@/lib/connect/authorization/PairingManager';
import { ConnectDevice } from '@/types/connect';

describe('RaagaX Connect — Dual Discovery & Authorization Matrix Suite', () => {
  beforeEach(() => {
    ConnectDeviceRegistry.unregisterDevice('dev_phone_userA');
    ConnectDeviceRegistry.unregisterDevice('dev_laptop_userA');
    ConnectDeviceRegistry.unregisterDevice('dev_tv_guestB');
    ConnectDeviceRegistry.unregisterDevice('dev_stranger_userC');
  });

  it('1. Same account + Same Wi-Fi: Resolves to LOCAL_LAN and AUTO_AUTHORIZED', () => {
    // Register Laptop on Account A, Subnet 192.168.1
    ConnectDeviceRegistry.registerBeacon(
      {
        deviceId: 'dev_laptop_userA',
        deviceName: "Ram's Laptop",
        deviceType: 'desktop',
        isOnline: true,
        state: 'IDLE',
        lastSeenAt: Date.now(),
        transport: 'LOCAL_LAN',
        accountId: 'acc_ram_123',
      },
      '192.168.1'
    );

    // Phone discovers on Account A, Subnet 192.168.1
    const discovered = ConnectDeviceRegistry.getActiveDevices('dev_phone_userA', '192.168.1', 'acc_ram_123');

    const laptop = discovered.find((d) => d.deviceId === 'dev_laptop_userA');
    expect(laptop).toBeDefined();
    expect(laptop?.transport).toBe('LOCAL_LAN');
    expect(laptop?.authStatus).toBe('AUTO_AUTHORIZED');
    expect(laptop?.isSameAccount).toBe(true);
    expect(laptop?.isSameSubnet).toBe(true);

    const isAuthed = SessionAuth.getInstance().isAuthorized('dev_phone_userA', 'dev_laptop_userA', 'acc_ram_123', 'acc_ram_123', true);
    expect(isAuthed).toBe(true);
  });

  it('2. Same account + Different network (5G): Resolves to CLOUD_RELAY and AUTO_AUTHORIZED', () => {
    // Register Laptop on Account A, Subnet 192.168.1
    ConnectDeviceRegistry.registerBeacon(
      {
        deviceId: 'dev_laptop_userA',
        deviceName: "Ram's Home Laptop",
        deviceType: 'desktop',
        isOnline: true,
        state: 'IDLE',
        lastSeenAt: Date.now(),
        transport: 'LOCAL_LAN',
        accountId: 'acc_ram_123',
      },
      '192.168.1'
    );

    // Phone on 5G (Subnet 10.45.88) queries with Account A
    const discovered = ConnectDeviceRegistry.getActiveDevices('dev_phone_userA', '10.45.88', 'acc_ram_123');

    const laptop = discovered.find((d) => d.deviceId === 'dev_laptop_userA');
    expect(laptop).toBeDefined();
    expect(laptop?.transport).toBe('CLOUD_RELAY');
    expect(laptop?.authStatus).toBe('AUTO_AUTHORIZED');
    expect(laptop?.isSameAccount).toBe(true);
    expect(laptop?.isSameSubnet).toBe(false);

    const isAuthed = SessionAuth.getInstance().isAuthorized('dev_phone_userA', 'dev_laptop_userA', 'acc_ram_123', 'acc_ram_123', false);
    expect(isAuthed).toBe(true);
  });

  it('3. Different account + Same Wi-Fi: Resolves to LOCAL_LAN and REQUIRES_PAIRING', () => {
    // Register Living Room TV on Guest Account B, Subnet 192.168.1
    ConnectDeviceRegistry.registerBeacon(
      {
        deviceId: 'dev_tv_guestB',
        deviceName: 'Living Room TV',
        deviceType: 'tv',
        isOnline: true,
        state: 'IDLE',
        lastSeenAt: Date.now(),
        transport: 'LOCAL_LAN',
        accountId: 'acc_guest_456',
      },
      '192.168.1'
    );

    // Phone on Account A, Subnet 192.168.1
    const discovered = ConnectDeviceRegistry.getActiveDevices('dev_phone_userA', '192.168.1', 'acc_ram_123');

    const tv = discovered.find((d) => d.deviceId === 'dev_tv_guestB');
    expect(tv).toBeDefined();
    expect(tv?.transport).toBe('LOCAL_LAN');
    expect(tv?.authStatus).toBe('REQUIRES_PAIRING');
    expect(tv?.isSameAccount).toBe(false);
    expect(tv?.isSameSubnet).toBe(true);

    // Initial authorization check without pairing should be false
    const isAuthed = SessionAuth.getInstance().isAuthorized('dev_phone_userA', 'dev_tv_guestB', 'acc_ram_123', 'acc_guest_456', true);
    expect(isAuthed).toBe(false);
  });

  it('4. Different account + Different network: Omitted from discovery (Zero exposure)', () => {
    // Stranger on Account C, Subnet 172.16.0
    ConnectDeviceRegistry.registerBeacon(
      {
        deviceId: 'dev_stranger_userC',
        deviceName: "Stranger's Speaker",
        deviceType: 'speaker',
        isOnline: true,
        state: 'IDLE',
        lastSeenAt: Date.now(),
        transport: 'LOCAL_LAN',
        accountId: 'acc_stranger_789',
      },
      '172.16.0'
    );

    // Phone on Account A, Subnet 192.168.1
    const discovered = ConnectDeviceRegistry.getActiveDevices('dev_phone_userA', '192.168.1', 'acc_ram_123');

    const stranger = discovered.find((d) => d.deviceId === 'dev_stranger_userC');
    expect(stranger).toBeUndefined(); // Filtered out!

    const status = SessionAuth.getInstance().resolveAuthStatus({
      controllerDeviceId: 'dev_phone_userA',
      controllerAccountId: 'acc_ram_123',
      targetDeviceId: 'dev_stranger_userC',
      targetAccountId: 'acc_stranger_789',
      isSameSubnet: false,
    });
    expect(status).toBe('DENIED');
  });

  it('5. Guest Pairing Flow: Request -> Approve -> Authorized on Same Wi-Fi', () => {
    const pairing = PairingManager.getInstance();

    // 1. Phone requests pairing to TV
    const req = pairing.requestPairing('dev_phone_userA', "Ram's Phone", 'dev_tv_guestB', '4821');
    expect(req.status).toBe('PENDING');
    expect(pairing.isPaired('dev_phone_userA', 'dev_tv_guestB')).toBe(false);

    // 2. TV sees pending request
    const pending = pairing.getPendingRequestsForTarget('dev_tv_guestB');
    expect(pending.length).toBe(1);
    expect(pending[0].controllerDeviceName).toBe("Ram's Phone");

    // 3. TV approves pairing
    pairing.approvePairing('dev_phone_userA', 'dev_tv_guestB');
    expect(pairing.isPaired('dev_phone_userA', 'dev_tv_guestB')).toBe(true);

    // 4. SessionAuth now authorizes control over LAN
    const isAuthed = SessionAuth.getInstance().isAuthorized('dev_phone_userA', 'dev_tv_guestB', 'acc_ram_123', 'acc_guest_456', true);
    expect(isAuthed).toBe(true);
  });
});
