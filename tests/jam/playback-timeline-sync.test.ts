import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'song_sync',
  title: 'In Sync',
  artist: 'RaagaX Band',
  artistId: 'art_1',
  album: 'Sync Album',
  albumId: 'alb_1',
  duration: 300,
  coverUrl: 'https://cdn.test/sync.jpg',
  audioUrl: 'https://cdn.test/sync.mp3',
  genre: 'Acoustic',
  category: 'melody',
  releaseYear: 2024,
  plays: 1000,
  likes: 50,
};

describe('Authoritative Playback Timeline & Future Start Scheduling', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('1. Schedules PLAY command with future authoritative timestamp startAtServerTime', () => {
    const { session } = engine.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSong,
    });

    const now = Date.now();
    const playRes = engine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'host_1',
      action: 'PLAY',
      payload: { positionMs: 0 },
    });

    expect(playRes.success).toBe(true);
    const updated = playRes.session!;

    expect(updated.state).toBe('PLAYING');
    // Future execution startAtServerTime must be >= serverNow + leadTime (min 300ms)
    expect(updated.startAtServerTime).toBeGreaterThanOrEqual(now + 300);
    expect(updated.leadTimeMs).toBeGreaterThanOrEqual(300);
    expect(updated.positionMs).toBe(0);
  });

  it('2. Dynamically adapts lead time buffer when participants with high RTT join', () => {
    const { session } = engine.createSession({
      hostId: 'host_1',
      hostName: 'Host India (20ms RTT)',
      initialSong: mockSong,
    });

    const leadTime1 = engine.computeAdaptiveLeadTime(session);
    expect(leadTime1).toBeLessThanOrEqual(450);

    // Participant from US with 280ms RTT joins
    engine.joinSession(session.jamId, {
      userId: 'user_usa',
      displayName: 'User USA',
    });

    const updatedSession = engine.getSession(session.jamId)!;
    updatedSession.participants['user_usa'].rttMs = 280;

    const leadTime2 = engine.computeAdaptiveLeadTime(updatedSession);
    // Lead time must expand to accommodate high latency participant: 280 * 1.5 + 200 = 620ms
    expect(leadTime2).toBeGreaterThanOrEqual(600);
  });

  it('3. Computes exact authoritative elapsed position when playing vs paused', () => {
    const { session } = engine.createSession({
      hostId: 'host_1',
      hostName: 'Host User',
      initialSong: mockSong,
    });

    const startServerTime = 1000000;
    session.state = 'PLAYING';
    session.positionMs = 15000; // 15 seconds anchor
    session.startAtServerTime = startServerTime;

    // Case A: Before startAtServerTime (in lead-in buffer) -> remains at 15000ms
    const posBefore = engine.calculateCurrentAuthoritativePosition(session, 999800);
    expect(posBefore).toBe(15000);

    // Case B: Exactly at startAtServerTime -> 15000ms
    const posAt = engine.calculateCurrentAuthoritativePosition(session, 1000000);
    expect(posAt).toBe(15000);

    // Case C: 3500ms after startAtServerTime -> 15000 + 3500 = 18500ms
    const posAfter = engine.calculateCurrentAuthoritativePosition(session, 1003500);
    expect(posAfter).toBe(18500);

    // Case D: In PAUSED state -> returns fixed positionMs regardless of time
    session.state = 'PAUSED';
    session.positionMs = 42000;
    const posPaused = engine.calculateCurrentAuthoritativePosition(session, 1050000);
    expect(posPaused).toBe(42000);
  });
});
