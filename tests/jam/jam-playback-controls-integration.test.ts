import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_a',
  title: 'Track Alpha',
  artist: 'Artist One',
  artistId: 'art_1',
  album: 'Album One',
  albumId: 'alb_1',
  duration: 200,
  coverUrl: 'https://cdn.test/a.jpg',
  audioUrl: 'https://cdn.test/a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 10,
  likes: 2,
};

const mockSongB: Song = {
  id: 'song_b',
  title: 'Track Bravo',
  artist: 'Artist Two',
  artistId: 'art_2',
  album: 'Album Two',
  albumId: 'alb_2',
  duration: 240,
  coverUrl: 'https://cdn.test/b.jpg',
  audioUrl: 'https://cdn.test/b.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 20,
  likes: 4,
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

    client.initUser('host_1', 'Host 1');
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

  it('7. JamServerEngine: createSession properly slices initialQueue without duplicate active track (TEST 4)', () => {
    const songC: Song = { id: 'song_c', title: 'Track Charlie', artist: 'Artist Three', artistId: 'art_3', album: 'Alb 3', albumId: 'alb_3', duration: 180, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };
    const songD: Song = { id: 'song_d', title: 'Track Delta', artist: 'Artist Four', artistId: 'art_4', album: 'Alb 4', albumId: 'alb_4', duration: 210, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };
    const songE: Song = { id: 'song_e', title: 'Track Echo', artist: 'Artist Five', artistId: 'art_5', album: 'Alb 5', albumId: 'alb_5', duration: 190, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };

    const initialQueue = [mockSongA, mockSongB, songC, songD, songE];

    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
      initialQueue,
    });

    expect(session.currentSong?.id).toBe('song_a');
    expect(session.queue.length).toBe(4);
    expect(session.queue[0]?.song.id).toBe('song_b');
    expect(session.queue[1]?.song.id).toBe('song_c');
    expect(session.queue[2]?.song.id).toBe('song_d');
    expect(session.queue[3]?.song.id).toBe('song_e');
    expect(session.history.length).toBe(0);

    // First SKIP_NEXT must transition immediately to Song B on click 1!
    const res = server.executeCommand({
      commandId: 'cmd_next_click_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_NEXT',
    });

    expect(res.success).toBe(true);
    expect(res.session?.currentSong?.id).toBe('song_b');
    expect(res.session?.queue[0]?.song.id).toBe('song_c');
    expect(res.session?.history[0]?.song.id).toBe('song_a');
  });

  it('8. JamServerEngine: createSession when initialSong is in middle of queue populates history and upcoming queue correctly', () => {
    const songC: Song = { id: 'song_c', title: 'Track Charlie', artist: 'Artist Three', artistId: 'art_3', album: 'Alb 3', albumId: 'alb_3', duration: 180, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };
    const songD: Song = { id: 'song_d', title: 'Track Delta', artist: 'Artist Four', artistId: 'art_4', album: 'Alb 4', albumId: 'alb_4', duration: 210, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };

    const initialQueue = [mockSongA, mockSongB, songC, songD];

    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: songC,
      initialQueue,
      initialQueueIndex: 2,
    });

    expect(session.currentSong?.id).toBe('song_c');
    expect(session.history.length).toBe(2);
    expect(session.history.map(h => h.song.id)).toEqual(['song_a', 'song_b']);
    expect(session.queue.length).toBe(1);
    expect(session.queue[0]?.song.id).toBe('song_d');
  });

  it('9. JamServerEngine: Pause -> Resume preserves exact position (TEST 1 & 2)', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    // Start playing
    server.executeCommand({
      commandId: 'cmd_play_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    // Advance authoritative position
    session.positionMs = 15200;
    session.basePositionMs = 15200;

    // Pause at 15.2s
    const pauseRes = server.executeCommand({
      commandId: 'cmd_pause_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PAUSE',
    });

    expect(pauseRes.success).toBe(true);
    expect(pauseRes.session?.state).toBe('PAUSED');
    expect(pauseRes.session?.positionMs).toBe(15200);

    // Resume without explicit payload -> preserves 15200ms
    const resumeRes = server.executeCommand({
      commandId: 'cmd_resume_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
    });

    expect(resumeRes.success).toBe(true);
    expect(resumeRes.session?.state).toBe('PLAYING');
    expect(resumeRes.session?.positionMs).toBe(15200);
    expect(resumeRes.session?.basePositionMs).toBe(15200);
  });

  it('10. JamServerEngine: Pause -> Seek while paused -> Resume resumes from sought position (TEST 3)', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    // Pause at 15s
    session.positionMs = 15000;
    session.basePositionMs = 15000;
    server.executeCommand({
      commandId: 'cmd_pause_seek_test',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PAUSE',
    });

    // Seek to 30s while paused
    const seekRes = server.executeCommand({
      commandId: 'cmd_seek_30',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SEEK',
      payload: { positionMs: 30000 },
    });

    expect(seekRes.success).toBe(true);
    expect(seekRes.session?.positionMs).toBe(30000);
    expect(seekRes.session?.state).toBe('PAUSED');

    // Resume
    const resumeRes = server.executeCommand({
      commandId: 'cmd_resume_after_seek',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
    });

    expect(resumeRes.success).toBe(true);
    expect(resumeRes.session?.positionMs).toBe(30000);
    expect(resumeRes.session?.state).toBe('PLAYING');
  });

  it('11. JamServerEngine: Rapid consecutive SKIP_NEXT calls transition deterministically (TEST 5)', () => {
    const songC: Song = { id: 'song_c', title: 'Track Charlie', artist: 'Artist Three', artistId: 'art_3', album: 'Alb 3', albumId: 'alb_3', duration: 180, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };
    const songD: Song = { id: 'song_d', title: 'Track Delta', artist: 'Artist Four', artistId: 'art_4', album: 'Alb 4', albumId: 'alb_4', duration: 210, coverUrl: '', audioUrl: '', genre: 'Pop', category: 'melody', releaseYear: 2024, plays: 1, likes: 1 };

    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
      initialQueue: [mockSongA, mockSongB, songC, songD],
    });

    const res1 = server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_1', action: 'SKIP_NEXT' });
    expect(res1.session?.currentSong?.id).toBe('song_b');

    const res2 = server.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'host_1', action: 'SKIP_NEXT' });
    expect(res2.session?.currentSong?.id).toBe('song_c');

    const res3 = server.executeCommand({ commandId: 'c3', jamId: session.jamId, userId: 'host_1', action: 'SKIP_NEXT' });
    expect(res3.session?.currentSong?.id).toBe('song_d');
  });

  it('12. JamServerEngine: Duplicate events are idempotent NO-OPs (TEST 6)', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    const res1 = server.executeCommand({ commandId: 'c_pause_1', jamId: session.jamId, userId: 'host_1', action: 'PAUSE' });
    expect(res1.success).toBe(true);

    const res2 = server.executeCommand({ commandId: 'c_pause_2', jamId: session.jamId, userId: 'host_1', action: 'PAUSE' });
    expect(res2.success).toBe(true);
    expect(res2.isIdempotentReplay).toBe(true);
  });
});
