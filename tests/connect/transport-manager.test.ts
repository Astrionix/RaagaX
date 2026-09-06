import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scoreTransport,
  TransportScore,
  TRANSPORT_COST_WEIGHTS,
  Transport,
  AuthorizedPeer,
  ControlMessage,
  TransportHealth,
} from '@/lib/connect/types';
import { TransportManager } from '@/lib/connect/transport/TransportManager';

class MockTransport implements Transport {
  public connectCalls = 0;
  public isConnectedState = false;
  private messageCb?: (msg: ControlMessage) => void;

  constructor(
    public readonly kind: any,
    private latency: number = 5,
    private shouldSucceed: boolean = true
  ) {}

  public isConnected(): boolean {
    return this.isConnectedState;
  }

  public async connect(peer: AuthorizedPeer): Promise<void> {
    this.connectCalls++;
    if (!this.shouldSucceed) {
      throw new Error(`Connection failed for ${this.kind}`);
    }
    this.isConnectedState = true;
  }

  public async send(msg: ControlMessage): Promise<void> {}

  public onMessage(cb: (msg: ControlMessage) => void): void {
    this.messageCb = cb;
  }

  public async healthCheck(): Promise<TransportHealth> {
    return { latencyMs: this.latency, ok: this.shouldSucceed };
  }

  public async close(): Promise<void> {
    this.isConnectedState = false;
  }
}

describe('RaagaX Connect — TransportManager & Scoring Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Scoring Formula: Favors LAN over P2P, TURN, and Cloud', () => {
    const lanScore: TransportScore = {
      transport: 'LOCAL_LAN',
      latencyMs: 3,
      reliability: 1.0,
      costWeight: TRANSPORT_COST_WEIGHTS['LOCAL_LAN'],
      available: true,
    };

    const p2pScore: TransportScore = {
      transport: 'P2P',
      latencyMs: 35,
      reliability: 1.0,
      costWeight: TRANSPORT_COST_WEIGHTS['P2P'],
      available: true,
    };

    const turnScore: TransportScore = {
      transport: 'TURN_RELAY',
      latencyMs: 80,
      reliability: 0.9,
      costWeight: TRANSPORT_COST_WEIGHTS['TURN_RELAY'],
      available: true,
    };

    const cloudScore: TransportScore = {
      transport: 'CLOUD_CONTROL',
      latencyMs: 90,
      reliability: 0.95,
      costWeight: TRANSPORT_COST_WEIGHTS['CLOUD_CONTROL'],
      available: true,
    };

    const sLan = scoreTransport(lanScore);
    const sP2P = scoreTransport(p2pScore);
    const sTurn = scoreTransport(turnScore);
    const sCloud = scoreTransport(cloudScore);

    // LAN (ultra low latency, cost=0) > P2P (cost=0) > TURN (cost=5*50) > Cloud (cost=10*50)
    expect(sLan).toBeGreaterThan(sP2P);
    expect(sP2P).toBeGreaterThan(sTurn);
    expect(sTurn).toBeGreaterThan(sCloud);

    // Unavailable returns -Infinity
    expect(scoreTransport({ ...lanScore, available: false })).toBe(-Infinity);
  });

  it('2. Priority Selection: Connects to LOCAL_LAN first when available', async () => {
    const mgr = TransportManager.getInstance();

    const mockLan = new MockTransport('LOCAL_LAN', 2, true);
    const mockP2P = new MockTransport('P2P', 30, true);
    const mockCloud = new MockTransport('CLOUD_CONTROL', 80, true);

    const dummyPeer: AuthorizedPeer = {
      peer: {
        deviceId: 'dev_test_1',
        pubKeyFingerprint: 'abc12345',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'mdns',
        lastSeen: Date.now(),
      },
      role: 'player',
      expiresAt: Date.now() + 10000,
    };

    const active = await mgr.establish(dummyPeer, [mockLan, mockP2P, mockCloud]);
    expect(active.kind).toBe('LOCAL_LAN');
    expect(mgr.getActiveKind()).toBe('LOCAL_LAN');
    expect(mockLan.connectCalls).toBe(1);

    mgr.closeAll();
  });

  it('3. Fallback Chain: Falls back to P2P if LAN fails', async () => {
    const mgr = TransportManager.getInstance();

    const mockLan = new MockTransport('LOCAL_LAN', 2, false); // LAN fails
    const mockP2P = new MockTransport('P2P', 30, true);       // P2P succeeds
    const mockCloud = new MockTransport('CLOUD_CONTROL', 80, true);

    const dummyPeer: AuthorizedPeer = {
      peer: {
        deviceId: 'dev_test_2',
        pubKeyFingerprint: 'def67890',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'cloud_presence',
        lastSeen: Date.now(),
      },
      role: 'player',
      expiresAt: Date.now() + 10000,
    };

    const active = await mgr.establish(dummyPeer, [mockLan, mockP2P, mockCloud]);
    expect(active.kind).toBe('P2P');
    expect(mgr.getActiveKind()).toBe('P2P');

    mgr.closeAll();
  });
});
