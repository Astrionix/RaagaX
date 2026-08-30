import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'song_roles_1',
  title: 'Role Test Track',
  artist: 'RaagaX Artist',
  artistId: 'art_1',
  album: 'Role Album',
  albumId: 'alb_1',
  duration: 180,
  coverUrl: 'https://cdn.test/role.jpg',
  audioUrl: 'https://cdn.test/role.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 50,
  likes: 5,
};

describe('Jam Role-Based Access, Presets & Moderator Host Transfer', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('1. Initializes host with role=HOST and participants with role=GUEST', () => {
    const { session } = engine.createSession({
      hostId: 'host_ravi',
      hostName: 'Ravi Host',
      initialSong: mockSong,
    });

    expect(session.participants['host_ravi'].role).toBe('HOST');
    expect(session.participants['host_ravi'].isHost).toBe(true);

    const joinRes = engine.joinSession(session.jamId, {
      userId: 'guest_priya',
      displayName: 'Priya Guest',
    });

    expect(joinRes.session?.participants['guest_priya'].role).toBe('GUEST');
    expect(joinRes.session?.participants['guest_priya'].isHost).toBe(false);
  });

  it('2. Promotes participant to MODERATOR and enforces moderator capabilities', () => {
    const { session } = engine.createSession({
      hostId: 'host_ravi',
      hostName: 'Ravi Host',
      initialSong: mockSong,
      initialQueue: [mockSong],
    });

    engine.joinSession(session.jamId, {
      userId: 'user_alex',
      displayName: 'Alex',
    });

    // Host promotes Alex to MODERATOR
    const promoteRes = engine.executeCommand({
      commandId: 'cmd_promote',
      jamId: session.jamId,
      userId: 'host_ravi',
      action: 'PROMOTE_MODERATOR',
      payload: { targetUserId: 'user_alex' },
    });

    expect(promoteRes.success).toBe(true);
    expect(promoteRes.session?.participants['user_alex'].role).toBe('MODERATOR');

    // Moderator can skip and control playback
    const skipRes = engine.executeCommand({
      commandId: 'cmd_mod_skip',
      jamId: session.jamId,
      userId: 'user_alex',
      action: 'SKIP_NEXT',
    });
    expect(skipRes.success).toBe(true);

    // Moderator CANNOT end session
    const endRes = engine.executeCommand({
      commandId: 'cmd_mod_end',
      jamId: session.jamId,
      userId: 'user_alex',
      action: 'END_SESSION',
    });
    expect(endRes.success).toBe(false);
    expect(endRes.error).toContain('Only the host');
  });

  it('3. Host departure prioritizes MODERATOR over earlier standard guests', () => {
    const { session } = engine.createSession({
      hostId: 'host_ravi',
      hostName: 'Ravi Host',
      initialSong: mockSong,
    });

    // Priya joins first at T+10
    engine.joinSession(session.jamId, {
      userId: 'guest_priya',
      displayName: 'Priya (Earlier Guest)',
    });

    // Alex joins later at T+50
    engine.joinSession(session.jamId, {
      userId: 'guest_alex',
      displayName: 'Alex (Moderator)',
    });

    // Host promotes Alex to MODERATOR
    engine.executeCommand({
      commandId: 'cmd_prom',
      jamId: session.jamId,
      userId: 'host_ravi',
      action: 'PROMOTE_MODERATOR',
      payload: { targetUserId: 'guest_alex' },
    });

    // Ravi leaves -> Alex (Moderator) must become the new host instead of Priya
    const leaveRes = engine.leaveSession(session.jamId, 'host_ravi');
    expect(leaveRes.success).toBe(true);

    const updated = engine.getSession(session.jamId);
    expect(updated?.hostId).toBe('guest_alex');
    expect(updated?.participants['guest_alex'].isHost).toBe(true);
    expect(updated?.participants['guest_alex'].role).toBe('HOST');
  });

  it('4. Applies Permission Presets (HOST_CONTROLLED, COLLABORATIVE, DJ_EVENT)', () => {
    const { session } = engine.createSession({
      hostId: 'host_ravi',
      hostName: 'Ravi Host',
      initialSong: mockSong,
    });

    engine.joinSession(session.jamId, {
      userId: 'guest_priya',
      displayName: 'Priya',
    });

    // Set to HOST_CONTROLLED
    engine.executeCommand({
      commandId: 'cmd_preset_host',
      jamId: session.jamId,
      userId: 'host_ravi',
      action: 'SET_PRESET',
      payload: { presetName: 'HOST_CONTROLLED' },
    });

    // Guest cannot pause under HOST_CONTROLLED
    const pauseRes = engine.executeCommand({
      commandId: 'cmd_pause_guest',
      jamId: session.jamId,
      userId: 'guest_priya',
      action: 'PAUSE',
    });
    expect(pauseRes.success).toBe(false);
    expect(pauseRes.error).toContain('Playback controls are disabled');

    // Switch to COLLABORATIVE
    engine.executeCommand({
      commandId: 'cmd_preset_collab',
      jamId: session.jamId,
      userId: 'host_ravi',
      action: 'SET_PRESET',
      payload: { presetName: 'COLLABORATIVE' },
    });

    // Guest CAN now pause under COLLABORATIVE
    const pauseRes2 = engine.executeCommand({
      commandId: 'cmd_pause_guest_2',
      jamId: session.jamId,
      userId: 'guest_priya',
      action: 'PAUSE',
    });
    expect(pauseRes2.success).toBe(true);
  });
});
