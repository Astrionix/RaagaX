import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_inv_a',
  title: 'Invariant Track A',
  artist: 'RaagaX Artist',
  artistId: 'art_1',
  album: 'Invariant Album',
  albumId: 'alb_1',
  duration: 200,
  coverUrl: 'https://cdn.test/coverA.jpg',
  audioUrl: 'https://cdn.test/audioA.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 10,
};

const mockSongB: Song = {
  id: 'song_inv_b',
  title: 'Invariant Track B',
  artist: 'RaagaX Artist',
  artistId: 'art_1',
  album: 'Invariant Album',
  albumId: 'alb_1',
  duration: 240,
  coverUrl: 'https://cdn.test/coverB.jpg',
  audioUrl: 'https://cdn.test/audioB.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 80,
  likes: 8,
};

describe('RaagaX Jam 10 Critical Invariants Suite (Section 57)', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('Invariant 1: At most one Jam host exists', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });

    engine.joinSession(session.jamId, { userId: 'user_guest_2', displayName: 'Guest Two' });
    engine.joinSession(session.jamId, { userId: 'user_guest_3', displayName: 'Guest Three' });

    const s = engine.getSession(session.jamId)!;
    const hosts = Object.values(s.participants).filter((p) => p.isHost || p.role === 'HOST');
    expect(hosts.length).toBe(1);
    expect(hosts[0].userId).toBe('user_host_1');
  });

  it('Invariant 2: A participant cannot execute unauthorized commands', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });

    engine.joinSession(session.jamId, { userId: 'user_guest_2', displayName: 'Guest Two' });

    // Guest cannot kick others or end session
    const kickRes = engine.executeCommand({
      commandId: 'cmd_kick',
      jamId: session.jamId,
      userId: 'user_guest_2',
      action: 'KICK_PARTICIPANT',
      payload: { targetUserId: 'user_host_1' },
    });
    expect(kickRes.success).toBe(false);

    const endRes = engine.executeCommand({
      commandId: 'cmd_end',
      jamId: session.jamId,
      userId: 'user_guest_2',
      action: 'END_SESSION',
    });
    expect(endRes.success).toBe(false);
  });

  it('Invariant 3: Every authoritative mutation has exactly one monotonically increasing revision', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });
    const rev0 = session.revision;

    const playRes = engine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PLAY',
    });
    expect(playRes.session?.revision).toBe(rev0 + 1);

    const pauseRes = engine.executeCommand({
      commandId: 'cmd_pause',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PAUSE',
    });
    expect(pauseRes.session?.revision).toBe(rev0 + 2);
  });

  it('Invariant 4: A queue item has exactly one unique queueItemId even for duplicate tracks', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });

    // Add song B twice
    engine.executeCommand({
      commandId: 'cmd_add_1',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });
    engine.executeCommand({
      commandId: 'cmd_add_2',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    const s = engine.getSession(session.jamId)!;
    expect(s.queue.length).toBe(2);
    expect(s.queue[0].trackId).toBe(mockSongB.id);
    expect(s.queue[1].trackId).toBe(mockSongB.id);
    expect(s.queue[0].queueItemId).not.toBe(s.queue[1].queueItemId);
  });

  it('Invariant 5: Duplicate requests do not create duplicate mutations when the same requestId is reused', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });

    const reqId = 'REQ_IDEMPOTENT_TEST_99';
    const res1 = engine.executeCommand({
      commandId: 'cmd_idem_1',
      requestId: reqId,
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });
    expect(res1.success).toBe(true);

    // Replay same requestId
    const res2 = engine.executeCommand({
      commandId: 'cmd_idem_2',
      requestId: reqId,
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });
    expect(res2.isIdempotentReplay).toBe(true);

    const s = engine.getSession(session.jamId)!;
    expect(s.queue.length).toBe(1);
  });

  it('Invariant 6: Participant exit cannot mutate playback or queue', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
      initialQueue: [mockSongB],
    });

    engine.joinSession(session.jamId, { userId: 'user_guest_2', displayName: 'Guest Two' });
    engine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PLAY',
      payload: { positionMs: 45000 },
    });

    const beforeLeave = engine.getSession(session.jamId)!;
    engine.leaveSession(session.jamId, 'user_guest_2');
    const afterLeave = engine.getSession(session.jamId)!;

    expect(afterLeave.state).toBe(beforeLeave.state);
    expect(afterLeave.trackId).toBe(beforeLeave.trackId);
    expect(afterLeave.queue.length).toBe(beforeLeave.queue.length);
    expect(afterLeave.participants['user_guest_2']).toBeUndefined();
  });

  it('Invariant 7: Host transfer cannot mutate playback timeline', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });

    engine.joinSession(session.jamId, { userId: 'user_guest_2', displayName: 'Guest Two' });
    engine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PLAY',
      payload: { positionMs: 30000 },
    });

    const beforeTransfer = engine.getSession(session.jamId)!;

    engine.executeCommand({
      commandId: 'cmd_xfer',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'TRANSFER_HOST',
      payload: { newHostId: 'user_guest_2' },
    });

    const afterTransfer = engine.getSession(session.jamId)!;
    expect(afterTransfer.hostId).toBe('user_guest_2');
    expect(afterTransfer.state).toBe(beforeTransfer.state);
    expect(afterTransfer.trackId).toBe(beforeTransfer.trackId);
    expect(afterTransfer.positionMs).toBe(beforeTransfer.positionMs);
  });

  it('Invariant 8: Clients converge on the authoritative Jam snapshot', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
    });

    const snap = engine.getSession(session.jamId);
    expect(snap).not.toBeNull();
    expect(snap?.jamId).toBe(session.jamId);
    expect(snap?.joinCode).toBe(session.joinCode);
    expect(snap?.hostId).toBe('user_host_1');
  });

  it('Invariant 9: A missing Jam does not trigger infinite reconnection and returns error', () => {
    const result = engine.getSession('NON_EXISTENT_JAM_ID_999');
    expect(result).toBeNull();

    const joinRes = engine.joinSession('NON_EXISTENT_JAM_ID_999', {
      userId: 'test_user',
      displayName: 'Test',
    });
    expect(joinRes.success).toBe(false);
    expect(joinRes.error).toContain('not found');
  });

  it('Invariant 10: One playback transition cannot trigger multiple local playback starts', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host One',
      initialSong: mockSongA,
      initialQueue: [mockSongB],
    });

    const skipRes = engine.executeCommand({
      commandId: 'cmd_skip_next',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'SKIP_NEXT',
    });

    expect(skipRes.success).toBe(true);
    expect(skipRes.session?.trackId).toBe(mockSongB.id);
    expect(skipRes.event?.type).toBe('TRACK_CHANGED');
    expect(skipRes.event?.payload.trackId).toBe(mockSongB.id);
  });
});
