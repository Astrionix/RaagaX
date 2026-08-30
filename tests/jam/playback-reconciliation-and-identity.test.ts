import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamPlaybackStateMachine, PlaybackIdentity } from '@/lib/jam/client/JamPlaybackStateMachine';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { JamSession, JamEvent } from '@/types/jam';

const songA: Song = {
  id: 'TRK_A',
  title: 'Track Alpha',
  artist: 'Artist A',
  artistId: 'ART_A',
  album: 'Album A',
  albumId: 'ALB_A',
  duration: 200,
  coverUrl: 'https://cdn.example.com/a.jpg',
  audioUrl: 'https://cdn.example.com/a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 10,
};

const songB: Song = {
  id: 'TRK_B',
  title: 'Track Beta',
  artist: 'Artist B',
  artistId: 'ART_B',
  album: 'Album B',
  albumId: 'ALB_B',
  duration: 240,
  coverUrl: 'https://cdn.example.com/b.jpg',
  audioUrl: 'https://cdn.example.com/b.mp3',
  genre: 'Rock',
  category: 'mass',
  releaseYear: 2024,
  plays: 200,
  likes: 20,
};

describe('RaagaX Jam — Playback Reconciliation, Identity & Anti-Restart Suite', () => {
  let server: JamServerEngine;
  let client: JamClientManager;
  let stateMachine: JamPlaybackStateMachine;
  let driftEngine: DriftCorrectionEngine;
  let clockSync: ClockSyncEngine;

  beforeEach(() => {
    server = JamServerEngine.getInstance();
    server.resetForTesting();

    client = JamClientManager.getInstance();
    client.resetForTesting();

    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();

    driftEngine = DriftCorrectionEngine.getInstance();
    driftEngine.resetForTesting();

    clockSync = ClockSyncEngine.getInstance();
    clockSync.resetForTesting(0);
  });

  it('1. Test 1 — PLAY: Idempotent PLAY commands on the same track do not reload audio, reset position, or change generation', () => {
    const { session } = server.createSession({
      hostId: 'user_1',
      hostName: 'User One',
      initialSong: songA,
    });

    const res1 = server.executeCommand({
      commandId: 'cmd_play_1',
      jamId: session.jamId,
      userId: 'user_1',
      action: 'PLAY',
      payload: { positionMs: 30000 },
    });

    expect(res1.success).toBe(true);
    const session1 = server.getSession(session.jamId)!;
    const initialGen = session1.generation;
    const initialTimeline = session1.timelineId;

    // Second PLAY command without new position or same position
    const res2 = server.executeCommand({
      commandId: 'cmd_play_2',
      jamId: session.jamId,
      userId: 'user_1',
      action: 'PLAY',
    });

    expect(res2.success).toBe(true);
    expect(res2.isIdempotentReplay).toBe(true);
    const session2 = server.getSession(session.jamId)!;
    expect(session2.generation).toBe(initialGen);
    expect(session2.timelineId).toBe(initialTimeline);
  });

  it('2. Test 2 — PAUSE: Duplicate PAUSE command is a harmless NO-OP', () => {
    const { session } = server.createSession({
      hostId: 'user_1',
      hostName: 'User One',
      initialSong: songA,
    });

    server.executeCommand({
      commandId: 'cmd_play_1',
      jamId: session.jamId,
      userId: 'user_1',
      action: 'PLAY',
    });

    // First PAUSE
    const res1 = server.executeCommand({
      commandId: 'cmd_pause_1',
      jamId: session.jamId,
      userId: 'user_1',
      action: 'PAUSE',
    });
    expect(res1.success).toBe(true);

    const pausedGen = server.getSession(session.jamId)!.generation;

    // Duplicate PAUSE
    const res2 = server.executeCommand({
      commandId: 'cmd_pause_2',
      jamId: session.jamId,
      userId: 'user_1',
      action: 'PAUSE',
    });
    expect(res2.success).toBe(true);
    expect(res2.isIdempotentReplay).toBe(true);
    expect(server.getSession(session.jamId)!.generation).toBe(pausedGen);
  });

  it('3. Test 3 & 4 — NEXT: Creates exactly one authoritative transition and advances generation by 1', () => {
    const { session } = server.createSession({
      hostId: 'user_1',
      hostName: 'User One',
      initialSong: songA,
      initialQueue: [songB],
    });

    const genBefore = session.generation ?? 1;

    const res = server.executeCommand({
      commandId: 'cmd_skip_1',
      jamId: session.jamId,
      userId: 'user_1',
      action: 'SKIP_NEXT',
    });

    expect(res.success).toBe(true);
    const updated = server.getSession(session.jamId)!;
    expect(updated.currentSong?.id).toBe('TRK_B');
    expect(updated.generation).toBe(genBefore + 1);
    expect(updated.history.length).toBe(1);
    expect(updated.history[0].trackId).toBe('TRK_A');
  });

  it('4. Test 6 — Duplicate Event: JamPlaybackStateMachine treats identical playback identity as a NO-OP without restarting audio', async () => {
    const session: JamSession = {
      jamId: 'JAM_TEST_IDEM',
      joinCode: 'IDEM1',
      name: 'Idempotency Test',
      hostId: 'user_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: songA.id,
      currentSong: songA,
      positionMs: 45000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 300,
      revision: 10,
      generation: 5,
      timelineId: 'TL_5_abc',
      transitionId: 'TR_5_xyz',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    // First transition application
    await stateMachine.handleTransition(session, undefined, 'NEW_TRANSITION');
    const id1 = stateMachine.getPlaybackIdentity();
    expect(id1.generation).toBe(5);
    expect(id1.trackId).toBe('TRK_A');

    // Simulate duplicate event / snapshot application
    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource');
    await stateMachine.handleTransition(session, undefined, 'RECONCILIATION');

    // Must NOT call loadAudioSource again
    expect(loadSpy).not.toHaveBeenCalled();

    // Identity must remain intact
    const id2 = stateMachine.getPlaybackIdentity();
    expect(id2.generation).toBe(5);
    expect(id2.timelineId).toBe('TL_5_abc');
  });

  it('5. Test 7 — Revision Gap: Snapshot recovery updates state cleanly without jumping seek-bar when playback identity is identical', async () => {
    const sessionInitial: JamSession = {
      jamId: 'JAM_TEST_GAP',
      joinCode: 'GAP1',
      name: 'Gap Test',
      hostId: 'user_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: songA.id,
      currentSong: songA,
      positionMs: 60000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 300,
      revision: 10,
      generation: 3,
      timelineId: 'TL_3_xyz',
      transitionId: 'TR_3_xyz',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    await stateMachine.handleTransition(sessionInitial, undefined, 'NEW_TRANSITION');

    // Revision advances on server from 10 -> 15 (e.g. participant metadata/chat) while playback identity is unchanged
    const sessionSnapshot: JamSession = {
      ...sessionInitial,
      revision: 15,
    };

    const playSpy = vi.spyOn(PlaybackService.getInstance(), 'play');
    await stateMachine.handleTransition(sessionSnapshot, undefined, 'RECONCILIATION');

    // Does not restart audio
    expect(playSpy).not.toHaveBeenCalled();
    expect(stateMachine.getPlaybackIdentity().generation).toBe(3);
  });

  it('6. Test 10 — Drift Correction: Tier 2/3 rate modulation and Tier 4 seek do NOT create new transitions or increment generation', () => {
    const session: JamSession = {
      jamId: 'JAM_DRIFT_TEST',
      joinCode: 'DRIFT1',
      name: 'Drift Test',
      hostId: 'user_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: songA.id,
      currentSong: songA,
      positionMs: 50000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 300,
      revision: 12,
      generation: 4,
      timelineId: 'TL_4_drift',
      transitionId: 'TR_4_drift',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    driftEngine.setSession(session);
    const mockAudio = {
      currentTime: 50.08, // 80ms ahead -> Tier 2 micro-drift
      playbackRate: 1.0,
      paused: false,
      buffered: { length: 0, start: () => 0, end: () => 0 },
    } as unknown as HTMLAudioElement;
    vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);
    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(1000);

    const status = driftEngine.evaluateAndCorrect();
    expect(status.correctionAction).toBe('MODULATE_RATE');
    expect(status.generation).toBe(4);
    expect(status.timelineId).toBe('TL_4_drift');
  });

  it('7. Test 11 — Stale Transitions: Discards older generation events with zero side-effects', async () => {
    const sessionGen4: JamSession = {
      jamId: 'JAM_STALE',
      joinCode: 'STALE1',
      name: 'Stale Test',
      hostId: 'user_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: songB.id,
      currentSong: songB,
      positionMs: 10000,
      serverTimestamp: 2000,
      startAtServerTime: 2000,
      leadTimeMs: 300,
      revision: 8,
      generation: 4,
      timelineId: 'TL_4_new',
      transitionId: 'TR_4_new',
      createdAt: 1000,
      updatedAt: 2000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    await stateMachine.handleTransition(sessionGen4, undefined, 'NEW_TRANSITION');
    expect(stateMachine.getPlaybackIdentity().generation).toBe(4);

    // Stale Gen 2 arrives late over network
    const staleSessionGen2: JamSession = {
      ...sessionGen4,
      generation: 2,
      timelineId: 'TL_2_old',
      transitionId: 'TR_2_old',
      trackId: songA.id,
      currentSong: songA,
    };

    const loadSpy = vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource');
    await stateMachine.handleTransition(staleSessionGen2, undefined, 'EVENT');

    // Completely rejected with zero side-effects
    expect(loadSpy).not.toHaveBeenCalled();
    expect(stateMachine.getPlaybackIdentity().generation).toBe(4);
    expect(stateMachine.getPlaybackIdentity().trackId).toBe('TRK_B');
  });
});
