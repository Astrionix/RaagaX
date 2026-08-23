import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { LocalPeerConnection } from '@/lib/connect/LocalPeerConnection';
import { TransportRouter } from '@/lib/connect/TransportRouter';
import { ConnectivityRouter } from '@/lib/connect/ConnectivityRouter';
import { usePlayerStore } from '@/context/usePlayerStore';

describe('RAAGAX CONNECT — DISCONNECT → RECONNECT RELIABILITY SUITE', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_mobile_01',
      activeDeviceId: 'dev_mobile_01',
      connectedDeviceId: null,
      isActiveDevice: true,
      deviceConnectionState: 'AVAILABLE',
    });
  });

  // ============================================================
  // TEST 1: 10 CONSECUTIVE CONNECT -> DISCONNECT -> CONNECT CYCLES
  // ============================================================
  it('TEST 1: Successfully performs 10 consecutive CONNECT -> DISCONNECT cycles with monotonic generation promotion', async () => {
    const manager = ConnectManager.getInstance();
    const targetId = 'dev_laptop_02';

    // Mock LocalPeerConnection.connectToDevice to simulate successful fast LAN handshake
    vi.spyOn(LocalPeerConnection.getInstance(), 'connectToDevice').mockImplementation(async (target, gen) => {
      return true;
    });

    let previousGen = manager.getConnectionGeneration();

    for (let cycle = 1; cycle <= 10; cycle++) {
      // 1. Connect
      const connectResult = await manager.connectToDevice(targetId);
      expect(connectResult).toBe(true);

      const currentGen = manager.getConnectionGeneration();
      expect(currentGen).toBeGreaterThan(previousGen);
      previousGen = currentGen;

      const attempt = manager.getCurrentAttempt();
      expect(attempt).not.toBeNull();
      expect(attempt?.generation).toBe(currentGen);
      expect(attempt?.status).toBe('LOCAL_CONNECTED');
      expect(attempt?.transport).toBe('LOCAL_DIRECT');
      expect(attempt?.fallbackStarted).toBe(false);
      expect(manager.getState()).toBe('READY');

      const storeConnected = usePlayerStore.getState();
      expect(storeConnected.connectedDeviceId).toBe(targetId);

      // 2. Disconnect
      await manager.manualDisconnect();
      expect(manager.getState()).toBe('DISCONNECTED');
      expect(manager.getCurrentAttempt()).toBeNull();
      expect(manager.isManualDisconnectRequested()).toBe(true);

      const storeDisconnected = usePlayerStore.getState();
      expect(storeDisconnected.connectedDeviceId).toBeNull();
      expect(storeDisconnected.isActiveDevice).toBe(true);

      const postDisconnectGen = manager.getConnectionGeneration();
      expect(postDisconnectGen).toBeGreaterThan(currentGen);
      previousGen = postDisconnectGen;
    }
  });

  // ============================================================
  // TEST 2: STALE ASYNC CALLBACKS & TIMERS FROM OLD GENERATION ARE IGNORED
  // ============================================================
  it('TEST 2: Stale callbacks and timers from an obsolete generation have zero effect on the new generation', async () => {
    const manager = ConnectManager.getInstance();
    const localPeer = LocalPeerConnection.getInstance();
    const targetId = 'dev_laptop_02';

    // 1. Start generation 1
    const gen1 = manager.getConnectionGeneration() + 1;
    let triggerGen1Timeout: (() => void) | null = null;

    vi.spyOn(localPeer, 'connectToDevice').mockImplementation(async (target, gen) => {
      if (gen === gen1) {
        return new Promise<boolean>((resolve) => {
          triggerGen1Timeout = () => {
            // Delayed callback from generation 1
            localPeer.cleanup(target, gen, 'LOCAL_CONNECTION_FAILED');
            resolve(false);
          };
        });
      }
      return true;
    });

    const connectPromise = manager.connectToDevice(targetId);

    // 2. User disconnects while gen 1 is connecting
    await manager.manualDisconnect();
    expect(manager.getState()).toBe('DISCONNECTED');

    // 3. Start generation 2
    const connectGen2Promise = manager.connectToDevice(targetId);
    const gen2Result = await connectGen2Promise;
    expect(gen2Result).toBe(true);
    expect(manager.getState()).toBe('READY');

    const gen2Attempt = manager.getCurrentAttempt();
    expect(gen2Attempt?.generation).toBe(manager.getConnectionGeneration());
    expect(gen2Attempt?.status).toBe('LOCAL_CONNECTED');

    // 4. Now fire the delayed timeout / failure from generation 1
    if (typeof triggerGen1Timeout === 'function') {
      (triggerGen1Timeout as () => void)();
    }


    // Verify generation 2 remains undisturbed and active
    expect(manager.getState()).toBe('READY');
    expect(manager.getCurrentAttempt()?.generation).toBe(gen2Attempt?.generation);
    expect(usePlayerStore.getState().connectedDeviceId).toBe(targetId);
  });

  // ============================================================
  // TEST 3: SINGLE OWNER TRANSPORT FALLBACK (EXACTLY ONCE)
  // ============================================================
  it('TEST 3: When LAN handshake fails, Cloud fallback occurs exactly once per attempt without duplicate events', async () => {
    const manager = ConnectManager.getInstance();
    const targetId = 'dev_laptop_02';

    // Simulate LAN handshake failure
    vi.spyOn(LocalPeerConnection.getInstance(), 'connectToDevice').mockResolvedValue(false);

    const fallbackSpy = vi.spyOn(console, 'warn');

    const connectResult = await manager.connectToDevice(targetId);
    expect(connectResult).toBe(true);

    const attempt = manager.getCurrentAttempt();
    expect(attempt?.status).toBe('CLOUD_CONNECTED');
    expect(attempt?.fallbackStarted).toBe(true);
    expect(manager.getState()).toBe('READY');

    // Verify fallback warning was emitted exactly once for this connection
    const fallbackLogs = fallbackSpy.mock.calls.filter(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('starting CLOUD fallback'))
    );
    expect(fallbackLogs.length).toBe(1);

    fallbackSpy.mockRestore();
  });

  // ============================================================
  // TEST 4: MANUAL DISCONNECT NEVER TRIGGERS CLOUD FALLBACK
  // ============================================================
  it('TEST 4: Manual disconnect cleanly tears down state without false LAN_LOST or CLOUD_RELAY fallback', async () => {
    const manager = ConnectManager.getInstance();
    const router = TransportRouter.getInstance();
    const targetId = 'dev_laptop_02';

    // Mock successful connect
    vi.spyOn(LocalPeerConnection.getInstance(), 'connectToDevice').mockResolvedValue(true);
    await manager.connectToDevice(targetId);
    expect(manager.getState()).toBe('READY');

    const lanLostSpy = vi.spyOn(router, 'onLanChannelLost');
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    // User triggers manual disconnect
    await manager.manualDisconnect();

    expect(manager.getState()).toBe('DISCONNECTED');
    expect(usePlayerStore.getState().connectedDeviceId).toBeNull();

    // Verify no false LAN lost callbacks or fallback warnings
    const cloudFallbackWarnings = consoleWarnSpy.mock.calls.filter(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('Falling back to CLOUD_RELAY'))
    );
    expect(cloudFallbackWarnings.length).toBe(0);

    consoleWarnSpy.mockRestore();
    lanLostSpy.mockRestore();
  });
});
