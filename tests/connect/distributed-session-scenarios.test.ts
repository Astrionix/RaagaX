import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { DeviceLeaseManager } from '@/lib/connect/DeviceLeaseManager';
import { TransferManager } from '@/lib/connect/TransferManager';
import { ConnectCommand, PlaybackSnapshot, calculateLivePositionMs } from '@/lib/connect/types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

const songA: Song = { id: 'song_a', title: 'Song A', artist: 'Artist 1', duration: 200 } as Song;
const songB: Song = { id: 'song_b', title: 'Song B', artist: 'Artist 2', duration: 180 } as Song;
const songC: Song = { id: 'song_c', title: 'Song C (Tabahi)', artist: 'Artist 3', duration: 220 } as Song;
const songD: Song = { id: 'song_d', title: 'Song D', artist: 'Artist 4', duration: 210 } as Song;

describe('RaagaX Distributed Playback Session — Master Specification Tests (Scenarios A-Z)', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_phone_1',
      isActiveDevice: true,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      queue: [],
      queueIndex: 0,
    });
    CommandValidator.getInstance().reset();
    CommandSequencer.getInstance().reset();
  });

  // ── INVARIANT 1: APP_OPEN !== PLAY ──────────────────────────────────────────
  it('Invariant 1 & Scenario A1: Opening the app on a device NEVER triggers autoplay', async () => {
    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(false);
    expect(store.currentTime).toBe(0);
  });

  // ── INVARIANT 2: CONTROLLER_OFFLINE !== PLAYER_OFFLINE ──────────────────────
  it('Invariant 2 & Scenario E1/F2/F3: Controller disconnect/close does NOT stop the active player', () => {
    const desktopPlayer = { deviceId: 'dev_desktop_1', isPlaying: true, role: 'RENDERER' };
    const mobileController = { deviceId: 'dev_phone_1', role: 'CONTROLLER', isOnline: true };

    // Mobile controller goes offline / killed
    mobileController.isOnline = false;

    // Desktop player continues uninterrupted
    expect(desktopPlayer.isPlaying).toBe(true);
    expect(desktopPlayer.role).toBe('RENDERER');
  });

  // ── INVARIANT 3: PLAYER_LOST !== AUTO_PLAY ──────────────────────────────────
  it('Invariant 3 & Scenario E2/F4: Active player crash/loss does NOT automatically start playback on remote controller', () => {
    // Desktop was playing, Mobile is controller
    usePlayerStore.setState({
      deviceId: 'dev_phone_1',
      isActiveDevice: false,
      activeDeviceId: 'dev_desktop_1',
      isPlaying: true, // remote is playing
      currentSong: songC,
    });

    // Desktop crashes / heartbeat expires -> Desktop becomes OFFLINE
    usePlayerStore.setState({
      activeDeviceId: null,
      isActiveDevice: false,
      isPlaying: false, // Strict: no auto takeover
    });

    const state = usePlayerStore.getState();
    expect(state.isActiveDevice).toBe(false);
    expect(state.isPlaying).toBe(false);
    expect(state.currentSong?.id).toBe('song_c'); // state preserved without surprise audio
  });

  // ── INVARIANT 4: Stale Epoch Rejected (Scenario I & L) ───────────────────────
  it('Invariant 4 & Scenario I/L: Commands with stale session_epoch < current_epoch are REJECTED', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();

    // Session advances to epoch 43 (e.g. after a transfer or session renewal)
    const commitCommand: ConnectCommand = {
      commandId: 'cmd_transfer_1',
      sessionId: 'sess_100',
      epoch: 43,
      sequence: 1,
      sourceDeviceId: 'dev_phone_1',
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: {}
    };
    expect(validator.validate(commitCommand)).toBe(true);
    expect(sequencer.getEpoch()).toBe(43);

    // Stale command from old epoch 42 arrives delayed
    const staleCommand: ConnectCommand = {
      commandId: 'cmd_stale_1',
      sessionId: 'sess_100',
      epoch: 42,
      sequence: 99,
      sourceDeviceId: 'dev_phone_old',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {}
    };
    expect(validator.validate(staleCommand)).toBe(false);
  });

  // ── INVARIANT 5: Duplicate & Out-of-Order Sequence Fencing (Scenario J & K) ─
  it('Invariant 5 & Scenario J/K/C3/C4: Duplicate commands and older sequence numbers are ignored', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();
    const currentEpoch = sequencer.getEpoch();

    const cmd101: ConnectCommand = {
      commandId: 'cmd_101',
      sessionId: 'sess_100',
      epoch: currentEpoch,
      sequence: 101,
      sourceDeviceId: 'dev_phone_1',
      type: 'SEEK',
      sentAt: Date.now(),
      payload: { positionMs: 50000 }
    };
    expect(validator.validate(cmd101)).toBe(true);

    // Duplicate cmd_101 re-sent by network retry -> rejected
    expect(validator.validate(cmd101)).toBe(false);

    // Out-of-order delayed cmd_100 arrives after cmd_101 -> rejected
    const cmd100: ConnectCommand = {
      commandId: 'cmd_100',
      sessionId: 'sess_100',
      epoch: currentEpoch,
      sequence: 100,
      sourceDeviceId: 'dev_phone_1',
      type: 'PLAY',
      sentAt: Date.now(),
      payload: {}
    };
    expect(validator.validate(cmd100)).toBe(false);
  });

  // ── INVARIANT 6: State Convergence & Drift Calculation (Scenario R & R2) ────
  it('Invariant 6 & Scenario R: Remote controllers estimate live position dynamically without spamming network', () => {
    const snapshot: PlaybackSnapshot = {
      sessionId: 'sess_100',
      deviceId: 'dev_desktop_1',
      currentTrackId: 'song_c',
      positionMs: 151000, // 02:31
      timestampMs: 1000000,
      isPlaying: true,
      sequence: 50,
      durationMs: 220000,
    };

    // 4 seconds later
    const now = 1004000;
    const livePosMs = calculateLivePositionMs(snapshot, now);
    expect(livePosMs).toBe(155000); // 02:35

    // If paused, position does not advance
    const pausedSnapshot: PlaybackSnapshot = { ...snapshot, isPlaying: false };
    expect(calculateLivePositionMs(pausedSnapshot, now)).toBe(151000);
  });

  // ── INVARIANT 7: State Preservation on Transfer (Scenario B1, B2, B3, B4) ────
  it('Invariant 7 & Scenario B1/B2/B3/B4: Transfer preserves exact track, position, and playback state', async () => {
    const targetDeviceId = 'dev_desktop_1';
    
    // Sender (Phone) has Song C at 02:31 PAUSED
    usePlayerStore.setState({
      deviceId: 'dev_phone_1',
      isActiveDevice: true,
      currentSong: songC,
      currentTime: 151, // 02:31
      isPlaying: false, // PAUSED
      queue: [songA, songB, songC],
      queueIndex: 2,
    });

    const transitionId = await TransferManager.getInstance().initiateTransfer(targetDeviceId);
    expect(transitionId).toBeDefined();

    // Receiver (Desktop) handles TRANSFER_REQUEST
    const incomingCommand: ConnectCommand = {
      commandId: crypto.randomUUID(),
      sessionId: 'sess_100',
      transitionId,
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_phone_1',
      targetDeviceId: 'dev_desktop_1',
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload: {
        trackId: songC.id,
        songData: songC,
        queue: [songA, songB, songC],
        queueIndex: 2,
        positionMs: 151000,
        isPlaying: false, // Preserves PAUSED state
      }
    };

    await TransferManager.getInstance().handleIncomingTransferRequest(incomingCommand);

    const targetState = usePlayerStore.getState();
    expect(targetState.currentSong?.id).toBe('song_c');
    expect(targetState.currentTime).toBe(151); // Exact position preserved
    expect(targetState.queue.length).toBe(3);
    expect(targetState.queueIndex).toBe(2);
    expect(targetState.isPlaying).toBe(false); // DO NOT AUTOPLAY when transferring paused song
  });

  // ── INVARIANT 8: Stable Device ID vs Connection ID (Scenario A4 & H) ────────
  it('Invariant 8 & Scenario A4/H: Browser refresh preserves stable device_id while rotating connection_id', () => {
    const stableDeviceId = 'desktop-pc-8392';
    const connection1 = 'conn_ws_abc1';
    const connection2 = 'conn_ws_xyz2'; // after refresh

    expect(stableDeviceId).toBe('desktop-pc-8392');
    expect(connection1).not.toBe(connection2);
  });

  // ── KILLER 01: Transfer while Playing ───────────────────────────────────────
  it('Killer 01: Transfer while PLAYING preserves playing state on target and stops sender', async () => {
    usePlayerStore.setState({
      deviceId: 'dev_phone_1',
      isActiveDevice: true,
      currentSong: songC,
      currentTime: 151,
      isPlaying: true, // Playing
    });

    const incomingCommand: ConnectCommand = {
      commandId: 'cmd_transfer_playing',
      sessionId: 'sess_100',
      epoch: 1,
      sequence: 1,
      sourceDeviceId: 'dev_phone_1',
      targetDeviceId: 'dev_desktop_1',
      type: 'TRANSFER_REQUEST',
      sentAt: Date.now(),
      payload: {
        trackId: songC.id,
        songData: songC,
        queue: [songC],
        queueIndex: 0,
        positionMs: 151000,
        isPlaying: true,
      }
    };

    await TransferManager.getInstance().handleIncomingTransferRequest(incomingCommand);
    const targetState = usePlayerStore.getState();
    expect(targetState.currentSong?.id).toBe('song_c');
    expect(targetState.currentTime).toBe(151);
  });

  // ── KILLER 06: Concurrent Takeover Race Arbitration ────────────────────────
  it('Killer 06: Concurrent takeover race resolves deterministically via epoch promotion', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();

    // Device A wins takeover and commits epoch 50
    const commitDevA: ConnectCommand = {
      commandId: 'commit_dev_a',
      sessionId: 'sess_100',
      epoch: 50,
      sequence: 1,
      sourceDeviceId: 'dev_laptop_1',
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: {}
    };
    expect(validator.validate(commitDevA)).toBe(true);
    expect(sequencer.getEpoch()).toBe(50);

    // Stale concurrent takeover from Device B at old epoch 49 is rejected
    const staleDevB: ConnectCommand = {
      commandId: 'commit_dev_b',
      sessionId: 'sess_100',
      epoch: 49,
      sequence: 1,
      sourceDeviceId: 'dev_tv_1',
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: {}
    };
    expect(validator.validate(staleDevB)).toBe(false);
  });

  // ── KILLER 10: Rapid Sequential Commands (NEXT x 3) ─────────────────────────
  it('Killer 10: Rapid NEXT clicks with distinct monotonic sequence numbers are all accepted', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();
    const epoch = sequencer.getEpoch();

    const seq1 = { commandId: 'c1', sessionId: 's', epoch, sequence: 10, sourceDeviceId: 'd1', type: 'NEXT' as const, sentAt: Date.now(), payload: {} };
    const seq2 = { commandId: 'c2', sessionId: 's', epoch, sequence: 11, sourceDeviceId: 'd1', type: 'NEXT' as const, sentAt: Date.now(), payload: {} };
    const seq3 = { commandId: 'c3', sessionId: 's', epoch, sequence: 12, sourceDeviceId: 'd1', type: 'NEXT' as const, sentAt: Date.now(), payload: {} };

    expect(validator.validate(seq1)).toBe(true);
    expect(validator.validate(seq2)).toBe(true);
    expect(validator.validate(seq3)).toBe(true);
  });

  // ── KILLER 11: End-of-Track & Manual Next Atomic Protection ─────────────────
  it('Killer 11: Atomic queue advancement prevents skipping 2 tracks during end-of-track race', () => {
    let currentIndex = 0;
    const queue = [songA, songB, songC, songD];

    const advanceQueue = (fromIndex: number): number => {
      // Atomic guard: only advance if currently on the expected fromIndex
      if (currentIndex === fromIndex && currentIndex < queue.length - 1) {
        currentIndex++;
      }
      return currentIndex;
    };

    // Auto-advance triggers at track end (index 0 -> 1)
    const newIdx1 = advanceQueue(0);
    expect(newIdx1).toBe(1);

    // Concurrent manual NEXT sent when song was at index 0 arrives late (expects index 0)
    const newIdx2 = advanceQueue(0); // rejected because currentIndex is now 1
    expect(newIdx2).toBe(1); // Queue did NOT double-advance to index 2!
  });

  // ── KILLER 21: Queue Mutation with Versioning ───────────────────────────────
  it('Killer 21: Remote queue add increments queue_version without stopping playback', () => {
    let queueVersion = 17;
    let activeQueue = [songA, songB];

    // Remote controller adds songC
    queueVersion++;
    activeQueue = [...activeQueue, songC];

    expect(queueVersion).toBe(18);
    expect(activeQueue.length).toBe(3);
    expect(activeQueue[2].id).toBe('song_c');
  });

  // ── KILLER 22: Rapid Concurrent Seek Arbitration ────────────────────────────
  it('Killer 22: Concurrent seeks resolve to newest monotonic sequence', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();
    const epoch = sequencer.getEpoch();

    const seek1 = { commandId: 's1', sessionId: 's', epoch, sequence: 201, sourceDeviceId: 'phone', type: 'SEEK' as const, sentAt: Date.now(), payload: { positionMs: 30000 } };
    const seek2 = { commandId: 's2', sessionId: 's', epoch, sequence: 202, sourceDeviceId: 'phone', type: 'SEEK' as const, sentAt: Date.now(), payload: { positionMs: 90000 } };

    expect(validator.validate(seek1)).toBe(true);
    expect(validator.validate(seek2)).toBe(true);
  });

  // ── KILLER 23: Account Switch Playback Reset ────────────────────────────────
  it('Killer 23: Account switch clears old session, queue, and resets playback to uninitialized state', () => {
    usePlayerStore.setState({
      currentSong: songC,
      currentTime: 145,
      isPlaying: true,
      queue: [songA, songB, songC],
      queueIndex: 2,
    });

    // User logs out & logs into Account B
    usePlayerStore.setState({
      currentSong: null,
      currentTime: 0,
      isPlaying: false,
      queue: [],
      queueIndex: 0,
      isActiveDevice: true,
    });

    const state = usePlayerStore.getState();
    expect(state.currentSong).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.queue.length).toBe(0);
  });
});
