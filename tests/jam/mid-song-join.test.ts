import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const playingSong: Song = {
  id: 'MID_JOIN_SONG',
  title: 'Mid-Song Join Anthem',
  artist: 'RaagaX Crew',
  artistId: 'ART_JAM',
  album: 'Jam Sessions',
  albumId: 'ALB_JAM',
  duration: 300,
  coverUrl: 'https://cdn.example.com/jam.jpg',
  audioUrl: 'https://cdn.example.com/jam.mp3',
  genre: 'Electronic',
  category: 'melody',
  releaseYear: 2024,
  plays: 500,
  likes: 50,
};

describe('RaagaX Jam — Mid-Song Device Joining Suite', () => {
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

  it('calculates the exact in-flight millisecond position when a new device joins mid-playback', async () => {
    const t0 = 1000000;
    // 1. Host starts Jam session and begins playing
    const { session: hostSession } = server.createSession({
      hostId: 'host_user',
      hostName: 'Host Player',
      initialSong: playingSong,
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

    // 2. Simulate 45.5 seconds of song playback having elapsed
    const elapsedMs = 45500;
    const nowServer = (activeSession.startAtServerTime || 0) + elapsedMs;

    // 3. New guest device joins the session
    const joinResult = server.joinSession(hostSession.jamId, {
      userId: 'guest_device_2',
      displayName: 'Guest Mobile',
      deviceType: 'mobile',
    });

    expect(joinResult.success).toBe(true);
    const guestReceivedSession = joinResult.session!;

    // 4. Guest runs ClockSync and calculates in-flight position
    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(nowServer);

    const expectedPosMs = driftEngine.calculateExpectedPositionMs(guestReceivedSession, nowServer);
    
    // Expected position must match exactly 45.5s (45500ms)
    expect(expectedPosMs).toBe(45500);

    // 5. Interpolated position helper also produces 45.5s
    const interpolatedSec = stateMachine.getInterpolatedPosition(guestReceivedSession);
    expect(interpolatedSec).toBeCloseTo(45.5, 1);
  });

  it('joining device does not reset playback to 0 and host session continues undisturbed', async () => {
    const { session } = server.createSession({
      hostId: 'host_user',
      hostName: 'Host Player',
      initialSong: playingSong,
    });

    server.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'host_user',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    const initialGen = server.getSession(session.jamId)!.generation;
    const initialTL = server.getSession(session.jamId)!.timelineId;

    // Guest joins
    server.joinSession(session.jamId, {
      userId: 'guest_user',
      displayName: 'Guest',
      deviceType: 'web',
    });

    const sessionAfterGuest = server.getSession(session.jamId)!;

    // Generation and timeline must remain identical so Host does NOT restart audio
    expect(sessionAfterGuest.generation).toBe(initialGen);
    expect(sessionAfterGuest.timelineId).toBe(initialTL);
    expect(sessionAfterGuest.state).toBe('PLAYING');
  });
});
