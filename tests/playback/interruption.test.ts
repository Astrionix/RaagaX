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

  it('Test 6 (Connect Focus Isolation): Phone (Controller) call does NOT pause Desktop (Renderer) session', async () => {
    const manager = InterruptionManager.getInstance();

    // Phone is pure Controller (isActiveDevice = false)
    usePlayerStore.setState({
      deviceId: 'phone_controller',
      isActiveDevice: false,
    });

    // Phone gets call
    await manager.handlePlatformEvent({ type: 'LOSS_TRANSIENT', reason: 'CALL' });

    // Desktop playback engine was NOT paused
    expect(mockAudioElement.pause).not.toHaveBeenCalled();
  });
});
