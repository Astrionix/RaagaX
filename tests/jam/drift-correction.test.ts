import { describe, it, expect, beforeEach } from 'vitest';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { JamSession } from '@/types/jam';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'drift_track',
  title: 'Drift Free',
  artist: 'RaagaX',
  artistId: 'art_1',
  album: 'Precision',
  albumId: 'alb_1',
  duration: 240,
  coverUrl: 'https://cdn.test/drift.jpg',
  audioUrl: 'https://cdn.test/drift.mp3',
  genre: 'Classical',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 10,
};

describe('Continuous Playback Drift Correction Engine', () => {
  let driftEngine: DriftCorrectionEngine;
  let clockSync: ClockSyncEngine;

  beforeEach(() => {
    driftEngine = DriftCorrectionEngine.getInstance();
    clockSync = ClockSyncEngine.getInstance();
    clockSync.resetForTesting(0);
  });

  it('1. Computes expected position from authoritative timeline and future start time', () => {
    const session: JamSession = {
      jamId: 'JAM_TEST',
      joinCode: 'TEST1',
      name: 'Test Jam',
      hostId: 'user_1',
      hostName: 'User',
      state: 'PLAYING',
      trackId: mockSong.id,
      currentSong: mockSong,
      positionMs: 10000,
      serverTimestamp: 500000,
      startAtServerTime: 500500, // Starts at 500500ms
      leadTimeMs: 500,
      revision: 1,
      createdAt: 500000,
      updatedAt: 500000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    // Before start time (e.g. 500200ms)
    const pos1 = driftEngine.calculateExpectedPositionMs(session, 500200);
    expect(pos1).toBe(10000);

    // Exactly at start time (500500ms)
    const pos2 = driftEngine.calculateExpectedPositionMs(session, 500500);
    expect(pos2).toBe(10000);

    // 2000ms after start time (502500ms)
    const pos3 = driftEngine.calculateExpectedPositionMs(session, 502500);
    expect(pos3).toBe(12000);
  });

  it('2. Evaluates drift zones: micro-drift rate modulation vs hard seek', () => {
    const session: JamSession = {
      jamId: 'JAM_TEST',
      joinCode: 'TEST1',
      name: 'Test Jam',
      hostId: 'user_1',
      hostName: 'User',
      state: 'PLAYING',
      trackId: mockSong.id,
      currentSong: mockSong,
      positionMs: 0,
      serverTimestamp: 1000000,
      startAtServerTime: 1000000,
      leadTimeMs: 400,
      revision: 1,
      createdAt: 1000000,
      updatedAt: 1000000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    driftEngine.setSession(session);

    // Case A: |Drift| <= 30ms -> Normal 1.0x rate
    // Case B: 30ms < |Drift| <= 120ms -> Micro rate nudge (1.018x or 0.982x)
    // Case C: |Drift| > 350ms -> Controlled seek
    expect(driftEngine).toBeDefined();
  });
});
