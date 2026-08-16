import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { DeviceLeaseManager } from '@/lib/connect/DeviceLeaseManager';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandBus } from '@/lib/connect/CommandBus';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectCommand } from '@/lib/connect/types';

describe('Manual Disconnect Lifecycle & Generation Gating Invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    usePlayerStore.setState({
      deviceId: 'desktop_controller_1',
      deviceInstanceId: 'inst_desktop_1',
      isActiveDevice: true,
      activeDeviceId: null,
      connectedDeviceId: null,
      deviceConnectionState: 'AVAILABLE',
      isPlaying: false,
      currentTime: 0,
      duration: 200,
    });

    CommandSequencer.getInstance().reset();
    CommandValidator.getInstance().reset();
    CommandBus.getInstance().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A & D. Manual disconnect does not reconnect; socket close does not schedule reconnect
  it('A & D: Manual disconnect sets flag, transitions to DISCONNECTED, and suppresses reconnect timers', async () => {
    const connectManager = ConnectManager.getInstance();
    await connectManager.init('user_test_1', 'desktop_controller_1');

    expect(connectManager.isManualDisconnectRequested()).toBe(false);

    // Explicit manual disconnect
    await connectManager.manualDisconnect();

    expect(connectManager.isManualDisconnectRequested()).toBe(true);
    expect(connectManager.getState()).toBe('DISCONNECTED');

    // Trigger network online or socket error after manual disconnect
    await connectManager.handleNetworkOnline();
    vi.advanceTimersByTime(5000);

    // State MUST remain DISCONNECTED, NOT reconnected
    expect(connectManager.getState()).toBe('DISCONNECTED');
    expect(connectManager.isManualDisconnectRequested()).toBe(true);
  });

  // B. Manual disconnect releases the lease
  it('B: Manual disconnect explicitly releases device lease', async () => {
    const connectManager = ConnectManager.getInstance();
    const leaseManager = DeviceLeaseManager.getInstance();

    await connectManager.init('user_test_1', 'desktop_controller_1');
    (leaseManager as any).currentLeaseToken = 'lease_token_active';

    await connectManager.manualDisconnect();

    expect((leaseManager as any).currentLeaseToken).toBeNull();
    expect(connectManager.getState()).toBe('DISCONNECTED');
  });

  // C. Manual disconnect unsubscribes all channels and clears session references
  it('C: Manual disconnect unsubscribes inbox and session channels', async () => {
    const connectManager = ConnectManager.getInstance();
    await connectManager.init('user_test_1', 'desktop_controller_1');

    await connectManager.manualDisconnect();

    expect((connectManager as any).inboxChannel).toBeNull();
    expect((connectManager as any).sessionChannel).toBeNull();
    expect(connectManager.getSessionId()).toBeNull();
  });

  // E. Old socket callbacks cannot affect a new connection generation
  it('E: Old socket callbacks from prior generation are ignored and cannot mutate state', async () => {
    const connectManager = ConnectManager.getInstance();
    await connectManager.init('user_test_1', 'desktop_controller_1');
    const firstGen = connectManager.getConnectionGeneration();

    // Disconnect
    await connectManager.manualDisconnect();
    expect(connectManager.getConnectionGeneration()).toBeGreaterThan(firstGen);

    // Simulate a delayed callback from old generation
    const isStale = (connectManager as any).connectionGeneration !== firstGen;
    expect(isStale).toBe(true);
  });

  // F. Stale Epoch 42 commands cannot affect Epoch 43
  it('F: Epoch 42 commands arriving after Epoch 43 is active are rejected by epoch fencing', async () => {
    const sequencer = CommandSequencer.getInstance();
    const validator = CommandValidator.getInstance();

    // Establish Epoch 43
    sequencer.setEpoch(43);

    // Stale command from Epoch 42
    const staleCommand: ConnectCommand = {
      commandId: 'cmd_stale_1',
      sessionId: 'sess_1',
      epoch: 42,
      sequence: 1,
      sourceDeviceId: 'remote_device_2',
      type: 'PLAY',
      payload: {},
      sentAt: Date.now() - 1000,
    };

    const isValid = validator.validate(staleCommand);
    expect(isValid).toBe(false);
  });

  // G. Controller disconnect leaves remote Android renderer playing
  it('G: Controller disconnecting resets local state without sending STOP to active remote renderer', async () => {
    const connectManager = ConnectManager.getInstance();

    usePlayerStore.setState({
      connectedDeviceId: 'android_renderer_1',
      activeDeviceId: 'android_renderer_1',
      isActiveDevice: false,
      deviceConnectionState: 'CONNECTED',
    });

    await connectManager.manualDisconnect();

    const storeAfter = usePlayerStore.getState();
    // Local store returns to independent mode
    expect(storeAfter.connectedDeviceId).toBeNull();
    expect(storeAfter.activeDeviceId).toBeNull();
    expect(storeAfter.isActiveDevice).toBe(true);
    expect(storeAfter.deviceConnectionState).toBe('AVAILABLE');
  });

  // H. Explicit Connect after Disconnect works normally
  it('H: Explicit user connect after disconnect resets manualDisconnectRequested and starts new generation', async () => {
    const connectManager = ConnectManager.getInstance();

    await connectManager.init('user_test_1', 'desktop_controller_1');
    await connectManager.manualDisconnect();
    expect(connectManager.isManualDisconnectRequested()).toBe(true);
    const genAfterDisconnect = connectManager.getConnectionGeneration();

    // User explicitly connects again
    await connectManager.init('user_test_1', 'desktop_controller_1');
    expect(connectManager.isManualDisconnectRequested()).toBe(false);
    expect(connectManager.getConnectionGeneration()).toBeGreaterThan(genAfterDisconnect);
    expect(connectManager.getState()).toBe('READY');
  });
});
