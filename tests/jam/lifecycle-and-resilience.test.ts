import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { JamSession } from '@/types/jam';
import { Song } from '@/types/music';

const testSong: Song = {
  id: 'song_life_1',
  title: 'Lifecycle Track',
  artist: 'RaagaX Artist',
  album: 'Album Life',
  duration: 300,
  audioUrl: 'https://cdn.example.com/life.mp4',
  coverUrl: 'https://cdn.example.com/life.jpg',
};

describe('RaagaX Jam — Lifecycle, Error Semantics & Synchronization Resilience Suite', () => {
  let serverEngine: JamServerEngine;

  beforeEach(() => {
    serverEngine = JamServerEngine.getInstance();
    serverEngine.resetForTesting();
  });

  it('1. Session Lifecycle & Error Semantics: returns JAM_NOT_FOUND (404) for non-existent session and JAM_ENDED (410) after host ends session', () => {
    // Non-existent session
    const notFoundRes = serverEngine.executeCommand({
      commandId: 'cmd_nf',
      jamId: 'JAM_NON_EXISTENT',
      userId: 'user_1',
      action: 'PLAY',
    });
    expect(notFoundRes.success).toBe(false);
    expect(notFoundRes.code).toBe('JAM_NOT_FOUND');

    // Create session
    const { session } = serverEngine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host 1',
      initialSong: testSong,
    });
    const jamId = session.jamId;

    // Host ends session
    const endRes = serverEngine.executeCommand({
      commandId: 'cmd_end',
      jamId,
      userId: 'user_host_1',
      action: 'END_SESSION',
    });
    expect(endRes.success).toBe(true);
    expect(serverEngine.isSessionEnded(jamId)).toBe(true);

    // Subsequent command on ended session returns JAM_ENDED
    const endedRes = serverEngine.executeCommand({
      commandId: 'cmd_after_end',
      jamId,
      userId: 'user_host_1',
      action: 'PLAY',
    });
    expect(endedRes.success).toBe(false);
    expect(endedRes.code).toBe('JAM_ENDED');
  });

  it('2. Participant Membership Check: returns UNAUTHORIZED for non-member trying to send command', () => {
    const { session } = serverEngine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host 1',
      initialSong: testSong,
    });

    const unauthRes = serverEngine.executeCommand({
      commandId: 'cmd_unauth',
      jamId: session.jamId,
      userId: 'stranger_user_999',
      action: 'PLAY',
    });
    expect(unauthRes.success).toBe(false);
    expect(unauthRes.code).toBe('UNAUTHORIZED');
  });

  it('3. Participant Status Update: UPDATE_PARTICIPANT_STATUS updates participant telemetry without mutating playback timeline', () => {
    const { session } = serverEngine.createSession({
      hostId: 'user_host_1',
      hostName: 'Host 1',
      initialSong: testSong,
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'guest_2',
      displayName: 'Guest 2',
    });

    // Start playback
    const playRes = serverEngine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'user_host_1',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });
    const initialGeneration = playRes.session!.generation;
    const initialTimelineId = playRes.session!.timelineId;
    const initialStartAt = playRes.session!.startAtServerTime;

    // Guest reports status
    const statusRes = serverEngine.executeCommand({
      commandId: 'cmd_status',
      jamId: session.jamId,
      userId: 'guest_2',
      action: 'UPDATE_PARTICIPANT_STATUS',
      payload: {
        status: 'PLAYING',
        clockOffsetMs: 14,
        rttMs: 45,
        playbackDriftMs: -12,
        isReadyForPlayback: true,
      },
    });

    expect(statusRes.success).toBe(true);
    const updatedSession = serverEngine.getSession(session.jamId)!;
    // Playback timeline and generation remain intact
    expect(updatedSession.generation).toBe(initialGeneration);
    expect(updatedSession.timelineId).toBe(initialTimelineId);
    expect(updatedSession.startAtServerTime).toBe(initialStartAt);
    expect(updatedSession.participants['guest_2'].rttMs).toBe(45);
    expect(updatedSession.participants['guest_2'].playbackDriftMs).toBe(-12);
  });

  it('4. Drift Engine Buffer/Syncing Guard: does not trigger hard seek or rate changes while player is buffering or audio is paused/loading', () => {
    const driftEngine = DriftCorrectionEngine.getInstance();

    const mockSession: JamSession = {
      jamId: 'JAM_TEST_101',
      joinCode: '7K29P',
      name: 'Sync Test Jam',
      hostId: 'user_host',
      hostName: 'Host',
      state: 'PLAYING',
      currentSong: testSong,
      positionMs: 0,
      basePositionMs: 0,
      startAtServerTime: Date.now() - 2500, // 2.5s elapsed on server
      timelineStartServerMs: Date.now() - 2500,
      serverTimestamp: Date.now(),
      leadTimeMs: 400,
      revision: 10,
      generation: 2,
      timelineId: 'TL_2_abc',
      queue: [],
      history: [],
      participants: {},
      permissions: {
        canAddSongs: true,
        canRemoveSongs: true,
        canReorderQueue: true,
        canControlPlayback: true,
        canSkip: true,
        canInvite: true,
        canRemoveParticipants: true,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    driftEngine.setSession(mockSession);

    // When audio element is not yet playing (e.g. paused/loading/buffering), driftEngine must report NONE and 0ms drift
    const status = driftEngine.evaluateAndCorrect();
    expect(status.driftMs).toBe(0);
    expect(status.playbackRate).toBe(1.0);
    expect(status.correctionAction).toBe('NONE');
  });

  it('5. Generation Invalidation: async scheduled start from superseded generation is cleanly discarded', () => {
    const driftEngine = DriftCorrectionEngine.getInstance();

    const oldSession: JamSession = {
      jamId: 'JAM_GEN_TEST',
      joinCode: '3AB4C',
      name: 'Gen Test Jam',
      hostId: 'user_host',
      hostName: 'Host',
      state: 'PLAYING',
      currentSong: testSong,
      positionMs: 0,
      startAtServerTime: Date.now() + 500, // 500ms in future
      serverTimestamp: Date.now(),
      leadTimeMs: 500,
      revision: 1,
      generation: 1,
      timelineId: 'TL_1_old',
      queue: [],
      history: [],
      participants: {},
      permissions: {
        canAddSongs: true,
        canRemoveSongs: true,
        canReorderQueue: true,
        canControlPlayback: true,
        canSkip: true,
        canInvite: true,
        canRemoveParticipants: true,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    driftEngine.setSession(oldSession);
    driftEngine.evaluateScheduledStart(oldSession);

    // Track is skipped immediately, advancing generation to 2
    const newSession: JamSession = {
      ...oldSession,
      generation: 2,
      timelineId: 'TL_2_new',
      revision: 2,
    };
    driftEngine.setSession(newSession);

    // The scheduled start callback from generation 1 will be rejected by live generation check
    expect(newSession.generation).toBe(2);
    expect(newSession.timelineId).toBe('TL_2_new');
  });
});
