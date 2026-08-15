import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { ConnectManager } from '@/lib/connect/ConnectManager';
import { LocalPeerConnection } from '@/lib/connect/LocalPeerConnection';
import { ConnectivityRouter } from '@/lib/connect/ConnectivityRouter';
import { PlaybackStateSync, RemotePlaybackState } from '@/lib/connect/PlaybackStateSync';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { SeekLock } from '@/lib/playback/SeekLock';
import { Song } from '@/types/music';

// Mock storage and navigator for Node test environment
const mockStorageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorageMap.get(key) || null,
  setItem: (key: string, value: string) => mockStorageMap.set(key, value),
  removeItem: (key: string) => mockStorageMap.delete(key),
  clear: () => mockStorageMap.clear(),
};

if (typeof window === 'undefined') {
  (global as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}
(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockLocalStorage;

Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    storage: {
      estimate: vi.fn().mockResolvedValue({ quota: 64 * 1024 * 1024 * 1024, usage: 0 }),
    }
  },
  writable: true,
  configurable: true
});

// Mock WebRTC API globally
class MockRTCDataChannel {
  public label: string;
  public readyState: string = 'connecting';
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onmessage: ((ev: any) => void) | null = null;
  public send = vi.fn();
  public close = vi.fn();

  constructor(label: string) {
    this.label = label;
  }
}

class MockRTCPeerConnection {
  public onicecandidate: ((ev: any) => void) | null = null;
  public ondatachannel: ((ev: any) => void) | null = null;
  
  public createDataChannel(label: string) {
    return new MockRTCDataChannel(label);
  }
  public createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'mock-sdp' });
  }
  public createAnswer() {
    return Promise.resolve({ type: 'answer', sdp: 'mock-sdp' });
  }
  public setLocalDescription() {
    return Promise.resolve();
  }
  public setRemoteDescription() {
    return Promise.resolve();
  }
  public addIceCandidate() {
    return Promise.resolve();
  }
  public close() {}
}

(global as any).RTCPeerConnection = MockRTCPeerConnection as any;
(global as any).RTCSessionDescription = class {} as any;
(global as any).RTCIceCandidate = class {} as any;

// Mock TransportRouter at module level so cloud dispatch resolves instantly without Supabase
vi.mock('@/lib/connect/TransportRouter', () => {
  let mockVia = 'CLOUD_RELAY' as const;

  const instance = {
    dispatchTargeted: vi.fn(async (targetId: string, command: any, cloudFallback: any) => {
      const { ConnectManager } = await import('@/lib/connect/ConnectManager');
      // If LAN is available, optimistically succeed; otherwise use cloud callback
      const { ConnectivityRouter } = await import('@/lib/connect/ConnectivityRouter');
      const transport = ConnectivityRouter.getInstance().getActiveTransport();
      if (transport === 'LOCAL_DIRECT') {
        const { LocalPeerConnection } = await import('@/lib/connect/LocalPeerConnection');
        const sent = LocalPeerConnection.getInstance().sendDirectCommand(targetId, command);
        if (sent) return { sent: true, via: 'LOCAL_DIRECT' };
        ConnectivityRouter.getInstance().setLocalPeerAvailable(false);
      }
      // Cloud fallback — trigger ACK so the caller doesn't timeout
      ConnectManager.getInstance().handleCommandAck({ commandId: command.commandId, status: 'APPLIED' });
      return { sent: true, via: 'CLOUD_RELAY' };
    }),
    dispatchBroadcast: vi.fn(async (_command: any, _cloudFallback: any) => {
      return { sent: true, via: 'CLOUD_RELAY' };
    }),
    onLanChannelAvailable: vi.fn(),
    onLanChannelLost: vi.fn(),
    getTransportLabel: vi.fn(() => 'Connected'),
  };

  return {
    TransportRouter: {
      getInstance: () => instance
    }
  };
});

const songInthandham: Song = {
  id: 'song_inthandham_1',
  title: 'Inthandham',
  artist: 'Sita Ramam',
  duration: 218,
  coverUrl: '/covers/inthandham.jpg',
  audioUrl: 'https://cdn.raagax.com/inthandham.mp3',
} as Song;

describe('RaagaX Hybrid LAN + Cloud Transport Router Tests', () => {
  beforeEach(() => {
    mockStorageMap.clear();
    usePlayerStore.setState({
      deviceId: 'dev_mobile_1',
      isActiveDevice: true,
      activeDeviceId: null,
      connectedDeviceId: null,
      deviceConnectionState: 'AVAILABLE',
      availableDevicePlaybackStates: {},
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      queue: [],
      queueIndex: 0,
      onlineDevices: [],
      localPlaybackRevision: 0,
      lastReceivedPlaybackRevision: 0,
    });

    CommandSequencer.getInstance().reset();
    ConnectivityRouter.getInstance().reset();
    
    // Clear mock spy tracking
    vi.restoreAllMocks();
  });

  // Test 1: Direct LAN Connection Handshake & Snapshot Adoption
  it('Test 1: Direct connect handshake initiates WebRTC P2P and adopts current playback snapshot', async () => {
    const peerConnection = LocalPeerConnection.getInstance();
    const connectManager = ConnectManager.getInstance();
    
    // Mock the connectToDevice promise resolution to simulate a successful handshake
    const handshakeSpy = vi.spyOn(peerConnection, 'connectToDevice').mockImplementation(async (targetId) => {
      // Simulate remote snapshot adoption immediately
      const mockSnapshot: RemotePlaybackState = {
        activeDeviceId: 'dev_laptop_1',
        activeDeviceName: 'TNT Gaming PC',
        songId: songInthandham.id,
        songData: songInthandham,
        isPlaying: true,
        positionMs: 134000,
        durationMs: 218000,
        volume: 0.72,
        isMuted: false,
        queue: [songInthandham],
        queueIndex: 0,
        epoch: 1,
        serverTimestamp: Date.now()
      };
      PlaybackStateSync.getInstance().adoptRemoteState(mockSnapshot);
      ConnectivityRouter.getInstance().setLocalPeerAvailable(true);
      return true;
    });

    const success = await connectManager.connectToDevice('dev_laptop_1');
    
    expect(success).toBe(true);
    expect(handshakeSpy).toHaveBeenCalledWith('dev_laptop_1');
    expect(usePlayerStore.getState().deviceConnectionState).toBe('CONNECTED');
    expect(usePlayerStore.getState().connectedDeviceId).toBe('dev_laptop_1');
    expect(usePlayerStore.getState().currentSong?.title).toBe('Inthandham');
    expect(usePlayerStore.getState().currentTime).toBe(134);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Transport health is LAN_CONNECTED
    expect(ConnectivityRouter.getInstance().getTransportHealth()).toBe('LAN_CONNECTED');
  });

  // Test 2: Command Routing (LAN Direct priority vs Cloud fallback)
  it('Test 2: Routes commands through LAN direct when active, and falls back to Cloud relay when LAN drops', async () => {
    const peerConnection = LocalPeerConnection.getInstance();
    const connectManager = ConnectManager.getInstance();
    const router = ConnectivityRouter.getInstance();

    // Set connected device on the store instance
    usePlayerStore.setState({ connectedDeviceId: 'dev_laptop_1' });

    // 1. Setup active LAN connection
    router.setLocalPeerAvailable(true);
    expect(router.getActiveTransport()).toBe('LOCAL_DIRECT');

    // Spy on LAN command send
    const sendDirectSpy = vi.spyOn(peerConnection, 'sendDirectCommand').mockReturnValue(true);
    
    // Dispatch seek command (this resolves immediately because of optimistic auto-resolution)
    const res = await connectManager.dispatchPlaybackCommand('SEEK', { positionMs: 120000 });
    expect(res.success).toBe(true);
    expect(sendDirectSpy).toHaveBeenCalled();

    // 2. Simulate LAN transport failure (datachannel closed/send fails)
    sendDirectSpy.mockReturnValue(false);
    
    // Mock the session channel and inbox channel fallback send to immediately trigger command ACK
    const sessionSendMock = vi.fn().mockImplementation(async (payload) => {
      const cmd = payload.payload;
      connectManager.handleCommandAck({ commandId: cmd.commandId, status: 'APPLIED' });
      return { success: true };
    });
    
    (connectManager as any).sessionChannel = {
      send: sessionSendMock
    };
    (connectManager as any).inboxChannel = {
      send: sessionSendMock
    };

    // Dispatch next command
    const resFallback = await connectManager.dispatchPlaybackCommand('PLAY');
    expect(resFallback.success).toBe(true);
    expect(router.getActiveTransport()).toBe('CLOUD_RELAY');
  });

  // Test 3: Heartbeat Timeout keepalive detection
  it('Test 3: Periodic heartbeats detect connection stale/lost and trigger cleanup', async () => {
    vi.useFakeTimers();
    const peerConnection = LocalPeerConnection.getInstance();
    
    // Set up mock DataChannel
    const mockChannel = new MockRTCDataChannel('raagax-control');
    mockChannel.readyState = 'open';
    (peerConnection as any).dataChannels.set('dev_laptop_1', mockChannel);

    // Start heartbeat
    (peerConnection as any).startHeartbeatLoop('dev_laptop_1');

    // Fast forward 3 seconds to trigger first heartbeat (missed = 1)
    vi.advanceTimersByTime(3000);
    expect(mockChannel.send).toHaveBeenCalled();
    expect((peerConnection as any).missedHeartbeats.get('dev_laptop_1')).toBe(1);

    // Fast forward another 6 seconds without HEARTBEAT_ACK (ticks at 6000ms: missed=2, ticks at 9000ms: missed=2 -> triggers timeout)
    vi.advanceTimersByTime(7000);
    
    // Should trigger cleanup of stale connection
    expect(peerConnection.sendDirectCommand('dev_laptop_1', {} as any)).toBe(false);
    // TransportRouter.onLanChannelLost → setLocalPeerAvailable(false) → CLOUD_RELAY
    expect(ConnectivityRouter.getInstance().getTransportHealth()).toBe('CLOUD_CONNECTED');

    vi.useRealTimers();
  });

  // Test 4: Seek Settling Lock shields remote state updates
  it('Test 4: Suppresses remote updates during seek settling window to eliminate thumb snapbacks', () => {
    const sync = PlaybackStateSync.getInstance();
    
    usePlayerStore.setState({
      connectedDeviceId: 'dev_laptop_1',
      isActiveDevice: false,
    });

    // Simulate user seek starting
    SeekLock.startSeeking();
    expect(SeekLock.shouldBlockRemoteUpdate).toBe(true);

    // End seek, settling lock starts
    SeekLock.endSeeking(800);
    expect(SeekLock.shouldBlockRemoteUpdate).toBe(true);

    // Incoming remote state update during settle should be ignored
    const remoteState: RemotePlaybackState = {
      activeDeviceId: 'dev_laptop_1',
      activeDeviceName: 'TNT Gaming PC',
      songId: songInthandham.id,
      songData: songInthandham,
      isPlaying: true,
      positionMs: 45000, // old stale position
      durationMs: 218000,
      volume: 0.72,
      isMuted: false,
      queue: [songInthandham],
      queueIndex: 0,
      epoch: 1,
      serverTimestamp: Date.now()
    };

    const stateAdoptSpy = vi.spyOn(sync, 'adoptRemoteState');
    sync.handleRemoteStateUpdate(remoteState);

    // State adoption must not happen!
    expect(stateAdoptSpy).not.toHaveBeenCalled();
  });
});
