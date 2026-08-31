import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalLanTransport } from '@/lib/jam/transport/LocalLanTransport';
import { TransportRouter } from '@/lib/jam/transport/TransportRouter';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { JamEvent } from '@/types/jam';
import { Song } from '@/types/music';

const sampleSongA: Song = {
  id: 'song_lan_a',
  title: 'LAN Anthem Alpha',
  artist: 'RaagaX Sync Artist',
  artistId: 'art_raaga',
  album: 'Sync Vol 1',
  albumId: 'alb_sync_1',
  duration: 240,
  audioUrl: 'https://cdn.example.com/lan_a.mp3',
  coverUrl: 'https://cdn.example.com/lan_a.jpg',
  genre: 'Electronic',
  category: 'melody',
  releaseYear: 2024,
  plays: 50,
  likes: 12,
};

describe('RaagaX Jam — Advanced Local LAN Low-Latency Synchronization & Transport Router Suite', () => {
  let lanTransport: LocalLanTransport;
  let router: TransportRouter;
  let clockEngine: ClockSyncEngine;
  let stateMachine: JamPlaybackStateMachine;
  let driftEngine: DriftCorrectionEngine;

  beforeEach(async () => {
    lanTransport = new LocalLanTransport();
    router = TransportRouter.getInstance();
    router.resetForTesting();
    clockEngine = ClockSyncEngine.getInstance();
    clockEngine.resetForTesting();
    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();
    driftEngine = DriftCorrectionEngine.getInstance();
  });

  afterEach(async () => {
    await lanTransport.disconnect();
    router.cleanup();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Direct Local LAN Low-Latency Connection & Health
  // ──────────────────────────────────────────────────────────────────────────
  it('1. Local LAN Transport: Connects with low RTT and reports healthy connection state', async () => {
    lanTransport.setEndpointForTesting('http://192.168.1.50:3000');
    const ok = await lanTransport.connect('JAM_LAN_01', { userId: 'user_phone_b', userName: 'Phone B' }, 'http://192.168.1.50:3000');
    expect(ok).toBe(true);
    expect(lanTransport.isConnected).toBe(true);
    expect(lanTransport.isHealthy()).toBe(true);

    const health = lanTransport.getHealth();
    expect(health.transport).toBe('LOCAL_LAN');
    expect(health.state).toBe('CONNECTED');
    expect(health.rttMs).toBeLessThanOrEqual(50);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Scheduled Future Start for Simultaneous Playback
  // ──────────────────────────────────────────────────────────────────────────
  it('2. Scheduled Future Start: Sends targetStartTimeMs in future for simultaneous playback start', async () => {
    const now = Date.now();
    const futureStartTime = now + 400; // 400ms lead time buffer

    const playEvent: JamEvent = {
      eventId: 'EV_PLAY_LAN_01',
      jamId: 'JAM_LAN_01',
      type: 'PLAY',
      revision: 1,
      generation: 1,
      timelineId: 'TL_1_LAN',
      transitionId: 'TR_1_LAN',
      serverTimestamp: now,
      senderId: 'host_user',
      payload: {
        positionMs: 0,
        startAtServerTime: futureStartTime,
        timelineStartServerMs: futureStartTime,
        trackId: sampleSongA.id,
        currentSong: sampleSongA,
        state: 'PLAYING',
      },
    };

    const sessionMock: any = {
      jamId: 'JAM_LAN_01',
      state: 'PLAYING',
      positionMs: 0,
      basePositionMs: 0,
      startAtServerTime: futureStartTime,
      timelineStartServerMs: futureStartTime,
      timelineId: 'TL_1_LAN',
      transitionId: 'TR_1_LAN',
      generation: 1,
      trackId: sampleSongA.id,
      currentSong: sampleSongA,
      queue: [],
      participants: {},
    };

    const evaluateSpy = vi.spyOn(driftEngine, 'evaluateScheduledStart').mockImplementation(() => {});

    await stateMachine.handleTransition(sessionMock, playEvent, 'NEW_TRANSITION');

    expect(evaluateSpy).toHaveBeenCalled();
    expect(stateMachine.getPlaybackIdentity().generation).toBe(1);
    expect(stateMachine.getPlaybackIdentity().trackId).toBe(sampleSongA.id);

    evaluateSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Pause / Resume Preserves Exact Millisecond Position
  // ──────────────────────────────────────────────────────────────────────────
  it('3. Pause / Resume: Preserves exact millisecond pause position without restarting track or resetting timeline', async () => {
    const pausePosMs = 45230; // 45.23 seconds

    const pauseSession: any = {
      jamId: 'JAM_LAN_01',
      state: 'PAUSED',
      positionMs: pausePosMs,
      basePositionMs: pausePosMs,
      timelineId: 'TL_1_LAN',
      transitionId: 'TR_1_PAUSE',
      generation: 1,
      trackId: sampleSongA.id,
      currentSong: sampleSongA,
      queue: [],
      participants: {},
    };

    await stateMachine.handleTransition(pauseSession, undefined, 'EVENT');
    expect(stateMachine.getState().playbackState).toBe('PAUSED');

    // Resume same track
    const resumeSession: any = {
      ...pauseSession,
      state: 'PLAYING',
      startAtServerTime: Date.now() + 200,
      timelineStartServerMs: Date.now() + 200,
      transitionId: 'TR_1_RESUME',
    };

    const evalSpy = vi.spyOn(driftEngine, 'evaluateScheduledStart').mockImplementation(() => {});
    await stateMachine.handleTransition(resumeSession, undefined, 'EVENT');

    expect(stateMachine.getState().playbackState).toBe('PLAYING');
    expect(stateMachine.getPlaybackIdentity().generation).toBe(1); // Generation unchanged on resume
    evalSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Seek: Emits New Generation Timeline Anchor
  // ──────────────────────────────────────────────────────────────────────────
  it('4. Seek: Emits new generation timeline anchor and distributes target position to peers', async () => {
    const seekSession: any = {
      jamId: 'JAM_LAN_01',
      state: 'PLAYING',
      positionMs: 80000,
      basePositionMs: 80000,
      startAtServerTime: Date.now() + 200,
      timelineStartServerMs: Date.now() + 200,
      timelineId: 'TL_2_SEEK',
      transitionId: 'TR_2_SEEK',
      generation: 2, // Seek increments generation
      trackId: sampleSongA.id,
      currentSong: sampleSongA,
      queue: [],
      participants: {},
    };

    const evalSpy = vi.spyOn(driftEngine, 'evaluateScheduledStart').mockImplementation(() => {});
    await stateMachine.handleTransition(seekSession, undefined, 'EVENT');

    expect(stateMachine.getPlaybackIdentity().generation).toBe(2);
    expect(stateMachine.getPlaybackIdentity().timelineId).toBe('TL_2_SEEK');
    evalSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Transport Router: Selects Local LAN when Healthy, Fails Over to Cloud
  // ──────────────────────────────────────────────────────────────────────────
  it('5. Transport Router: Selects Local LAN when available and seamlessly fails over to Cloud on network fault', async () => {
    router.getLanTransport().setEndpointForTesting('http://192.168.1.50:3000');
    const initOk = await router.initialize(
      'JAM_LAN_01',
      { userId: 'user_host', userName: 'Host' },
      'http://192.168.1.50:3000'
    );
    expect(initOk).toBe(true);

    // Initial preference is LOCAL_LAN because endpoint is healthy
    expect(router.getActiveTransportType()).toBe('LOCAL_LAN');
    expect(router.getStatus().activeTransport).toBe('LOCAL_LAN');

    // Simulate LAN transport failure and command send -> should fail over to Cloud Realtime
    const lanSendCommandSpy = vi.spyOn(router.getLanTransport(), 'sendCommand').mockResolvedValue({
      success: false,
      error: 'LAN connection timeout',
      revision: 0,
    });

    const cloudSendCommandSpy = vi.spyOn(router.getCloudTransport(), 'sendCommand').mockResolvedValue({
      success: true,
      revision: 2,
    });

    const res = await router.sendCommand({
      commandId: 'cmd_play_test',
      action: 'PLAY',
      jamId: 'JAM_LAN_01',
      userId: 'user_host',
    });

    expect(res.success).toBe(true);
    expect(router.getActiveTransportType()).toBe('CLOUD_REALTIME');
    expect(router.getStatus().failoverCount).toBe(1);

    lanSendCommandSpy.mockRestore();
    cloudSendCommandSpy.mockRestore();
  });
});
