import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamClientManager } from '@/lib/jam/client/JamClientManager';
import { Song } from '@/types/music';

const mockSongA: Song = {
  id: 'song_a',
  title: 'Kesariya',
  artist: 'Arijit Singh',
  duration: 240,
  audioUrl: 'https://cdn.example.com/kesariya.mp3',
  coverUrl: 'https://cdn.example.com/kesariya.jpg',
};

const mockSongB: Song = {
  id: 'song_b',
  title: 'Hukum',
  artist: 'Anirudh Ravichander',
  duration: 200,
  audioUrl: 'https://cdn.example.com/hukum.mp3',
  coverUrl: 'https://cdn.example.com/hukum.jpg',
};

const mockSongC: Song = {
  id: 'song_c',
  title: 'Chaleya',
  artist: 'Arijit Singh',
  duration: 190,
  audioUrl: 'https://cdn.example.com/chaleya.mp3',
  coverUrl: 'https://cdn.example.com/chaleya.jpg',
};

describe('RaagaX Jam — Advanced Capabilities: Playback Handoff, History & Capabilities Suite', () => {
  let serverEngine: JamServerEngine;

  beforeEach(() => {
    serverEngine = JamServerEngine.getInstance();
    serverEngine.resetForTesting();
  });

  describe('1. Playback History Model', () => {
    it('1.1 Records authoritative history entries with distinct (queueItemId + trackId + transitionId)', () => {
      const { session } = serverEngine.createSession({
        hostId: 'user_host',
        hostName: 'Host User',
        initialSong: mockSongA,
        initialQueue: [mockSongB, mockSongA], // Note mockSongA is repeated in queue!
      });

      expect(session.playbackHistory).toBeDefined();
      expect(session.playbackHistory?.length).toBeGreaterThanOrEqual(1);
      expect(session.playbackHistory![0].trackId).toBe('song_a');

      // Skip to next track (Song B)
      const res1 = serverEngine.executeCommand({
        commandId: 'cmd_1',
        jamId: session.jamId,
        userId: 'user_host',
        action: 'SKIP_NEXT',
        requestId: 'REQ_SKIP_1',
      });

      expect(res1.success).toBe(true);
      expect(res1.session?.currentSong?.id).toBe('song_b');
      expect(res1.session?.playbackHistory?.[0].trackId).toBe('song_b');
      expect(res1.session?.playbackHistory?.[0].reason).toBe('MANUAL_NEXT');
      expect(res1.session?.playbackHistory?.[0].transitionId).toBeDefined();

      // Skip to next track (Song A repeated)
      const res2 = serverEngine.executeCommand({
        commandId: 'cmd_2',
        jamId: session.jamId,
        userId: 'user_host',
        action: 'SKIP_NEXT',
        requestId: 'REQ_SKIP_2',
      });

      expect(res2.success).toBe(true);
      expect(res2.session?.currentSong?.id).toBe('song_a');

      // Verify the two occurrences of song_a have distinct transition IDs
      const historyList = res2.session?.playbackHistory || [];
      expect(historyList.length).toBeGreaterThanOrEqual(3);
      const latestA = historyList[0];
      const firstA = historyList[2];

      expect(latestA.trackId).toBe('song_a');
      expect(firstA.trackId).toBe('song_a');
      expect(latestA.transitionId).not.toBe(firstA.transitionId);
    });

    it('1.2 Non-linear Previous Navigation steps backward along actual history entries', () => {
      const { session } = serverEngine.createSession({
        hostId: 'user_host',
        hostName: 'Host User',
        initialSong: mockSongA,
        initialQueue: [mockSongB, mockSongC],
      });

      // Play through: Song A -> Song B -> Song C
      serverEngine.executeCommand({
        commandId: 'c1',
        jamId: session.jamId,
        userId: 'user_host',
        action: 'SKIP_NEXT',
      });
      serverEngine.executeCommand({
        commandId: 'c2',
        jamId: session.jamId,
        userId: 'user_host',
        action: 'SKIP_NEXT',
      });

      // Current is Song C
      const sessionAtC = serverEngine.getSession(session.jamId);
      expect(sessionAtC?.currentSong?.id).toBe('song_c');

      // Tap Previous at 1.5s into Song C (<= 3s) -> should step back to Song B
      const prev1 = serverEngine.executeCommand({
        commandId: 'c3',
        jamId: session.jamId,
        userId: 'user_host',
        action: 'SKIP_PREV',
        requestId: 'REQ_PREV_1',
      });

      expect(prev1.success).toBe(true);
      expect(prev1.session?.currentSong?.id).toBe('song_b');

      // Tap Previous at 1.0s into Song B -> should step back to Song A
      const prev2 = serverEngine.executeCommand({
        commandId: 'c4',
        jamId: session.jamId,
        userId: 'user_host',
        action: 'SKIP_PREV',
        requestId: 'REQ_PREV_2',
      });

      expect(prev2.success).toBe(true);
      expect(prev2.session?.currentSong?.id).toBe('song_a');
    });
  });

  describe('2. Device Capabilities Model', () => {
    it('2.1 Stores participant device capabilities during join and state updates', () => {
      const { session } = serverEngine.createSession({
        hostId: 'user_host',
        hostName: 'Host Laptop',
        deviceType: 'desktop',
        initialSong: mockSongA,
      });

      // Guest joins with mobile device and specific capabilities
      const guestJoin = serverEngine.joinSession(session.jamId, {
        userId: 'user_guest',
        displayName: 'Guest Phone',
        deviceType: 'mobile',
      });

      expect(guestJoin.success).toBe(true);

      // Report capabilities
      const updated = serverEngine.updateParticipantState(session.jamId, 'user_guest', {
        deviceId: 'device_phone_pixel8',
        capabilities: {
          deviceId: 'device_phone_pixel8',
          platform: 'android',
          supportedCodecs: ['mp3', 'aac', 'flac', 'opus'],
          audioCapabilities: {
            sampleRates: [44100, 48000],
            channelCount: 2,
            maxBitrate: 320,
          },
          backgroundPlayback: true,
          outputCapabilities: {
            speaker: true,
            bluetooth: true,
          },
        },
      });

      expect(updated.success).toBe(true);
      const participant = updated.session?.participants['user_guest'];
      expect(participant?.capabilities?.platform).toBe('android');
      expect(participant?.capabilities?.supportedCodecs).toContain('flac');
      expect(participant?.capabilities?.backgroundPlayback).toBe(true);
    });
  });

  describe('3. Playback Handoff State Machine', () => {
    it('3.1 Executes full handoff flow with authoritative timeline continuation and zero double-playback', () => {
      // Create session on Laptop (Host)
      const { session } = serverEngine.createSession({
        hostId: 'user_laptop',
        hostName: 'Laptop Host',
        deviceType: 'desktop',
        initialSong: mockSongA,
      });

      // Join Phone (Guest)
      serverEngine.joinSession(session.jamId, {
        userId: 'user_phone',
        displayName: 'Phone Guest',
        deviceType: 'mobile',
      });

      // Start playback and advance to 45 seconds (45000ms)
      serverEngine.executeCommand({
        commandId: 'play_1',
        jamId: session.jamId,
        userId: 'user_laptop',
        action: 'PLAY',
        payload: { positionMs: 45000 },
      });

      // Step 1: Laptop requests handoff to Phone
      const reqHandoff = serverEngine.executeCommand({
        commandId: 'cmd_ho_req',
        jamId: session.jamId,
        userId: 'user_laptop',
        action: 'REQUEST_HANDOFF',
        payload: { targetUserId: 'user_phone', targetDeviceId: 'dev_phone' },
        requestId: 'REQ_HO_100',
      });

      expect(reqHandoff.success).toBe(true);
      const handoffState = reqHandoff.session?.activeHandoff;
      expect(handoffState).toBeDefined();
      expect(handoffState?.status).toBe('HANDOFF_REQUESTED');
      expect(handoffState?.targetUserId).toBe('user_phone');
      expect(handoffState?.positionMs).toBeGreaterThanOrEqual(45000);

      // Step 2: Target Phone prepares and confirms ready
      const confirmReady = serverEngine.executeCommand({
        commandId: 'cmd_ho_ready',
        jamId: session.jamId,
        userId: 'user_phone',
        action: 'CONFIRM_HANDOFF_READY',
        payload: { handoffId: handoffState!.handoffId },
        requestId: 'REQ_HO_101',
      });

      expect(confirmReady.success).toBe(true);
      expect(confirmReady.session?.activeHandoff?.status).toBe('HANDOFF_COMMITTED');
      // Authoritative position continued from exact handoff timestamp!
      expect(confirmReady.session?.positionMs).toBe(handoffState!.positionMs);
      expect(confirmReady.session?.state).toBe('PLAYING');

      // Step 3: Target confirms playing
      const confirmPlaying = serverEngine.executeCommand({
        commandId: 'cmd_ho_playing',
        jamId: session.jamId,
        userId: 'user_phone',
        action: 'CONFIRM_TARGET_PLAYING',
        payload: { handoffId: handoffState!.handoffId },
      });

      expect(confirmPlaying.success).toBe(true);
      expect(confirmPlaying.session?.activeHandoff?.status).toBe('TARGET_PLAYING');
    });

    it('3.2 Handoff failure isolation: source continues uninterrupted if target fails', () => {
      const { session } = serverEngine.createSession({
        hostId: 'user_source',
        hostName: 'Source',
        initialSong: mockSongA,
      });

      serverEngine.joinSession(session.jamId, {
        userId: 'user_broken_target',
        displayName: 'Broken Target',
      });

      // Request handoff
      const req = serverEngine.executeCommand({
        commandId: 'ho_req',
        jamId: session.jamId,
        userId: 'user_source',
        action: 'REQUEST_HANDOFF',
        payload: { targetUserId: 'user_broken_target' },
      });

      expect(req.success).toBe(true);
      const handoffId = req.session?.activeHandoff?.handoffId;

      // Target fails
      const fail = serverEngine.executeCommand({
        commandId: 'ho_fail',
        jamId: session.jamId,
        userId: 'user_broken_target',
        action: 'FAIL_HANDOFF',
        payload: { handoffId, errorMessage: 'Codec unsupported on target' },
      });

      expect(fail.success).toBe(true);
      expect(fail.session?.activeHandoff).toBeNull();
      // Source session remains active and unchanged
      expect(fail.session?.currentSong?.id).toBe('song_a');
    });
  });

  describe('4. End-to-End Observability & Event Deduplication', () => {
    it('4.1 Event deduplication ignores duplicate eventIds gracefully', () => {
      const client = JamClientManager.getInstance();
      client.resetForTesting();

      // Configure active session for client so it accepts events for JAM_TEST
      (client as any).activeSession = {
        jamId: 'JAM_TEST',
        revision: 5,
        participants: {},
        queue: [],
        history: [],
      };
      (client as any).localRevision = 5;

      const applySpy = vi.spyOn(client as any, 'applyEventLocally');

      const mockEvent = {
        eventId: 'EVT_UNIQUE_9999',
        jamId: 'JAM_TEST',
        type: 'PLAY' as const,
        revision: 6,
        serverTimestamp: Date.now(),
        senderId: 'user_host',
        payload: { positionMs: 0 },
      };

      // First delivery: processes
      client.handleIncomingEvent(mockEvent);

      // Second duplicate delivery with same eventId: drops
      client.handleIncomingEvent(mockEvent);

      expect(applySpy).toHaveBeenCalledTimes(1);
    });
  });
});
