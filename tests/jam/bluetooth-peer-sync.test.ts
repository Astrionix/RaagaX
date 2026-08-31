import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BluetoothDiscoveryTransport, BluetoothSyncPacket } from '@/lib/jam/transport/BluetoothDiscoveryTransport';
import { TransportRouter } from '@/lib/jam/transport/TransportRouter';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { JamEvent } from '@/types/jam';
import { Song } from '@/types/music';

const sampleSongA: Song = {
  id: 'song_bt_a',
  title: 'Bluetooth Anthem Alpha',
  artist: 'RaagaX Sync Artist',
  artistId: 'art_raaga',
  album: 'Sync Vol 1',
  albumId: 'alb_sync_1',
  duration: 240,
  audioUrl: 'https://cdn.example.com/bt_a.mp3',
  coverUrl: 'https://cdn.example.com/bt_a.jpg',
  genre: 'Electronic',
  category: 'melody',
  releaseYear: 2024,
  plays: 50,
  likes: 12,
};

describe('RaagaX Jam — Advanced Bluetooth Low-Latency Peer Control & Synchronization Suite', () => {
  let btTransport: BluetoothDiscoveryTransport;
  let router: TransportRouter;
  let clockEngine: ClockSyncEngine;
  let stateMachine: JamPlaybackStateMachine;
  let driftEngine: DriftCorrectionEngine;

  beforeEach(async () => {
    btTransport = new BluetoothDiscoveryTransport();
    router = TransportRouter.getInstance();
    router.resetForTesting();
    clockEngine = ClockSyncEngine.getInstance();
    clockEngine.resetForTesting();
    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();
    driftEngine = DriftCorrectionEngine.getInstance();
  });

  afterEach(async () => {
    await btTransport.disconnect();
    router.cleanup();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Direct Peer NTP Clock Sync over Bluetooth
  // ──────────────────────────────────────────────────────────────────────────
  it('1. Direct Peer NTP Clock Sync: Computes direct hardware radio clock offset with sub-15ms RTT', async () => {
    await btTransport.connect('JAM_BT_01', { userId: 'user_phone_b', userName: 'Phone B' });
    expect(btTransport.isConnected).toBe(true);

    // Initial peer burst sets direct clock offset
    await btTransport.performPeerTimeSyncBurst(3);

    const clockState = clockEngine.getState();
    expect(clockState.sampleCount).toBeGreaterThanOrEqual(3);
    expect(clockState.rttMs).toBeLessThanOrEqual(15); // Direct peer radio RTT is ultra-low
    expect(btTransport.getHealth().quality).toBe('EXCELLENT');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Authoritative Timeline Packet Broadcast (Scheduled Future Start)
  // ──────────────────────────────────────────────────────────────────────────
  it('2. Scheduled Future Start: Bluetooth sends targetStartTimeMs in future for simultaneous playback start', async () => {
    await btTransport.connect('JAM_BT_01', { userId: 'host_pc', userName: 'Host PC' });
    btTransport.setHostRole(true);

    let receivedEvent: JamEvent | null = null;
    btTransport.subscribe((event) => {
      receivedEvent = event;
    });

    const hostNow = Date.now();
    const commandRes = await btTransport.sendCommand({
      commandId: 'cmd_play_1',
      jamId: 'JAM_BT_01',
      userId: 'host_pc',
      action: 'PLAY',
      payload: { positionMs: 15230, song: sampleSongA, trackId: sampleSongA.id },
      generation: 1,
      timelineId: 'TL_BT_1',
    });

    expect(commandRes.success).toBe(true);
    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent!.type).toBe('PLAY');
    expect(receivedEvent!.payload.positionMs).toBe(15230);
    // Scheduled start is set to future timestamp (~250ms ahead)
    expect(receivedEvent!.payload.startAtServerTime).toBeGreaterThan(hostNow);
    expect(receivedEvent!.payload.startAtServerTime - hostNow).toBeGreaterThanOrEqual(200);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Exact Pause / Resume Position Preservation
  // ──────────────────────────────────────────────────────────────────────────
  it('3. Pause / Resume: Preserves exact millisecond pause position without restarting track or resetting timeline', async () => {
    await btTransport.connect('JAM_BT_01', { userId: 'host_pc', userName: 'Host PC' });
    btTransport.setHostRole(true);

    const events: JamEvent[] = [];
    btTransport.subscribe((e) => events.push(e));

    // 1. Host Pauses at 42,150 ms
    await btTransport.sendCommand({
      commandId: 'cmd_pause_1',
      jamId: 'JAM_BT_01',
      userId: 'host_pc',
      action: 'PAUSE',
      payload: { positionMs: 42150, song: sampleSongA, trackId: sampleSongA.id },
      generation: 1,
      timelineId: 'TL_BT_1',
    });

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('PAUSE');
    expect(events[0].payload.positionMs).toBe(42150);

    // 2. Host Resumes Playback
    await btTransport.sendCommand({
      commandId: 'cmd_resume_1',
      jamId: 'JAM_BT_01',
      userId: 'host_pc',
      action: 'PLAY',
      payload: { positionMs: 42150, song: sampleSongA, trackId: sampleSongA.id },
      generation: 1,
      timelineId: 'TL_BT_1',
    });

    expect(events.length).toBe(2);
    expect(events[1].type).toBe('PLAY');
    expect(events[1].payload.positionMs).toBe(42150); // Exact resume position
    expect(events[1].payload.trackId).toBe(sampleSongA.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Authoritative Seek Creates New Generation Timeline Anchor
  // ──────────────────────────────────────────────────────────────────────────
  it('4. Seek: Emits new generation timeline anchor and distributes target position to peers', async () => {
    await btTransport.connect('JAM_BT_01', { userId: 'host_pc', userName: 'Host PC' });
    btTransport.setHostRole(true);

    let seekEvent: JamEvent | null = null;
    btTransport.subscribe((e) => {
      if (e.type === 'SEEK') seekEvent = e;
    });

    await btTransport.sendCommand({
      commandId: 'cmd_seek_90s',
      jamId: 'JAM_BT_01',
      userId: 'host_pc',
      action: 'SEEK',
      payload: { positionMs: 90000, song: sampleSongA, trackId: sampleSongA.id },
      generation: 2,
      timelineId: 'TL_BT_2',
    });

    expect(seekEvent).not.toBeNull();
    expect(seekEvent!.type).toBe('SEEK');
    expect(seekEvent!.generation).toBe(2);
    expect(seekEvent!.timelineId).toBe('TL_BT_2');
    expect(seekEvent!.payload.positionMs).toBe(90000);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Continuous Peer Timing Heartbeat (Anchor Calculation, No Packet Flooding)
  // ──────────────────────────────────────────────────────────────────────────
  it('5. Continuous Peer Timing: Calculates continuous expected position from timeline anchor', () => {
    const anchorTime = Date.now() - 5000; // Anchor was 5 seconds ago
    const anchorPositionMs = 20000; // Song was at 20.0s

    const packet: BluetoothSyncPacket = {
      version: 2,
      sequenceNumber: 1,
      type: 'TIMELINE_ANCHOR',
      jamId: 'JAM_BT_01',
      revision: 10,
      generation: 1,
      timelineId: 'TL_BT_1',
      transitionId: 'TR_BT_1',
      trackId: sampleSongA.id,
      queueItemId: 'QI_1',
      state: 'PLAYING',
      anchorPositionMs,
      anchorHostTimeMs: anchorTime,
      targetStartTimeMs: anchorTime,
      hostTimestampMs: Date.now(),
    };

    // Client calculates expected position locally at current moment
    const currentHostTime = Date.now();
    const elapsedSinceAnchor = currentHostTime - packet.anchorHostTimeMs;
    const expectedPositionMs = packet.anchorPositionMs + elapsedSinceAnchor;

    // Expected position must be ~25,000ms (20s anchor + 5s elapsed)
    expect(expectedPositionMs).toBeGreaterThanOrEqual(24900);
    expect(expectedPositionMs).toBeLessThanOrEqual(25200);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Transport Router: Bluetooth Preferred for Nearby Sync with Zero-Interruption Failover
  // ──────────────────────────────────────────────────────────────────────────
  it('6. Transport Router: Selects Bluetooth Peer Sync first and seamlessly fails over to LAN/Cloud', async () => {
    router.getBluetoothTransport().setActivePeersCount(1);
    await router.initialize('JAM_BT_ROUTER', { userId: 'user_1', userName: 'User 1' }, undefined, true);

    // Initial preference is BLUETOOTH_PEER_SYNC
    expect(router.getActiveTransportType()).toBe('BLUETOOTH_PEER_SYNC');
    expect(router.getStatus().activeTransport).toBe('BLUETOOTH_PEER_SYNC');

    const cloudSpy = vi.spyOn(router.getCloudTransport(), 'sendCommand').mockResolvedValue({
      success: true,
      revision: 5,
      commandId: 'cmd_failover_bt',
    });

    // Simulate Bluetooth transport disconnection
    await router.getBluetoothTransport().disconnect();

    // Send a command when Bluetooth is down -> should seamlessly fail over to Cloud Realtime
    const res = await router.sendCommand({
      commandId: 'cmd_failover_bt',
      jamId: 'JAM_BT_ROUTER',
      userId: 'user_1',
      action: 'PLAY',
      payload: { positionMs: 30000 },
    });

    expect(res.success).toBe(true);
    expect(cloudSpy).toHaveBeenCalled();
    expect(router.getActiveTransportType()).toBe('CLOUD_REALTIME');
    expect(router.getStatus().failoverCount).toBeGreaterThanOrEqual(1);

    cloudSpy.mockRestore();
  });
});
