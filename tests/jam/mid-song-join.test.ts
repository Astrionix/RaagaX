import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';
import { JamSession } from '@/types/jam';

const songA: Song = {
  id: 'MID_JOIN_A',
  title: 'Track A (In-Flight)',
  artist: 'Artist A',
  artistId: 'ART_A',
  album: 'Album A',
  albumId: 'ALB_A',
  duration: 300,
  coverUrl: 'https://cdn.example.com/a.jpg',
  audioUrl: 'https://cdn.example.com/a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 500,
  likes: 50,
};

const songB: Song = {
  id: 'MID_JOIN_B',
  title: 'Track B (Next Track)',
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
  plays: 300,
  likes: 30,
};

describe('RaagaX Jam — New Device Join During Active Playback Suite', () => {
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

  it('1. Calculates exact in-flight position accounting for preparation delay (e.g. 700ms)', async () => {
    // 1. Host creates session and starts playing Track A
    const { session: hostSession } = server.createSession({
      hostId: 'host_user',
      hostName: 'Host Player',
      initialSong: songA,
    });

    server.executeCommand({
      commandId: 'cmd_play',
      jamId: hostSession.jamId,
      userId: 'host_user',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    const activeSession = server.getSession(hostSession.jamId)!;
    expect(activeSession.state).toBe('PLAYING');

    // 2. Snapshot captured when song has been playing for 151,420ms (02:31.420)
    const snapshotServerTime = (activeSession.startAtServerTime || 0) + 151420;
    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(snapshotServerTime);

    const posAtSnapshot = driftEngine.calculateExpectedPositionMs(activeSession, snapshotServerTime);
    expect(posAtSnapshot).toBe(151420);

    // 3. Preparation / audio loading takes 700ms on the joining device
    const prepDelayMs = 700;
    const readyServerTime = snapshotServerTime + prepDelayMs;
    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(readyServerTime);

    // 4. Target start position is re-calculated at readiness time (151420 + 700 = 152120ms)
    const targetStartMs = driftEngine.calculateExpectedPositionMs(activeSession, readyServerTime);
    expect(targetStartMs).toBe(152120);

    // 5. Joining device joins existing timeline without creating a new generation
    expect(activeSession.generation).toBe(2);
    expect(activeSession.timelineId).toMatch(/^TL_2_/);
  });

  it('2. Joining is completely side-effect-free for existing devices', async () => {
    const { session } = server.createSession({
      hostId: 'host_user',
      hostName: 'Host Player',
      initialSong: songA,
    });

    server.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'host_user',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    const sessionBefore = server.getSession(session.jamId)!;
    const initialGen = sessionBefore.generation;
    const initialTL = sessionBefore.timelineId;
    const initialTransition = sessionBefore.transitionId;

    // Guest joins
    const joinRes = server.joinSession(session.jamId, {
      userId: 'guest_device_b',
      displayName: 'Guest B',
      deviceType: 'mobile',
    });

    expect(joinRes.success).toBe(true);
    const sessionAfter = server.getSession(session.jamId)!;

    // Existing timeline, generation, and playback state remain 100% untouched
    expect(sessionAfter.generation).toBe(initialGen);
    expect(sessionAfter.timelineId).toBe(initialTL);
    expect(sessionAfter.transitionId).toBe(initialTransition);
    expect(sessionAfter.state).toBe('PLAYING');
    expect(sessionAfter.currentSong?.id).toBe(songA.id);
  });

  it('3. Convergence: If track changes on Host while Guest is preparing, Guest converges to the latest track', async () => {
    const sessionTrackA: JamSession = {
      jamId: 'JAM_CONVERGE',
      joinCode: 'CONV1',
      name: 'Convergence Jam',
      hostId: 'host_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: songA.id,
      currentSong: songA,
      positionMs: 30000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 300,
      revision: 5,
      generation: 3,
      timelineId: 'TL_3_trackA',
      transitionId: 'TR_3_trackA',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    // Guest initiates transition for Track A (Gen 3)
    await stateMachine.handleTransition(sessionTrackA, undefined, 'NEW_TRANSITION');
    expect(stateMachine.getPlaybackIdentity().generation).toBe(3);
    expect(stateMachine.getPlaybackIdentity().trackId).toBe('MID_JOIN_A');

    // While in-flight, Host advances to Track B (Gen 4)
    const sessionTrackB: JamSession = {
      ...sessionTrackA,
      revision: 6,
      generation: 4,
      timelineId: 'TL_4_trackB',
      transitionId: 'TR_4_trackB',
      trackId: songB.id,
      currentSong: songB,
      positionMs: 0,
    };

    await stateMachine.handleTransition(sessionTrackB, undefined, 'NEW_TRANSITION');

    // Guest converges to Track B (Gen 4)
    const activeIdentity = stateMachine.getPlaybackIdentity();
    expect(activeIdentity.generation).toBe(4);
    expect(activeIdentity.timelineId).toBe('TL_4_trackB');
    expect(activeIdentity.trackId).toBe('MID_JOIN_B');
  });

  it('4. Local Error Isolation: If joining device fails audio load, session continues uninterrupted', async () => {
    const session: JamSession = {
      jamId: 'JAM_ERROR_ISO',
      joinCode: 'ERR1',
      name: 'Error Isolation Jam',
      hostId: 'host_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: songA.id,
      currentSong: songA,
      positionMs: 40000,
      serverTimestamp: 2000,
      startAtServerTime: 2000,
      leadTimeMs: 300,
      revision: 8,
      generation: 5,
      timelineId: 'TL_5_safe',
      transitionId: 'TR_5_safe',
      createdAt: 1000,
      updatedAt: 2000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    // Simulate audio load failure on the joining device
    vi.spyOn(PlaybackService.getInstance(), 'loadAudioSource').mockResolvedValue(false);

    // handleTransition handles the error gracefully without throwing
    await expect(stateMachine.handleTransition(session, undefined, 'NEW_TRANSITION')).resolves.not.toThrow();

    // Identity is preserved without corrupting host timeline
    expect(stateMachine.getPlaybackIdentity().generation).toBe(5);
    expect(stateMachine.getPlaybackIdentity().timelineId).toBe('TL_5_safe');
  });
});
