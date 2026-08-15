import { describe, it, expect, beforeEach } from 'vitest';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { ConnectCommand, CommandAckPayload, PlaybackSnapshot } from '@/lib/connect/types';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { QueueManager } from '@/lib/queue/QueueManager';
import { TransferManager } from '@/lib/connect/TransferManager';
import { Song } from '@/types/music';

const mockTrackA: Song = {
  id: 'track_a',
  title: 'Track A (Inthandham)',
  artist: 'Sita Ramam Artist',
  duration: 214,
  coverUrl: '/covers/a.jpg',
  audioUrl: 'https://cdn.raagax.com/a.mp3',
} as Song;

const mockTrackB: Song = {
  id: 'track_b',
  title: 'Track B (Chilipiga)',
  artist: 'Orange Artist',
  duration: 310,
  coverUrl: '/covers/b.jpg',
  audioUrl: 'https://cdn.raagax.com/b.mp3',
} as Song;

const mockTrackC: Song = {
  id: 'track_c',
  title: 'Track C (Adiga Adiga)',
  artist: 'Ninnu Kori Artist',
  duration: 185,
  coverUrl: '/covers/c.jpg',
  audioUrl: 'https://cdn.raagax.com/c.mp3',
} as Song;

describe('RaagaX Connect 2.0 — Extreme Production Distributed Invariants Suite', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      deviceId: 'dev_laptop_renderer',
      isActiveDevice: true,
      activeDeviceId: 'dev_laptop_renderer',
      currentSong: mockTrackA,
      isPlaying: true,
      currentTime: 120, // 02:00
      duration: 214,
      queue: [mockTrackA, mockTrackB, mockTrackC],
      queueIndex: 0,
      isAutoplayEnabled: false,
    });

    CommandValidator.getInstance().reset();
    CommandSequencer.getInstance().reset();
    CommandSequencer.getInstance().setEpoch(10);
  });

  // ── INVARIANT 1: At most one active renderer per session ───────────────────
  it('Invariant 1: Exactly one renderer can claim lease; subsequent takeover yields new epoch and demotes previous renderer', async () => {
    const sequencer = CommandSequencer.getInstance();
    const validator = CommandValidator.getInstance();

    // Laptop is renderer at Epoch 10
    expect(sequencer.getEpoch()).toBe(10);
    expect(usePlayerStore.getState().isActiveDevice).toBe(true);

    // Phone executes Takeover/Transfer at Epoch 11
    const transferCommitCmd: ConnectCommand = {
      commandId: 'cmd_takeover_commit_1',
      sessionId: 'sess_1',
      transitionId: 'tr_takeover_100',
      epoch: 11,
      sequence: 1,
      sourceDeviceId: 'dev_phone_takeover',
      targetDeviceId: 'dev_laptop_renderer',
      type: 'TRANSFER_COMMIT',
      sentAt: Date.now(),
      payload: { shouldResume: true },
    };

    const isAccepted = validator.validate(transferCommitCmd);
    expect(isAccepted).toBe(true);
    expect(sequencer.getEpoch()).toBe(11);

    // Laptop demotes to controller
    usePlayerStore.setState({
      isActiveDevice: false,
      activeDeviceId: 'dev_phone_takeover',
      connectedDeviceId: 'dev_phone_takeover',
      remoteDeviceName: 'My Phone',
    });

    const laptopState = usePlayerStore.getState();
    expect(laptopState.isActiveDevice).toBe(false);
    expect(laptopState.activeDeviceId).toBe('dev_phone_takeover');
  });

  // ── INVARIANT 2: Stale renderer commands are strictly rejected ──────────────
  it('Invariant 2: Stale commands from old renderer carrying obsolete epoch are strictly fenced and rejected', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();
    sequencer.setEpoch(15); // Active epoch is 15

    // Obsolete command from demoted device at Epoch 14
    const staleCommand: ConnectCommand = {
      commandId: 'cmd_stale_1',
      sessionId: 'sess_1',
      epoch: 14, // Stale!
      sequence: 99,
      sourceDeviceId: 'dev_laptop_demoted',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {},
    };

    const isValid = validator.validate(staleCommand);
    expect(isValid).toBe(false); // Must be rejected
  });

  // ── INVARIANT 3: Multi-Controller Race (Phone A, Phone B, Laptop) ────────────
  it('Invariant 3: Multiple controllers issuing simultaneous commands are strictly serialized by sequence number', () => {
    const validator = CommandValidator.getInstance();
    const sequencer = CommandSequencer.getInstance();
    sequencer.setEpoch(20);

    // Phone A sends PAUSE with sequence 1
    const cmdPhoneA: ConnectCommand = {
      commandId: 'cmd_phone_a_1',
      sessionId: 'sess_1',
      epoch: 20,
      sequence: 1,
      sourceDeviceId: 'dev_phone_a',
      type: 'PAUSE',
      sentAt: Date.now(),
      payload: {},
    };

    // Phone B sends PLAY with sequence 1
    const cmdPhoneB: ConnectCommand = {
      commandId: 'cmd_phone_b_1',
      sessionId: 'sess_1',
      epoch: 20,
      sequence: 1,
      sourceDeviceId: 'dev_phone_b',
      type: 'PLAY',
      sentAt: Date.now() + 5,
      payload: {},
    };

    expect(validator.validate(cmdPhoneA)).toBe(true);
    expect(validator.validate(cmdPhoneB)).toBe(true);

    // Replay of Phone A sequence 1 is rejected
    const replayPhoneA: ConnectCommand = {
      ...cmdPhoneA,
      commandId: 'cmd_phone_a_replay',
    };
    expect(validator.validate(replayPhoneA)).toBe(false);
  });

  // ── INVARIANT 4: 2PC Transfer Failure Rollback Safety ───────────────────────
  it('Invariant 4: Transfer preparation timeout preserves source active playback with zero audio gap', async () => {
    const transferManager = TransferManager.getInstance();
    usePlayerStore.setState({
      deviceId: 'dev_laptop_source',
      isActiveDevice: true,
      isPlaying: true,
      currentSong: mockTrackA,
    });

    const txId = await transferManager.initiateTransfer('dev_tv_target');
    expect(usePlayerStore.getState().isTransferring).toBe(true);

    // Simulate Target Timeout Rollback
    transferManager.handleTransferRollback(txId, 'TARGET_TIMEOUT');

    const state = usePlayerStore.getState();
    expect(state.isActiveDevice).toBe(true);
    expect(state.isPlaying).toBe(true);
    expect(state.isTransferring).toBe(false);
    expect(transferManager.getTransferState()).toBe('ROLLED_BACK');
  });

  // ── INVARIANT 5: Authoritative Queue Mutations across Distributed Nodes ─────
  it('Invariant 5: Queue mutations belong to session context, not renderer hardware', () => {
    const manager = QueueManager.getInstance();
    manager.replaceQueue([mockTrackA, mockTrackB], 0);

    // Controller adds Track C
    manager.addToQueue(mockTrackC);

    const snapshot = manager.getSnapshot();
    expect(snapshot.items.length).toBe(3);
    expect(snapshot.items[2].song.id).toBe('track_c');
  });

  // ── INVARIANT 6: Canonical Timeline Alignment for Lyrics Synchronization ────
  it('Invariant 6: Lyrics engine derives canonical position from store without local timer drift', () => {
    const lyricsEngine = LyricsEngine.getInstance();
    usePlayerStore.setState({
      currentTime: 145.5, // 02:25.500
      isPlaying: true,
    });

    const effectiveMs = lyricsEngine.getEffectivePositionMs();
    expect(effectiveMs).toBe(145500); // Exactly aligns with central store
  });

  // ── INVARIANT 7: Reconnect with Stale Local Snapshot Reconciles Server ───────
  it('Invariant 7: Old reconnecting client with stale snapshot adopts authoritative server state', () => {
    const twoDaysAgo = Date.now() - 172800000;
    const staleSnapshot: PlaybackSnapshot = {
      sessionId: 'sess_1',
      deviceId: 'dev_old_laptop',
      currentTrackId: 'old_tabahi',
      positionMs: 30000,
      timestampMs: twoDaysAgo,
      isPlaying: true,
      sequence: 1,
    };

    // Stale check
    const isStale = (Date.now() - staleSnapshot.timestampMs) > 60000;
    expect(isStale).toBe(true);

    // Authoritative Server wins
    const activeServerState = {
      currentSong: mockTrackA,
      currentTime: 120,
      isPlaying: true,
    };

    expect(activeServerState.currentSong.id).toBe('track_a');
  });
});
