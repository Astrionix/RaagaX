import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamSessionManager } from '@/lib/jam/JamSessionManager';
import { DriftCorrectionEngine } from '@/lib/jam/DriftCorrectionEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PlayableUrlCache } from '@/lib/playback/PlayableUrlCache';
import { Song } from '@/types/music';

describe('Jam Session Zero-Latency Wi-Fi Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      isInJam: false,
      isLocalPlayback: true,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      queue: [],
      queueIndex: 0,
    });
  });

  it('1. Host attaches resolved direct CDN audioUrl so guests bypass external API resolution', () => {
    const jam = JamSessionManager.getInstance();
    const mockTrack: Song = {
      id: 'test_song_1',
      title: 'Deva Deva',
      artist: 'Arijit Singh',
      duration: 240,
      audioUrl: '', // empty originally
    };

    // Cache the direct CDN URL
    PlayableUrlCache.getInstance().set('test_song_1', 'https://aac.saavncdn.com/test_1.mp4', ['https://aac.saavncdn.com/test_1.mp4'], 'remote');

    usePlayerStore.setState({
      isInJam: true,
      isLocalPlayback: true,
      currentSong: mockTrack,
      isPlaying: true,
    });

    // Mock sendToRoom
    const sentMessages: any[] = [];
    (jam as any).currentState.isInJam = true;
    (jam as any).sendToRoom = (msg: any) => sentMessages.push(msg);

    jam.broadcastCurrentPlaybackState();

    expect(sentMessages.length).toBeGreaterThan(0);
    const broadcast = sentMessages[0];
    expect(broadcast.type).toBe('BROADCAST_STATE');
    expect(broadcast.payload.track.audioUrl).toBe('https://aac.saavncdn.com/test_1.mp4');
    expect(broadcast.payload.scheduledStartTime).toBeDefined();
  });

  it('2. DriftCorrectionEngine rapidly converges NTP clock offset within the first 5 samples', () => {
    const engine = DriftCorrectionEngine.getInstance();
    engine.resetTrack('test_song_1');

    // Simulate ping/pong samples with host clock offset by +50ms
    const now = Date.now();
    const rtt = 20;
    const t0 = now - rtt;
    const hostTime = now + 40; // t1 - (t0 + now)/2 = (now + 40) - (now - 10) = 50ms
    engine.recordRttSample(rtt, hostTime, t0);

    let metrics = engine.getMetrics();
    expect(Math.abs(metrics.clockOffsetMs - 50)).toBeLessThanOrEqual(2);

    // Second sample with slight jitter (+52ms)
    const now2 = Date.now();
    const t0_2 = now2 - rtt;
    const hostTime2 = now2 + 42;
    engine.recordRttSample(rtt, hostTime2, t0_2);
    metrics = engine.getMetrics();
    expect(metrics.clockOffsetMs).toBeGreaterThanOrEqual(49);
    expect(metrics.clockOffsetMs).toBeLessThanOrEqual(53);
  });

  it('3. PlaybackService.playTrack accepts scheduledStartTime and coordinates start window', async () => {
    const playback = PlaybackService.getInstance();
    const mockTrack: Song = {
      id: 'test_song_2',
      title: 'Kesariya',
      artist: 'Arijit Singh',
      duration: 200,
      audioUrl: 'https://aac.saavncdn.com/test_2.mp4',
    };

    usePlayerStore.setState({
      isInJam: true,
      isLocalPlayback: true,
      currentSong: mockTrack,
      isPlaying: true,
    });

    const now = Date.now();
    const scheduledStart = now + 100; // 100ms in future
    const result = await playback.playTrack(mockTrack, true, 0, scheduledStart);
    expect(result).toBe(true);
  });
});
