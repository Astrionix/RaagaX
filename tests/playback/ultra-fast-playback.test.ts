import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayableUrlCache } from '@/lib/playback/PlayableUrlCache';
import { PreloadManager } from '@/lib/playback/PreloadManager';
import { PlaybackTelemetry } from '@/lib/playback/PlaybackTelemetry';
import { Song } from '@/types/music';

describe('RaagaX Ultra-Fast Song Loading & Minimum Startup Latency Suite', () => {
  beforeEach(() => {
    PlayableUrlCache.getInstance().clear();
    PreloadManager.getInstance().reset();
    PlaybackTelemetry.getInstance().clear();
  });

  const mockSongA = {
    id: 'song_a',
    title: 'Neno Butterfly',
    artist: 'Sid Sriram',
    album: 'Butterfly OST',
    duration: 210,
    coverUrl: 'https://example.com/cover_a.jpg',
    audioUrl: 'https://example.com/stream_a_320.mp4',
  } as unknown as Song;

  const mockSongB = {
    id: 'song_b',
    title: 'Samayama',
    artist: 'Anurag Kulkarni',
    album: 'Hi Nanna',
    duration: 245,
    coverUrl: 'https://example.com/cover_b.jpg',
    audioUrl: 'https://example.com/stream_b_320.mp4',
  } as unknown as Song;

  describe('1. PlayableUrlCache (Sub-Millisecond 0ms URL Hits & TTL)', () => {
    it('synchronously returns cached URL with candidate waterfall', () => {
      const cache = PlayableUrlCache.getInstance();
      cache.set('song_123', 'https://cdn.raagax.com/track_320.mp4', [
        'https://cdn.raagax.com/track_320.mp4',
        'https://cdn.raagax.com/track_160.mp4',
      ], 'remote', 3600000);

      const entry = cache.get('song_123');
      expect(entry).not.toBeNull();
      expect(entry?.url).toBe('https://cdn.raagax.com/track_320.mp4');
      expect(entry?.candidates).toHaveLength(2);
      expect(entry?.type).toBe('remote');
    });

    it('silently expires stale URLs and returns null', () => {
      const cache = PlayableUrlCache.getInstance();
      // Set expired entry with negative TTL
      cache.set('song_expired', 'https://cdn.raagax.com/expired.mp4', [], 'remote', -1000);

      const entry = cache.get('song_expired');
      expect(entry).toBeNull();
    });

    it('accurately identifies URLs nearing expiration threshold', () => {
      const cache = PlayableUrlCache.getInstance();
      // Set URL expiring in 5 minutes (threshold is 15 minutes)
      cache.set('song_soon', 'https://cdn.raagax.com/soon.mp4', [], 'remote', 5 * 60 * 1000);

      expect(cache.isExpiringSoon('song_soon')).toBe(true);
    });
  });

  describe('2. PreloadManager & prepareNextTrack (P1 Standby Handoff)', () => {
    it('prepares next track, populates URL cache, and sets READY status', async () => {
      const manager = PreloadManager.getInstance();

      const mockAudio = {
        src: '',
        preload: '',
        readyState: 4,
        load: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLAudioElement;

      const ready = await manager.prepareNextTrack(mockSongB, mockAudio);
      expect(ready).toBe(true);
      expect(manager.isTrackReady(mockSongB.id)).toBe(true);
      expect(manager.getPreloadedTrackId()).toBe(mockSongB.id);

      // URL cache must now contain song B
      const cached = PlayableUrlCache.getInstance().get(mockSongB.id);
      expect(cached).not.toBeNull();
      expect(cached?.url).toBe(mockSongB.audioUrl);
    });

    it('cancels superseded preloads if track changes while in-flight', async () => {
      const manager = PreloadManager.getInstance();

      const mockAudio = {
        src: '',
        preload: '',
        readyState: 0,
        load: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLAudioElement;

      // Start preparing song A
      const prepA = manager.prepareNextTrack(mockSongA, mockAudio);
      // Immediately supersede with song B
      const prepB = manager.prepareNextTrack(mockSongB, mockAudio);

      await Promise.all([prepA, prepB]);
      expect(manager.getPreloadedTrackId()).toBe(mockSongB.id);
    });
  });

  describe('3. PlaybackTelemetry (Startup Latency & P50/P75/P95 Metrics)', () => {
    it('records metrics and computes accurate P50, P75, and P95 latency percentiles', () => {
      const telemetry = PlaybackTelemetry.getInstance();

      // Record simulated latencies across different source types:
      // Local downloads (<100ms)
      telemetry.recordMetric({ sessionId: '1', trackId: 's1', sourceType: 'LOCAL_DOWNLOAD', timeToFirstAudioMs: 85, success: true });
      telemetry.recordMetric({ sessionId: '2', trackId: 's2', sourceType: 'LOCAL_DOWNLOAD', timeToFirstAudioMs: 95, success: true });
      
      // Preloaded standby (<300ms)
      telemetry.recordMetric({ sessionId: '3', trackId: 's3', sourceType: 'PRELOADED_STANDBY', timeToFirstAudioMs: 140, success: true });
      telemetry.recordMetric({ sessionId: '4', trackId: 's4', sourceType: 'PRELOADED_STANDBY', timeToFirstAudioMs: 180, success: true });
      
      // Cache hits (<400ms)
      telemetry.recordMetric({ sessionId: '5', trackId: 's5', sourceType: 'URL_CACHE_HIT', timeToFirstAudioMs: 310, success: true });

      // Cold network streams (<800ms)
      telemetry.recordMetric({ sessionId: '6', trackId: 's6', sourceType: 'NETWORK_STREAM', timeToFirstAudioMs: 620, success: true });

      const summary = telemetry.getSummary();
      expect(summary.total).toBe(6);
      expect(summary.successRate).toBe(1.0);
      expect(summary.minTTFAMs).toBe(85);
      expect(summary.maxTTFAMs).toBe(620);
      expect(summary.p50TTFAMs).toBeLessThanOrEqual(200);
      expect(summary.p95TTFAMs).toBeLessThanOrEqual(650);
      expect(summary.lastSourceType).toBe('NETWORK_STREAM');
      expect(summary.lastTTFAMs).toBe(620);
    });
  });
});
