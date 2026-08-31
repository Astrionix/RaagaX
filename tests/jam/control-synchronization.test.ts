import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_a',
  title: 'Song Alpha',
  artist: 'Artist One',
  artistId: 'art_1',
  album: 'Album One',
  albumId: 'alb_1',
  duration: 240,
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
  title: 'Song Bravo',
  artist: 'Artist Two',
  artistId: 'art_2',
  album: 'Album Two',
  albumId: 'alb_2',
  duration: 180,
  coverUrl: 'https://cdn.test/b.jpg',
  audioUrl: 'https://cdn.test/b.mp3',
  genre: 'Rock',
  category: 'mass',
  releaseYear: 2024,
  plays: 20,
  likes: 4,
};

const mockSongC: Song = {
  id: 'song_c',
  title: 'Song Charlie',
  artist: 'Artist Three',
  artistId: 'art_3',
  album: 'Album Three',
  albumId: 'alb_3',
  duration: 210,
  coverUrl: 'https://cdn.test/c.jpg',
  audioUrl: 'https://cdn.test/c.mp3',
  genre: 'Jazz',
  category: 'melody',
  releaseYear: 2024,
  plays: 30,
  likes: 6,
};

describe('RaagaX Jam — Advanced Control Synchronization Pipeline', () => {
  let server: JamServerEngine;
  let client: JamClientManager;
  let stateMachine: JamPlaybackStateMachine;

  beforeEach(() => {
    server = JamServerEngine.getInstance();
    server.resetForTesting();

    client = JamClientManager.getInstance();
    client.resetForTesting();

    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();

    usePlayerStore.setState({
      currentSong: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      currentTime: 0,
    });
  });

  it('1. Authoritative Timeline: contains all required timeline fields upon creation and command', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    expect(session.jamId).toBeDefined();
    expect(session.timelineId).toBe('TL_1');
    expect(session.transitionId).toBe('TR_1');
    expect(session.generation).toBe(1);
    expect(session.revision).toBe(1);
    expect(session.trackId).toBe('song_a');
    expect(session.currentTrackId).toBe('song_a');
    expect(session.currentQueueItemId).toBeDefined();
    expect(session.positionMs).toBe(0);
    expect(session.durationMs).toBe(240000);
    expect(session.isPlaying).toBe(false);
    expect(session.playbackState).toBe('PAUSED');
    expect(session.anchorPositionMs).toBe(0);
    expect(session.anchorServerTimeMs).toBeDefined();
  });

  it('2. PLAY: starts authoritative timeline with scheduled lead time and preserves generation on resume', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    const res = server.executeCommand({
      commandId: 'cmd_play_1',
      requestId: 'req_play_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
      payload: { positionMs: 5000 },
    });

    expect(res.success).toBe(true);
    const updated = res.session!;
    expect(updated.state).toBe('PLAYING');
    expect(updated.isPlaying).toBe(true);
    expect(updated.positionMs).toBe(5000);
    expect(updated.anchorPositionMs).toBe(5000);
    expect(updated.startAtServerTime).toBeGreaterThanOrEqual(updated.serverTimestamp);
    expect(updated.anchorServerTimeMs).toBe(updated.startAtServerTime);
    expect(updated.generation).toBe(1); // Preserved generation for same-track resume
  });

  it('3. PAUSE & RESUME: captures exact millisecond position and resumes seamlessly without 0:00 reset', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    // Start playing
    server.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    // Seek to 15.428s
    server.executeCommand({
      commandId: 'cmd_seek_mid',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SEEK',
      payload: { positionMs: 15428 },
    });

    const pauseRes = server.executeCommand({
      commandId: 'cmd_pause',
      requestId: 'req_pause_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PAUSE',
    });

    expect(pauseRes.success).toBe(true);
    const pausedSession = pauseRes.session!;
    expect(pausedSession.state).toBe('PAUSED');
    expect(pausedSession.isPlaying).toBe(false);
    expect(pausedSession.positionMs).toBe(15428);
    expect(pausedSession.anchorPositionMs).toBe(15428);

    // Now RESUME
    const resumeRes = server.executeCommand({
      commandId: 'cmd_resume',
      requestId: 'req_resume_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
    });

    expect(resumeRes.success).toBe(true);
    const resumedSession = resumeRes.session!;
    expect(resumedSession.state).toBe('PLAYING');
    expect(resumedSession.isPlaying).toBe(true);
    expect(resumedSession.positionMs).toBe(15428); // Resumed from exact paused position
    expect(resumedSession.anchorPositionMs).toBe(15428);
  });

  it('4. NEXT: atomic queue transition and ensures currently playing track is never duplicated in upcoming queue', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
      initialQueue: [mockSongA, mockSongB, mockSongC],
      initialQueueIndex: 0,
    });

    // Initial state: current is Song A, upcoming queue is [Song B, Song C]
    expect(session.currentSong?.id).toBe('song_a');
    expect(session.queue.map((q) => q.song.id)).toEqual(['song_b', 'song_c']);

    // Issue NEXT
    const nextRes = server.executeCommand({
      commandId: 'cmd_next',
      requestId: 'req_next_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_NEXT',
    });

    expect(nextRes.success).toBe(true);
    const updated = nextRes.session!;
    // Current is now Song B
    expect(updated.currentSong?.id).toBe('song_b');
    expect(updated.trackId).toBe('song_b');
    expect(updated.currentTrackId).toBe('song_b');
    expect(updated.positionMs).toBe(0);
    expect(updated.generation).toBe(2); // Bumped generation for track change

    // Queue must contain only [Song C] — Song B must NOT be duplicated in queue!
    expect(updated.queue.map((q) => q.song.id)).toEqual(['song_c']);

    // History must contain Song A
    expect(updated.history.map((h) => h.song.id)).toContain('song_a');
  });

  it('5. PREVIOUS: restarts if played > 3s, or steps back into history if <= 3s', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
      initialQueue: [mockSongA, mockSongB],
      initialQueueIndex: 0,
    });

    // Advance to Song B
    server.executeCommand({
      commandId: 'cmd_next',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_NEXT',
    });

    const activeSession = server.getSession(session.jamId)!;
    expect(activeSession.currentSong?.id).toBe('song_b');

    // Case A: Position > 3s (Seek to 10s into Song B) -> PREVIOUS restarts Song B at 0:00
    server.executeCommand({
      commandId: 'cmd_seek_10s',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SEEK',
      payload: { positionMs: 10000 },
    });

    const restartRes = server.executeCommand({
      commandId: 'cmd_prev_restart',
      requestId: 'req_prev_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_PREV',
    });

    expect(restartRes.success).toBe(true);
    expect(restartRes.session?.currentSong?.id).toBe('song_b');
    expect(restartRes.session?.positionMs).toBe(0);

    // Case B: Position <= 3s (Seek to 1s into Song B) -> PREVIOUS steps back to Song A
    server.executeCommand({
      commandId: 'cmd_seek_1s',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SEEK',
      payload: { positionMs: 1000 },
    });

    const stepBackRes = server.executeCommand({
      commandId: 'cmd_prev_stepback',
      requestId: 'req_prev_2',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SKIP_PREV',
    });

    expect(stepBackRes.success).toBe(true);
    const steppedBack = stepBackRes.session!;
    expect(steppedBack.currentSong?.id).toBe('song_a');
    expect(steppedBack.positionMs).toBe(0);
    // Song B is placed back at the head of the upcoming queue
    expect(steppedBack.queue[0]?.song.id).toBe('song_b');
  });

  it('6. SEEK: clamps to track duration and generates new timeline anchor', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA, // duration 240s = 240000ms
    });

    const seekRes = server.executeCommand({
      commandId: 'cmd_seek',
      requestId: 'req_seek_1',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SEEK',
      payload: { positionMs: 65000 },
    });

    expect(seekRes.success).toBe(true);
    const updated = seekRes.session!;
    expect(updated.positionMs).toBe(65000);
    expect(updated.anchorPositionMs).toBe(65000);
    expect(updated.generation).toBe(2);

    // Test clamped seek exceeding duration
    const clampedRes = server.executeCommand({
      commandId: 'cmd_seek_over',
      requestId: 'req_seek_2',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'SEEK',
      payload: { positionMs: 500000 },
    });

    expect(clampedRes.success).toBe(true);
    expect(clampedRes.session?.positionMs).toBe(240000);
  });

  it('7. Idempotency: duplicate command with same requestId returns cached result without incrementing revision', () => {
    const { session } = server.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSongA,
    });

    const res1 = server.executeCommand({
      commandId: 'cmd_idempotent',
      requestId: 'same_req_123',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
      payload: { positionMs: 1000 },
    });

    expect(res1.success).toBe(true);
    const rev1 = res1.session!.revision;

    // Second execution with identical requestId
    const res2 = server.executeCommand({
      commandId: 'cmd_idempotent_retry',
      requestId: 'same_req_123',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
      payload: { positionMs: 1000 },
    });

    expect(res2.success).toBe(true);
    expect(res2.isIdempotentReplay).toBe(true);
    expect(res2.session!.revision).toBe(rev1); // Revision was not bumped twice
  });
});
