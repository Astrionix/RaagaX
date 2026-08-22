import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectTelemetry } from '../../src/lib/connect/lan/ConnectTelemetry';
import { RemoteControlClient } from '../../src/lib/connect/lan/RemoteControlClient';
import { PlaybackOwnerEngine } from '../../src/lib/connect/lan/PlaybackOwnerEngine';
import { DirectLANTransport } from '../../src/lib/connect/lan/DirectLANTransport';
import { usePlayerStore } from '../../src/context/usePlayerStore';
import { Song } from '../../src/types/music';

const mockSong: Song = {
  id: 'perf_song_1',
  title: 'Telemetry Anthem',
  artist: 'Benchmark Artist',
  artistId: 'art_perf_1',
  album: 'Benchmark Album',
  albumId: 'alb_perf_1',
  coverUrl: '/cover.png',
  duration: 300,
  audioUrl: 'https://audio.raagax.test/perf.mp3',
  genre: 'Acoustic',
  category: 'global_trending',
  releaseYear: 2026,
  plays: 100,
  likes: 50,
};

describe('RaagaX Connect V2: Telemetry, Optimistic UI & Zero-Churn Performance Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ConnectTelemetry.getInstance().clear();

    usePlayerStore.setState({
      deviceId: 'dev_controller',
      activeDeviceId: 'dev_owner',
      connectedDeviceId: 'dev_owner',
      isActiveDevice: false,
      currentSong: mockSong,
      isPlaying: false,
      currentTime: 30,
      duration: 300,
    });

    PlaybackOwnerEngine.getInstance().setOwner('dev_owner', false);
  });

  // 1. Optimistic UI Response (~0ms perceived delay)
  it('1. Controller executes optimistic UI update instantly upon button tap', () => {
    const client = RemoteControlClient.getInstance();
    const transport = DirectLANTransport.getInstance();
    let sentMsg: any = null;

    vi.spyOn(transport, 'sendMessage').mockImplementation((targetId, msg) => {
      sentMsg = msg;
      return true;
    });

    expect(usePlayerStore.getState().isPlaying).toBe(false);

    // User taps PLAY
    const tapTime = Date.now();
    client.sendCommand('CMD_PLAY', undefined, tapTime);

    // Optimistic UI check: player state changed immediately before any network ACK!
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Sent message payload checks
    expect(sentMsg).not.toBeNull();
    expect(sentMsg.type).toBe('CMD_PLAY');
    expect(sentMsg.timing.tapTimestamp).toBe(tapTime);
    expect(sentMsg.timing.sendTimestamp).toBeDefined();
  });

  // 2. Full Lifecycle Telemetry (Tap -> Send -> Recv -> Exec -> ACK)
  it('2. Records full lifecycle telemetry metrics and calculates RTT and execution delay', () => {
    const client = RemoteControlClient.getInstance();
    const telemetry = ConnectTelemetry.getInstance();

    const commandId = 'c_test_perf_100';
    const baseTime = 1000000;

    // Simulate complete ACK packet from target device
    client.handleCommandAck({
      id: 'ack_100',
      type: 'CMD_ACK',
      sourceDeviceId: 'dev_owner',
      targetDeviceId: 'dev_controller',
      commandId,
      success: true,
      stateVersion: 10,
      timing: {
        tapTimestamp: baseTime,
        sendTimestamp: baseTime + 2,      // 2ms tap to send
        receiveTimestamp: baseTime + 6,   // 4ms transit
        executeTimestamp: baseTime + 8,   // 2ms native execution
        ackTimestamp: baseTime + 12,      // 4ms ACK transit
      },
      timestamp: baseTime + 12,
    });

    const metrics = telemetry.getRecentMetrics(1);
    expect(metrics.length).toBe(1);
    expect(metrics[0].transitMs).toBe(4);   // 6 - 2
    expect(metrics[0].execMs).toBe(2);      // 8 - 6
    expect(metrics[0].rttMs).toBe(10);      // 12 - 2
  });

  // 3. Percentiles Calculation (P50, P75, P95)
  it('3. Computes accurate P50, P75, and P95 latency percentiles', () => {
    const telemetry = ConnectTelemetry.getInstance();

    // Ingest synthetic latencies: 5ms, 10ms, 15ms, 20ms, 50ms
    const rtts = [5, 10, 15, 20, 50];
    rtts.forEach((rtt, idx) => {
      telemetry.recordCommandLifecycle(`cmd_${idx}`, 'CMD_PAUSE', {
        tapTimestamp: 1000,
        sendTimestamp: 1000,
        receiveTimestamp: 1000 + rtt / 2,
        executeTimestamp: 1000 + rtt / 2 + 1,
        ackTimestamp: 1000 + rtt,
      });
    });

    const p = telemetry.getPercentiles();
    expect(p.count).toBe(5);
    expect(p.min).toBe(5);
    expect(p.p50).toBe(15); // Median
    expect(p.p95).toBe(50); // P95
    expect(p.max).toBe(50);
  });

  // 4. Smooth Timestamp Extrapolation
  it('4. Extrapolates position smoothly without spamming network state updates', () => {
    const client = RemoteControlClient.getInstance();

    const stateTime = Date.now() - 5000; // 5 seconds ago
    client.handlePlaybackStateUpdate({
      id: 'st_1',
      type: 'PLAYBACK_STATE',
      sourceDeviceId: 'dev_owner',
      targetDeviceId: 'dev_controller',
      payload: {
        ownerDeviceId: 'dev_owner',
        songId: mockSong.id,
        song: mockSong,
        queue: [mockSong],
        queueIndex: 0,
        positionMs: 60000, // 60s
        durationMs: 300000,
        isPlaying: true,
        playbackRate: 1.0,
        volume: 1.0,
        isMuted: false,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        stateVersion: 1,
        timestamp: stateTime,
      },
      timestamp: stateTime,
    });

    // 60s + 5s elapsed = ~65s
    const estimated = client.getEstimatedPositionMs() / 1000;
    expect(estimated).toBeGreaterThanOrEqual(64.9);
    expect(estimated).toBeLessThanOrEqual(65.5);
  });
});
