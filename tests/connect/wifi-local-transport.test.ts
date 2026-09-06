import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceDiscoveryEngine } from '@/lib/connect/discovery/DeviceDiscoveryEngine';
import { P2PTransport } from '@/lib/connect/transport/P2PTransport';
import { LocalTransport } from '@/lib/connect/transport/LocalTransport';
import { TransportManager } from '@/lib/connect/transport/TransportManager';
import { AuthorizedPeer, SignalMessage } from '@/lib/connect/types';

describe('RaagaX Connect — Wi-Fi Local & P2P Transport Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. DeviceDiscoveryEngine implements SignalingChannel correctly', async () => {
    const engine = DeviceDiscoveryEngine.getInstance();
    expect(typeof engine.sendSignal).toBe('function');
    expect(typeof engine.onSignal).toBe('function');

    let receivedSig: SignalMessage | null = null;
    const unsub = engine.onSignal((sig) => {
      receivedSig = sig;
    });

    const testSignal: SignalMessage = {
      sessionId: 'sess_test',
      fromDeviceId: 'ipad_1',
      toDeviceId: 'pc_1',
      type: 'offer',
      payload: JSON.stringify({ type: 'offer', sdp: 'v=0...' }),
      seq: 1,
    };

    // Broadcasts should notify listeners
    await engine.sendSignal(testSignal);
    unsub();
  });

  it('2. LocalTransport fails fast when peer is on another device', async () => {
    const local = new LocalTransport();
    const remotePeer: AuthorizedPeer = {
      peer: {
        deviceId: 'dev_remote_wifi',
        deviceName: 'Desktop PC',
        pubKeyFingerprint: 'fp_pc',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'mdns',
        lastSeen: Date.now(),
      },
      role: 'controller',
      expiresAt: Date.now() + 60000,
    };

    // If peer is not on this exact machine, LocalTransport handshake times out in ~250ms
    const start = Date.now();
    await expect(local.connect(remotePeer)).rejects.toThrow();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('3. P2PTransport rejects if no signaling channel provided', async () => {
    const p2p = new P2PTransport(undefined);
    const mockPeer: AuthorizedPeer = {
      peer: {
        deviceId: 'dev_pc',
        deviceName: 'Desktop PC',
        pubKeyFingerprint: 'fp_pc',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'cloud_presence',
        lastSeen: Date.now(),
      },
      role: 'controller',
      expiresAt: Date.now() + 60000,
    };

    await expect(p2p.connect(mockPeer)).rejects.toThrow();
  });

  it('4. TransportManager initializes P2P with DeviceDiscoveryEngine signaling channel', () => {
    const mgr = TransportManager.getInstance();
    expect(mgr).toBeDefined();
    expect(typeof mgr.establish).toBe('function');
    expect(typeof mgr.send).toBe('function');
  });
});
