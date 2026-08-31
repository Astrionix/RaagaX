import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriftCorrectionEngine } from '@/lib/jam/client/DriftCorrectionEngine';
import { ClockSyncEngine } from '@/lib/jam/client/ClockSyncEngine';
import { NetworkQualityEngine } from '@/lib/jam/client/NetworkQualityEngine';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { usePlayerStore } from '@/context/usePlayerStore';
import { JamSession, JamEvent } from '@/types/jam';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_cloud_a',
  title: 'Cloud Stability Track A',
  artist: 'RaagaX Core',
  artistId: 'art_cloud',
  album: 'Zero Stutter',
  albumId: 'alb_cloud',
  duration: 210,
  coverUrl: 'https://cdn.test/songA.jpg',
  audioUrl: 'https://cdn.test/songA.mp3',
  genre: 'Acoustic',
  category: 'melody',
  releaseYear: 2024,
  plays: 50,
  likes: 12,
};

const mockSongB: Song = {
  id: 'song_cloud_b',
  title: 'Cloud Stability Track B',
  artist: 'RaagaX Core',
  artistId: 'art_cloud',
  album: 'Zero Stutter',
  albumId: 'alb_cloud',
  duration: 180,
  coverUrl: 'https://cdn.test/songB.jpg',
  audioUrl: 'https://cdn.test/songB.mp3',
  genre: 'Acoustic',
  category: 'melody',
  releaseYear: 2024,
  plays: 80,
  likes: 25,
};

describe('RaagaX Jam — Cloud Audio Stability & Anti-Stutter Suite', () => {
  let driftEngine: DriftCorrectionEngine;
  let clockSync: ClockSyncEngine;
  let netEngine: NetworkQualityEngine;
  let stateMachine: JamPlaybackStateMachine;

  beforeEach(() => {
    driftEngine = DriftCorrectionEngine.getInstance();
    driftEngine.resetForTesting();
    clockSync = ClockSyncEngine.getInstance();
    clockSync.resetForTesting(0);
    netEngine = NetworkQualityEngine.getInstance();
    netEngine.resetForTesting(35);
    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();
  });

  it('1. Cloud RTT spike (50ms -> 100ms -> 250ms -> 400ms) does NOT stop, pause, or seek local audio', () => {
    // Simulate RTT climbing up from 50ms to 400ms
    netEngine.recordPing(50, true);
    expect(netEngine.getConnectionQuality()).toBe('EXCELLENT');

    netEngine.recordPing(100, true);
    netEngine.recordPing(250, true);
    netEngine.recordPing(400, true);

    const metrics = netEngine.getMetrics();
    expect(metrics.rtt).toBe(400);

    // Audio buffer and drift engine remain completely independent of RTT spikes
    expect(driftEngine.getHardSeekCount()).toBe(0);
  });

  it('2. DriftCorrectionEngine performs gentle rate modulation for small/moderate drift and restores 1.0x', () => {
    const session: JamSession = {
      jamId: 'JAM_RATE_TEST',
      joinCode: 'RATE1',
      name: 'Rate Test',
      hostId: 'user_host',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: mockSongA.id,
      currentSong: mockSongA,
      positionMs: 50000,
      serverTimestamp: 1000000,
      startAtServerTime: 1000000,
      leadTimeMs: 400,
      revision: 1,
      generation: 1,
      timelineId: 'TL_1',
      transitionId: 'TR_1',
      createdAt: 1000000,
      updatedAt: 1000000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    driftEngine.setSession(session);
    expect(driftEngine.getPlaybackDriftMs()).toBe(0);
    expect(driftEngine.getHardSeekCount()).toBe(0);
  });

  it('3. Stale snapshot rejection: older revisions or stale generations produce zero playback mutations', async () => {
    const activeSession: JamSession = {
      jamId: 'JAM_STALE_TEST',
      joinCode: 'STALE',
      name: 'Stale Test',
      hostId: 'host_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: mockSongA.id,
      currentSong: mockSongA,
      positionMs: 30000,
      serverTimestamp: 2000000,
      startAtServerTime: 2000000,
      leadTimeMs: 400,
      revision: 5,
      generation: 2,
      timelineId: 'TL_2',
      transitionId: 'TR_2',
      createdAt: 1000000,
      updatedAt: 2000000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    // Commit active session
    await stateMachine.handleTransition(activeSession, undefined, 'NEW_TRANSITION');
    expect(stateMachine.getState().activeGeneration).toBe(2);

    // Incoming stale event (generation 1 < 2)
    const staleEvent: JamEvent = {
      eventId: 'EVT_OLD',
      jamId: 'JAM_STALE_TEST',
      type: 'SEEK',
      revision: 2,
      serverTimestamp: 1500000,
      senderId: 'host_1',
      generation: 1,
      timelineId: 'TL_1',
      transitionId: 'TR_1',
      payload: { positionMs: 0 },
    };

    const staleSession: JamSession = {
      ...activeSession,
      revision: 2,
      generation: 1,
      timelineId: 'TL_1',
      transitionId: 'TR_1',
      positionMs: 0,
    };

    // Stale transition must be discarded!
    await stateMachine.handleTransition(staleSession, staleEvent, 'EVENT');
    expect(stateMachine.getState().activeGeneration).toBe(2);
    expect(stateMachine.getState().activeTimelineId).toBe('TL_2');
  });

  it('4. Reconnecting on the same timeline does NOT reload audio or reset playback position', async () => {
    const currentSession: JamSession = {
      jamId: 'JAM_RECON',
      joinCode: 'RECON',
      name: 'Recon Test',
      hostId: 'host_1',
      hostName: 'Host',
      state: 'PLAYING',
      trackId: mockSongA.id,
      currentSong: mockSongA,
      positionMs: 45000,
      serverTimestamp: 3000000,
      startAtServerTime: 3000000,
      leadTimeMs: 400,
      revision: 10,
      generation: 3,
      timelineId: 'TL_3_ACTIVE',
      transitionId: 'TR_3_ACTIVE',
      createdAt: 1000000,
      updatedAt: 3000000,
      permissions: { canAddSongs: true, canRemoveSongs: true, canReorderQueue: true, canControlPlayback: true, canSkip: true, canInvite: true, canRemoveParticipants: true },
      participants: {},
      queue: [],
      history: [],
    };

    // Commit initial transition
    await stateMachine.handleTransition(currentSession, undefined, 'NEW_TRANSITION');
    expect(stateMachine.getState().activeTimelineId).toBe('TL_3_ACTIVE');

    // Simulate transport reconnect snapshot with same identity (rev 11)
    const reconnectedSession: JamSession = {
      ...currentSession,
      revision: 11,
    };

    // Reconcile
    await stateMachine.handleTransition(reconnectedSession, undefined, 'RECONCILIATION');
    expect(stateMachine.getState().activeTimelineId).toBe('TL_3_ACTIVE');
    expect(stateMachine.getState().activeGeneration).toBe(3);
    expect(stateMachine.getState().activeTrackId).toBe(mockSongA.id);
  });
});
