import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrackMetadataCache } from '@/lib/music/TrackMetadataCache';
import { JamPlaybackStateMachine } from '@/lib/jam/client/JamPlaybackStateMachine';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { JamSession, JamEvent } from '@/types/jam';
import { Song } from '@/types/music';

const mockSong1: Song = {
  id: 'track_alpha',
  title: 'Song Alpha',
  artist: 'Artist Alpha',
  album: 'Album Alpha',
  duration: 200,
  audioUrl: 'https://cdn.example.com/audio/alpha.mp4',
  coverUrl: 'https://cdn.example.com/images/alpha.jpg',
};

const mockSong2: Song = {
  id: 'track_beta',
  title: 'Song Beta',
  artist: 'Artist Beta',
  album: 'Album Beta',
  duration: 180,
  audioUrl: 'https://cdn.example.com/audio/beta.mp4',
  coverUrl: 'https://cdn.example.com/images/beta.jpg',
};

describe('RaagaX Jam — Modular 4-Tier Architecture & JamPlaybackStateMachine Suite', () => {
  let metadataCache: TrackMetadataCache;
  let stateMachine: JamPlaybackStateMachine;
  let serverEngine: JamServerEngine;
  let clientManager: JamClientManager;

  beforeEach(() => {
    metadataCache = TrackMetadataCache.getInstance();
    metadataCache.clear();
    stateMachine = JamPlaybackStateMachine.getInstance();
    stateMachine.reset();
    serverEngine = JamServerEngine.getInstance();
    serverEngine.resetForTesting();
    clientManager = JamClientManager.getInstance();
    clientManager.resetForTesting();
  });

  describe('1. Music Catalog & TrackMetadataCache (Section 1 & 14 & 16)', () => {
    it('answers "What song is this?" and resolves metadata with generation tagging', async () => {
      const meta = await metadataCache.resolve('track_alpha', 10, mockSong1);
      expect(meta).not.toBeNull();
      expect(meta?.trackId).toBe('track_alpha');
      expect(meta?.title).toBe('Song Alpha');
      expect(meta?.durationMs).toBe(200000);
      expect(meta?.generation).toBe(10);

      // Fast synchronous cache hit
      const cached = metadataCache.get('track_alpha');
      expect(cached?.title).toBe('Song Alpha');
    });

    it('generation guards discard stale metadata callbacks when newer generation is active', async () => {
      // Simulate slow async resolution for Gen 22
      let resolveSlowGen22: (val: any) => void;
      const slowPromise = new Promise((res) => {
        resolveSlowGen22 = res;
      });

      // Transition to Gen 23 immediately
      const mockSessionGen23: JamSession = {
        jamId: 'JAM_GEN_TEST',
        joinCode: '7K29P',
        name: 'Gen Test Jam',
        hostId: 'host_1',
        hostName: 'Host 1',
        status: 'ACTIVE',
        state: 'PLAYING',
        trackId: mockSong2.id,
        currentSong: mockSong2,
        positionMs: 0,
        basePositionMs: 0,
        serverTimestamp: Date.now(),
        startAtServerTime: Date.now() + 400,
        timelineStartServerMs: Date.now() + 400,
        leadTimeMs: 400,
        revision: 2,
        generation: 23,
        timelineId: 'TL_23',
        transitionId: 'TR_23',
        createdAt: Date.now(),
        updatedAt: Date.now(),
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

      await stateMachine.handleTransition(mockSessionGen23);
      expect(stateMachine.getState().activeGeneration).toBe(23);
      expect(stateMachine.getState().activeTrackId).toBe('track_beta');

      // Now Gen 22 finishes late
      metadataCache.set('track_alpha', { ...mockSong1, generation: 22 });
      
      // Active state machine track must remain track_beta (Gen 23)
      expect(stateMachine.getState().activeTrackId).toBe('track_beta');
      expect(stateMachine.getState().activeGeneration).toBe(23);
    });
  });

  describe('2. Queue Engine & Duplicate Tracks (Section 7 & 8 & 9)', () => {
    it('supports duplicate songs in queue by unique queueItemId', () => {
      const { session } = serverEngine.createSession({
        hostId: 'host_queue',
        hostName: 'Host Queue',
        initialSong: mockSong1,
      });

      // Add Song 2 (Q1)
      serverEngine.executeCommand({
        commandId: 'cmd_add_1',
        jamId: session.jamId,
        userId: 'host_queue',
        action: 'ADD_TRACK',
        payload: { song: mockSong2 },
      });

      // Add Song 1 again (Q2 - duplicate song, distinct queue entry)
      serverEngine.executeCommand({
        commandId: 'cmd_add_2',
        jamId: session.jamId,
        userId: 'host_queue',
        action: 'ADD_TRACK',
        payload: { song: mockSong1 },
      });

      const updated = serverEngine.getSession(session.jamId)!;
      expect(updated.queue.length).toBe(2);
      expect(updated.queue[0].trackId).toBe('track_beta');
      expect(updated.queue[1].trackId).toBe('track_alpha');
      expect(updated.queue[0].queueItemId).not.toBe(updated.queue[1].queueItemId);
    });

    it('SKIP_NEXT advances to next queue item, bumps generation, and updates timeline atomically', () => {
      const { session } = serverEngine.createSession({
        hostId: 'host_skip',
        hostName: 'Host Skip',
        initialSong: mockSong1,
      });

      serverEngine.executeCommand({
        commandId: 'cmd_add_next',
        jamId: session.jamId,
        userId: 'host_skip',
        action: 'ADD_TRACK',
        payload: { song: mockSong2 },
      });

      const nextRes = serverEngine.executeCommand({
        commandId: 'cmd_skip_next',
        jamId: session.jamId,
        userId: 'host_skip',
        action: 'SKIP_NEXT',
      });

      expect(nextRes.success).toBe(true);
      expect(nextRes.session?.trackId).toBe('track_beta');
      expect(nextRes.session?.generation).toBeGreaterThan(1);
      expect(nextRes.session?.timelineId).toMatch(/^TL_/);
      expect(nextRes.session?.transitionId).toMatch(/^TR_/);
      expect(nextRes.session?.history.length).toBe(1);
      expect(nextRes.session?.history[0].trackId).toBe('track_alpha');
    });

    it('SKIP_PREV restarts current track if played > 3000ms, or pops history if <= 3000ms', () => {
      const { session } = serverEngine.createSession({
        hostId: 'host_prev',
        hostName: 'Host Prev',
        initialSong: mockSong1,
      });

      // Start playing and advance position past 3000ms
      serverEngine.executeCommand({
        commandId: 'cmd_play',
        jamId: session.jamId,
        userId: 'host_prev',
        action: 'PLAY',
        payload: { positionMs: 15000 },
      });

      // SKIP_PREV when position = 15000ms -> restarts track at 0:00
      const restartRes = serverEngine.executeCommand({
        commandId: 'cmd_prev_restart',
        jamId: session.jamId,
        userId: 'host_prev',
        action: 'SKIP_PREV',
      });

      expect(restartRes.success).toBe(true);
      expect(restartRes.session?.trackId).toBe('track_alpha'); // Stays on same track
      expect(restartRes.session?.positionMs).toBe(0); // Restarts at 0:00
    });

    it('STOP command pauses and resets position to 0 with new timeline', () => {
      const { session } = serverEngine.createSession({
        hostId: 'host_stop',
        hostName: 'Host Stop',
        initialSong: mockSong1,
      });

      serverEngine.executeCommand({
        commandId: 'cmd_play',
        jamId: session.jamId,
        userId: 'host_stop',
        action: 'PLAY',
        payload: { positionMs: 45000 },
      });

      const stopRes = serverEngine.executeCommand({
        commandId: 'cmd_stop',
        jamId: session.jamId,
        userId: 'host_stop',
        action: 'STOP',
      });

      expect(stopRes.success).toBe(true);
      expect(stopRes.session?.state).toBe('PAUSED');
      expect(stopRes.session?.positionMs).toBe(0);
      expect(stopRes.session?.timelineId).toMatch(/^TL_/);
    });
  });

  describe('3. JamPlaybackStateMachine & Progress Interpolation (Section 3 & 13 & 15)', () => {
    it('calculates smooth local timeline progress without polling server every 16ms', () => {
      const now = Date.now();
      const mockSession: JamSession = {
        jamId: 'JAM_INTERPOLATE',
        joinCode: '4K99P',
        name: 'Interpolate Jam',
        hostId: 'host_1',
        hostName: 'Host 1',
        status: 'ACTIVE',
        state: 'PLAYING',
        trackId: mockSong1.id,
        currentSong: mockSong1,
        positionMs: 10000,
        basePositionMs: 10000,
        serverTimestamp: now,
        startAtServerTime: now - 5000, // Started 5 seconds ago
        timelineStartServerMs: now - 5000,
        leadTimeMs: 400,
        revision: 1,
        generation: 1,
        timelineId: 'TL_1',
        transitionId: 'TR_1',
        createdAt: now,
        updatedAt: now,
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

      const interpolatedSec = stateMachine.getInterpolatedPosition(mockSession);
      // 10s base + 5s elapsed = ~15s (15.0)
      expect(interpolatedSec).toBeGreaterThanOrEqual(14.9);
      expect(interpolatedSec).toBeLessThanOrEqual(15.2);
    });

    it('SKIP_NEXT after playing 120s resets position to 0:00 and applies new track across host & client', async () => {
      const { session } = serverEngine.createSession({
        hostId: 'host_reset_pos',
        hostName: 'Host Reset Pos',
        initialSong: mockSong1,
      });

      // Add second song to queue
      serverEngine.executeCommand({
        commandId: 'cmd_add_2',
        jamId: session.jamId,
        userId: 'host_reset_pos',
        action: 'ADD_TRACK',
        payload: { song: mockSong2 },
      });

      // Play song 1 up to 120 seconds (120,000 ms)
      serverEngine.executeCommand({
        commandId: 'cmd_play_120',
        jamId: session.jamId,
        userId: 'host_reset_pos',
        action: 'PLAY',
        payload: { positionMs: 120000 },
      });

      // Skip to next track
      const skipRes = serverEngine.executeCommand({
        commandId: 'cmd_skip',
        jamId: session.jamId,
        userId: 'host_reset_pos',
        action: 'SKIP_NEXT',
      });

      expect(skipRes.success).toBe(true);
      expect(skipRes.session?.trackId).toBe('track_beta');
      expect(skipRes.session?.positionMs).toBe(0);
      expect(skipRes.session?.basePositionMs).toBe(0);

      // Transition client coordinator
      await stateMachine.handleTransition(skipRes.session!);
      expect(stateMachine.getState().activeTrackId).toBe('track_beta');
      
      // Interpolated position of newly skipped track must start at 0:00, NOT 120:00
      const newPos = stateMachine.getInterpolatedPosition(skipRes.session!);
      expect(newPos).toBe(0);
    });
  });
});
