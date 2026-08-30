import { describe, it, expect, beforeEach } from 'vitest';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';
import { JamDiscoveryEngine } from '@/lib/jam/client/JamDiscoveryEngine';
import { Song } from '@/types/music';

const mockSong: Song = {
  id: 'song_discovery',
  title: 'Discovery Song',
  artist: 'RaagaX',
  artistId: 'art_1',
  album: 'Wireless',
  albumId: 'alb_1',
  duration: 210,
  coverUrl: 'https://cdn.test/disc.jpg',
  audioUrl: 'https://cdn.test/disc.mp3',
  genre: 'Electronic',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 10,
};

describe('Jam Bluetooth, Wi-Fi Discovery & Join Code Architecture', () => {
  let serverEngine: JamServerEngine;
  let clientDiscovery: JamDiscoveryEngine;

  beforeEach(() => {
    serverEngine = JamServerEngine.getInstance();
    serverEngine.resetForTesting();
    clientDiscovery = JamDiscoveryEngine.getInstance();
    clientDiscovery.reset();
  });

  it('1. Generates 5-character Join Code strictly adhering to unambiguous restricted alphabet (no 0, O, 1, I, L)', () => {
    const invalidAmbiguousChars = ['0', 'O', '1', 'I', 'L'];
    const validRestrictedAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    // Generate 50 codes to verify statistical compliance
    for (let i = 0; i < 50; i++) {
      const code = serverEngine.generateJoinCode();
      expect(code.length).toBeGreaterThanOrEqual(5);

      for (const char of code) {
        expect(validRestrictedAlphabet).toContain(char);
        expect(invalidAmbiguousChars).not.toContain(char);
      }
    }
  });

  it('2. Resolves Join Code case-insensitively and ignores leading/trailing whitespace', () => {
    const { session } = serverEngine.createSession({
      hostId: 'user_host',
      hostName: 'Ravi',
      initialSong: mockSong,
    });

    const code = session.joinCode;
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThanOrEqual(5);

    // Exact uppercase
    const matchUpper = serverEngine.resolveJoinCode(code);
    expect(matchUpper?.jamId).toBe(session.jamId);

    // Lowercase input (e.g. user typed on mobile keyboard without shift)
    const matchLower = serverEngine.resolveJoinCode(code.toLowerCase());
    expect(matchLower?.jamId).toBe(session.jamId);

    // Mixed case with whitespace (e.g. " 7k29P ")
    const matchMixed = serverEngine.resolveJoinCode(`  ${code.toLowerCase()}  `);
    expect(matchMixed?.jamId).toBe(session.jamId);

    // Invalid non-existent code returns null
    const nonExistent = serverEngine.resolveJoinCode('ZZZZZ');
    expect(nonExistent).toBeNull();
  });

  it('3. Nearby Discovery: returns active discoverable Jams with track metadata and participant count', () => {
    const { session } = serverEngine.createSession({
      hostId: 'user_ravi',
      hostName: 'Ravi Host',
      initialSong: mockSong,
      isNearbyDiscoverable: true,
    });

    // Participant joins
    serverEngine.joinSession(session.jamId, {
      userId: 'user_priya',
      displayName: 'Priya',
    });

    const discoverable = serverEngine.getDiscoverableJams();
    expect(discoverable.length).toBe(1);

    const jam = discoverable[0];
    expect(jam.jamId).toBe(session.jamId);
    expect(jam.joinCode).toBe(session.joinCode);
    expect(jam.hostName).toBe('Ravi Host');
    expect(jam.currentSongTitle).toBe('Discovery Song');
    expect(jam.participantCount).toBe(2);
  });

  it('4. Local LAN Preferred Transport & Silent Cloud Relay Fallback', () => {
    // Initial default is cloud
    expect(clientDiscovery.getCurrentTransport()).toBe('cloud');

    // Host or local discovery sets local LAN endpoint
    clientDiscovery.setLanEndpoint('http://192.168.1.50:3000');
    expect(clientDiscovery.getCurrentTransport()).toBe('lan');

    // Participant disconnects from Wi-Fi -> switches to mobile data -> falls back to Cloud silently
    clientDiscovery.fallbackToCloud();
    expect(clientDiscovery.getCurrentTransport()).toBe('cloud');
  });
});
