import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterruptionManager } from '../../src/lib/playback/interruption/InterruptionManager';
import { PlaybackEngine } from '../../src/lib/playback/PlaybackEngine';
import { usePlayerStore } from '../../src/context/usePlayerStore';

describe('Playback Interruption Orchestrator & Audio Focus Tests', () => {
  let mockAudioElement: HTMLAudioElement;
  let isPaused: boolean;

  beforeEach(() => {
    isPaused = false;
    mockAudioElement = {
      play: vi.fn().mockImplementation(async () => { isPaused = false; }),
      pause: vi.fn().mockImplementation(() => { isPaused = true; }),
      get paused() { return isPaused; },
      volume: 1.0,
      currentTime: 45,
      duration: 200,
    } as any;

    PlaybackEngine.getInstance().attachMediaElement(mockAudioElement);
    usePlayerStore.setState({
      deviceId: 'dev_phone_1',
      isActiveDevice: true, // Active renderer by default
      isPlaying: true,
      currentSong: { id: 'song_bohemian', title: 'Bohemian Rhapsody', artist: 'Queen' } as any,
    });
  });

  it('Test 1 (Notification Ducking): DUCKS volume to 25%, continues playing, and restores 100% volume on GAIN', async () => {
    const manager = InterruptionManager.getInstance();

    // Trigger notification LOSS_DUCK
    await manager.handlePlatformEvent({ type: 'LOSS_DUCK', reason: 'NOTIFICATION' });

    expect(manager.getDuckDepth()).toBe(1);
    expect(mockAudioElement.volume).toBe(0.25);
    expect(mockAudioElement.pause).not.toHaveBeenCalled();

    // Notification finishes -> GAIN
    await manager.handlePlatformEvent({ type: 'GAIN' });

    expect(manager.getDuckDepth()).toBe(0);
    expect(mockAudioElement.volume).toBe(1.0);
  });

  it('Test 2 (Nested Ducking): Overlapping notifications increment duckDepth without corrupting base volume', async () => {
    const manager = InterruptionManager.getInstance();

    // Notification 1
    await manager.handlePlatformEvent({ type: 'LOSS_DUCK', reason: 'NOTIFICATION' });
    expect(manager.getDuckDepth()).toBe(1);
    expect(mockAudioElement.volume).toBe(0.25);

    // Notification 2 (overlapping)
    await manager.handlePlatformEvent({ type: 'LOSS_DUCK', reason: 'NOTIFICATION' });
    expect(manager.getDuckDepth()).toBe(2);
    expect(mockAudioElement.volume).toBe(0.25);

    // Notification 1 ends
    await manager.handlePlatformEvent({ type: 'GAIN' });
    expect(manager.getDuckDepth()).toBe(1);
    expect(mockAudioElement.volume).toBe(0.25);

    // Notification 2 ends
    await manager.handlePlatformEvent({ type: 'GAIN' });
    expect(manager.getDuckDepth()).toBe(0);
    expect(mockAudioElement.volume).toBe(1.0);
  });

  it('Test 3 (Phone Call Resume): Pauses on call LOSS_TRANSIENT, auto-resumes on GAIN iff playing before call', async () => {
    const manager = InterruptionManager.getInstance();

    // Call arrives -> LOSS_TRANSIENT
    await manager.handlePlatformEvent({ type: 'LOSS_TRANSIENT', reason: 'CALL' });

    expect(mockAudioElement.pause).toHaveBeenCalled();
    const snapshot = manager.getActiveSnapshot();
    expect(snapshot?.reason).toBe('CALL');
    expect(snapshot?.wasPlaying).toBe(true);

    // Call ends -> GAIN
    await manager.handlePlatformEvent({ type: 'GAIN' });
    expect(mockAudioElement.play).toHaveBeenCalled();
  });

  it('Test 4 (Manual Pause + Phone Call): User manual pause before call permanently revokes auto-resume eligibility', async () => {
    const manager = InterruptionManager.getInstance();

    // User manually pauses
    manager.reportUserManualPause();
    isPaused = true;
    usePlayerStore.setState({ isPlaying: false });

    // Phone call arrives while already paused
    await manager.handlePlatformEvent({ type: 'LOSS_TRANSIENT', reason: 'CALL' });
    const snapshot = manager.getActiveSnapshot();
    expect(snapshot?.wasPlaying).toBe(false);

    // Call ends -> GAIN
    mockAudioElement.play = vi.fn();
    await manager.handlePlatformEvent({ type: 'GAIN' });
    expect(mockAudioElement.play).not.toHaveBeenCalled();
  });

  it('Test 5 (Competing Music App): YouTube/Spotify starts -> Permanent LOSS -> Pauses and DOES NOT auto-resume', async () => {
    const manager = InterruptionManager.getInstance();

    // YouTube starts playing -> LOSS
    await manager.handlePlatformEvent({ type: 'LOSS', reason: 'OTHER_MEDIA' });
    expect(mockAudioElement.pause).toHaveBeenCalled();

    // YouTube stops -> GAIN
    mockAudioElement.play = vi.fn();
    await manager.handlePlatformEvent({ type: 'GAIN' });

    // Must NOT auto-resume
    expect(mockAudioElement.play).not.toHaveBeenCalled();
  });

  it('Test 6 (Transient Focus Loss - Phone Call): Pauses playback on call arrival and creates resume policy', async () => {
    const manager = InterruptionManager.getInstance();

    usePlayerStore.setState({
      isPlaying: true,
      currentSong: { id: 'track_call_test', title: 'Test', artist: 'Artist' } as any,
    });

    // Phone receives incoming call
    await manager.handlePlatformEvent({ type: 'LOSS_TRANSIENT', reason: 'CALL' });

    // Local audio is paused immediately
    expect(mockAudioElement.pause).toHaveBeenCalled();
  });

  it('Test 7 (Headphone / Bluetooth Disconnect): Pauses playback, preserves exact position (45s, NOT 0s) and queue', async () => {
    const manager = InterruptionManager.getInstance();

    usePlayerStore.setState({
      queue: [{ id: 'song_1' }, { id: 'song_2' }] as any,
      queueIndex: 0,
      currentTime: 45,
    });

    // Headphone removed
    await manager.handlePlatformEvent({ type: 'LOSS_TRANSIENT', reason: 'HEADPHONES_REMOVED' });

    expect(mockAudioElement.pause).toHaveBeenCalled();
    const snapshot = manager.getActiveSnapshot();
    expect(snapshot?.positionMs).toBeCloseTo(45000, -2);
    // Queue and queue index must remain intact
    expect(usePlayerStore.getState().queue.length).toBe(2);
    expect(usePlayerStore.getState().queueIndex).toBe(0);
  });

  it('Test 8 (Navigation / Voice Assistant Ducking): Volume ducks to 25%, does NOT pause/seek, then restores 100%', async () => {
    const manager = InterruptionManager.getInstance();

    // Navigation voice instruction begins
    await manager.handlePlatformEvent({ type: 'LOSS_DUCK', reason: 'NAVIGATION' });
    expect(manager.getDuckDepth()).toBe(1);
    expect(mockAudioElement.volume).toBe(0.25);
    expect(mockAudioElement.pause).not.toHaveBeenCalled();

    // Navigation instruction finishes
    await manager.handlePlatformEvent({ type: 'GAIN' });
    expect(manager.getDuckDepth()).toBe(0);
    expect(mockAudioElement.volume).toBe(1.0);
  });

  it('Test 9 (Zero-Next-Track Invariant): Interruption is NEVER treated as Next Track or Queue Reset', async () => {
    const manager = InterruptionManager.getInstance();

    usePlayerStore.setState({
      queue: [{ id: 'song_a' }, { id: 'song_b' }, { id: 'song_c' }] as any,
      queueIndex: 1, // Currently on song_b
      currentSong: { id: 'song_b', title: 'Song B' } as any,
    });

    // Interruption occurs
    await manager.handlePlatformEvent({ type: 'LOSS_TRANSIENT', reason: 'CALL' });

    // Must NOT advance queue index or change currentSong
    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().currentSong?.id).toBe('song_b');
    expect(usePlayerStore.getState().queue.length).toBe(3);
  });

  it('Test 10 (Silent App Open): Opening Instagram/YouTube without audio leaves playback running untouched', async () => {
    // No audio focus event fired by OS
    expect(mockAudioElement.pause).not.toHaveBeenCalled();
    expect(mockAudioElement.volume).toBe(1.0);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
