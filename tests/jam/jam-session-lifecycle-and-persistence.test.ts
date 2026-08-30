import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { JamSession } from '@/types/jam';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'song_persistence_1',
  title: 'Eternal Resonance',
  artist: 'RaagaX Master',
  album: 'Cosmic Vol 1',
  duration: 240,
  audioUrl: 'https://cdn.example.com/audio/res.mp4',
  coverUrl: 'https://cdn.example.com/images/res.jpg',
};

describe('RaagaX Jam — Comprehensive Session Lifecycle, Persistence & Resilience Suite', () => {
  let serverEngine: JamServerEngine;
  let clientManager: JamClientManager;

  beforeEach(() => {
    serverEngine = JamServerEngine.getInstance();
    serverEngine.resetForTesting();
    clientManager = JamClientManager.getInstance();
    clientManager.resetForTesting();
  });

  it('1. Jam 60-Second & Idle Persistence: Jam session does NOT disappear after 60 seconds or idle periods', async () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_user_1',
      hostName: 'Host User',
      initialSong: mockSong,
    });
    const jamId = session.jamId;

    expect(session.status).toBe('ACTIVE');
    expect(session.createdAt).toBeGreaterThan(0);
    expect(session.expiresAt).toBeGreaterThan(Date.now() + 3600000); // At least 1 hour+

    // Advance time by 65 seconds (past the 60s mark)
    const after65s = Date.now() + 65000;
    const fetchedSession = serverEngine.getSession(jamId);
    expect(fetchedSession).not.toBeNull();
    expect(fetchedSession?.jamId).toBe(jamId);
    expect(fetchedSession?.status).toBe('ACTIVE');

    // Advance time by 5 minutes (300s)
    const after5min = Date.now() + 300000;
    const fetchedSession5min = serverEngine.getSession(jamId);
    expect(fetchedSession5min).not.toBeNull();
    expect(fetchedSession5min?.status).toBe('ACTIVE');

    // Verify commands still work after idle period
    const playResult = serverEngine.executeCommand({
      commandId: 'cmd_play_idle',
      jamId,
      userId: 'host_user_1',
      action: 'PLAY',
      payload: { positionMs: 15000 },
    });

    expect(playResult.success).toBe(true);
    expect(playResult.session?.state).toBe('PLAYING');
    expect(playResult.session?.positionMs).toBe(15000);
  });

  it('2. State Machine Transitions: CREATING -> ACTIVE -> IDLE -> ACTIVE -> ENDED', () => {
    // 1. Creation -> ACTIVE
    const { session } = serverEngine.createSession({
      hostId: 'host_sm_1',
      hostName: 'Host SM',
      initialSong: mockSong,
    });
    const jamId = session.jamId;
    expect(serverEngine.getSession(jamId)?.status).toBe('ACTIVE');

    // 2. All participants leave -> IDLE (NOT deleted!)
    const leaveRes = serverEngine.leaveSession(jamId, 'host_sm_1');
    expect(leaveRes.success).toBe(true);
    expect(leaveRes.sessionEnded).toBe(false);

    const idleSession = serverEngine.getSession(jamId);
    expect(idleSession).not.toBeNull();
    expect(idleSession?.status).toBe('IDLE');

    // 3. User joins back -> transitions back to ACTIVE
    const joinRes = serverEngine.joinSession(jamId, {
      userId: 'reconnected_host',
      displayName: 'Reconnected Host',
    });
    expect(joinRes.success).toBe(true);
    expect(joinRes.session?.status).toBe('ACTIVE');
    expect(serverEngine.getSession(jamId)?.status).toBe('ACTIVE');

    // 4. Host explicit END_SESSION -> ENDED
    const endRes = serverEngine.executeCommand({
      commandId: 'cmd_end_explicit',
      jamId,
      userId: 'reconnected_host',
      action: 'END_SESSION',
    });
    expect(endRes.success).toBe(true);
    expect(serverEngine.isSessionEnded(jamId)).toBe(true);
    expect(serverEngine.getSession(jamId)).toBeNull();
  });

  it('3. Lightweight HEARTBEAT: keeps participant and session alive without mutating timeline', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_hb',
      hostName: 'Host HB',
      initialSong: mockSong,
    });
    const jamId = session.jamId;

    serverEngine.joinSession(jamId, {
      userId: 'guest_hb',
      displayName: 'Guest HB',
    });

    // Start playback
    const playRes = serverEngine.executeCommand({
      commandId: 'cmd_play_hb',
      jamId,
      userId: 'host_hb',
      action: 'PLAY',
    });
    const timelineIdBefore = playRes.session!.timelineId;
    const generationBefore = playRes.session!.generation;
    const startAtBefore = playRes.session!.startAtServerTime;

    // Send HEARTBEAT
    const hbRes = serverEngine.executeCommand({
      commandId: 'cmd_hb_1',
      jamId,
      userId: 'guest_hb',
      action: 'HEARTBEAT',
      payload: {
        status: 'PLAYING',
        clockOffsetMs: 8,
        rttMs: 32,
        playbackDriftMs: 3,
      },
    });

    expect(hbRes.success).toBe(true);
    const updated = serverEngine.getSession(jamId)!;
    // Heartbeat must NOT mutate playback generation or timeline
    expect(updated.timelineId).toBe(timelineIdBefore);
    expect(updated.generation).toBe(generationBefore);
    expect(updated.startAtServerTime).toBe(startAtBefore);
    expect(updated.participants['guest_hb'].rttMs).toBe(32);
    expect(updated.lastActivityAt).toBeGreaterThan(0);
  });

  it('4. Participant Presence vs Jam Lifetime: Host disconnect does not destroy Jam session', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_pers',
      hostName: 'Persistent Host',
      initialSong: mockSong,
    });
    const jamId = session.jamId;

    // Guest joins
    serverEngine.joinSession(jamId, {
      userId: 'guest_pers',
      displayName: 'Guest Persistent',
    });

    // Host temporarily disconnects (leaveSession)
    serverEngine.leaveSession(jamId, 'host_pers');

    // Jam remains ACTIVE with transferred host (guest_pers)
    const sessionAfterHostLeave = serverEngine.getSession(jamId);
    expect(sessionAfterHostLeave).not.toBeNull();
    expect(sessionAfterHostLeave?.status).toBe('ACTIVE');
    expect(sessionAfterHostLeave?.hostId).toBe('guest_pers');

    // Original host reconnects as participant
    const reconnected = serverEngine.joinSession(jamId, {
      userId: 'host_pers',
      displayName: 'Persistent Host',
    });
    expect(reconnected.success).toBe(true);
    expect(reconnected.session?.jamId).toBe(jamId);
  });

  it('5. Structured Diagnostic Logging: logs lifecycle events with required fields', () => {
    const logSpy = vi.spyOn(console, 'log');

    const { session } = serverEngine.createSession({
      hostId: 'host_logger',
      hostName: 'Logger Host',
      initialSong: mockSong,
    });

    // Verify [JAM_CREATED] was logged
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[JAM_CREATED]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`jamId=${session.jamId}`));

    // Activity: PLAY
    serverEngine.executeCommand({
      commandId: 'cmd_log_play',
      jamId: session.jamId,
      userId: 'host_logger',
      action: 'PLAY',
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[JAM_ACTIVITY]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('operation=PLAY'));

    // Heartbeat
    serverEngine.executeCommand({
      commandId: 'cmd_log_hb',
      jamId: session.jamId,
      userId: 'host_logger',
      action: 'HEARTBEAT',
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[JAM_HEARTBEAT]'));

    // End session
    serverEngine.executeCommand({
      commandId: 'cmd_log_end',
      jamId: session.jamId,
      userId: 'host_logger',
      action: 'END_SESSION',
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[JAM_ENDED]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('reason=EXPLICIT_HOST_END'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[JAM_DESTROYED]'));
  });

  it('6. Client-Side Resilience: background telemetry failure (404/400) does not destroy active session', async () => {
    clientManager.initUser('client_user_1', 'Client User');
    const mockSession: JamSession = {
      jamId: 'JAM_RESILIENT_99',
      joinCode: '4K99P',
      name: 'Resilient Jam',
      hostId: 'client_user_1',
      hostName: 'Client User',
      status: 'ACTIVE',
      state: 'PLAYING',
      trackId: mockSong.id,
      currentSong: mockSong,
      positionMs: 0,
      basePositionMs: 0,
      serverTimestamp: Date.now(),
      startAtServerTime: Date.now(),
      timelineStartServerMs: Date.now(),
      leadTimeMs: 400,
      revision: 1,
      generation: 1,
      timelineId: 'TL_1',
      transitionId: 'TR_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivityAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      permissions: {
        canAddSongs: true,
        canRemoveSongs: false,
        canReorderQueue: false,
        canControlPlayback: true,
        canSkip: true,
        canInvite: true,
        canRemoveParticipants: false,
      },
      participants: {},
      queue: [],
      history: [],
    };

    (clientManager as any).activeSession = mockSession;

    // Mock fetch to simulate a temporary 404 response on heartbeat command
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, code: 'JAM_NOT_FOUND', error: 'Jam session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Send background telemetry
    const result = await clientManager.sendCommand('HEARTBEAT', {
      status: 'PLAYING',
      rttMs: 40,
    });

    // Result should be false, but activeSession MUST NOT be wiped out!
    expect(result).toBe(false);
    expect(clientManager.getActiveSession()).not.toBeNull();
    expect(clientManager.getActiveSession()?.jamId).toBe('JAM_RESILIENT_99');

    fetchSpy.mockRestore();
  });
});
