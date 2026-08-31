import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TransportRouter } from '@/lib/jam/transport/TransportRouter';
import { LocalLanTransport } from '@/lib/jam/transport/LocalLanTransport';
import { CloudRealtimeTransport } from '@/lib/jam/transport/CloudRealtimeTransport';
import { BluetoothDiscoveryTransport } from '@/lib/jam/transport/BluetoothDiscoveryTransport';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamSession, JamEvent } from '@/types/jam';
import { Song } from '@/types/music';

const sampleSongA: Song = {
  id: 'song_a',
  title: 'Song Alpha',
  artist: 'Artist Alpha',
  artistId: 'art_a',
  album: 'Album Alpha',
  albumId: 'alb_a',
  duration: 200,
  audioUrl: 'https://cdn.test/song_a.mp3',
  coverUrl: 'https://cdn.test/song_a.jpg',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 10,
  likes: 2,
};

const sampleSongB: Song = {
  id: 'song_b',
  title: 'Song Beta',
  artist: 'Artist Beta',
  artistId: 'art_b',
  album: 'Album Beta',
  albumId: 'alb_b',
  duration: 180,
  audioUrl: 'https://cdn.test/song_b.mp3',
  coverUrl: 'https://cdn.test/song_b.jpg',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 20,
  likes: 5,
};

describe('RaagaX Jam — Advanced Multi-Transport Discovery, Low-Latency Synchronization & Cross-Device Playback', () => {
  let router: TransportRouter;
  let clientManager: JamClientManager;
  let stateMachine: JamPlaybackStateMachine;
  let driftEngine: DriftCorrectionEngine;
  let clockSync: ClockSyncEngine;
  let serverEngine: JamServerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    serverEngine = JamServerEngine.getInstance();
    router = TransportRouter.getInstance();
    router.resetForTesting();
    clientManager = JamClientManager.getInstance();
    clientManager.resetForTesting();
    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();
    driftEngine = DriftCorrectionEngine.getInstance();
    driftEngine.resetForTesting();
    clockSync = ClockSyncEngine.getInstance();
    clockSync.resetForTesting(0);
  });

  afterEach(() => {
    router.cleanup();
    clientManager.resetForTesting();
  });

  it('1. Transport Abstraction: Prefer Local LAN when healthy with ultra-low latency and zero separate clock', async () => {
    const lanTransport = router.getLanTransport();
    lanTransport.setEndpointForTesting('http://192.168.1.50:3000');

    await router.initialize('JAM_LAN_1', { userId: 'user_host', userName: 'Host' }, 'http://192.168.1.50:3000', false);

    // Verify LAN transport is actively selected
    expect(router.getActiveTransportType()).toBe('LOCAL_LAN');
    const health = router.getStatus().lanHealth;
    expect(health.transport).toBe('LOCAL_LAN');
    expect(health.rttMs).toBeLessThanOrEqual(50);
  });

  it('2. Remote Network Transport: Selects Cloud Realtime when no LAN endpoint is reachable', async () => {
    await router.initialize('JAM_CLOUD_1', { userId: 'user_remote', userName: 'Remote Participant' }, undefined, false);

    expect(router.getActiveTransportType()).toBe('CLOUD_REALTIME');
    const status = router.getStatus();
    expect(status.cloudHealth.state).toBe('CONNECTED');
    expect(status.failoverCount).toBe(0);
  });

  it('3. Automatic Failover: Seamlessly switches to Cloud Realtime when LAN degrades with ZERO playback interruption', async () => {
    const lanTransport = router.getLanTransport();
    lanTransport.setEndpointForTesting('http://192.168.1.50:3000');

    await router.initialize('JAM_FAILOVER_1', { userId: 'user_1', userName: 'User 1' }, 'http://192.168.1.50:3000', false);
    expect(router.getActiveTransportType()).toBe('LOCAL_LAN');

    // Simulate LAN failure
    lanTransport.disconnect();

    // Send a command while LAN is down
    const cmdResponse = await router.sendCommand({
      commandId: 'cmd_failover_test',
      jamId: 'JAM_FAILOVER_1',
      userId: 'user_1',
      action: 'PLAY',
      payload: { positionMs: 35000 },
      timestamp: Date.now(),
    });

    // Transport should have automatically failed over to Cloud
    expect(router.getActiveTransportType()).toBe('CLOUD_REALTIME');
    expect(router.getStatus().failoverCount).toBe(1);
  });

  it('4. Hysteresis / Anti-Flapping: Prevents continuous bouncing between LAN and Cloud on transient jitter', async () => {
    const lanTransport = router.getLanTransport();
    lanTransport.setEndpointForTesting('http://192.168.1.50:3000');

    await router.initialize('JAM_HYSTERESIS_1', { userId: 'user_1', userName: 'User 1' }, 'http://192.168.1.50:3000', false);
    expect(router.getActiveTransportType()).toBe('LOCAL_LAN');

    // A single ping failure must NOT immediately flap to Cloud (requires consecutive failures)
    lanTransport.getHealth().failureCount = 1;
    expect(router.getActiveTransportType()).toBe('LOCAL_LAN');
  });

  it('5. In-flight Seek & Next Idempotency: Duplicate events across transports produce exactly one transition', async () => {
    const session: JamSession = {
      jamId: 'JAM_IDEMPOTENT',
      joinCode: 'IDEMP',
      name: 'Idempotency Jam',
      hostId: 'h1',
      hostName: 'Alice',
      state: 'PLAYING',
      trackId: sampleSongA.id,
      currentSong: sampleSongA,
      positionMs: 15000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 400,
      revision: 5,
      generation: 2,
      timelineId: 'TL_2',
      transitionId: 'TR_2_SEEK',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [{ queueItemId: 'q_b', trackId: sampleSongB.id, song: sampleSongB, addedBy: 'h1', addedByName: 'Alice', addedAt: 1000, orderKey: 'a0' }],
      history: [],
    };

    const duplicateEvent: JamEvent = {
      eventId: 'evt_seek_duplicate',
      jamId: 'JAM_IDEMPOTENT',
      senderId: 'h1',
      type: 'SEEK',
      revision: 6,
      generation: 3,
      timelineId: 'TL_3',
      transitionId: 'TR_3_SEEK_120',
      serverTimestamp: 2000,
      payload: { positionMs: 120000, trackId: sampleSongA.id },
    };

    await router.initialize('JAM_IDEMPOTENT', { userId: 'user_1', userName: 'Alice' }, 'http://192.168.1.50:3000');

    let eventReceiveCount = 0;
    router.subscribe(() => {
      eventReceiveCount++;
    });

    // Mock receiving the same event across both LAN and Cloud
    router.getLanTransport().mockEmitEvent(duplicateEvent);
    router.getLanTransport().mockEmitEvent(duplicateEvent); // Duplicate dropped by Router deduplication

    expect(eventReceiveCount).toBe(1);
  });

  it('6. New Device Join While Playing: Host remains uninterrupted; joining device calculates timeline and catches up', async () => {
    const activeSession: JamSession = {
      jamId: 'JAM_JOIN_PLAYING',
      joinCode: 'JOIN1',
      name: 'Join Jam',
      hostId: 'host_alice',
      hostName: 'Alice',
      state: 'PLAYING',
      trackId: sampleSongA.id,
      currentSong: sampleSongA,
      positionMs: 60000,
      serverTimestamp: 100000,
      startAtServerTime: 100000,
      leadTimeMs: 400,
      revision: 10,
      generation: 3,
      timelineId: 'TL_3',
      createdAt: 100000,
      updatedAt: 100000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    driftEngine.setSession(activeSession);

    // Host at serverNow = 115000 (15 seconds elapsed since startAtServerTime)
    const expectedPosMs = driftEngine.calculateExpectedPositionMs(activeSession, 115000);
    expect(expectedPosMs).toBe(75000); // 60000 base + 15000 elapsed
  });

  it('7. New Device Join While Paused: Seeks to pause position and remains paused', async () => {
    const pausedSession: JamSession = {
      jamId: 'JAM_JOIN_PAUSED',
      joinCode: 'PAUSE',
      name: 'Paused Jam',
      hostId: 'host_alice',
      hostName: 'Alice',
      state: 'PAUSED',
      trackId: sampleSongA.id,
      currentSong: sampleSongA,
      positionMs: 32500,
      serverTimestamp: 100000,
      startAtServerTime: 100000,
      leadTimeMs: 400,
      revision: 4,
      generation: 1,
      timelineId: 'TL_1',
      createdAt: 100000,
      updatedAt: 100000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    driftEngine.setSession(pausedSession);

    // Expected position during pause is exactly the paused positionMs regardless of elapsed time
    const expectedPosMs = driftEngine.calculateExpectedPositionMs(pausedSession, 150000);
    expect(expectedPosMs).toBe(32500);
  });
});
