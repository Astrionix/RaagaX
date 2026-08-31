import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'song_seek_1',
  title: 'Synchronized Anthem',
  artist: 'RaagaX Master',
  artistId: 'art_master',
  album: 'Synchronized Hits',
  albumId: 'alb_hits',
  duration: 300, // 5 minutes (300,000 ms)
  audioUrl: 'https://cdn.example.com/anthem.mp4',
  coverUrl: 'https://cdn.example.com/anthem.jpg',
  genre: 'Rock',
  category: 'melody',
  releaseYear: 2024,
  plays: 500,
  likes: 100,
};

describe('RaagaX Jam — Synchronized Seek-Bar Dragging Suite', () => {
  let serverEngine: JamServerEngine;

  beforeEach(() => {
    serverEngine = JamServerEngine.getInstance();
  });

  it('1. Single Authoritative SEEK Commit: Releasing seek bar commits target position and creates new timeline', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_user_1',
      hostName: 'Host User',
      initialSong: mockSong,
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'guest_user_2',
      displayName: 'Guest User',
      deviceType: 'mobile',
    });

    // Start playing
    serverEngine.executeCommand({
      commandId: 'cmd_play',
      jamId: session.jamId,
      userId: 'host_user_1',
      action: 'PLAY',
      payload: { positionMs: 15000 },
    });

    // Host drags seek bar to 2:30 (150,000 ms) and releases
    const seekResult = serverEngine.executeCommand({
      commandId: 'cmd_seek_1',
      jamId: session.jamId,
      userId: 'host_user_1',
      action: 'SEEK',
      payload: { positionMs: 150000 },
      requestId: 'req_seek_commit_150',
    });

    expect(seekResult.success).toBe(true);
    const updatedSession = seekResult.session!;

    expect(updatedSession.positionMs).toBe(150000);
    expect(updatedSession.state).toBe('PLAYING');
    expect(seekResult.event?.payload.timelineId).toBeDefined();
    expect(seekResult.event?.payload.timelineId).toMatch(/^TL_/);

    // Verify all clients calculate identical target position
    const driftEngine = DriftCorrectionEngine.getInstance();
    const futureServerTime = updatedSession.startAtServerTime + 5000;
    const expectedPos = driftEngine.calculateExpectedPositionMs(updatedSession, futureServerTime);

    expect(expectedPos).toBe(155000);
  });

  it('2. Seek While Paused Invariant: Seeking while paused preserves PAUSED state on all devices', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_user_paused',
      hostName: 'Host Paused',
      initialSong: mockSong,
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'guest_user_paused',
      displayName: 'Guest Paused',
    });

    // Paused at 0s. Host seeks to 90s
    const seekResult = serverEngine.executeCommand({
      commandId: 'cmd_seek_paused',
      jamId: session.jamId,
      userId: 'host_user_paused',
      action: 'SEEK',
      payload: { positionMs: 90000 },
    });

    expect(seekResult.success).toBe(true);
    const updatedSession = seekResult.session!;

    expect(updatedSession.state).toBe('PAUSED');
    expect(updatedSession.positionMs).toBe(90000);

    const driftEngine = DriftCorrectionEngine.getInstance();
    // At any future server time, expected position must stay exactly 90,000ms
    const expectedPos = driftEngine.calculateExpectedPositionMs(updatedSession, Date.now() + 60000);
    expect(expectedPos).toBe(90000);
  });

  it('3. Permission Enforcement: HostControlled preset blocks guest seeking', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_strict',
      hostName: 'Strict Host',
      initialSong: mockSong,
    });

    serverEngine.joinSession(session.jamId, {
      userId: 'guest_strict',
      displayName: 'Strict Guest',
    });

    // Set permission preset to HOST_CONTROLLED
    serverEngine.executeCommand({
      commandId: 'cmd_preset',
      jamId: session.jamId,
      userId: 'host_strict',
      action: 'SET_PRESET',
      payload: { presetName: 'HOST_CONTROLLED' },
    });

    // Guest tries to seek
    const guestSeekResult = serverEngine.executeCommand({
      commandId: 'cmd_guest_seek',
      jamId: session.jamId,
      userId: 'guest_strict',
      action: 'SEEK',
      payload: { positionMs: 45000 },
    });

    expect(guestSeekResult.success).toBe(false);
    expect(guestSeekResult.error).toContain('disabled');
  });

  it('4. Boundary Clamping: Seeking beyond duration clamps to track duration; negative clamps to 0', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_clamp',
      hostName: 'Clamp Host',
      initialSong: mockSong, // 300s (300,000ms)
    });

    // Seek beyond duration (500s)
    const overSeek = serverEngine.executeCommand({
      commandId: 'cmd_over',
      jamId: session.jamId,
      userId: 'host_clamp',
      action: 'SEEK',
      payload: { positionMs: 500000 },
    });

    expect(overSeek.success).toBe(true);
    expect(overSeek.session!.positionMs).toBe(300000);

    // Seek negative (-50s)
    const underSeek = serverEngine.executeCommand({
      commandId: 'cmd_under',
      jamId: session.jamId,
      userId: 'host_clamp',
      action: 'SEEK',
      payload: { positionMs: -50000 },
    });

    expect(underSeek.success).toBe(true);
    expect(underSeek.session!.positionMs).toBe(0);
  });

  it('5. Rapid Consecutive Seeks: Monotonic revision increments and latest timeline wins', () => {
    const { session } = serverEngine.createSession({
      hostId: 'host_rapid',
      hostName: 'Rapid Host',
      initialSong: mockSong,
    });

    const rev0 = session.revision;

    serverEngine.executeCommand({
      commandId: 's1',
      jamId: session.jamId,
      userId: 'host_rapid',
      action: 'SEEK',
      payload: { positionMs: 30000 },
    });

    serverEngine.executeCommand({
      commandId: 's2',
      jamId: session.jamId,
      userId: 'host_rapid',
      action: 'SEEK',
      payload: { positionMs: 60000 },
    });

    const finalSeek = serverEngine.executeCommand({
      commandId: 's3',
      jamId: session.jamId,
      userId: 'host_rapid',
      action: 'SEEK',
      payload: { positionMs: 120000 },
    });

    expect(finalSeek.session!.positionMs).toBe(120000);
    expect(finalSeek.session!.revision).toBe(rev0 + 3);
  });
});
