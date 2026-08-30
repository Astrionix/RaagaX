import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_a',
  title: 'Track Alpha',
  artist: 'Artist One',
  duration: 200,
  coverUrl: 'https://cdn.test/a.jpg',
  audioUrl: 'https://cdn.test/a.mp3',
};

const mockSongB: Song = {
  id: 'song_b',
  title: 'Track Bravo',
  artist: 'Artist Two',
  duration: 240,
  coverUrl: 'https://cdn.test/b.jpg',
  audioUrl: 'https://cdn.test/b.mp3',
};

describe('RaagaX Jam — Playback Controls & Multi-Device Sync Integration', () => {
  let server: JamServerEngine;
  let client: JamClientManager;

  beforeEach(() => {
    server = JamServerEngine.getInstance();
    server.resetForTesting();

    client = JamClientManager.getInstance();
    client.resetForTesting();

    usePlayerStore.setState({
      currentSong: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      currentTime: 0,
      seekTarget: null,
    });
  });

  it('1. JamServerEngine: SKIP_NEXT on empty queue smoothly resets track to 0:00', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    const res = server.executeCommand({
      commandId: 'cmd_next_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_NEXT',
    });

    expect(res.success).toBe(true);
    expect(res.session?.currentSong?.id).toBe('song_a');
    expect(res.session?.positionMs).toBe(0);
  });

  it('2. JamServerEngine: SKIP_PREV on empty history restarts current song at 0:00', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    const res = server.executeCommand({
      commandId: 'cmd_prev_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_PREV',
    });

    expect(res.success).toBe(true);
    expect(res.session?.currentSong?.id).toBe('song_a');
    expect(res.session?.positionMs).toBe(0);
  });

  it('3. JamServerEngine: ADD_TRACK with playNow: true immediately transitions track', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    const res = server.executeCommand({
      commandId: 'cmd_add_now',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'ADD_TRACK',
      payload: { song: mockSongB, playNow: true },
    });

    expect(res.success).toBe(true);
    expect(res.session?.currentSong?.id).toBe('song_b');
    expect(res.session?.state).toBe('PLAYING');
    expect(res.session?.history[0]?.song.id).toBe('song_a');
  });

  it('4. usePlayerStore: togglePlayPause() routes to JamClientManager when in Jam', async () => {
    const sendPauseSpy = vi.spyOn(client, 'sendPause').mockResolvedValue(true);
    const sendPlaySpy = vi.spyOn(client, 'sendPlay').mockResolvedValue(true);

    // Simulate active Jam session
    const mockSession: any = {
      jamId: 'JAM_TEST_1',
      hostId: 'host_1',
      state: 'PLAYING',
      currentSong: mockSongA,
      queue: [],
      participants: {},
      revision: 1,
    };
    (client as any).activeSession = mockSession;

    usePlayerStore.setState({ isPlaying: true });
    await usePlayerStore.getState().togglePlayPause();
    expect(sendPauseSpy).toHaveBeenCalled();

    usePlayerStore.setState({ isPlaying: false });
    await usePlayerStore.getState().togglePlayPause();
    expect(sendPlaySpy).toHaveBeenCalled();
  });

  it('5. usePlayerStore: playNext() and playPrev() route to JamClientManager when in Jam', async () => {
    const skipNextSpy = vi.spyOn(client, 'sendSkipNext').mockResolvedValue(true);
    const skipPrevSpy = vi.spyOn(client, 'sendSkipPrev').mockResolvedValue(true);
    const seekSpy = vi.spyOn(client, 'sendSeek').mockResolvedValue(true);

    const mockSession: any = {
      jamId: 'JAM_TEST_2',
      hostId: 'host_1',
      state: 'PLAYING',
      currentSong: mockSongA,
      queue: [],
      participants: {},
      revision: 1,
    };
    (client as any).activeSession = mockSession;

    await usePlayerStore.getState().playNext();
    expect(skipNextSpy).toHaveBeenCalled();

    // With currentTime <= 3 -> sendSkipPrev
    usePlayerStore.setState({ currentTime: 1.5 });
    await usePlayerStore.getState().playPrev();
    expect(skipPrevSpy).toHaveBeenCalled();

    // With currentTime > 3 -> sendSeek(0)
    usePlayerStore.setState({ currentTime: 15.0 });
    await usePlayerStore.getState().playPrev();
    expect(seekSpy).toHaveBeenCalledWith(0);
  });

  it('6. usePlayerStore: playSong() routes to JamClientManager.sendAddTrack(song, true) when in Jam', async () => {
    const addTrackSpy = vi.spyOn(client, 'sendAddTrack').mockResolvedValue(true);

    const mockSession: any = {
      jamId: 'JAM_TEST_3',
      hostId: 'host_1',
      state: 'PLAYING',
      currentSong: mockSongA,
      queue: [],
      participants: {},
      revision: 1,
    };
    (client as any).activeSession = mockSession;

    await usePlayerStore.getState().playSong(mockSongB);
    expect(addTrackSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'song_b' }), true);
  });
});
