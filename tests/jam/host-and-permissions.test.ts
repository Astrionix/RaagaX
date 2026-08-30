import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'perm_song',
  title: 'Permission Song',
  artist: 'RaagaX',
  artistId: 'art_1',
  album: 'Security',
  albumId: 'alb_1',
  duration: 200,
  coverUrl: 'https://cdn.test/perm.jpg',
  audioUrl: 'https://cdn.test/perm.mp3',
  genre: 'Rock',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 5,
};

describe('Jam Server-Side Permissions & Host Lifecycle', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('1. Rejects unauthorized participant playback commands when permission is disabled', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host User',
      initialSong: mockSong,
    });

    // Participant joins
    engine.joinSession(session.jamId, {
      userId: 'user_guest',
      displayName: 'Guest User',
    });

    // Host disables playback controls for participants
    engine.executeCommand({
      commandId: 'cmd_perm',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'UPDATE_PERMISSIONS',
      payload: { permissions: { canControlPlayback: false } },
    });

    // Guest tries to pause playback -> Must be rejected by server!
    const guestPause = engine.executeCommand({
      commandId: 'cmd_unauth_pause',
      jamId: session.jamId,
      userId: 'user_guest',
      action: 'PAUSE',
    });

    expect(guestPause.success).toBe(false);
    expect(guestPause.error).toContain('disabled for participants');
  });

  it('2. Prevents non-host from modifying session permissions or ending the session', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host User',
      initialSong: mockSong,
    });

    engine.joinSession(session.jamId, {
      userId: 'user_guest',
      displayName: 'Guest User',
    });

    // Guest attempts to update permissions
    const res1 = engine.executeCommand({
      commandId: 'c1',
      jamId: session.jamId,
      userId: 'user_guest',
      action: 'UPDATE_PERMISSIONS',
      payload: { permissions: { canControlPlayback: true } },
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('host');

    // Guest attempts to end the session
    const res2 = engine.executeCommand({
      commandId: 'c2',
      jamId: session.jamId,
      userId: 'user_guest',
      action: 'END_SESSION',
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('host');
  });

  it('3. Automatically transfers host ownership to longest-standing participant when host leaves (Option B)', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Original Host',
      initialSong: mockSong,
    });

    // Participant 1 joins first
    engine.joinSession(session.jamId, {
      userId: 'user_first',
      displayName: 'First Joiner',
    });

    // Participant 2 joins second
    engine.joinSession(session.jamId, {
      userId: 'user_second',
      displayName: 'Second Joiner',
    });

    // Host leaves
    const leaveRes = engine.leaveSession(session.jamId, 'user_host');
    expect(leaveRes.success).toBe(true);
    expect(leaveRes.sessionEnded).toBeFalsy();

    const updatedSession = engine.getSession(session.jamId)!;
    // Ownership should transfer to user_first
    expect(updatedSession.hostId).toBe('user_first');
    expect(updatedSession.hostName).toBe('First Joiner');
    expect(updatedSession.participants['user_first'].isHost).toBe(true);
  });
});
