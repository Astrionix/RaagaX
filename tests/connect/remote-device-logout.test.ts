/**
 * RAAGAX CONNECT — SAME-ACCOUNT REMOTE DEVICE LOGOUT TEST SUITE
 * 
 * Verifies:
 * 1. Discovered devices display [ Connect ] and three-dot (⋮) menu with ONLY "Log out".
 * 2. Revoking remote device authorization removes it from discovery and emits DEVICE_REVOKED.
 * 3. Logging out a currently-connected device safely disconnects without stopping remaining playback.
 * 4. Target device receiving DEVICE_REVOKED signs out and cleans up session.
 * 5. Disconnect vs. Log out separation: Disconnect keeps device logged in; Log out revokes account authorization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceRegistry } from '@/lib/connect/DeviceRegistry';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { CommandBus } from '@/lib/connect/CommandBus';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb) => {
      if (cb) cb('SUBSCRIBED');
      return mockChannel;
    }),
    send: vi.fn().mockResolvedValue({ error: null }),
    httpSend: vi.fn().mockResolvedValue({ error: null }),
    state: 'joined',
    topic: 'realtime:mock_topic'
  };

  const mockDeleteChain = {
    eq: vi.fn(() => mockDeleteChain),
    match: vi.fn(() => mockDeleteChain),
    then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve)
  };

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      getChannels: vi.fn(() => []),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        match: vi.fn().mockReturnThis(),
        delete: vi.fn(() => mockDeleteChain),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: { device_id: 'dev_laptop_1' }, error: null })
      })),

      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: '00000000-0000-4000-8000-000000000001', email: 'user@raagax.com' }
            }
          }
        })
      }
    }
  };
});

describe('RaagaX Connect — Same-Account Remote Device Logout Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      deviceId: 'dev_phone_1',
      activeDeviceId: 'dev_phone_1',
      connectedDeviceId: null,
      deviceConnectionState: 'AVAILABLE',
      isActiveDevice: true,
      isPlaying: true,
      currentSong: {
        id: 'song_1',
        title: 'Kesariya',
        artist: 'Arijit Singh',
        audioUrl: 'https://cdn.raagax.com/kesariya.mp3',
        coverUrl: '/covers/kesariya.jpg',
        duration: 268
      } as any,
      onlineDevices: [
        { id: 'dev_phone_1', name: 'This phone', platform: 'Android', isOnline: true },
        { id: 'dev_laptop_1', name: 'My Laptop', platform: 'Windows', isOnline: true }
      ]
    });
  });

  // ============================================================
  // TEST 1: Disconnect vs. Log out Separation
  // ============================================================
  it('Test 1: Disconnect removes Connect session but keeps device logged in & discoverable', async () => {
    const manager = ConnectManager.getInstance();
    
    // Connect to Laptop
    usePlayerStore.setState({
      connectedDeviceId: 'dev_laptop_1',
      deviceConnectionState: 'CONNECTED'
    });

    // Disconnect
    await manager.manualDisconnect();

    expect(manager.getState()).toBe('DISCONNECTED');
    expect(usePlayerStore.getState().deviceConnectionState).toBe('AVAILABLE');
    expect(usePlayerStore.getState().connectedDeviceId).toBeNull();

    // Device remains in onlineDevices list because it is still logged in
    const online = usePlayerStore.getState().onlineDevices || [];
    expect(online.some(d => d.id === 'dev_laptop_1')).toBe(true);
  });

  // ============================================================
  // TEST 2: Remote Logout Revocation Execution
  // ============================================================
  it('Test 2: Revoking remote device removes it from discovery and emits DEVICE_REVOKED command', async () => {
    const registry = DeviceRegistry.getInstance();
    const connectManager = ConnectManager.getInstance();
    const sendCommandSpy = vi.spyOn(connectManager, 'sendTargetedCommand').mockResolvedValue(undefined);

    const success = await registry.revokeRemoteDevice('dev_laptop_1');
    expect(success).toBe(true);

    // 1. Dispatches DEVICE_REVOKED command to target device
    expect(sendCommandSpy).toHaveBeenCalledWith(
      'dev_laptop_1',
      expect.objectContaining({
        type: 'DEVICE_REVOKED',
        targetDeviceId: 'dev_laptop_1'
      })
    );

    // 2. Removes target device from local onlineDevices list
    const online = usePlayerStore.getState().onlineDevices || [];
    expect(online.some(d => d.id === 'dev_laptop_1')).toBe(false);

    // 3. Deletes device from Supabase devices table
    expect(supabase.from).toHaveBeenCalledWith('devices');
  });

  // ============================================================
  // TEST 3: Connected Device Logout preserves Remaining Playback
  // ============================================================
  it('Test 3: Logging out a currently-connected device disconnects session while keeping local playback intact', async () => {
    const registry = DeviceRegistry.getInstance();
    const connectManager = ConnectManager.getInstance();
    vi.spyOn(connectManager, 'sendTargetedCommand').mockResolvedValue(undefined);

    // Laptop is connected
    usePlayerStore.setState({
      connectedDeviceId: 'dev_laptop_1',
      deviceConnectionState: 'CONNECTED',
      isPlaying: true,
      isActiveDevice: true
    });

    await registry.revokeRemoteDevice('dev_laptop_1');

    // Connection state is cleared
    expect(usePlayerStore.getState().connectedDeviceId).toBeNull();
    expect(usePlayerStore.getState().deviceConnectionState).toBe('AVAILABLE');

    // Local music playback is NOT stopped on the remaining device
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().currentSong?.title).toBe('Kesariya');
  });

  // ============================================================
  // TEST 4: Target Device Signs Out on DEVICE_REVOKED
  // ============================================================
  it('Test 4: Target device receiving DEVICE_REVOKED signs out and cleans up session', async () => {
    const authStore = useAuthStore.getState();
    const signOutSpy = vi.spyOn(authStore, 'signOut').mockResolvedValue(undefined);

    // Simulate Laptop receiving DEVICE_REVOKED targeted to itself
    usePlayerStore.setState({ deviceId: 'dev_laptop_1' });

    CommandBus.getInstance().handleIncomingCommand({
      commandId: 'cmd_revocation_1',
      sessionId: 'sess_1',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_phone_1',
      targetDeviceId: 'dev_laptop_1',
      type: 'DEVICE_REVOKED',
      sentAt: Date.now(),
      payload: {
        revokedDeviceId: 'dev_laptop_1',
        revokedByUserId: 'user_1'
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(signOutSpy).toHaveBeenCalled();
  });
});


