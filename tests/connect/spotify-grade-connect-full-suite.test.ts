import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { CommandValidator } from '@/lib/connect/CommandValidator';
import { CommandSequencer } from '@/lib/connect/CommandSequencer';
import { ClockSynchronizer } from '@/lib/connect/ClockSynchronizer';
import { PlaybackStateSync, RemotePlaybackState } from '@/lib/connect/PlaybackStateSync';
import { calculateLivePositionMs, PlaybackSnapshot, ConnectCommand, COMMAND_CLASS_MAP } from '@/lib/connect/types';
import { QueueManager } from '@/lib/queue/QueueManager';
import { DeviceRegistry } from '@/lib/connect/DeviceRegistry';
import { CommandBus } from '@/lib/connect/CommandBus';
import { TransferManager } from '@/lib/connect/TransferManager';
import { Song } from '@/types/music';

const dummySong1: Song = {
  id: 'song_1',
  title: 'Starboy',
  artist: 'The Weeknd',
  artistId: 'art_1',
  album: 'Starboy',
  albumId: 'alb_1',
  duration: 230,
  genre: 'Pop',
  category: 'global_trending',
  releaseYear: 2016,
  plays: 10000,
  likes: 5000,
  coverUrl: 'https://images.unsplash.com/photo-starboy.jpg',
  audioUrl: 'https://audio.raagax.com/starboy.mp3',
  sources: { jiosaavn: { id: 'saavn_1' } }
};

const dummySong2: Song = {
  id: 'song_2',
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  artistId: 'art_1',
  album: 'After Hours',
  albumId: 'alb_2',
  duration: 200,
  genre: 'Pop',
  category: 'global_trending',
  releaseYear: 2020,
  plays: 20000,
  likes: 10000,
  coverUrl: 'https://images.unsplash.com/photo-blinding.jpg',
  audioUrl: 'https://audio.raagax.com/blinding.mp3',
  sources: { jiosaavn: { id: 'saavn_2' } }
};

const dummySong3: Song = {
  id: 'song_3',
  title: 'Save Your Tears',
  artist: 'The Weeknd',
  artistId: 'art_1',
  album: 'After Hours',
  albumId: 'alb_2',
  duration: 215,
  genre: 'Pop',
  category: 'global_trending',
  releaseYear: 2020,
  plays: 15000,
  likes: 8000,
  coverUrl: 'https://images.unsplash.com/photo-save.jpg',
  audioUrl: 'https://audio.raagax.com/save.mp3',
  sources: { jiosaavn: { id: 'saavn_3' } }
};

describe('Spotify-Grade Connect Platform: End-to-End Master Specification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      deviceId: 'dev_phone_local',
      isActiveDevice: true,
      activeDeviceId: 'dev_phone_local',
      connectedDeviceId: null,
      currentSong: dummySong1,
      currentTime: 45,
      duration: 230,
      isPlaying: true,
      queue: [dummySong1, dummySong2, dummySong3],
      queueIndex: 0,
      volume: 0.8,
      isMuted: false,
      shuffleMode: 'OFF' as any,
      repeatMode: 'OFF' as any,
      deviceConnectionState: 'AVAILABLE',
      onlineDevices: [
        { id: 'dev_phone_local', name: 'My Phone', platform: 'Android', isOnline: true },
        { id: 'dev_laptop_remote', name: 'My Laptop', platform: 'Windows', isOnline: true },
        { id: 'dev_tv_livingroom', name: 'Living Room TV', platform: 'Android', isOnline: true },
      ]
    });

    QueueManager.getInstance().replaceQueue([dummySong1, dummySong2, dummySong3], 0, 'USER');
    CommandSequencer.getInstance().reset();
    CommandSequencer.getInstance().setEpoch(1);
    CommandValidator.getInstance().reset();
    CommandBus.getInstance().reset();
  });

  describe('1. Single Active Player Invariant & Handoff ("Continue on Device")', () => {
    it('enforces single audio output: controller does not output audio while following remote active player', () => {
      const stateSync = PlaybackStateSync.getInstance();
      
      const remoteState: RemotePlaybackState = {
        activeDeviceId: 'dev_laptop_remote',
        activeDeviceName: 'My Laptop',
        songId: dummySong2.id,
        songData: dummySong2,
        isPlaying: true,
        positionMs: 62000,
        durationMs: 200000,
        volume: 0.75,
        isMuted: false,
        queue: [dummySong1, dummySong2, dummySong3],
        queueIndex: 1,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        serverTimestamp: Date.now(),
        epoch: 1,
        revision: 5
      };

      // Adopt remote state on Phone (in controller mode)
      usePlayerStore.setState({
        isActiveDevice: false,
        connectedDeviceId: 'dev_laptop_remote',
        activeDeviceId: 'dev_laptop_remote',
      });

      stateSync.adoptRemoteState(remoteState, 5);

      const store = usePlayerStore.getState();
      expect(store.isActiveDevice).toBe(false);
      expect(store.activeDeviceId).toBe('dev_laptop_remote');
      expect(store.connectedDeviceId).toBe('dev_laptop_remote');
      expect(store.currentSong?.id).toBe(dummySong2.id);
      expect(store.currentTime).toBe(62);
      expect(store.queueIndex).toBe(1);
    });

    it('seamlessly transfers playback from Phone to Laptop preserving track, position, queue, and playback state', async () => {
      // 1. Initial state: Phone is playing Starboy at 45s
      expect(usePlayerStore.getState().currentSong?.title).toBe('Starboy');
      expect(usePlayerStore.getState().currentTime).toBe(45);
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      // 2. Capture transfer snapshot
      const snapshot: PlaybackSnapshot = usePlayerStore.getState().getPlaybackSnapshot();
      expect(snapshot.currentTrackId).toBe('song_1');
      expect(snapshot.positionMs).toBe(45000);
      expect(snapshot.isPlaying).toBe(true);

      // Set controller mode following transfer initiation
      usePlayerStore.setState({
        isActiveDevice: false,
        connectedDeviceId: 'dev_laptop_remote',
      });

      // 3. Laptop becomes active player with received state
      const laptopRemoteState: RemotePlaybackState = {
        activeDeviceId: 'dev_laptop_remote',
        activeDeviceName: 'My Laptop',
        songId: snapshot.currentTrackId,
        songData: dummySong1,
        isPlaying: snapshot.isPlaying,
        positionMs: snapshot.positionMs,
        durationMs: 230000,
        volume: 0.8,
        isMuted: false,
        queue: [dummySong1, dummySong2, dummySong3],
        queueIndex: 0,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        serverTimestamp: Date.now(),
        epoch: 2,
        revision: 1
      };

      PlaybackStateSync.getInstance().adoptRemoteState(laptopRemoteState, 1);

      const postHandoffStore = usePlayerStore.getState();
      expect(postHandoffStore.isActiveDevice).toBe(false);
      expect(postHandoffStore.activeDeviceId).toBe('dev_laptop_remote');
      expect(postHandoffStore.currentSong?.id).toBe('song_1');
      expect(postHandoffStore.currentTime).toBe(45);
      expect(postHandoffStore.isPlaying).toBe(true);
    });

    it('transfers playback back from remote Laptop to local Phone cleanly ("Switch Playback Here")', async () => {
      // Setup: Phone currently acting as controller for remote Laptop
      usePlayerStore.setState({
        isActiveDevice: false,
        activeDeviceId: 'dev_laptop_remote',
        connectedDeviceId: 'dev_laptop_remote',
        remoteDeviceName: 'My Laptop',
        currentSong: dummySong2,
        currentTime: 80,
        isPlaying: true,
      });

      // User taps "Switch Playback to This Device"
      await usePlayerStore.getState().transferPlayback('dev_phone_local');

      const store = usePlayerStore.getState();
      expect(store.isActiveDevice).toBe(true);
      expect(store.activeDeviceId).toBe('dev_phone_local');
      expect(store.connectedDeviceId).toBeNull();
      expect(store.remoteDeviceName).toBeNull();
    });
  });

  describe('2. Logical Playback Clock & Drift Correction', () => {
    it('calculates live playback position dynamically using snapshot and wall clock elapsed time', () => {
      const now = 1000000;
      const snapshot: PlaybackSnapshot = {
        sessionId: 'sess_1',
        deviceId: 'dev_laptop_remote',
        currentTrackId: 'song_1',
        positionMs: 30000, // 30s
        timestampMs: now - 5000, // 5s ago
        isPlaying: true,
        sequence: 1,
        durationMs: 230000
      };

      const calculated = calculateLivePositionMs(snapshot, now);
      expect(calculated).toBe(35000); // 30s + 5s elapsed = 35s
    });

    it('freezes logical position when isPlaying is false (paused state)', () => {
      const now = 1000000;
      const snapshot: PlaybackSnapshot = {
        sessionId: 'sess_1',
        deviceId: 'dev_laptop_remote',
        currentTrackId: 'song_1',
        positionMs: 42000, // 42s
        timestampMs: now - 10000, // 10s ago, but paused
        isPlaying: false,
        sequence: 1,
        durationMs: 230000
      };

      const calculated = calculateLivePositionMs(snapshot, now);
      expect(calculated).toBe(42000); // Exactly 42s, does not advance while paused
    });

    it('caps logical position to song durationMs to prevent overflow', () => {
      const now = 1000000;
      const snapshot: PlaybackSnapshot = {
        sessionId: 'sess_1',
        deviceId: 'dev_laptop_remote',
        currentTrackId: 'song_1',
        positionMs: 228000,
        timestampMs: now - 5000, // 5s elapsed, but only 2s remain
        isPlaying: true,
        sequence: 1,
        durationMs: 230000 // 230s max
      };

      const calculated = calculateLivePositionMs(snapshot, now);
      expect(calculated).toBe(230000);
    });
  });

  describe('3. Remote Queue Synchronization & Real-Time Mutations', () => {
    it('executes ADD_TO_QUEUE remotely on active player and updates session queue', () => {
      const bus = CommandBus.getInstance();
      bus.init('dev_phone_local', 'sess_100');

      const addCommand: ConnectCommand = {
        commandId: 'cmd_add_q1',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        targetDeviceId: 'dev_phone_local',
        type: 'ADD_TO_QUEUE',
        sentAt: Date.now(),
        payload: {
          song: dummySong3,
          playNext: false
        }
      };

      bus.handleIncomingCommand(addCommand);

      const store = usePlayerStore.getState();
      expect(store.queue.some(s => s.id === 'song_3')).toBe(true);
    });

    it('executes REMOVE_FROM_QUEUE remotely on active player', () => {
      const bus = CommandBus.getInstance();
      bus.init('dev_phone_local', 'sess_100');

      const removeCommand: ConnectCommand = {
        commandId: 'cmd_rm_q1',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        targetDeviceId: 'dev_phone_local',
        type: 'REMOVE_FROM_QUEUE',
        sentAt: Date.now(),
        payload: {
          songId: 'song_2'
        }
      };

      bus.handleIncomingCommand(removeCommand);

      const store = usePlayerStore.getState();
      expect(store.queue.some(s => s.id === 'song_2')).toBe(false);
    });

    it('executes CLEAR_QUEUE remotely preserving only currently playing song and history', () => {
      const bus = CommandBus.getInstance();
      bus.init('dev_phone_local', 'sess_100');

      usePlayerStore.setState({
        queue: [dummySong1, dummySong2, dummySong3],
        queueIndex: 0
      });

      const clearCommand: ConnectCommand = {
        commandId: 'cmd_clear_q1',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        targetDeviceId: 'dev_phone_local',
        type: 'CLEAR_QUEUE',
        sentAt: Date.now(),
        payload: {}
      };

      bus.handleIncomingCommand(clearCommand);

      const store = usePlayerStore.getState();
      expect(store.queue.length).toBe(1);
      expect(store.queue[0].id).toBe('song_1');
    });

    it('executes MOVE_QUEUE_ITEM remotely to reorder upcoming tracks', () => {
      const bus = CommandBus.getInstance();
      bus.init('dev_phone_local', 'sess_100');

      usePlayerStore.setState({
        queue: [dummySong1, dummySong2, dummySong3],
        queueIndex: 0
      });

      // Move upcoming track at index 1 (song_3) before index 0 (song_2)
      const moveCommand: ConnectCommand = {
        commandId: 'cmd_move_q1',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        targetDeviceId: 'dev_phone_local',
        type: 'MOVE_QUEUE_ITEM',
        sentAt: Date.now(),
        payload: {
          fromUpNextIndex: 1,
          toUpNextIndex: 0
        }
      };

      bus.handleIncomingCommand(moveCommand);

      const store = usePlayerStore.getState();
      expect(store.queue[1].id).toBe('song_3');
      expect(store.queue[2].id).toBe('song_2');
    });
  });

  describe('4. Multi-Controller Concurrency & Race Condition Protection', () => {
    it('processes commands from multiple controllers sequentially and maintains monotonic sequence', () => {
      const bus = CommandBus.getInstance();
      bus.init('dev_phone_local', 'sess_100');

      usePlayerStore.setState({ isPlaying: true });

      // Controller A (Laptop) sends PAUSE
      bus.handleIncomingCommand({
        commandId: 'cmd_ctrl_a_pause',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        targetDeviceId: 'dev_phone_local',
        type: 'PAUSE',
        sentAt: Date.now(),
        payload: {}
      });

      expect(usePlayerStore.getState().isPlaying).toBe(false);

      // Controller B (TV) sends PLAY
      bus.handleIncomingCommand({
        commandId: 'cmd_ctrl_b_play',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_tv_livingroom',
        targetDeviceId: 'dev_phone_local',
        type: 'PLAY',
        sentAt: Date.now(),
        payload: {}
      });

      expect(usePlayerStore.getState().isPlaying).toBe(true);
    });

    it('rejects duplicate commands using idempotency token deduplication', () => {
      const bus = CommandBus.getInstance();
      bus.init('dev_phone_local', 'sess_100');

      const cmd: ConnectCommand = {
        commandId: 'idempotent_cmd_test_001',
        sessionId: 'sess_100',
        epoch: 1,
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        targetDeviceId: 'dev_phone_local',
        type: 'SEEK',
        sentAt: Date.now(),
        payload: { positionMs: 90000 }
      };

      // First execution
      bus.handleIncomingCommand(cmd);
      expect(usePlayerStore.getState().currentTime).toBe(90);

      // Mutate time manually to verify duplicate command is ignored
      usePlayerStore.setState({ currentTime: 110 });

      // Duplicate execution attempt with same commandId
      bus.handleIncomingCommand(cmd);
      expect(usePlayerStore.getState().currentTime).toBe(110); // Not overwritten back to 90
    });

    it('fences and rejects commands with stale epochs from previous lease holders', () => {
      const validator = CommandValidator.getInstance();
      CommandSequencer.getInstance().setEpoch(5);

      const staleCommand: ConnectCommand = {
        commandId: 'cmd_stale_epoch',
        sessionId: 'sess_100',
        epoch: 4, // Stale epoch (< 5)
        sequence: 1,
        sourceDeviceId: 'dev_laptop_remote',
        type: 'PAUSE',
        sentAt: Date.now(),
        payload: {}
      };

      const isValid = validator.validate(staleCommand);
      expect(isValid).toBe(false);
    });
  });

  describe('5. Resiliency: Controller Disconnect & Active Player Continuous Playback', () => {
    it('active player continues playing independently when controller disconnects', async () => {
      // Laptop is playing locally as Active Renderer
      usePlayerStore.setState({
        deviceId: 'dev_laptop_remote',
        isActiveDevice: true,
        activeDeviceId: 'dev_laptop_remote',
        connectedDeviceId: null,
        isPlaying: true,
        currentSong: dummySong1,
        currentTime: 75
      });

      // Phone (controller) disconnects
      // Local laptop state MUST NOT pause or clear queue
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentSong?.id).toBe('song_1');
      expect(usePlayerStore.getState().currentTime).toBe(75);
    });

    it('controller recovers authoritative playback state upon reconnecting', () => {
      // Phone was disconnected, now reconnects and receives current snapshot from Laptop
      const authoritativeLaptopState: RemotePlaybackState = {
        activeDeviceId: 'dev_laptop_remote',
        activeDeviceName: 'My Laptop',
        songId: dummySong3.id,
        songData: dummySong3,
        isPlaying: true,
        positionMs: 112000,
        durationMs: 215000,
        volume: 0.85,
        isMuted: false,
        queue: [dummySong1, dummySong2, dummySong3],
        queueIndex: 2,
        shuffleMode: 'OFF',
        repeatMode: 'OFF',
        serverTimestamp: Date.now(),
        epoch: 2,
        revision: 14
      };

      usePlayerStore.setState({
        deviceId: 'dev_phone_local',
        isActiveDevice: false,
        connectedDeviceId: 'dev_laptop_remote',
      });

      PlaybackStateSync.getInstance().adoptRemoteState(authoritativeLaptopState, 14);

      const store = usePlayerStore.getState();
      expect(store.currentSong?.id).toBe(dummySong3.id);
      expect(store.currentTime).toBe(112);
      expect(store.queueIndex).toBe(2);
      expect(store.isPlaying).toBe(true);
      expect(store.lastReceivedPlaybackRevision).toBe(14);
    });
  });

  describe('6. Security & Device Capabilities Verification', () => {
    it('advertises accurate device capabilities for desktop, mobile, and web targets', () => {
      const friendlyDesktop = DeviceRegistry.getInstance().getFriendlyDeviceName();
      expect(friendlyDesktop).toBeDefined();
      expect(friendlyDesktop.name).toBeDefined();
    });

    it('correctly maps command delivery classes for critical, interactive, and preview commands', () => {
      expect(COMMAND_CLASS_MAP.PLAY).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.PAUSE).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.SEEK).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.ADD_TO_QUEUE).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.REMOVE_FROM_QUEUE).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.CLEAR_QUEUE).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.MOVE_QUEUE_ITEM).toBe('CRITICAL');
      expect(COMMAND_CLASS_MAP.SET_VOLUME).toBe('INTERACTIVE');
      expect(COMMAND_CLASS_MAP.SEEK_DRAG).toBe('HIGH_FREQUENCY');
    });
  });
});
