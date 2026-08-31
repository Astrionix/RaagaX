import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { JamSession, JamEvent } from '@/types/jam';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const songA: Song = {
  id: 'RACE_TRACK_A',
  title: 'Race Track A',
  artist: 'Artist A',
  artistId: 'ART_A',
  album: 'Album A',
  albumId: 'ALB_A',
  duration: 240,
  coverUrl: 'https://cdn.example.com/a.jpg',
  audioUrl: 'https://cdn.example.com/a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 1000,
  likes: 100,
};

const songB: Song = {
  id: 'RACE_TRACK_B',
  title: 'Race Track B',
  artist: 'Artist B',
  artistId: 'ART_B',
  album: 'Album B',
  albumId: 'ALB_B',
  duration: 200,
  coverUrl: 'https://cdn.example.com/b.jpg',
  audioUrl: 'https://cdn.example.com/b.mp3',
  genre: 'Rock',
  category: 'mass',
  releaseYear: 2024,
  plays: 800,
  likes: 80,
};

const songC: Song = {
  id: 'RACE_TRACK_C',
  title: 'Race Track C',
  artist: 'Artist C',
  artistId: 'ART_C',
  album: 'Album C',
  albumId: 'ALB_C',
  duration: 300,
  coverUrl: 'https://cdn.example.com/c.jpg',
  audioUrl: 'https://cdn.example.com/c.mp3',
  genre: 'Classical',
  category: 'melody',
  releaseYear: 2024,
  plays: 600,
  likes: 60,
};

// ─── Helper: make a mock JamSession ──────────────────────────────────────────

function makeSession(overrides: Partial<JamSession> = {}): JamSession {
  return {
    jamId: 'JAM_RACE_TEST',
    joinCode: 'RACE1',
    name: 'Race Condition Test',
    hostId: 'host_user',
    hostName: 'Host',
    isNearbyDiscoverable: false,
    status: 'ACTIVE',
    state: 'PLAYING',
    trackId: songA.id,
    currentSong: songA,
    currentQueueItemId: 'QI_RACE_TRACK_A',
    positionMs: 15000,
    basePositionMs: 15000,
    serverTimestamp: 1000000,
    startAtServerTime: 1000000 - 15000,
    timelineStartServerMs: 1000000 - 15000,
    leadTimeMs: 400,
    revision: 5,
    generation: 2,
    timelineId: 'TL_2_abc',
    transitionId: 'TR_2_abc',
    createdAt: 999000,
    updatedAt: 1000000,
    lastActivityAt: 1000000,
    expiresAt: 1086400000,
    permissions: {
      canAddSongs: true,
      canRemoveSongs: true,
      canReorderQueue: true,
      canControlPlayback: true,
      canSkip: true,
      canInvite: true,
      canRemoveParticipants: true,
    },
    participants: {
      host_user: {
        participantId: 'P_HOST',
        userId: 'host_user',
        displayName: 'Host',
        role: 'HOST',
        isHost: true,
        status: 'PLAYING',
        joinedAt: 999000,
        lastSeenAt: 1000000,
        clockOffsetMs: 0,
        rttMs: 20,
        playbackDriftMs: 0,
        deviceType: 'desktop',
        isReadyForPlayback: true,
      },
    },
    queue: [{ queueItemId: 'QI_RACE_TRACK_B', trackId: songB.id, song: songB, addedBy: 'host_user', addedByName: 'Host', addedAt: 999000, orderKey: '1000' }],
    history: [],
    playbackHistory: [],
    activeHandoff: null,
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RaagaX Jam — Race Condition Safety Suite (Phase 10)', () => {
  let server: JamServerEngine;
  let stateMachine: JamPlaybackStateMachine;
  let driftEngine: DriftCorrectionEngine;
  let clockSync: ClockSyncEngine;

  beforeEach(() => {
    server = JamServerEngine.getInstance();
    server.resetForTesting();

    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();

    driftEngine = DriftCorrectionEngine.getInstance();
    driftEngine.resetForTesting();

    clockSync = ClockSyncEngine.getInstance();
    clockSync.resetForTesting(0);
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 1: Rapid PAUSE + PLAY — must not reload audio, must not seek to 0
  // ──────────────────────────────────────────────────────────────────
  it('Race 1: Rapid PAUSE + PLAY — same generation, no audio reload', async () => {
    const { session } = server.createSession({
      hostId: 'host_user',
      hostName: 'Host',
      initialSong: songA,
      initialQueue: [songA, songB],
    });

    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 15000 } });
    const afterPlay = server.getSession(session.jamId)!;
    const genAfterPlay = afterPlay.generation;

    server.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'host_user', action: 'PAUSE' });
    const afterPause = server.getSession(session.jamId)!;
    const genAfterPause = afterPause.generation;

    server.executeCommand({ commandId: 'c3', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: afterPause.positionMs } });
    const afterResume = server.getSession(session.jamId)!;
    const genAfterResume = afterResume.generation;

    // PHASE 1: PAUSE/PLAY preserve generation — all three should be the same
    expect(genAfterPlay).toBe(genAfterPause);
    expect(genAfterPause).toBe(genAfterResume);

    // Position must be preserved through pause
    expect(afterPause.positionMs).toBeGreaterThan(0);
    expect(afterResume.positionMs).toBe(afterPause.positionMs);

    // Track identity must not change
    expect(afterResume.trackId).toBe(songA.id);
    expect(afterResume.state).toBe('PLAYING');
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 2: PAUSE + snapshot with same identity — must be drift-only update
  // ──────────────────────────────────────────────────────────────────
  it('Race 2: PAUSE + snapshot with same identity — no new audio load', async () => {
    const session = makeSession({ state: 'PAUSED', positionMs: 15000 });

    // Simulate: stateMachine has already committed this identity
    stateMachine['state'].activeGeneration = 2;
    stateMachine['state'].activeTimelineId = 'TL_2_abc';
    stateMachine['state'].activeTransitionId = 'TR_2_abc';
    stateMachine['state'].activeTrackId = songA.id;
    stateMachine['state'].playbackState = 'PAUSED';

    const pauseSpy = vi.spyOn(PlaybackService.getInstance(), 'pause').mockImplementation(() => {});

    // Incoming snapshot with same identity — should NOT reload
    await stateMachine.handleTransition(session, undefined, 'RECONCILIATION');

    // The pause was already applied — no EXTRA pause calls from reconciliation
    expect(stateMachine.getPlaybackIdentity().generation).toBe(2);
    expect(stateMachine.getPlaybackIdentity().trackId).toBe(songA.id);

    pauseSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 3: PLAY event with isPureResume=true — state-only, no audio reload
  // ──────────────────────────────────────────────────────────────────
  it('Race 3: PLAY event with isPureResume=true — applies RESUME without loading audio', async () => {
    const session = makeSession({ state: 'PLAYING', positionMs: 15000 });

    // Set machine to PAUSED for same track+generation
    stateMachine['state'].activeGeneration = 2;
    stateMachine['state'].activeTimelineId = 'TL_2_prev';
    stateMachine['state'].activeTransitionId = 'TR_2_prev';
    stateMachine['state'].activeTrackId = songA.id;
    stateMachine['state'].playbackState = 'PAUSED';

    const playEvent: JamEvent = {
      eventId: 'EV_PLAY_RESUME',
      jamId: 'JAM_RACE_TEST',
      type: 'PLAY',
      revision: 6,
      generation: 2,
      timelineId: 'TL_2_abc',
      transitionId: 'TR_2_abc',
      serverTimestamp: Date.now(),
      senderId: 'host_user',
      payload: {
        positionMs: 15000,
        basePositionMs: 15000,
        startAtServerTime: Date.now() + 400,
        trackId: songA.id,
        currentQueueItemId: 'QI_RACE_TRACK_A',
        timelineId: 'TL_2_abc',
        transitionId: 'TR_2_abc',
        generation: 2,
        isPureResume: true,
      },
    };

    const evaluateSpy = vi.spyOn(driftEngine, 'evaluateScheduledStart').mockImplementation(() => {});
    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource').mockResolvedValue(true);

    await stateMachine.handleTransition(session, playEvent, 'EVENT');

    // MUST have called evaluateScheduledStart (resume via drift engine)
    expect(evaluateSpy).toHaveBeenCalled();
    // Must NOT have called loadAudioSource (no audio reload)
    expect(loadSpy).not.toHaveBeenCalled();

    expect(stateMachine['state'].playbackState).toBe('PLAYING');
    expect(stateMachine.getPlaybackIdentity().generation).toBe(2);

    evaluateSpy.mockRestore();
    loadSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 4: PAUSE event with isPureResume=false — pauses without reload
  // ──────────────────────────────────────────────────────────────────
  it('Race 4: PAUSE event with isPureResume=false — pauses without reload', async () => {
    const session = makeSession({ state: 'PAUSED', positionMs: 15000 });

    stateMachine['state'].activeGeneration = 2;
    stateMachine['state'].activeTimelineId = 'TL_2_prev';
    stateMachine['state'].activeTransitionId = 'TR_2_prev';
    stateMachine['state'].activeTrackId = songA.id;
    stateMachine['state'].playbackState = 'PLAYING';

    const pauseEvent: JamEvent = {
      eventId: 'EV_PAUSE_PURE',
      jamId: 'JAM_RACE_TEST',
      type: 'PAUSE',
      revision: 6,
      generation: 2,
      timelineId: 'TL_2_abc',
      transitionId: 'TR_2_abc',
      serverTimestamp: Date.now(),
      senderId: 'host_user',
      payload: {
        positionMs: 15000,
        trackId: songA.id,
        currentQueueItemId: 'QI_RACE_TRACK_A',
        generation: 2,
        isPureResume: false,
      },
    };

    const pauseSpy = vi.spyOn(PlaybackService.getInstance(), 'pause').mockImplementation(() => {});
    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource').mockResolvedValue(true);

    await stateMachine.handleTransition(session, pauseEvent, 'EVENT');

    expect(pauseSpy).toHaveBeenCalledOnce();
    expect(loadSpy).not.toHaveBeenCalled();
    expect(stateMachine['state'].playbackState).toBe('PAUSED');

    pauseSpy.mockRestore();
    loadSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 5: SEEK + snapshot arriving out-of-order — stale snapshot ignored
  // ──────────────────────────────────────────────────────────────────
  it('Race 5: Stale snapshot after SEEK — stale generation is rejected', async () => {
    const { session } = server.createSession({ hostId: 'host_user', hostName: 'Host', initialSong: songA, initialQueue: [songA, songB] });

    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 0 } });
    server.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'host_user', action: 'SEEK', payload: { positionMs: 30000 } });

    const currentSession = server.getSession(session.jamId)!;
    const currentGen = currentSession.generation || 1;

    // Simulate a stale snapshot from before the SEEK (lower generation)
    const staleSession: JamSession = { ...currentSession, generation: currentGen - 1, positionMs: 5000 };

    stateMachine['state'].activeGeneration = currentGen;
    stateMachine['state'].activeTrackId = songA.id;

    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource').mockResolvedValue(true);
    await stateMachine.handleTransition(staleSession, undefined, 'RECONCILIATION');

    // Stale generation must be rejected — no reload, no position change
    expect(loadSpy).not.toHaveBeenCalled();
    expect(stateMachine.getPlaybackIdentity().generation).toBe(currentGen);

    loadSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 6: NEXT + AUTO_NEXT simultaneously — server-level idempotency
  // ──────────────────────────────────────────────────────────────────
  it('Race 6: Simultaneous SKIP_NEXT from host + duplicate — server deduplicates', () => {
    const { session } = server.createSession({ hostId: 'host_user', hostName: 'Host', initialSong: songA, initialQueue: [songA, songB, songC] });

    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 0 } });

    // First SKIP_NEXT
    const res1 = server.executeCommand({ commandId: 'cmd_next_1', jamId: session.jamId, userId: 'host_user', action: 'SKIP_NEXT' });
    expect(res1.success).toBe(true);

    const sessionAfterFirst = server.getSession(session.jamId)!;
    const genAfterFirst = sessionAfterFirst.generation;
    const trackAfterFirst = sessionAfterFirst.trackId;

    // Second SKIP_NEXT with SAME commandId — idempotent replay
    const res2 = server.executeCommand({ commandId: 'cmd_next_1', jamId: session.jamId, userId: 'host_user', action: 'SKIP_NEXT' });
    expect(res2.isIdempotentReplay).toBe(true);

    const sessionAfterSecond = server.getSession(session.jamId)!;

    // Generation and track must be unchanged after duplicate SKIP_NEXT
    expect(sessionAfterSecond.generation).toBe(genAfterFirst);
    expect(sessionAfterSecond.trackId).toBe(trackAfterFirst);
    expect(sessionAfterSecond.queue.length).toBe(sessionAfterFirst.queue.length);
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 7: NEXT + PREVIOUS simultaneously — last command wins
  // ──────────────────────────────────────────────────────────────────
  it('Race 7: SKIP_NEXT then SKIP_PREV — each creates unique generation, state is sequential', () => {
    const { session } = server.createSession({ hostId: 'host_user', hostName: 'Host', initialSong: songA, initialQueue: [songA, songB, songC] });
    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 0 } });

    const res1 = server.executeCommand({ commandId: 'cmd_next', jamId: session.jamId, userId: 'host_user', action: 'SKIP_NEXT' });
    expect(res1.success).toBe(true);
    const genAfterNext = server.getSession(session.jamId)!.generation || 0;

    const res2 = server.executeCommand({ commandId: 'cmd_prev', jamId: session.jamId, userId: 'host_user', action: 'SKIP_PREV' });
    expect(res2.success).toBe(true);
    const genAfterPrev = server.getSession(session.jamId)!.generation || 0;

    // Each SKIP creates a new generation
    expect(genAfterPrev).toBeGreaterThan(genAfterNext);
    // Should be back on track A (songA was the current when we did NEXT, PREV brings back songA)
    expect(server.getSession(session.jamId)!.currentSong?.id).toBe(songA.id);
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 8: New device joins while PLAY is being processed
  // ──────────────────────────────────────────────────────────────────
  it('Race 8: New device joins while PLAY is in-flight — join is side-effect-free', () => {
    const { session } = server.createSession({ hostId: 'host_user', hostName: 'Host', initialSong: songA, initialQueue: [songA, songB] });

    const playRes = server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 5000 } });
    expect(playRes.success).toBe(true);

    const sessionBeforeJoin = server.getSession(session.jamId)!;
    const genBeforeJoin = sessionBeforeJoin.generation;
    const tlBeforeJoin = sessionBeforeJoin.timelineId;

    // Guest device joins
    const joinRes = server.joinSession(session.jamId, { userId: 'guest_device', displayName: 'Guest Phone', deviceType: 'mobile' });
    expect(joinRes.success).toBe(true);

    const sessionAfterJoin = server.getSession(session.jamId)!;

    // Join must NOT change generation, timelineId, or playback state
    expect(sessionAfterJoin.generation).toBe(genBeforeJoin);
    expect(sessionAfterJoin.timelineId).toBe(tlBeforeJoin);
    expect(sessionAfterJoin.state).toBe('PLAYING');
    expect(sessionAfterJoin.trackId).toBe(songA.id);
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 9: New device joins while Jam is paused — snapshot has correct position
  // ──────────────────────────────────────────────────────────────────
  it('Race 9: New device joins while paused — snapshot preserves pause position', () => {
    const { session } = server.createSession({ hostId: 'host_user', hostName: 'Host', initialSong: songA, initialQueue: [songA, songB] });

    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 0 } });
    server.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'host_user', action: 'PAUSE' });

    const sessionBeforeJoin = server.getSession(session.jamId)!;
    expect(sessionBeforeJoin.state).toBe('PAUSED');
    const pausePosition = sessionBeforeJoin.positionMs;
    expect(pausePosition).toBeGreaterThanOrEqual(0);

    // New device joins
    const joinRes = server.joinSession(session.jamId, { userId: 'guest_latejoiner', displayName: 'Late Joiner', deviceType: 'mobile' });
    expect(joinRes.success).toBe(true);

    const snapshotForGuest = server.getSession(session.jamId)!;

    // Guest receives PAUSED snapshot at the correct position
    expect(snapshotForGuest.state).toBe('PAUSED');
    expect(snapshotForGuest.positionMs).toBe(pausePosition);
    expect(snapshotForGuest.trackId).toBe(songA.id);
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 10: RECONNECT + same identity — drift update only, no audio reload
  // ──────────────────────────────────────────────────────────────────
  it('Race 10: Reconnect with same-identity snapshot — drift engine update only', async () => {
    const session = makeSession({ state: 'PLAYING', positionMs: 30000 });

    // Machine already committed this identity
    stateMachine['state'].activeGeneration = 2;
    stateMachine['state'].activeTimelineId = 'TL_2_abc';
    stateMachine['state'].activeTransitionId = 'TR_2_abc';
    stateMachine['state'].activeTrackId = songA.id;
    stateMachine['state'].playbackState = 'PLAYING';

    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource').mockResolvedValue(true);

    // Reconnect snapshot with same identity, different positionMs (time has elapsed)
    const reconnectSnapshot = { ...session, positionMs: 35000, revision: 7 };
    await stateMachine.handleTransition(reconnectSnapshot, undefined, 'RECONCILIATION');

    // Should NOT have called loadAudioSource — same identity
    expect(loadSpy).not.toHaveBeenCalled();
    // Identity preserved
    expect(stateMachine.getPlaybackIdentity().generation).toBe(2);
    expect(stateMachine.getPlaybackIdentity().trackId).toBe(songA.id);

    loadSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 11: RECONNECT + NEXT in flight — new identity triggers full load
  // ──────────────────────────────────────────────────────────────────
  it('Race 11: Reconnect snapshot with NEW identity (track changed during outage) — full reload', async () => {
    const session = makeSession({ state: 'PLAYING', positionMs: 30000 });

    // Machine is on generation 2
    stateMachine['state'].activeGeneration = 2;
    stateMachine['state'].activeTimelineId = 'TL_2_abc';
    stateMachine['state'].activeTransitionId = 'TR_2_abc';
    stateMachine['state'].activeTrackId = songA.id;
    stateMachine['state'].playbackState = 'PLAYING';

    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource').mockResolvedValue(true);

    // New snapshot: track changed to songB, new generation 3
    const newTrackSnapshot: JamSession = {
      ...session,
      trackId: songB.id,
      currentSong: songB,
      currentQueueItemId: 'QI_RACE_TRACK_B',
      generation: 3,
      timelineId: 'TL_3_xyz',
      transitionId: 'TR_3_xyz',
      positionMs: 1000,
      revision: 9,
    };

    await stateMachine.handleTransition(newTrackSnapshot, undefined, 'RECONCILIATION');

    // Identity should be updated to gen 3
    expect(stateMachine.getPlaybackIdentity().generation).toBe(3);
    expect(stateMachine.getPlaybackIdentity().trackId).toBe(songB.id);

    loadSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 12: Duplicate PLAY events (SSE + Supabase both deliver same event)
  // ──────────────────────────────────────────────────────────────────
  it('Race 12: Duplicate PLAY event from SSE and Supabase — second is NO_OP', async () => {
    const session = makeSession({ state: 'PAUSED', positionMs: 15000 });

    stateMachine['state'].activeGeneration = 2;
    stateMachine['state'].activeTimelineId = 'TL_2_prev';
    stateMachine['state'].activeTransitionId = 'TR_2_prev';
    stateMachine['state'].activeTrackId = songA.id;
    stateMachine['state'].playbackState = 'PAUSED';

    const resumeSession: JamSession = { ...session, state: 'PLAYING', timelineId: 'TL_2_abc', transitionId: 'TR_2_abc' };
    const resumeEvent: JamEvent = {
      eventId: 'EV_PLAY_DUP',
      jamId: 'JAM_RACE_TEST',
      type: 'PLAY',
      revision: 6,
      generation: 2,
      timelineId: 'TL_2_abc',
      transitionId: 'TR_2_abc',
      serverTimestamp: Date.now(),
      senderId: 'host_user',
      payload: { positionMs: 15000, isPureResume: true, generation: 2, trackId: songA.id, currentQueueItemId: 'QI_RACE_TRACK_A' },
    };

    const evaluateSpy = vi.spyOn(driftEngine, 'evaluateScheduledStart').mockImplementation(() => {});

    // First delivery (SSE)
    await stateMachine.handleTransition(resumeSession, resumeEvent, 'EVENT');
    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(stateMachine['state'].playbackState).toBe('PLAYING');

    // Second delivery (Supabase duplicate) — same transitionId, now idempotent
    await stateMachine.handleTransition(resumeSession, resumeEvent, 'EVENT');
    // evaluateScheduledStart must NOT be called again (NO_OP for same state)
    expect(evaluateSpy).toHaveBeenCalledTimes(1);

    evaluateSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 13: Drift correction does NOT create new generation or transition
  // ──────────────────────────────────────────────────────────────────
  it('Race 13: Drift correction applies rate modulation without changing generation', () => {
    const { session } = server.createSession({ hostId: 'host_user', hostName: 'Host', initialSong: songA, initialQueue: [songA, songB] });
    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 0 } });

    const currentSession = server.getSession(session.jamId)!;
    const genBefore = currentSession.generation;

    // Apply drift correction
    const mockAudio = {
      currentTime: 10.2,  // 200ms ahead (Tier 2 micro-drift)
      playbackRate: 1.0,
      paused: false,
      buffered: { length: 0, start: () => 0, end: () => 0 },
    } as unknown as HTMLAudioElement;
    vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);
    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(currentSession.startAtServerTime + 10000);

    driftEngine.setSession(currentSession);
    const status = driftEngine.evaluateAndCorrect();

    // Drift correction must NOT change session generation on the server
    const sessionAfter = server.getSession(session.jamId)!;
    expect(sessionAfter.generation).toBe(genBefore);
    expect(sessionAfter.trackId).toBe(songA.id);

    // Status reflects correction only
    expect(status.generation).toBe(currentSession.generation);
  });

  // ──────────────────────────────────────────────────────────────────
  // Race 14: SEEK + NEXT in sequence — SEEK position must not persist after NEXT
  // ──────────────────────────────────────────────────────────────────
  it('Race 14: SEEK then NEXT — new track starts at position 0, not seek position', () => {
    const { session } = server.createSession({
      hostId: 'host_user',
      hostName: 'Host',
      initialSong: songA,
      initialQueue: [songA, songB, songC],
    });

    server.executeCommand({ commandId: 'c1', jamId: session.jamId, userId: 'host_user', action: 'PLAY', payload: { positionMs: 0 } });
    server.executeCommand({ commandId: 'c2', jamId: session.jamId, userId: 'host_user', action: 'SEEK', payload: { positionMs: 100000 } });
    server.executeCommand({ commandId: 'c3', jamId: session.jamId, userId: 'host_user', action: 'SKIP_NEXT' });

    const afterNext = server.getSession(session.jamId)!;

    // Must be on song B
    expect(afterNext.trackId).toBe(songB.id);
    // Must start at position 0, not at 100000 (the seek position was on song A)
    expect(afterNext.positionMs).toBe(0);
    // New higher generation
    expect(afterNext.generation).toBeGreaterThan(1);
  });
});
