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
      lastReceivedPlaybackSessionRevision: 0,
      lastReceivedPlaybackRevision: 0,
      localPlaybackRevision: 0,
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
    const pauseSpy = vi.spyOn(PlaybackEngine.getInstance(), 'pause');

    await reconciler.applySnapshot(snapshot);

    // Verify seekCanonical was called immediately to restore position as PAUSED (Zero Autoplay)
    expect(seekSpy).toHaveBeenCalled();
    expect(seekSpy.mock.calls[0][0]).toBeGreaterThanOrEqual(45000);
    expect(pauseSpy).toHaveBeenCalled();

    seekSpy.mockRestore();
    pauseSpy.mockRestore();
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

  it('Test 3 (Stale Account Session Discard): Discards 2-day-old Tabahi cloud snapshot and retains local device song', async () => {
    const reconciler = SessionReconciler.getInstance();
    usePlayerStore.setState({
      deviceId: 'dev_renderer_1',
      isActiveDevice: true,
      isPlaying: false,
      currentSong: { id: 'song_hellalo', title: 'Hellalo' } as any,
    });

    // Stale snapshot from 2 days ago (Account A: Tabahi)
    const staleSnapshot: PlaybackSnapshot = {
      sessionId: 'sess_user_a',
      sessionEpoch: 1,
      revision: 1,
      sequenceNumber: 1,
      stateVersion: 1,
      trackId: 'song_tabahi',
      songData: { id: 'song_tabahi', title: 'Tabahi' },
      status: 'paused',
      positionMs: 10000,
      serverTimestamp: Date.now() - (48 * 60 * 60 * 1000), // 48 hours ago
      ownerDeviceId: 'dev_renderer_1',
    };

    await reconciler.applySnapshot(staleSnapshot);

    // Current song on local player MUST remain Hellalo (NOT overwritten by Tabahi)
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_hellalo');
    expect(usePlayerStore.getState().currentSong?.title).toBe('Hellalo');
  });
});
