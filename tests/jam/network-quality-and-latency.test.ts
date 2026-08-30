import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkQualityEngine } from '@/lib/jam/client/NetworkQualityEngine';
import { ClockSyncEngine, ClockSample } from '@/lib/jam/client/ClockSyncEngine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { JamSession, Song } from '@/types/jam';

const sampleSong1: Song = {
  id: 'song-net-1',
  title: 'Network Sync Groove',
  artist: 'RaagaX Ensemble',
  album: 'Latency Horizons',
  duration: 240,
  url: 'https://cdn.example.com/audio/song1.mp3',
  cover: 'https://cdn.example.com/covers/song1.jpg',
};

const sampleSong2: Song = {
  id: 'song-net-2',
  title: 'Jitter Resilient Melody',
  artist: 'Drift Masters',
  album: 'Clock Alignment',
  duration: 180,
  url: 'https://cdn.example.com/audio/song2.mp3',
  cover: 'https://cdn.example.com/covers/song2.jpg',
};

describe('RaagaX Jam — Network Quality & Latency Synchronization Suite', () => {
  let netEngine: NetworkQualityEngine;
  let clockEngine: ClockSyncEngine;
  let driftEngine: DriftCorrectionEngine;
  let serverEngine: JamServerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    netEngine = NetworkQualityEngine.getInstance();
    netEngine.resetForTesting(30);

    clockEngine = ClockSyncEngine.getInstance();
    clockEngine.resetForTesting(0);

    driftEngine = DriftCorrectionEngine.getInstance();
    driftEngine.resetForTesting();

    serverEngine = JamServerEngine.getInstance();
    serverEngine.resetForTesting();
  });

  afterEach(() => {
    driftEngine.stop();
    clockEngine.stopPeriodicSync();
  });

  describe('1. NetworkQualityEngine: RTT, Median, Jitter, Packet Loss & Quality State', () => {
    it('accurately computes rolling median RTT and rejects anomalous outlier spikes', () => {
      // Record normal pings: 30ms, 32ms, 28ms, 35ms
      netEngine.recordPing(30);
      netEngine.recordPing(32);
      netEngine.recordPing(28);
      netEngine.recordPing(35);

      expect(netEngine.getMedianRTT()).toBe(31);
      expect(netEngine.getConnectionQuality()).toBe('EXCELLENT');

      // Record a transient network spike (e.g. 450ms cellular spike)
      netEngine.recordPing(450);

      // Median should remain stable around ~32ms, immune to single spike
      expect(netEngine.getMedianRTT()).toBe(32);
    });

    it('calculates network jitter based on variation between consecutive samples', () => {
      netEngine.recordPing(40);
      netEngine.recordPing(60); // diff = 20
      netEngine.recordPing(30); // diff = 30
      netEngine.recordPing(50); // diff = 20

      // Jitter = (20 + 30 + 20) / 3 = 23.33 -> 23
      expect(netEngine.getJitter()).toBe(23);
    });

    it('measures packet loss percentage and transitions connection quality state', () => {
      // Record 18 successes and 2 failures
      for (let i = 0; i < 18; i++) {
        netEngine.recordPing(50, true);
      }
      netEngine.recordPing(100, false);
      netEngine.recordPing(100, false);

      // 2 failed out of 20 total = 10% packet loss
      expect(netEngine.getPacketLoss()).toBe(10);
      expect(netEngine.getConnectionQuality()).toBe('FAIR');
    });

    it('classifies POOR connection when median RTT >= 450ms or packet loss >= 15%', () => {
      for (let i = 0; i < 5; i++) {
        netEngine.recordPing(480, true);
      }
      expect(netEngine.getConnectionQuality()).toBe('POOR');
    });

    it('notifies subscribers immediately when network metrics update', () => {
      const listener = vi.fn();
      const unsub = netEngine.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1); // initial emission

      netEngine.recordPing(85);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[1][0].rtt).toBe(85);

      unsub();
      netEngine.recordPing(90);
      expect(listener).toHaveBeenCalledTimes(2); // no further calls after unsub
    });
  });

  describe('2. ClockSyncEngine & NTP Server-Clock Alignment', () => {
    it('exposes estimatedServerNow() based on measured clock offset', () => {
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Suppose local clock is 120ms behind server (+120ms offset)
      clockEngine.resetForTesting(120);

      expect(clockEngine.estimatedServerNow()).toBe(now + 120);
      expect(clockEngine.getEstimatedServerTime()).toBe(now + 120);
    });

    it('processes NTP samples with weighted exponential moving average and outlier filtering', () => {
      const samples: ClockSample[] = [
        { rtt: 40, offset: 50, timestamp: 1000 },
        { rtt: 42, offset: 52, timestamp: 1060 },
        { rtt: 38, offset: 48, timestamp: 1120 },
        { rtt: 350, offset: 180, timestamp: 1180 }, // Outlier with high RTT
      ];

      clockEngine.processSamples(samples);

      const state = clockEngine.getState();
      expect(state.offsetMs).toBeCloseTo(50, -1);
      expect(state.rttMs).toBeLessThan(60);
      expect(state.sampleCount).toBeGreaterThan(0);
    });
  });

  describe('3. Authoritative Playback Timelines, Adaptive Lead Time & Generation Tracking', () => {
    it('computes adaptive lead time bounded between 250ms and 1000ms based on participant RTTs', () => {
      const { session } = serverEngine.createSession({
        hostId: 'host-1',
        hostName: 'Alice',
        initialSong: sampleSong1,
      });

      // Fast LAN participant (20ms RTT)
      serverEngine.joinSession(session.jamId, { userId: 'guest-fast', displayName: 'Bob' });
      serverEngine.executeCommand({
        commandId: 'cmd-stat-1',
        jamId: session.jamId,
        userId: 'guest-fast',
        action: 'UPDATE_PARTICIPANT_STATUS',
        payload: { rttMs: 20 },
      });

      const fastLeadTime = serverEngine.computeAdaptiveLeadTime(serverEngine.getSession(session.jamId)!);
      expect(fastLeadTime).toBeGreaterThanOrEqual(250);
      expect(fastLeadTime).toBeLessThanOrEqual(400);

      // Higher latency cellular participant (350ms RTT)
      serverEngine.joinSession(session.jamId, { userId: 'guest-cell', displayName: 'Charlie' });
      serverEngine.executeCommand({
        commandId: 'cmd-stat-2',
        jamId: session.jamId,
        userId: 'guest-cell',
        action: 'UPDATE_PARTICIPANT_STATUS',
        payload: { rttMs: 350 },
      });

      const cellularLeadTime = serverEngine.computeAdaptiveLeadTime(serverEngine.getSession(session.jamId)!);
      expect(cellularLeadTime).toBeGreaterThanOrEqual(500);
      expect(cellularLeadTime).toBeLessThanOrEqual(1000);
    });

    it('increments generation and creates new timelineId / transitionId on PLAY, PAUSE, and SEEK', () => {
      const { session } = serverEngine.createSession({
        hostId: 'host-1',
        hostName: 'Alice',
        initialSong: sampleSong1,
      });

      expect(session.generation).toBe(1);
      expect(session.timelineId).toBe('TL_1');

      // PLAY command
      const playRes = serverEngine.executeCommand({
        commandId: 'cmd-play-1',
        jamId: session.jamId,
        userId: 'host-1',
        action: 'PLAY',
        payload: { positionMs: 0 },
      });

      expect(playRes.success).toBe(true);
      expect(playRes.session?.generation).toBe(2);
      expect(playRes.session?.timelineId).toMatch(/^TL_2_/);
      expect(playRes.session?.transitionId).toMatch(/^TR_2_/);
      expect(playRes.session?.state).toBe('PLAYING');

      // SEEK command
      const seekRes = serverEngine.executeCommand({
        commandId: 'cmd-seek-1',
        jamId: session.jamId,
        userId: 'host-1',
        action: 'SEEK',
        payload: { positionMs: 45000 },
      });

      expect(seekRes.success).toBe(true);
      expect(seekRes.session?.generation).toBe(3);
      expect(seekRes.session?.timelineId).toMatch(/^TL_3_/);
      expect(seekRes.session?.positionMs).toBe(45000);

      // PAUSE command
      const pauseRes = serverEngine.executeCommand({
        commandId: 'cmd-pause-1',
        jamId: session.jamId,
        userId: 'host-1',
        action: 'PAUSE',
      });

      expect(pauseRes.success).toBe(true);
      expect(pauseRes.session?.generation).toBe(4);
      expect(pauseRes.session?.timelineId).toMatch(/^TL_4_/);
      expect(pauseRes.session?.state).toBe('PAUSED');
    });
  });

  describe('4. DriftCorrectionEngine: Multi-Tier Tolerance & Stale Generation Invalidation', () => {
    it('applies Tier 1 (no rate change) when |drift| <= 35ms', () => {
      const mockAudio = {
        currentTime: 10.0,
        playbackRate: 1.0,
        paused: false,
        buffered: { length: 0, start: () => 0, end: () => 0 },
      } as unknown as HTMLAudioElement;
      vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);

      const session: JamSession = {
        jamId: 'jam-test-1',
        joinCode: '7K29P',
        name: 'Sync Jam',
        hostId: 'h1',
        hostName: 'Alice',
        state: 'PLAYING',
        trackId: sampleSong1.id,
        currentSong: sampleSong1,
        positionMs: 10000, // 10000ms
        serverTimestamp: 1000,
        startAtServerTime: 1000,
        leadTimeMs: 300,
        revision: 2,
        generation: 2,
        timelineId: 'TL_2',
        createdAt: 1000,
        updatedAt: 1000,
        permissions: { allowGuestAddQueue: true, allowGuestControlPlayback: true, allowGuestReorderQueue: true, requireModeratorApproval: false },
        participants: {},
        queue: [],
        history: [],
      };

      vi.spyOn(clockEngine, 'estimatedServerNow').mockReturnValue(1000);
      driftEngine.setSession(session);
      mockAudio.currentTime = 10.02; // 10020ms (20ms ahead)

      const status = driftEngine.evaluateAndCorrect();
      // Drift = 10020 - 10000 = +20ms (<= 35ms)
      expect(status.driftMs).toBe(20);
      expect(status.correctionAction).toBe('NONE');
      expect(mockAudio.playbackRate).toBe(1.0);
    });

    it('applies Tier 2 smooth rate modulation (0.982x / 1.018x) when 35ms < |drift| <= 120ms', () => {
      const mockAudio = {
        currentTime: 10.0,
        playbackRate: 1.0,
        paused: false,
        buffered: { length: 0, start: () => 0, end: () => 0 },
      } as unknown as HTMLAudioElement;
      vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);

      const session: JamSession = {
        jamId: 'jam-test-1',
        joinCode: '7K29P',
        name: 'Sync Jam',
        hostId: 'h1',
        hostName: 'Alice',
        state: 'PLAYING',
        trackId: sampleSong1.id,
        currentSong: sampleSong1,
        positionMs: 10000,
        serverTimestamp: 1000,
        startAtServerTime: 1000,
        leadTimeMs: 300,
        revision: 2,
        generation: 2,
        createdAt: 1000,
        updatedAt: 1000,
        permissions: { allowGuestAddQueue: true, allowGuestControlPlayback: true, allowGuestReorderQueue: true, requireModeratorApproval: false },
        participants: {},
        queue: [],
        history: [],
      };

      vi.spyOn(clockEngine, 'estimatedServerNow').mockReturnValue(1000);
      driftEngine.setSession(session);
      mockAudio.currentTime = 10.08; // 10080ms (80ms ahead)

      const status = driftEngine.evaluateAndCorrect();
      // Drift = +80ms (ahead) -> slow down to 0.982x
      expect(status.driftMs).toBe(80);
      expect(status.correctionAction).toBe('MODULATE_RATE');
      expect(mockAudio.playbackRate).toBeCloseTo(0.982, 3);
    });

    it('applies Tier 3 moderate rate modulation (0.948x / 1.052x) when 120ms < |drift| <= 500ms', () => {
      const mockAudio = {
        currentTime: 10.0,
        playbackRate: 1.0,
        paused: false,
        buffered: { length: 0, start: () => 0, end: () => 0 },
      } as unknown as HTMLAudioElement;
      vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);

      const session: JamSession = {
        jamId: 'jam-test-1',
        joinCode: '7K29P',
        name: 'Sync Jam',
        hostId: 'h1',
        hostName: 'Alice',
        state: 'PLAYING',
        trackId: sampleSong1.id,
        currentSong: sampleSong1,
        positionMs: 10000,
        serverTimestamp: 1000,
        startAtServerTime: 1000,
        leadTimeMs: 300,
        revision: 2,
        generation: 2,
        createdAt: 1000,
        updatedAt: 1000,
        permissions: { allowGuestAddQueue: true, allowGuestControlPlayback: true, allowGuestReorderQueue: true, requireModeratorApproval: false },
        participants: {},
        queue: [],
        history: [],
      };

      vi.spyOn(clockEngine, 'estimatedServerNow').mockReturnValue(1000);
      driftEngine.setSession(session);
      mockAudio.currentTime = 9.8; // 9800ms (200ms behind)

      const status = driftEngine.evaluateAndCorrect();
      // Drift = -200ms (behind) -> speed up to 1.052x
      expect(status.driftMs).toBe(-200);
      expect(status.correctionAction).toBe('MODULATE_RATE');
      expect(mockAudio.playbackRate).toBeCloseTo(1.052, 3);
    });

    it('applies Tier 4 controlled seek when |drift| > 500ms and logs diagnostic context when drift > 300ms', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockAudio = {
        currentTime: 10.0,
        playbackRate: 1.0,
        paused: false,
        buffered: { length: 0, start: () => 0, end: () => 0 },
      } as unknown as HTMLAudioElement;
      vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);

      const session: JamSession = {
        jamId: 'jam-test-1',
        joinCode: '7K29P',
        name: 'Sync Jam',
        hostId: 'h1',
        hostName: 'Alice',
        state: 'PLAYING',
        trackId: sampleSong1.id,
        currentSong: sampleSong1,
        positionMs: 10000,
        serverTimestamp: 1000,
        startAtServerTime: 1000,
        leadTimeMs: 300,
        revision: 2,
        generation: 2,
        timelineId: 'TL_2',
        transitionId: 'TR_2',
        createdAt: 1000,
        updatedAt: 1000,
        permissions: { allowGuestAddQueue: true, allowGuestControlPlayback: true, allowGuestReorderQueue: true, requireModeratorApproval: false },
        participants: {},
        queue: [],
        history: [],
      };

      vi.spyOn(clockEngine, 'estimatedServerNow').mockReturnValue(1000);
      driftEngine.setSession(session);
      mockAudio.currentTime = 8.0; // 8000ms (2000ms behind)

      const status = driftEngine.evaluateAndCorrect();
      expect(status.correctionAction).toBe('HARD_SEEK');
      expect(mockAudio.currentTime).toBe(10.0); // Pre-seek to 10s

      // Verify diagnostic warning was logged with full context
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SYNC_DRIFT_DIAGNOSTIC]',
        expect.objectContaining({
          trackId: sampleSong1.id,
          timelineId: 'TL_2',
          generation: 2,
          drift: '-2000ms',
        })
      );
    });

    it('rejects stale scheduled start callbacks when generation has advanced', async () => {
      vi.useFakeTimers();
      const playSpy = vi.spyOn(PlaybackService.getInstance(), 'play').mockImplementation(() => Promise.resolve());

      const initialSession: JamSession = {
        jamId: 'jam-gen-1',
        joinCode: '7K29P',
        name: 'Gen Test',
        hostId: 'h1',
        hostName: 'Alice',
        state: 'PLAYING',
        trackId: sampleSong1.id,
        currentSong: sampleSong1,
        positionMs: 0,
        serverTimestamp: 1000,
        startAtServerTime: 1500, // 500ms in future
        leadTimeMs: 500,
        revision: 1,
        generation: 1,
        timelineId: 'TL_1',
        createdAt: 1000,
        updatedAt: 1000,
        permissions: { allowGuestAddQueue: true, allowGuestControlPlayback: true, allowGuestReorderQueue: true, requireModeratorApproval: false },
        participants: {},
        queue: [],
        history: [],
      };

      vi.spyOn(clockEngine, 'estimatedServerNow').mockReturnValue(1000);
      driftEngine.setSession(initialSession);

      // Now a new seek/track event arrives advancing generation to 2
      const updatedSession: JamSession = {
        ...initialSession,
        generation: 2,
        timelineId: 'TL_2',
        positionMs: 30000,
        startAtServerTime: 2000,
      };
      driftEngine.setSession(updatedSession);

      // Fast forward past the initial 500ms timer
      vi.advanceTimersByTime(600);

      // The initial generation 1 callback should have been discarded and not executed premature play
      expect(playSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
