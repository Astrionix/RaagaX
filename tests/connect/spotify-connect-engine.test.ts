import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectGateway, CanonicalSessionState } from '@/lib/connect/gateway/ConnectGateway';

describe('Spotify Connect — Canonical Engine & Gateway Architecture', () => {
  let gateway: ConnectGateway;
  const userId = 'user_test_spotify_connect_123';

  beforeEach(() => {
    gateway = ConnectGateway.getInstance();
  });

  it('1. Initializes canonical session with valid authority schema', () => {
    const session = gateway.getOrCreateSession(userId);
    expect(session.userId).toBe(userId);
    expect(session.stateVersion).toBeGreaterThanOrEqual(1);
    expect(session.playback.isPaused).toBe(true);
    expect(session.volume.value).toBe(80);
  });

  it('2. Zero-Gap Handover: Promotes target device and silences old speaker', async () => {
    let unicastSent: { target: string; action: string; payload: any } | null = null;
    const unsubscribe = gateway.onUnicastCommand((target, action, payload) => {
      unicastSent = { target, action, payload };
    });

    // Step 1: Device X is initial active speaker
    await gateway.handleCommand(userId, {
      commandId: 'cmd_1',
      senderDeviceId: 'dev_phone_x',
      senderName: 'iPhone 15 Pro',
      action: 'TRANSFER_PLAYBACK',
      payload: {
        deviceType: 'mobile',
        isPlaying: true,
        positionMs: 45000,
        track: {
          id: 'track_1',
          title: 'Starboy',
          artist: 'The Weeknd',
          durationMs: 230000,
          audioUrl: 'https://aac.saavncdn.com/test_starboy.mp4',
        },
      },
      timestamp: Date.now(),
    });

    let session = gateway.getOrCreateSession(userId);
    expect(session.activeSpeakerId).toBe('dev_phone_x');
    expect(session.playback.isPaused).toBe(false);
    expect(session.playback.positionMs).toBe(45000);
    const initialVersion = session.stateVersion;

    // Step 2: Device Y (Laptop) requests takeover ("Play on this device")
    await gateway.handleCommand(userId, {
      commandId: 'cmd_2',
      senderDeviceId: 'dev_laptop_y',
      senderName: 'MacBook Pro',
      action: 'TRANSFER_PLAYBACK',
      payload: {
        deviceType: 'desktop',
        isPlaying: true,
      },
      timestamp: Date.now(),
    });

    session = gateway.getOrCreateSession(userId);
    expect(session.activeSpeakerId).toBe('dev_laptop_y');
    expect(session.activeSpeakerName).toBe('MacBook Pro');
    expect(session.stateVersion).toBeGreaterThan(initialVersion);

    // Verify unicast silence command was dispatched to old speaker (Device X)
    expect(unicastSent).not.toBeNull();
    expect((unicastSent as any)?.target).toBe('dev_phone_x');
    expect((unicastSent as any)?.action).toBe('SILENCE_AND_BECOME_CONTROLLER');

    unsubscribe();
  });

  it('3. Optimistic Concurrency Control: Rejects stale out-of-order commands', async () => {
    const session = gateway.getOrCreateSession(userId);
    const currentVersion = session.stateVersion;

    // Attempt command with stale revision (expectedVersion < currentVersion)
    const result = await gateway.handleCommand(userId, {
      commandId: 'cmd_stale',
      senderDeviceId: 'dev_phone_x',
      action: 'PAUSE',
      expectedVersion: currentVersion - 1,
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('STALE_VERSION');
  });

  it('4. Remote Transport & Volume Dispatch: Forwards commands to physical speaker', async () => {
    const unicastActions: string[] = [];
    const unsubscribe = gateway.onUnicastCommand((target, action) => {
      unicastActions.push(action);
    });

    // Remote Seek from Controller
    await gateway.handleCommand(userId, {
      commandId: 'cmd_seek',
      senderDeviceId: 'dev_remote_ctrl',
      action: 'SEEK',
      payload: { positionMs: 90000 },
      timestamp: Date.now(),
    });

    // Remote Volume change
    await gateway.handleCommand(userId, {
      commandId: 'cmd_vol',
      senderDeviceId: 'dev_remote_ctrl',
      action: 'SET_VOLUME',
      payload: { value: 65 },
      timestamp: Date.now(),
    });

    const session = gateway.getOrCreateSession(userId);
    expect(session.playback.positionMs).toBe(90000);
    expect(session.volume.value).toBe(65);
    expect(unicastActions).toContain('SEEK');
    expect(unicastActions).toContain('SET_VOLUME');

    unsubscribe();
  });

  it('5. Bidirectional Detach: Disconnecting controller preserves uninterrupted speaker playback', async () => {
    const session = gateway.getOrCreateSession(userId);
    const speakerIdBefore = session.activeSpeakerId;
    const isPlayingBefore = !session.playback.isPaused;

    // Controller detaches itself
    await gateway.handleCommand(userId, {
      commandId: 'cmd_detach',
      senderDeviceId: 'dev_remote_ctrl',
      action: 'CONTROLLER_DETACH',
      timestamp: Date.now(),
    });

    const sessionAfter = gateway.getOrCreateSession(userId);
    expect(sessionAfter.controllerId).toBeNull();
    expect(sessionAfter.activeSpeakerId).toBe(speakerIdBefore);
    expect(!sessionAfter.playback.isPaused).toBe(isPlayingBefore);
  });
});
