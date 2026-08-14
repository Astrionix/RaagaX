import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageEligibilityEngine } from '@/lib/language/LanguageEligibilityEngine';
import { usePlayerStore } from '@/context/usePlayerStore';
import { Song } from '@/types/music';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-123' } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [] }),
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue(undefined),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
  },
}));

describe('Strict 3-Tier Language Preference & Queue Purity Architecture Tests', () => {
  const engine = LanguageEligibilityEngine.getInstance();

  const teluguSong1: Song = {
    id: 'te_1',
    title: 'Samajavaragamana',
    artist: 'Sid Sriram',
    artistId: 'art_te_1',
    album: 'Ala Vaikunthapurramuloo',
    albumId: 'alb_te_1',
    duration: 210,
    audioUrl: 'https://test.com/te1.mp3',
    coverUrl: '/te1.jpg',
    genre: 'Telugu Hits',
    language: 'Telugu',
    category: 'global_trending',
    releaseYear: 2020,
    plays: 50000,
    likes: 1200,
  };

  const teluguSong2: Song = {
    id: 'te_2',
    title: 'Butta Bomma',
    artist: 'Armaan Malik',
    artistId: 'art_te_2',
    album: 'Ala Vaikunthapurramuloo',
    albumId: 'alb_te_2',
    duration: 195,
    audioUrl: 'https://test.com/te2.mp3',
    coverUrl: '/te2.jpg',
    genre: 'Telugu Melodies',
    language: 'Telugu',
    category: 'global_trending',
    releaseYear: 2020,
    plays: 60000,
    likes: 1500,
  };

  const hindiSong1: Song = {
    id: 'hi_1',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    artistId: 'art_hi_1',
    album: 'Brahmastra',
    albumId: 'alb_hi_1',
    duration: 268,
    audioUrl: 'https://test.com/hi1.mp3',
    coverUrl: '/hi1.jpg',
    genre: 'Hindi Romantic',
    language: 'Hindi',
    category: 'global_trending',
    releaseYear: 2022,
    plays: 90000,
    likes: 4000,
  };

  const englishSong1: Song = {
    id: 'en_1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artistId: 'art_en_1',
    album: 'After Hours',
    albumId: 'alb_en_1',
    duration: 200,
    audioUrl: 'https://test.com/en1.mp3',
    coverUrl: '/en1.jpg',
    genre: 'English Pop',
    language: 'English',
    category: 'global_trending',
    releaseYear: 2020,
    plays: 150000,
    likes: 9000,
  };

  beforeEach(() => {
    usePlayerStore.setState({
      preferredLanguage: 'Telugu',
      sessionLanguage: 'Telugu',
      interestLanguages: { Telugu: 0.90 },
      queue: [],
      currentSong: null,
      isPlaying: false,
    });
  });

  it('Test 1 (Global Selection & Normalization): Normalizes language names and ISO codes properly', () => {
    expect(engine.normalizeLanguage('te')).toBe('Telugu');
    expect(engine.normalizeLanguage('telugu')).toBe('Telugu');
    expect(engine.normalizeLanguage('hi')).toBe('Hindi');
    expect(engine.normalizeLanguage('hindi')).toBe('Hindi');
    expect(engine.normalizeLanguage('ta')).toBe('Tamil');
    expect(engine.normalizeLanguage('en')).toBe('English');

    expect(engine.detectSongLanguage(teluguSong1)).toBe('Telugu');
    expect(engine.detectSongLanguage(hindiSong1)).toBe('Hindi');
    expect(engine.detectSongLanguage(englishSong1)).toBe('English');
  });

  it('Test 2 (Queue Purity - HARD RULE): Telugu Queue rejects Hindi and English tracks during Autoplay/Refill', async () => {
    const candidates = [teluguSong1, hindiSong1, teluguSong2, englishSong1];
    const filtered = await engine.filterCandidates('user_1', candidates, 'AUTOPLAY', 'Telugu');

    expect(filtered).toHaveLength(2);
    expect(filtered.map(s => s.id)).toEqual(['te_1', 'te_2']);
    expect(filtered.some(s => s.id === 'hi_1')).toBe(false);
    expect(filtered.some(s => s.id === 'en_1')).toBe(false);
  });

  it('Test 3 (Search Intent - Soft Signal): Searching Hindi extracts Hindi intent without changing global language', () => {
    const inferred = engine.inferLanguageFromQuery('Arijit Singh romantic songs');
    expect(inferred).toBe('Hindi');

    const store = usePlayerStore.getState();
    expect(store.preferredLanguage).toBe('Telugu');

    // Simulate search intent tracking
    store.recordLanguageInterest('Hindi', 0.15);

    const updatedStore = usePlayerStore.getState();
    expect(updatedStore.preferredLanguage).toBe('Telugu'); // GLOBAL_LANGUAGE remains Telugu
    expect(updatedStore.interestLanguages['Hindi']).toBeGreaterThanOrEqual(0.15);
    expect(updatedStore.interestLanguages['Telugu']).toBe(0.90); // Telugu remains dominant
  });

  it('Test 4 (Session Override Exception): User explicitly playing Hindi song overrides SESSION_LANGUAGE while preserving GLOBAL_LANGUAGE', () => {
    const store = usePlayerStore.getState();
    expect(store.preferredLanguage).toBe('Telugu');
    expect(store.sessionLanguage).toBe('Telugu');

    // Explicitly play Hindi song from search
    store.playSong(hindiSong1);

    const playingStore = usePlayerStore.getState();
    expect(playingStore.preferredLanguage).toBe('Telugu'); // GLOBAL_LANGUAGE unchanged!
    expect(playingStore.sessionLanguage).toBe('Hindi'); // SESSION_LANGUAGE became Hindi
    expect(playingStore.currentSong?.id).toBe('hi_1');
  });

  it('Test 5 (Hindi Session Autoplay Purity): Once in a Hindi playback session, Autoplay refills with Hindi tracks only', async () => {
    usePlayerStore.setState({
      preferredLanguage: 'Telugu',
      sessionLanguage: 'Hindi',
      currentSong: hindiSong1,
    });

    const candidates = [teluguSong1, hindiSong1, teluguSong2, englishSong1];
    const sessionFiltered = await engine.filterCandidates('user_1', candidates, 'AUTOPLAY', 'Hindi');

    expect(sessionFiltered).toHaveLength(1);
    expect(sessionFiltered[0].id).toBe('hi_1');
    expect(sessionFiltered.some(s => s.id === 'te_1')).toBe(false);
  });

  it('Test 6 (Likes create Stronger Signal): Liking tracks increases interest score while respecting explicit hierarchy', () => {
    const store = usePlayerStore.getState();
    store.playSong(hindiSong1);
    store.toggleLikeSong(hindiSong1.id);

    const updatedStore = usePlayerStore.getState();
    expect(updatedStore.preferredLanguage).toBe('Telugu');
    expect(updatedStore.interestLanguages['Hindi']).toBeGreaterThanOrEqual(0.35);
  });
});
