import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_track_a',
  title: 'Chaleya',
  artist: 'Arijit Singh',
  artistId: 'art_arijit',
  album: 'Jawan',
  albumId: 'alb_jawan',
  duration: 200,
  coverUrl: 'https://cdn.test/chaleya.jpg',
  audioUrl: 'https://cdn.test/chaleya.mp3',
  genre: 'Bollywood',
  category: 'latest_hindi',
  releaseYear: 2023,
  plays: 900000,
  likes: 45000,
};

const mockSongB: Song = {
  id: 'song_track_b',
  title: 'Naa Ready',
  artist: 'Anirudh Ravichander',
  artistId: 'art_anirudh',
  album: 'Leo',
  albumId: 'alb_leo',
  duration: 248,
  coverUrl: 'https://cdn.test/naaready.jpg',
  audioUrl: 'https://cdn.test/naaready.mp3',
  genre: 'Kollywood',
  category: 'latest_tamil',
  releaseYear: 2023,
  plays: 850000,
  likes: 40000,
};

describe('Participant Independence & Playback Continuity Suite', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('1. CRITICAL: Participant B leaving must NEVER modify track, playback state, position, timeline, or queue for A & C', () => {
    // 1. Host User A starts Jam with Song A
    const { session } = engine.createSession({
      hostId: 'user_a',
      hostName: 'User A (India)',
      initialSong: mockSongA,
    });

    // 2. Start playback at position 45,000ms
    engine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'user_a',
      action: 'PLAY',
      payload: { positionMs: 45000 },
    });

    // 3. User B (USA) and User C (UK) join
    engine.joinSession(session.jamId, { userId: 'user_b', displayName: 'User B (USA)' });
    engine.joinSession(session.jamId, { userId: 'user_c', displayName: 'User C (UK)' });

    // 4. Add Song B to shared queue
    engine.executeCommand({
      commandId: 'cmd_add',
      jamId: session.jamId,
      userId: 'user_b',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    // Snapshot before B leaves
    const stateBefore = engine.getSession(session.jamId)!;
    const initialTrackId = stateBefore.trackId;
    const initialPlaybackState = stateBefore.state;
    const initialPosition = stateBefore.positionMs;
    const initialStartTime = stateBefore.startAtServerTime;
    const initialQueueLength = stateBefore.queue.length;
    const initialQueueItemId = stateBefore.queue[0].queueItemId;

    // 5. User B leaves Jam
    const leaveRes = engine.leaveSession(session.jamId, 'user_b');
    expect(leaveRes.success).toBe(true);

    // Snapshot after B leaves
    const stateAfter = engine.getSession(session.jamId)!;

    // Verify Participant Independence:
    // A and C remain present; B is removed
    expect(Object.keys(stateAfter.participants)).toEqual(['user_a', 'user_c']);
    expect(stateAfter.participants['user_b']).toBeUndefined();

    // Playback state, track, position, timeline, and queue MUST remain completely unchanged!
    expect(stateAfter.trackId).toBe(initialTrackId);
    expect(stateAfter.state).toBe(initialPlaybackState);
    expect(stateAfter.positionMs).toBe(initialPosition);
    expect(stateAfter.startAtServerTime).toBe(initialStartTime);
    expect(stateAfter.queue.length).toBe(initialQueueLength);
    expect(stateAfter.queue[0].queueItemId).toBe(initialQueueItemId);
  });

  it('2. Network Disconnection: Participant B experiencing connection loss (RECONNECTING) does not interrupt Jam', () => {
    const { session } = engine.createSession({
      hostId: 'user_a',
      hostName: 'User A',
      initialSong: mockSongA,
    });

    engine.joinSession(session.jamId, { userId: 'user_b', displayName: 'Ravi' });
    engine.executeCommand({ commandId: 'c_play', jamId: session.jamId, userId: 'user_a', action: 'PLAY', payload: { positionMs: 12000 } });

    // Ravi loses network -> updates participant state to RECONNECTING
    engine.updateParticipantState(session.jamId, 'user_b', {
      status: 'RECONNECTING',
    });

    const activeSession = engine.getSession(session.jamId)!;
    // Presence updated
    expect(activeSession.participants['user_b'].status).toBe('RECONNECTING');

    // Playback state is untouched and remains PLAYING
    expect(activeSession.state).toBe('PLAYING');
    expect(activeSession.positionMs).toBe(12000);

    // Ravi reconnects -> updates to READY / PLAYING
    engine.updateParticipantState(session.jamId, 'user_b', {
      status: 'PLAYING',
      driftMs: 8,
    });

    const recoveredSession = engine.getSession(session.jamId)!;
    expect(recoveredSession.participants['user_b'].status).toBe('PLAYING');
    expect(recoveredSession.state).toBe('PLAYING');
  });

  it('3. Host Leaving: Atomically transfers host to next participant without interrupting playback or queue', () => {
    const { session } = engine.createSession({
      hostId: 'user_host_a',
      hostName: 'Original Host A',
      initialSong: mockSongA,
    });

    engine.joinSession(session.jamId, { userId: 'user_guest_b', displayName: 'Participant B' });
    engine.joinSession(session.jamId, { userId: 'user_guest_c', displayName: 'Participant C' });

    engine.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'user_host_a', action: 'PLAY', payload: { positionMs: 30000 } });
    engine.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'user_guest_b', action: 'ADD_TRACK', payload: { song: mockSongB } });

    const beforeLeave = engine.getSession(session.jamId)!;
    const startServerTime = beforeLeave.startAtServerTime;

    // Host A leaves
    const res = engine.leaveSession(session.jamId, 'user_host_a');
    expect(res.success).toBe(true);
    expect(res.sessionEnded).toBeFalsy();

    const afterLeave = engine.getSession(session.jamId)!;

    // Host role is transferred to Participant B
    expect(afterLeave.hostId).toBe('user_guest_b');
    expect(afterLeave.hostName).toBe('Participant B');
    expect(afterLeave.participants['user_guest_b'].isHost).toBe(true);

    // Playback, queue, and timeline remain continuous and uninterrupted
    expect(afterLeave.state).toBe('PLAYING');
    expect(afterLeave.positionMs).toBe(30000);
    expect(afterLeave.startAtServerTime).toBe(startServerTime);
    expect(afterLeave.queue.length).toBe(1);
    expect(afterLeave.queue[0].trackId).toBe('song_track_b');
  });

  it('4. Simultaneous queue modifications from multiple participants are ordered deterministically', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host',
      initialSong: mockSongA,
    });

    engine.joinSession(session.jamId, { userId: 'user_ravi', displayName: 'Ravi' });
    engine.joinSession(session.jamId, { userId: 'user_priya', displayName: 'Priya' });

    // Ravi adds Track A
    const res1 = engine.executeCommand({
      commandId: 'cmd_ravi_1',
      jamId: session.jamId,
      userId: 'user_ravi',
      action: 'ADD_TRACK',
      payload: { song: mockSongA },
    });

    // Priya adds Track B
    const res2 = engine.executeCommand({
      commandId: 'cmd_priya_1',
      jamId: session.jamId,
      userId: 'user_priya',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
    });

    expect(res1.session!.revision).toBeGreaterThan(1);
    expect(res2.session!.revision).toBe(res1.session!.revision + 1);

    const queue = res2.session!.queue;
    expect(queue.length).toBe(2);
    expect(queue[0].addedBy).toBe('user_ravi');
    expect(queue[1].addedBy).toBe('user_priya');
    expect(queue[0].queueItemId).not.toBe(queue[1].queueItemId);
  });
});
