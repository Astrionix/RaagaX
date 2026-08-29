import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedSearchEngine } from '@/lib/search/UnifiedSearchEngine';

describe('RaagaX Recently Searched System & Dedicated Deduplication Invariants', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    });
  });

  it('Invariant 1: Empty or whitespace-only searches are NEVER added to history', () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.clearRecentSearches();

    engine.addRecentSearch('');
    engine.addRecentSearch('   ');
    engine.addRecentSearch('\t\n');

    expect(engine.getRecentSearches()).toEqual([]);
  });

  it('Invariant 2: Typing / remote search execution does NOT automatically write to history', async () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.clearRecentSearches();

    // Mock global fetch for search API
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'SUCCESS', data: { results: [] } }),
    }));

    // Simulating user typing intermediate keystrokes: 'y', 'ye', 'yes', 'yeshnagula'
    await engine.search('y');
    await engine.search('ye');
    await engine.search('yes');
    await engine.search('yeshnagula');

    // History MUST remain completely empty
    expect(engine.getRecentSearches()).toEqual([]);
  });

  it('Invariant 3: Adding completed search saves query, trims whitespace, and preserves display casing', () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.clearRecentSearches();

    engine.addRecentSearch('  Chennai Love Story  ');
    expect(engine.getRecentSearches()).toEqual(['Chennai Love Story']);
  });

  it('Invariant 4: Case-insensitive & whitespace deduplication moves existing search to TOP without duplicates', () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.clearRecentSearches();

    engine.addRecentSearch('Telugu Songs');
    engine.addRecentSearch('Chennai Love Story');
    engine.addRecentSearch('Tamil Hits');

    expect(engine.getRecentSearches()).toEqual([
      'Tamil Hits',
      'Chennai Love Story',
      'Telugu Songs',
    ]);

    // User searches 'telugu songs' again in lowercase
    engine.addRecentSearch('telugu songs');

    // Must move to TOP and maintain single instance
    expect(engine.getRecentSearches()).toEqual([
      'telugu songs',
      'Tamil Hits',
      'Chennai Love Story',
    ]);
    expect(engine.getRecentSearches().length).toBe(3);
  });

  it('Invariant 5: Maximum 20 history entries bounded (21st item evicts oldest entry)', () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.clearRecentSearches();

    // Add 25 searches
    for (let i = 1; i <= 25; i++) {
      engine.addRecentSearch(`Search Query ${i}`);
    }

    const recents = engine.getRecentSearches();
    expect(recents.length).toBe(20);
    // Most recent is top
    expect(recents[0]).toBe('Search Query 25');
    // Oldest retained is #6 (1-5 were evicted)
    expect(recents[recents.length - 1]).toBe('Search Query 6');
  });

  it('Invariant 6: Individual search item removal removes only target item', () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.clearRecentSearches();

    engine.addRecentSearch('Song A');
    engine.addRecentSearch('Song B');
    engine.addRecentSearch('Song C');

    expect(engine.getRecentSearches()).toEqual(['Song C', 'Song B', 'Song A']);

    engine.removeRecentSearch('Song B');

    expect(engine.getRecentSearches()).toEqual(['Song C', 'Song A']);
  });

  it('Invariant 7: Clear recent searches removes all entries', () => {
    const engine = UnifiedSearchEngine.getInstance();
    engine.addRecentSearch('Song A');
    engine.addRecentSearch('Song B');

    expect(engine.getRecentSearches().length).toBe(2);

    engine.clearRecentSearches();

    expect(engine.getRecentSearches()).toEqual([]);
  });
});
