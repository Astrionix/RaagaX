import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionReconciler, PlaybackSnapshot } from '../../src/lib/connect/SessionReconciler';
import { PlaybackEngine } from '../../src/lib/playback/PlaybackEngine';
import { usePlayerStore } from '../../src/context/usePlayerStore';

describe('Connect Device Reconciliation & Zero-Stutter Tests', () => {
  let mockAudioElement: HTMLAudioElement;

  beforeEach(() => {
    mockAudioElement = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      volume: 1.0,
      currentTime: 0,
      duration: 200,
    } as any;

    PlaybackEngine.getInstance().attachMediaElement(mockAudioElement);
    usePlayerStore.setState({
      deviceId: 'dev_renderer_1',
      isActiveDevice: true,
      isPlaying: true,
      currentSong: { id: 'song_old', title: 'Old Song' } as any,
    });
  });

  it('Test 1 (Zero-Stutter Seeking): Active renderer seeks immediately to canonical position before playing without 500ms delay', async () => {
    const reconciler = SessionReconciler.getInstance();

    const snapshot: PlaybackSnapshot = {
      sessionId: 'sess_123',
      sessionEpoch: 1,
      revision: 10,
      sequenceNumber: 5,
      stateVersion: 10,
      trackId: 'song_new',
      songData: { id: 'song_new', title: 'New Song' },
      status: 'playing',
      positionMs: 45000, // 45 seconds
      serverTimestamp: Date.now(),
      ownerDeviceId: 'dev_renderer_1', // Active renderer
    };

    const seekSpy = vi.spyOn(PlaybackEngine.getInstance(), 'seekCanonical');
    const playSpy = vi.spyOn(PlaybackEngine.getInstance(), 'play');

    await reconciler.applySnapshot(snapshot);

    // Verify seekCanonical was called immediately (accounting for clock drift calculation)
    expect(seekSpy).toHaveBeenCalled();
    expect(seekSpy.mock.calls[0][0]).toBeGreaterThanOrEqual(45000);
    expect(playSpy).toHaveBeenCalled();

    seekSpy.mockRestore();
    playSpy.mockRestore();
  });

  it('Test 2 (Follower Audio Suppression): Follower device pauses local audio engine to act purely as remote controller', async () => {
    const reconciler = SessionReconciler.getInstance();

    const snapshot: PlaybackSnapshot = {
      sessionId: 'sess_123',
      sessionEpoch: 1,
      revision: 10,
      sequenceNumber: 5,
      stateVersion: 10,
      trackId: 'song_new',
      songData: { id: 'song_new', title: 'New Song' },
      status: 'playing',
      positionMs: 45000,
      serverTimestamp: Date.now(),
      ownerDeviceId: 'dev_desktop_remote', // Remote owner
    };

    const pauseSpy = vi.spyOn(PlaybackEngine.getInstance(), 'pause');

    await reconciler.applySnapshot(snapshot);

    expect(usePlayerStore.getState().isActiveDevice).toBe(false);
    expect(pauseSpy).toHaveBeenCalled();

    pauseSpy.mockRestore();
  });
});
