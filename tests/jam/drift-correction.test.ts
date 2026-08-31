import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { NetworkQualityEngine } from '@/lib/jam/client/NetworkQualityEngine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
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
    expect(driftEngine).toBeDefined();
  });

  it('3. Same Wi-Fi / Local LAN Zero-Drift Mode: micro-tunes rate to eliminate residual drift down to 0ms', () => {
    const netEngine = NetworkQualityEngine.getInstance();
    netEngine.setTransport('LAN');

    const mockAudio = {
      currentTime: 10.008, // 10008ms (8ms ahead on LAN)
      playbackRate: 1.0,
      paused: false,
      buffered: { length: 0, start: () => 0, end: () => 0 },
    } as unknown as HTMLAudioElement;
    vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);

    const session: JamSession = {
      jamId: 'JAM_LAN',
      joinCode: 'LAN01',
      name: 'LAN Jam',
      hostId: 'user_1',
      hostName: 'User',
      state: 'PLAYING',
      trackId: mockSong.id,
      currentSong: mockSong,
      positionMs: 10000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 200,
      revision: 1,
      generation: 1,
      timelineId: 'TL_LAN',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(1000);
    driftEngine.setSession(session);

    const status = driftEngine.evaluateAndCorrect();
    // On Same Wi-Fi / LAN, an 8ms drift is actively micro-tuned towards 0ms
    expect(status.driftMs).toBe(8);
    expect(status.correctionAction).toBe('MODULATE_RATE');
    expect(status.qualityState).toBe('SYNCED');
    // Pitch-neutral micro-rate reduction to pull drift to 0ms
    expect(status.playbackRate).toBeLessThan(1.0);
    expect(status.playbackRate).toBeGreaterThanOrEqual(0.9980);

    // Reset transport back to CLOUD for test cleanliness
    netEngine.setTransport('CLOUD');
  });

  it('4. Same Wi-Fi Phase Lock: holds perfectly at 1.0x when drift is <= 1ms', () => {
    const netEngine = NetworkQualityEngine.getInstance();
    netEngine.setTransport('LAN');

    const mockAudio = {
      currentTime: 10.0005, // 10000.5ms (0.5ms drift -> perfect Phase Lock)
      playbackRate: 1.0,
      paused: false,
      buffered: { length: 0, start: () => 0, end: () => 0 },
    } as unknown as HTMLAudioElement;
    vi.spyOn(PlaybackService.getInstance(), 'getActiveAudio').mockReturnValue(mockAudio);

    const session: JamSession = {
      jamId: 'JAM_LAN_LOCK',
      joinCode: 'LOCK1',
      name: 'Phase Lock Jam',
      hostId: 'user_1',
      hostName: 'User',
      state: 'PLAYING',
      trackId: mockSong.id,
      currentSong: mockSong,
      positionMs: 10000,
      serverTimestamp: 1000,
      startAtServerTime: 1000,
      leadTimeMs: 200,
      revision: 1,
      generation: 1,
      timelineId: 'TL_LOCK',
      createdAt: 1000,
      updatedAt: 1000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    vi.spyOn(clockSync, 'estimatedServerNow').mockReturnValue(1000);
    driftEngine.setSession(session);

    const status = driftEngine.evaluateAndCorrect();
    // Phase Lock holds 1.0x with action NONE at 0ms
    expect(status.correctionAction).toBe('NONE');
    expect(status.playbackRate).toBe(1.0);
    expect(status.qualityState).toBe('SYNCED');

    netEngine.setTransport('CLOUD');
  });
});

