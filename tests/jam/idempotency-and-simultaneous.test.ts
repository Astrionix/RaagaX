import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'idemp_song',
  title: 'Idempotency Test Song',
  artist: 'RaagaX',
  artistId: 'art_1',
  album: 'Reliability',
  albumId: 'alb_1',
  duration: 150,
  coverUrl: 'https://cdn.test/idemp.jpg',
  audioUrl: 'https://cdn.test/idemp.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 10,
  likes: 1,
};

describe('Idempotency & Simultaneous Command Serialization', () => {
  let engine: JamServerEngine;

  beforeEach(() => {
    engine = JamServerEngine.getInstance();
    engine.resetForTesting();
  });

  it('1. Duplicate requests with identical requestId return cached response without adding duplicates', () => {
    const { session } = engine.createSession({
      hostId: 'user_host',
      hostName: 'Host',
      initialSong: mockSong,
    });

    const fixedRequestId = 'req_unique_add_12345';

    // First Send
    const res1 = engine.executeCommand({
      commandId: 'cmd_1',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'ADD_TRACK',
      payload: { song: mockSong },
      requestId: fixedRequestId,
    });

    expect(res1.success).toBe(true);
    expect(res1.isIdempotentReplay).toBeFalsy();
    expect(res1.session!.queue.length).toBe(1);

    // Second Send (Network retry / duplicate request with SAME requestId)
    const res2 = engine.executeCommand({
      commandId: 'cmd_2',
      jamId: session.jamId,
      userId: 'user_host',
      action: 'ADD_TRACK',
      payload: { song: mockSong },
      requestId: fixedRequestId,
    });

    expect(res2.success).toBe(true);
    expect(res2.isIdempotentReplay).toBe(true);
    // Queue length MUST still be 1 (zero duplicate item added!)
    const currentSession = engine.getSession(session.jamId)!;
    expect(currentSession.queue.length).toBe(1);
  });
});
