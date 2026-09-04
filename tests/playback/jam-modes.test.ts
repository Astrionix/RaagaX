import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamSessionManager, JamAudioMode } from '@/lib/jam/JamSessionManager';
import { usePlayerStore } from '@/context/usePlayerStore';

describe('Jam 3-Mode Architecture (Spotify-Standard)', () => {
  beforeEach(() => {
    JamSessionManager.getInstance().leaveJam();
  });

  it('Host startJam sets IN_PERSON mode with isLocalAudioOutput = true by default', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.startJam();
    const state = jam.getState();

    expect(state.isInJam).toBe(true);
    expect(state.isHost).toBe(true);
    expect(state.audioMode).toBe('IN_PERSON');
    expect(state.isLocalAudioOutput).toBe(true);
  });

  it('Guest joinJam sets IN_PERSON mode with isLocalAudioOutput = false by default (0ms Echo)', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.joinJam('123456');
    const state = jam.getState();

    expect(state.isInJam).toBe(true);
    expect(state.isHost).toBe(false);
    expect(state.audioMode).toBe('IN_PERSON');
    expect(state.isLocalAudioOutput).toBe(false);
    // Guest acts as a silent remote controller
    expect(usePlayerStore.getState().isLocalPlayback).toBe(false);
  });

  it('Guest can toggle local audio output to listen on this phone or host speaker', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.joinJam('123456');

    // Default: false
    expect(jam.getState().isLocalAudioOutput).toBe(false);

    // Guest taps "Listen on this phone" (e.g. Headphones)
    jam.setLocalAudioOutput(true);
    expect(jam.getState().isLocalAudioOutput).toBe(true);
    expect(usePlayerStore.getState().isLocalPlayback).toBe(true);

    // Guest taps "Host's Speaker"
    jam.setLocalAudioOutput(false);
    expect(jam.getState().isLocalAudioOutput).toBe(false);
    expect(usePlayerStore.getState().isLocalPlayback).toBe(false);
  });

  it('Host can switch between IN_PERSON, REMOTE_LISTEN, and MULTI_SPEAKER modes', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.startJam();

    expect(jam.getState().audioMode).toBe('IN_PERSON');

    jam.setAudioMode('REMOTE_LISTEN');
    expect(jam.getState().audioMode).toBe('REMOTE_LISTEN');

    jam.setAudioMode('MULTI_SPEAKER');
    expect(jam.getState().audioMode).toBe('MULTI_SPEAKER');

    jam.setAudioMode('IN_PERSON');
    expect(jam.getState().audioMode).toBe('IN_PERSON');
  });

  it('Host correctly handles remote actions (PLAY, PAUSE, NEXT, PREV, SEEK) from guests', async () => {
    const jam = JamSessionManager.getInstance();
    await jam.startJam();

    const store = usePlayerStore.getState();
    const playNextSpy = vi.spyOn(store, 'playNext').mockImplementation(async () => {});
    const playPrevSpy = vi.spyOn(store, 'playPrev').mockImplementation(async () => {});

    await jam.handleHostRemoteAction('PLAY');
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await jam.handleHostRemoteAction('PAUSE');
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    await jam.handleHostRemoteAction('NEXT');
    expect(playNextSpy).toHaveBeenCalled();

    await jam.handleHostRemoteAction('PREV');
    expect(playPrevSpy).toHaveBeenCalled();
  });
});
