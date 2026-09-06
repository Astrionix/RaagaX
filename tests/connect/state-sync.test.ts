import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectSessionManager } from '@/lib/connect/session/ConnectSessionManager';
import { TransportManager } from '@/lib/connect/transport/TransportManager';
import { usePlayerStore } from '@/context/usePlayerStore';
import { PlaybackService } from '@/lib/playback/PlaybackService';
import { PlaybackState, ControlMessage } from '@/lib/connect/types';

describe('RaagaX Connect — State Sync & Idempotency Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TransportManager.getInstance(), 'send').mockResolvedValue(undefined);
    (ConnectSessionManager.getInstance() as any).connectedControllers.clear();

    usePlayerStore.setState({
      isLocalPlayback: false, // Simulate remote controller
      isPlaying: false,
      currentTime: 10,
      volume: 0.8,
    });
  });

  it('1. Optimistic Updates: Controller applies local mutation immediately on sendCommand', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    await sessionMgr.sendCommand('PLAY');
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await sessionMgr.sendCommand('PAUSE');
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    await sessionMgr.sendCommand('SEEK', { position: 45 });
    expect(usePlayerStore.getState().currentTime).toBe(45);

    await sessionMgr.sendCommand('VOLUME', { volume: 0.5 });
    expect(usePlayerStore.getState().volume).toBe(0.5);
  });

  it('2. Authoritative Reconcile: Controller reconciles against STATE_SYNC from player', () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    const authoritativeState: PlaybackState = {
      sessionId: 'sess_live',
      revision: 10,
      trackId: 'song_123',
      position: 78,
      duration: 210,
      isPlaying: true,
      volume: 0.9,
      queue: ['song_123', 'song_124'],
      shuffle: false,
      repeat: 'off',
      activePlayerDeviceId: 'dev_player_authoritative',
      updatedAt: Date.now(),
    };

    const syncMsg: ControlMessage = {
      commandId: 'cmd_sync_1',
      sessionId: 'sess_live',
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'STATE_SYNC',
      payload: authoritativeState,
      senderDeviceId: 'dev_player_authoritative',
    };

    // Simulate incoming authoritative message
    (sessionMgr as any).handleIncomingControlMessage(syncMsg);

    // Controller state should now reflect the authoritative player's state
    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(true);
    expect(store.currentTime).toBe(78);
    expect(store.volume).toBe(0.9);
  });

  it('3. Stale Revision Discard: Stale revisions from network blips do NOT overwrite state', () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    // Latest state at revision 20
    (sessionMgr as any).currentRevision = 20;
    (sessionMgr as any).lastStateUpdatedAt = Date.now();
    usePlayerStore.setState({ isPlaying: true, currentTime: 100 });

    const staleState: PlaybackState = {
      sessionId: 'sess_live',
      revision: 15, // STALE revision!
      trackId: 'song_old',
      position: 50,
      duration: 210,
      isPlaying: false,
      volume: 0.5,
      queue: [],
      shuffle: false,
      repeat: 'off',
      activePlayerDeviceId: 'dev_player',
      updatedAt: Date.now() - 5000,
    };

    const staleMsg: ControlMessage = {
      commandId: 'cmd_stale_1',
      sessionId: 'sess_live',
      sequenceNumber: 0,
      timestamp: Date.now() - 5000,
      type: 'STATE_SYNC',
      payload: staleState,
      senderDeviceId: 'dev_player',
    };

    (sessionMgr as any).handleIncomingControlMessage(staleMsg);

    // Should remain untouched
    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(true);
    expect(store.currentTime).toBe(100);
  });

  it('4. Optimistic NEXT / PREV on Controller: UI flips immediately without waiting for player ack', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    const song1 = { id: 'song_1', title: 'Song One', duration: 180 } as any;
    const song2 = { id: 'song_2', title: 'Song Two', duration: 220 } as any;

    usePlayerStore.setState({
      isLocalPlayback: false, // Controller
      queue: [song1, song2],
      queueIndex: 0,
      currentSong: song1,
      currentTime: 45,
      isPlaying: true,
    });

    // Tap NEXT on controller
    await sessionMgr.sendCommand('NEXT');
    let state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_2');
    expect(state.queueIndex).toBe(1);
    expect(state.currentTime).toBe(0);

    // Tap PREV on controller
    await sessionMgr.sendCommand('PREV');
    state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe('song_1');
    expect(state.queueIndex).toBe(0);
    expect(state.currentTime).toBe(0);
  });

  it('5. Connected Controllers Tracking & Direct Cloud Broadcast', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();
    const { DeviceDiscoveryEngine } = await import('@/lib/connect/discovery/DeviceDiscoveryEngine');
    const cloudSpy = vi.spyOn(DeviceDiscoveryEngine.getInstance(), 'sendCloudCommand').mockReturnValue(true);

    // Simulate Desktop Authoritative Player receiving NEXT command from iPad
    usePlayerStore.setState({
      isLocalPlayback: true,
      currentSong: { id: 'song_authoritative', title: 'Authoritative Track', duration: 300 } as any,
      queueIndex: 3,
      currentTime: 0,
      isPlaying: true,
    });

    const incomingCommand: ControlMessage = {
      commandId: 'cmd_from_ipad_999',
      sessionId: 'sess_1',
      sequenceNumber: 5,
      timestamp: Date.now(),
      type: 'NEXT',
      payload: {},
      senderDeviceId: 'ipad_device_123',
    };

    // Desktop handles incoming command from iPad
    await sessionMgr.handleIncomingControlMessage(incomingCommand);

    // Verify iPad was registered in connectedControllers
    expect((sessionMgr as any).connectedControllers.has('ipad_device_123')).toBe(true);

    // Verify STATE_SYNC was broadcast back to iPad
    expect(cloudSpy).toHaveBeenCalledWith(
      'ipad_device_123',
      expect.objectContaining({
        type: 'STATE_SYNC',
        payload: expect.objectContaining({
          trackId: 'song_authoritative',
          queueIndex: 3,
        }),
      })
    );
  });

  it('6. Authoritative Reconcile Updates Controller Song & QueueIndex', () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    const initialSong = { id: 'song_init', title: 'Initial' } as any;
    const nextSong = { id: 'song_next', title: 'Next Desktop Song', duration: 250 } as any;

    usePlayerStore.setState({
      isLocalPlayback: false, // Controller
      currentSong: initialSong,
      queue: [initialSong, nextSong],
      queueIndex: 0,
      duration: 180,
    });

    const syncMsg: ControlMessage = {
      commandId: 'sync_new_track',
      sessionId: 'sess_live',
      sequenceNumber: 2,
      timestamp: Date.now(),
      type: 'STATE_SYNC',
      payload: {
        sessionId: 'sess_live',
        revision: 50,
        trackId: 'song_next',
        position: 0,
        duration: 250,
        isPlaying: true,
        volume: 1.0,
        queue: ['song_init', 'song_next'],
        queueIndex: 1,
        shuffle: false,
        repeat: 'off',
        activePlayerDeviceId: 'desktop_host',
        updatedAt: Date.now(),
        currentSongData: nextSong,
      } as PlaybackState,
      senderDeviceId: 'desktop_host',
    };

    (sessionMgr as any).handleIncomingControlMessage(syncMsg);

    const store = usePlayerStore.getState();
    expect(store.currentSong?.id).toBe('song_next');
    expect(store.currentSong?.title).toBe('Next Desktop Song');
    expect(store.queueIndex).toBe(1);
    expect(store.duration).toBe(250);
  });

  it('7. Remote Speaker Pauses on DISCONNECT or PAUSE command', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();
    const pauseSpy = vi.spyOn(PlaybackService.getInstance(), 'pause').mockImplementation(() => {});

    // Authoritative Desk player playing music
    usePlayerStore.setState({
      isLocalPlayback: true,
      isPlaying: true,
      currentSong: { id: 'song_desk', title: 'Desk Track' } as any,
    });
    (sessionMgr as any).connectedControllers.add('ipad_controller');

    const disconnectMsg: ControlMessage = {
      commandId: 'cmd_disc_1',
      sessionId: 'sess_1',
      sequenceNumber: 99,
      timestamp: Date.now(),
      type: 'DISCONNECT',
      payload: { reason: 'user_disconnect' },
      senderDeviceId: 'ipad_controller',
    };

    await (sessionMgr as any).handleIncomingControlMessage(disconnectMsg);

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(pauseSpy).toHaveBeenCalled();
    expect((sessionMgr as any).connectedControllers.has('ipad_controller')).toBe(false);
  });

  it('8. Handover to Local (transferPlaybackToLocal) pauses speaker and resumes locally', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();
    const sendSpy = vi.spyOn(sessionMgr, 'sendCommand').mockResolvedValue(undefined);
    const switchSpy = vi.spyOn(usePlayerStore.getState(), 'switchTrack').mockResolvedValue(true);

    const activeSong = { id: 'song_handover', title: 'Handover Song' } as any;

    // iPad acting as remote controller with active song playing on Desk at 42 seconds
    usePlayerStore.setState({
      isLocalPlayback: false,
      activePlaybackDeviceId: 'desk_speaker_id',
      activePlaybackDeviceName: 'Windows PC',
      isPlaying: true,
      currentTime: 42,
      currentSong: activeSong,
      queue: [activeSong],
      queueIndex: 0,
    });

    (sessionMgr as any).activePeer = { peer: { deviceId: 'desk_speaker_id' } };

    await sessionMgr.transferPlaybackToLocal(true);

    // Verified remote speaker was commanded to pause
    expect(sendSpy).toHaveBeenCalledWith('PAUSE');
    expect(sendSpy).toHaveBeenCalledWith('DISCONNECT', expect.objectContaining({ reason: 'transfer_to_local' }));

    // Verified local device took over
    const store = usePlayerStore.getState();
    expect(store.isLocalPlayback).toBe(true);
    expect(store.activePlaybackDeviceId).toBe('dev_local');

    // Verified switchTrack was called with saved position
    expect(switchSpy).toHaveBeenCalledWith(activeSong, 0, true, 42);
  });

  it('9. Timestamp Synchronization: Connecting to Remote Speaker preserves exact 30s position', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();
    const sendSpy = vi.spyOn(sessionMgr, 'sendCommand').mockResolvedValue(undefined);
    const switchSpy = vi.spyOn(usePlayerStore.getState(), 'switchTrack').mockResolvedValue(true);

    const ipadSong = { id: 'song_30s', title: '30 Second Song' } as any;

    // iPad playing locally at 30 seconds
    usePlayerStore.setState({
      isLocalPlayback: true,
      activePlaybackDeviceId: 'dev_local',
      isPlaying: true,
      currentTime: 30,
      currentSong: ipadSong,
      queue: [ipadSong],
      queueIndex: 0,
    });

    const authorizedPeer: any = {
      peer: { deviceId: 'desk_pc', deviceName: 'Windows PC' },
      role: 'player',
      expiresAt: Date.now() + 100000,
    };

    // Controller transfers playback to Desk
    await sessionMgr.transferPlaybackToPeer(authorizedPeer);

    // Verified SWITCH_PLAYBACK was sent with position: 30
    expect(sendSpy).toHaveBeenCalledWith('SWITCH_PLAYBACK', expect.objectContaining({
      song: ipadSong,
      position: 30,
      isPlaying: true,
    }));

    // Now simulate Desk (player) receiving this SWITCH_PLAYBACK message
    usePlayerStore.setState({
      isLocalPlayback: true,
      currentSong: null,
      currentTime: 0,
    });

    const switchMsg: ControlMessage = {
      commandId: 'cmd_switch_30s',
      sessionId: 'sess_1',
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'SWITCH_PLAYBACK',
      payload: {
        song: ipadSong,
        position: 30,
        isPlaying: true,
        queue: [ipadSong],
        queueIndex: 0,
      },
      senderDeviceId: 'ipad_dev',
    };

    await (sessionMgr as any).handleIncomingControlMessage(switchMsg);

    // Verified Desk player called switchTrack with initialPositionSec = 30
    expect(switchSpy).toHaveBeenCalledWith(ipadSong, 0, true, 30);
  });

  it('10. Timeline Delta-Time Interpolation: Advances time accurately with performance.now()', () => {
    vi.useFakeTimers();
    const sessionMgr = ConnectSessionManager.getInstance();

    usePlayerStore.setState({
      isLocalPlayback: false, // Controller
      isPlaying: true,
      currentSong: { id: 'song_interp', duration: 200 } as any,
      duration: 200,
      currentTime: 10,
    });

    let mockTime = 100000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    sessionMgr.startControllerInterpolation();

    // Advance virtual time by 500ms (2 ticks of 250ms)
    mockTime += 250;
    vi.advanceTimersByTime(250);
    expect(usePlayerStore.getState().currentTime).toBeCloseTo(10.25, 2);

    mockTime += 250;
    vi.advanceTimersByTime(250);
    expect(usePlayerStore.getState().currentTime).toBeCloseTo(10.50, 2);

    sessionMgr.stopControllerInterpolation();
    vi.useRealTimers();
  });

  it('11. Pause Timeline Snapping: Controller snaps unconditionally to paused speaker position without deadzone', () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    usePlayerStore.setState({
      isLocalPlayback: false, // Controller
      isPlaying: true,
      currentTime: 24.3, // Controller is at 24.3s (small drift under 0.5s)
    });

    // Speaker paused at 24.1s
    const syncMsg: ControlMessage = {
      commandId: 'cmd_pause_sync',
      sessionId: 'sess_1',
      sequenceNumber: 20,
      timestamp: Date.now(),
      type: 'STATE_SYNC',
      payload: {
        sessionId: 'sess_1',
        revision: 100,
        trackId: 'song_pause',
        position: 24.1,
        duration: 200,
        isPlaying: false, // Paused!
        volume: 0.8,
        queue: ['song_pause'],
        shuffle: false,
        repeat: 'off',
        activePlayerDeviceId: 'desk_host',
        updatedAt: Date.now(),
      } as PlaybackState,
      senderDeviceId: 'desk_host',
    };

    (sessionMgr as any).handleIncomingControlMessage(syncMsg);

    const store = usePlayerStore.getState();
    expect(store.isPlaying).toBe(false);
    expect(store.currentTime).toBe(24.1); // Must snap unconditionally to 24.1s!
  });

  it('12. Full Queue Synchronization: Controller updates queue from authoritative queueSongs snapshot', () => {
    const sessionMgr = ConnectSessionManager.getInstance();

    const songA = { id: 'song_a', title: 'Song A', duration: 120 } as any;
    const songB = { id: 'song_b', title: 'Song B', duration: 180 } as any;
    const songC = { id: 'song_c', title: 'Song C', duration: 240 } as any;

    usePlayerStore.setState({
      isLocalPlayback: false, // Controller
      currentSong: songA,
      queue: [songA, songB],
      queueIndex: 0,
    });

    // Speaker reordered or added songC
    const syncMsg: ControlMessage = {
      commandId: 'cmd_queue_sync',
      sessionId: 'sess_1',
      sequenceNumber: 30,
      timestamp: Date.now(),
      type: 'STATE_SYNC',
      payload: {
        sessionId: 'sess_1',
        revision: 105,
        trackId: 'song_a',
        position: 15,
        duration: 120,
        isPlaying: true,
        volume: 0.8,
        queue: ['song_a', 'song_c', 'song_b'],
        queueIndex: 0,
        shuffle: false,
        repeat: 'off',
        activePlayerDeviceId: 'desk_host',
        updatedAt: Date.now(),
        queueSongs: [songA, songC, songB],
      } as PlaybackState,
      senderDeviceId: 'desk_host',
    };

    (sessionMgr as any).handleIncomingControlMessage(syncMsg);

    const store = usePlayerStore.getState();
    expect(store.queue.length).toBe(3);
    expect(store.queue.map(s => s.id)).toEqual(['song_a', 'song_c', 'song_b']);
  });

  it('13. Local Speaker Volume & Queue Changes Broadcast to Controllers', async () => {
    const sessionMgr = ConnectSessionManager.getInstance();
    const broadcastSpy = vi.spyOn(sessionMgr, 'broadcastCurrentState');

    // Simulate authoritative speaker
    usePlayerStore.setState({
      isLocalPlayback: true,
      currentSong: { id: 'song_desk', duration: 180 } as any,
      queue: [{ id: 'song_desk', duration: 180 } as any],
      volume: 0.5,
      isMuted: false,
      isPlaying: true,
    });

    // Toggle mute on speaker
    usePlayerStore.getState().toggleMute();
    expect(broadcastSpy).toHaveBeenCalled();

    // Toggle shuffle on speaker
    broadcastSpy.mockClear();
    await usePlayerStore.getState().toggleShuffle();
    expect(broadcastSpy).toHaveBeenCalled();

    // Set repeat mode on speaker
    broadcastSpy.mockClear();
    await usePlayerStore.getState().setRepeatMode('one');
    expect(broadcastSpy).toHaveBeenCalled();
  });
});

