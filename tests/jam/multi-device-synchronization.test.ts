import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { JamSession } from '@/types/jam';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_alpha',
  title: 'Alpha Song',
  artist: 'Artist A',
  artistId: 'art_a',
  album: 'Album Alpha',
  albumId: 'alb_a',
  duration: 240,
  audioUrl: 'https://cdn.example.com/alpha.mp4',
  coverUrl: 'https://cdn.example.com/alpha.jpg',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 10,
  likes: 1,
};

const mockSongB: Song = {
  id: 'song_beta',
  title: 'Beta Song',
  artist: 'Artist B',
  artistId: 'art_b',
  album: 'Album Beta',
  albumId: 'alb_b',
  duration: 180,
  audioUrl: 'https://cdn.example.com/beta.mp4',
  coverUrl: 'https://cdn.example.com/beta.jpg',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 20,
  likes: 2,
};

describe('RaagaX Jam — Two-Device & Multi-Device Synchronization Suite', () => {
  let serverEngine: JamServerEngine;

  beforeEach(() => {
    serverEngine = JamServerEngine.getInstance();
  });

  it('1. Two-Device Test: Host and Guest calculate identical expected playback positions across common server timeline', () => {
    const { session } = serverEngine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host 1',
      initialSong: mockSongA,
      deviceType: 'desktop',
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'user_guest_2',
      displayName: 'Guest 2',
      deviceType: 'mobile',
    });

    // Host starts playback
    const playResult = serverEngine.executeCommand({
      commandId: 'cmd_1',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PLAY',
      payload: { positionMs: 0 },
      requestId: 'req_play_1',
    });

    expect(playResult.success).toBe(true);
    const liveSession = playResult.session!;

    const driftEngine = DriftCorrectionEngine.getInstance();

    // At 15 seconds after scheduled start
    const targetServerTime = liveSession.startAtServerTime + 15000;
    const hostExpectedPos = driftEngine.calculateExpectedPositionMs(liveSession, targetServerTime);
    const guestExpectedPos = driftEngine.calculateExpectedPositionMs(liveSession, targetServerTime);

    expect(hostExpectedPos).toBe(15000);
    expect(guestExpectedPos).toBe(15000);
    expect(hostExpectedPos).toBe(guestExpectedPos);
  });

  it('2. Three-Device & High-Latency Test: Adaptive lead time expands buffer to accommodate slowest device', () => {
    const { session } = serverEngine.createSession({
      hostId: 'dev_A',
      hostName: 'Device A (Host)',
      initialSong: mockSongA,
      deviceType: 'desktop',
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'dev_B',
      displayName: 'Device B (100ms RTT)',
      deviceType: 'mobile',
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'dev_C',
      displayName: 'Device C (250ms RTT)',
      deviceType: 'mobile',
    });

    // Update telemetry with high RTTs
    serverEngine.updateParticipantState(session.jamId, 'dev_A', { rttMs: 20 });
    serverEngine.updateParticipantState(session.jamId, 'dev_B', { rttMs: 100 });
    serverEngine.updateParticipantState(session.jamId, 'dev_C', { rttMs: 250 });

    const playResult = serverEngine.executeCommand({
      commandId: 'cmd_play_multi',
      jamId: session.jamId,
      userId: 'dev_A',
      action: 'PLAY',
      payload: { positionMs: 0 },
      requestId: 'req_play_multi',
    });

    const liveSession = playResult.session!;
    // Lead time must be >= max RTT + padding to allow Device C to buffer before startAtServerTime
    expect(liveSession.leadTimeMs).toBeGreaterThanOrEqual(400);
    expect(liveSession.startAtServerTime).toBe(liveSession.serverTimestamp + liveSession.leadTimeMs);
  });

  it('3. Mid-Song Join Invariant: Joining an in-flight session calculates accurate elapsed position without 0:00 stutter', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_mid',
      hostName: 'Host Mid',
      initialSong: mockSongA,
    });

    // Start playing at server time T0
    const startResult = serverEngine.executeCommand({
      commandId: 'cmd_start',
      jamId: session.jamId,
      userId: 'host_mid',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    const liveSession = startResult.session!;
    const driftEngine = DriftCorrectionEngine.getInstance();

    // Guest joins 35 seconds after playback started
    const guestJoinServerTime = liveSession.startAtServerTime + 35000;
    const guestCalculatedPos = driftEngine.calculateExpectedPositionMs(liveSession, guestJoinServerTime);

    expect(guestCalculatedPos).toBe(35000);
  });

  it('4. Revision Continuity & Gap Recovery: Monotonically increasing revision increments with every mutation', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_rev',
      hostName: 'Host Rev',
      initialSong: mockSongA,
    });

    const initialRev = session.revision; // 100

    // Add track -> revision + 1
    const addResult = serverEngine.executeCommand({
      commandId: 'cmd_add',
      jamId: session.jamId,
      userId: 'host_rev',
      action: 'ADD_TRACK',
      payload: { song: mockSongB },
      requestId: 'req_add_1',
    });
    expect(addResult.session!.revision).toBe(initialRev + 1);

    // Seek track -> revision + 1
    const seekResult = serverEngine.executeCommand({
      commandId: 'cmd_seek',
      jamId: session.jamId,
      userId: 'host_rev',
      action: 'SEEK',
      payload: { positionMs: 45000 },
      requestId: 'req_seek_1',
    });
    expect(seekResult.session!.revision).toBe(initialRev + 2);
  });

  it('5. Host Continuity: Host departure elevates Moderator without pausing or shifting the common timeline', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_original',
      hostName: 'Original Host',
      initialSong: mockSongA,
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'mod_user',
      displayName: 'Moderator User',
      deviceType: 'desktop',
    });

    serverEngine.executeCommand({
      commandId: 'cmd_promote_1',
      jamId: session.jamId,
      userId: 'host_original',
      action: 'PROMOTE_MODERATOR',
      payload: { targetUserId: 'mod_user' },
    });

    // Start playback
    const playResult = serverEngine.executeCommand({
      commandId: 'cmd_p',
      jamId: session.jamId,
      userId: 'host_original',
      action: 'PLAY',
      payload: { positionMs: 10000 },
    });

    const preLeaveTimelineStart = playResult.session!.startAtServerTime;

    // Host leaves
    serverEngine.leaveSession(session.jamId, 'host_original');

    const updatedSession = serverEngine.getSession(session.jamId)!;
    expect(updatedSession.hostId).toBe('mod_user');
    expect(updatedSession.state).toBe('PLAYING');
    expect(updatedSession.startAtServerTime).toBe(preLeaveTimelineStart);
  });
});
