import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaSessionManager } from '../MediaSessionManager';

describe('MediaSessionManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates metadata when mediaSession is available', () => {
    const mockMediaSession: any = {
      metadata: null,
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
      playbackState: 'none'
    };

    vi.stubGlobal('navigator', {
      mediaSession: mockMediaSession
    });

    const manager = MediaSessionManager.getInstance();
    manager.updateMetadata({
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album'
    });

    expect(mockMediaSession.metadata).not.toBeNull();
    expect(mockMediaSession.metadata?.title).toBe('Test Song');
  });

  it('sets position state correctly', () => {
    const setPositionStateMock = vi.fn();
    vi.stubGlobal('navigator', {
      mediaSession: {
        setPositionState: setPositionStateMock
      }
    });

    const manager = MediaSessionManager.getInstance();
    manager.setPositionState({ duration: 180, position: 45, playbackRate: 1 });

    expect(setPositionStateMock).toHaveBeenCalledWith({
      duration: 180,
      position: 45,
      playbackRate: 1
    });
  });

  it('handles setPositionState safely when duration is invalid', () => {
    const setPositionStateMock = vi.fn();
    vi.stubGlobal('navigator', {
      mediaSession: {
        setPositionState: setPositionStateMock
      }
    });

    const manager = MediaSessionManager.getInstance();
    manager.setPositionState({ duration: NaN, position: 0 });

    expect(setPositionStateMock).not.toHaveBeenCalled();
  });
});
