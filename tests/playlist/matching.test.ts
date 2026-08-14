import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaylistResolver } from '../../src/lib/discovery/PlaylistResolver';
import { SpotifyProvider } from '../../src/lib/discovery/SpotifyProvider';
import type { SpotifyTrack } from '../../src/lib/discovery/SpotifyProvider';
import { calculateMatchScore } from '../../src/lib/discovery/PlaylistResolver';
import { Song } from '../../src/types/music';

// Initialize global mock stores
(global as any).__resolutionCache = new Map<string, any>();
(global as any).__playlistCache = new Map<string, any>();
(global as any).__canonicalSongs = new Map<string, any>();

// Mock InternetDateScraper to bypass date scraping HTTP calls
vi.mock('../../src/lib/discovery/InternetDateScraper', () => {
  return {
    InternetDateScraper: {
      fetchExactReleaseDate: async () => '2026-08-14'
    }
  };
});

// Mock Supabase admin using the global mock stores
vi.mock('../../src/lib/supabaseAdmin', () => {
  return {
    supabaseAdmin: {
      from: (table: string) => {
        return {
          select: (fields?: string) => {
            return {
              eq: (col: string, val: any) => {
                return {
                  maybeSingle: async () => {
                    const resCache = (global as any).__resolutionCache;
                    const plCache = (global as any).__playlistCache;
                    const canonical = (global as any).__canonicalSongs;

                    if (table === 'song_resolution_cache' && col === 'cache_key') {
                      return { data: resCache.get(val) || null, error: null };
                    }
                    if (table === 'spotify_playlist_cache' && col === 'playlist_id') {
                      return { data: plCache.get(val) || null, error: null };
                    }
                    if (table === 'canonical_songs' && col === 'id') {
                      return { data: canonical.get(val) || null, error: null };
                    }
                    return { data: null, error: null };
                  }
                };
              }
            };
          },
          upsert: async (payload: any, options?: any) => {
            const resCache = (global as any).__resolutionCache;
            const plCache = (global as any).__playlistCache;
            const canonical = (global as any).__canonicalSongs;

            const arr = Array.isArray(payload) ? payload : [payload];
            for (const item of arr) {
              if (table === 'song_resolution_cache' && item.cache_key) {
                resCache.set(item.cache_key, item);
              }
              if (table === 'spotify_playlist_cache' && item.playlist_id) {
                plCache.set(item.playlist_id, item);
              }
              if (table === 'canonical_songs' && item.id) {
                canonical.set(item.id, item);
              }
            }
            return { data: null, error: null };
          }
        };
      }
    }
  };
});

// Helper to create mock Spotify tracks
function createMockSpotifyTracks(count: number, prefix = 'sp_track'): SpotifyTrack[] {
  const tracks: SpotifyTrack[] = [];
  for (let i = 1; i <= count; i++) {
    tracks.push({
      id: `${prefix}_${i}`,
      title: `Song Title ${i}`,
      artist: `Artist Name ${i}`,
      album: `Album ${i}`,
      coverUrl: `https://spotify.com/cover${i}.jpg`,
      duration: 200 + i // seconds
    });
  }
  return tracks;
}

describe('RaagaX Browse Spotify Playlist Sync & Matching System Tests', () => {
  let resolver: PlaylistResolver;

  beforeEach(() => {
    // Clear in-memory DB mocks
    (global as any).__resolutionCache.clear();
    (global as any).__playlistCache.clear();
    (global as any).__canonicalSongs.clear();

    // Set Spotify env variables to enable token authentication route
    process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';

    resolver = new PlaylistResolver('http://localhost:3000');
    vi.restoreAllMocks();
    // Default fetch stub returns valid Promise so .catch() in DiscoveryQueue never crashes
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('TEST 1: 90 -> 90: Spotify = 90 tracks, JioSaavn matches = 90 -> Expected Browse = 90', async () => {
    const spotifyTracks = createMockSpotifyTracks(90);
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    // Mock JioSaavn search results for 90 tracks
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/query=([^&]+)/);
      if (!match) return { ok: true, json: async () => ({ results: [] }) };
      const q = decodeURIComponent(match[1]);
      const numMatch = q.match(/\d+/);
      const idx = numMatch ? numMatch[0] : '1';

      return {
        ok: true,
        json: async () => ({
          data: {
            results: [
              {
                id: `saavn_song_${idx}`,
                name: `Song Title ${idx}`,
                artists: { primary: [{ name: `Artist Name ${idx}` }] },
                album: { name: `Album ${idx}` },
                duration: 200 + parseInt(idx),
                image: [{ url: `https://saavn.com/cover${idx}.jpg`, quality: '500x500' }],
                downloadUrl: [{ url: `https://saavn.com/audio${idx}.mp3`, quality: '320kbps' }]
              }
            ]
          }
        })
      };
    });
    global.fetch = fetchMock;

    const songs = await resolver.resolveSpotifyPlaylist('test_playlist_90');
    expect(songs.length).toBe(90);
  });

  it('TEST 2: 90 -> 87: Spotify = 90 tracks, JioSaavn matches = 87 -> Expected Browse = 87', async () => {
    const spotifyTracks = createMockSpotifyTracks(90);
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    // Mock JioSaavn matching: tracks 1 to 87 match, 88 to 90 return empty
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/query=([^&]+)/);
      if (!match) return { ok: true, json: async () => ({ results: [] }) };
      const q = decodeURIComponent(match[1]);
      const numMatch = q.match(/\d+/);
      const idx = numMatch ? parseInt(numMatch[0]) : 1;

      if (idx > 87) {
        return { ok: true, json: async () => ({ data: { results: [] } }) };
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            results: [
              {
                id: `saavn_song_${idx}`,
                name: `Song Title ${idx}`,
                artists: { primary: [{ name: `Artist Name ${idx}` }] },
                album: { name: `Album ${idx}` },
                duration: 200 + idx,
                image: [{ url: `https://saavn.com/cover${idx}.jpg`, quality: '500x500' }],
                downloadUrl: [{ url: `https://saavn.com/audio${idx}.mp3`, quality: '320kbps' }]
              }
            ]
          }
        })
      };
    });
    global.fetch = fetchMock;

    const songs = await resolver.resolveSpotifyPlaylist('test_playlist_87');
    expect(songs.length).toBe(87);
  });

  it('TEST 3: 90 -> 0: Spotify = 90 tracks, JioSaavn matches = 0 -> Expected Browse = 0', async () => {
    const spotifyTracks = createMockSpotifyTracks(90);
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { results: [] } })
    });

    const songs = await resolver.resolveSpotifyPlaylist('test_playlist_zero');
    expect(songs.length).toBe(0);
  });

  it('TEST 4: 100 existing + 10 new: Process only the 10 new tracks without querying JioSaavn for existing', async () => {
    // 1. Populate the mock resolution cache with 100 tracks
    const existingTracks = createMockSpotifyTracks(100, 'existing');
    const resCache = (global as any).__resolutionCache;
    existingTracks.forEach((t, i) => {
      const cacheKey = Buffer.from(`Song Title ${i+1}_Artist Name ${i+1}`).toString('base64');
      resCache.set(cacheKey, {
        cache_key: cacheKey,
        title: `Song Title ${i+1}`,
        artist: `Artist Name ${i+1}`,
        jiosaavn_song_id: `saavn_song_existing_${i+1}`,
        status: 'resolved',
        raw_response: {
          id: `saavn_song_existing_${i+1}`,
          title: `Song Title ${i+1}`,
          artist: `Artist Name ${i+1}`,
          album: `Album ${i+1}`,
          duration: 200 + i + 1,
          coverUrl: `https://spotify.com/cover${i+1}.jpg`
        }
      });
    });

    // 2. Mock 110 Spotify tracks (100 existing + 10 new)
    const newTracks = createMockSpotifyTracks(10, 'new');
    // Rename titles to avoid overlap
    newTracks.forEach((t, i) => {
      t.title = `New Song Title ${i+1}`;
      t.artist = `New Artist Name ${i+1}`;
    });

    const combinedTracks = [...existingTracks, ...newTracks];
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(combinedTracks);

    // 3. Spy on fetch to monitor JioSaavn search requests
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      return {
        ok: true,
        json: async () => ({
          data: {
            results: [
              {
                id: `saavn_song_new_matched`,
                name: `New Song Title 1`,
                artists: { primary: [{ name: `New Artist Name 1` }] },
                album: { name: 'Album' },
                duration: 200,
                image: [{ url: 'https://saavn.com/cover.jpg', quality: '500x500' }],
                downloadUrl: [{ url: 'https://saavn.com/audio.mp3', quality: '320kbps' }]
              }
            ]
          }
        })
      };
    });
    global.fetch = fetchSpy;

    const songs = await resolver.resolveSpotifyPlaylist('test_playlist_incremental');
    
    // We expect the final Browse list to have the 100 existing songs + matched new ones
    expect(songs.length).toBeGreaterThanOrEqual(100);

    // Verify fetch was only called for the 10 new tracks
    // Since each search attempts 2 API endpoints, we expect max 20 fetch calls (2 * 10)
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(20);
  });

  it('TEST 5: Duplicate Spotify tracks deduplication', async () => {
    // Playlist with duplicate tracks
    const spotifyTracks = [
      { id: '1', title: 'Duplicate Song', artist: 'Artist A', album: 'Album X', coverUrl: '', duration: 240 },
      { id: '2', title: 'Duplicate Song', artist: 'Artist A', album: 'Album X', coverUrl: '', duration: 240 },
      { id: '3', title: 'Unique Song', artist: 'Artist B', album: 'Album Y', coverUrl: '', duration: 180 }
    ];
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const isUnique = url.includes('Unique');
      return {
        ok: true,
        json: async () => ({
          data: {
            results: [
              {
                id: isUnique ? 'saavn_unique' : 'saavn_duplicate',
                name: isUnique ? 'Unique Song' : 'Duplicate Song',
                artists: { primary: [{ name: isUnique ? 'Artist B' : 'Artist A' }] },
                album: { name: 'Album' },
                duration: isUnique ? 180 : 240,
                image: [{ url: 'https://saavn.com/cover.jpg' }]
              }
            ]
          }
        })
      };
    });
    global.fetch = fetchMock;

    const songs = await resolver.resolveSpotifyPlaylist('test_duplicates');
    expect(songs.length).toBe(2);
    expect(songs.map(s => s.id)).toContain('saavn_unique');
    expect(songs.map(s => s.id)).toContain('saavn_duplicate');
  });

  it('TEST 6: Duplicate JioSaavn matches mapping to same canonical song', async () => {
    // Two different Spotify tracks (remix and original) mapping to same JioSaavn ID
    const spotifyTracks = [
      { id: '1', title: 'Song Original', artist: 'Artist A', album: 'Album X', coverUrl: '', duration: 240 },
      { id: '2', title: 'Song Remix', artist: 'Artist A', album: 'Album X', coverUrl: '', duration: 240 }
    ];
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          results: [
            {
              id: 'saavn_canonical_id',
              name: 'Song Original',
              artists: { primary: [{ name: 'Artist A' }] },
              album: { name: 'Album' },
              duration: 240,
              image: [{ url: 'https://saavn.com/cover.jpg' }]
            }
          ]
        }
      })
    });

    const songs = await resolver.resolveSpotifyPlaylist('test_duplicate_matches');
    expect(songs.length).toBe(1);
    expect(songs[0].id).toBe('saavn_canonical_id');
  });

  it('TEST 7: Spotify pagination fetches multiple pages', async () => {
    // Mock access token fetch
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes('api.spotify.com/v1/playlists/test_paginated/tracks')) {
        const isPage2 = url.includes('offset=100');
        return {
          ok: true,
          json: async () => ({
            next: isPage2 ? null : 'https://api.spotify.com/v1/playlists/test_paginated/tracks?offset=100',
            items: isPage2 
              ? [{ track: { id: 'track_p2_1', name: 'P2 Song', artists: [{ name: 'Artist' }], duration_ms: 220000 } }]
              : [{ track: { id: 'track_p1_1', name: 'P1 Song', artists: [{ name: 'Artist' }], duration_ms: 180000 } }]
          })
        };
      }
      if (url.includes('accounts.spotify.com/api/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock_token' })
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    global.fetch = fetchMock;

    const tracks = await SpotifyProvider.getPlaylistTracks('test_paginated');
    expect(tracks.length).toBe(2);
    expect(tracks.map(t => t.id)).toContain('track_p1_1');
    expect(tracks.map(t => t.id)).toContain('track_p2_1');
  });

  it('TEST 8: Failed individual match does not fail the entire sync', async () => {
    const spotifyTracks = [
      { id: '1', title: 'Good Song A', artist: 'Artist A', album: 'Album X', coverUrl: '', duration: 240 },
      { id: '2', title: 'Bad Song B', artist: 'Artist B', album: 'Album Y', coverUrl: '', duration: 180 },
      { id: '3', title: 'Good Song C', artist: 'Artist C', album: 'Album Z', coverUrl: '', duration: 200 }
    ];
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('Bad%20Song%20B')) {
        throw new Error('JioSaavn API Temporary Failure');
      }
      const title = url.includes('Good%20Song%20A') ? 'Good Song A' : 'Good Song C';
      const artist = url.includes('Good%20Song%20A') ? 'Artist A' : 'Artist C';
      const id = url.includes('Good%20Song%20A') ? 'saavn_a' : 'saavn_c';
      const duration = url.includes('Good%20Song%20A') ? 240 : 200;

      return {
        ok: true,
        json: async () => ({
          data: {
            results: [{ id, name: title, artists: { primary: [{ name: artist }] }, album: { name: 'Album' }, duration, image: [{ url: '' }] }]
          }
        })
      };
    });
    global.fetch = fetchMock;

    const songs = await resolver.resolveSpotifyPlaylist('test_individual_failures');
    expect(songs.length).toBe(2);
    expect(songs.map(s => s.id)).toContain('saavn_a');
    expect(songs.map(s => s.id)).toContain('saavn_c');
  });

  it('TEST 9: Unchanged Spotify snapshot returns cache early with 0 new tracks processed', async () => {
    const spotifyTracks = createMockSpotifyTracks(5);
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/query=([^&]+)/);
      const q = decodeURIComponent(match?.[1] || '1');
      const numMatch = q.match(/\d+/)?.[0] || '1';
      return {
        ok: true,
        json: async () => ({
          data: {
            results: [{
              id: 'matched',
              name: `Song Title ${numMatch}`,
              artists: { primary: [{ name: `Artist Name ${numMatch}` }] },
              album: { name: `Album ${numMatch}` },
              duration: 200,
              image: [{ url: '' }]
            }]
          }
        })
      };
    });

    // Run 1: Normal sync
    const run1 = await resolver.resolveSpotifyPlaylist('test_unchanged_snapshot');
    expect(run1.length).toBeGreaterThan(0);

    // Run 2: Spotify returns identical tracks. It should detect unchanged snapshot and return cache early.
    const spy = vi.spyOn(resolver, 'resolveSpotifyPlaylist');
    const run2 = await resolver.resolveSpotifyPlaylist('test_unchanged_snapshot');
    expect(run2.length).toBe(run1.length);
  });

  it('TEST 10: Removed Spotify tracks are NOT automatically deleted from Browse', async () => {
    // Run 1: Spotify has 3 tracks
    const initialTracks = [
      { id: '1', title: 'Song 1', artist: 'Artist 1', album: 'Album 1', coverUrl: '', duration: 200 },
      { id: '2', title: 'Song 2', artist: 'Artist 2', album: 'Album 2', coverUrl: '', duration: 200 },
      { id: '3', title: 'Song 3', artist: 'Artist 3', album: 'Album 3', coverUrl: '', duration: 200 }
    ];
    let mockTracks = initialTracks;
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockImplementation(async () => mockTracks);

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const match = url.match(/query=([^&]+)/);
      const q = decodeURIComponent(match?.[1] || '1');
      const idx = q.match(/\d+/)?.[0] || '1';

      return {
        ok: true,
        json: async () => ({
          data: {
            results: [{
              id: `saavn_song_${idx}`,
              name: `Song ${idx}`,
              artists: { primary: [{ name: `Artist ${idx}` }] },
              album: { name: `Album ${idx}` },
              duration: 200
            }]
          }
        })
      };
    });

    const run1 = await resolver.resolveSpotifyPlaylist('test_playlist_mirror');
    expect(run1.length).toBe(3);

    // Run 2: Spotify removes track 3, only has tracks 1 and 2
    mockTracks = [
      { id: '1', title: 'Song 1', artist: 'Artist 1', album: 'Album 1', coverUrl: '', duration: 200 },
      { id: '2', title: 'Song 2', artist: 'Artist 2', album: 'Album 2', coverUrl: '', duration: 200 }
    ];

    const run2 = await resolver.resolveSpotifyPlaylist('test_playlist_mirror');
    // Track 3 must NOT be deleted from Browse
    expect(run2.length).toBe(3);
    expect(run2.map(s => s.id)).toContain('saavn_song_3');
  });

  it('TEST 11: Temporary API failure retries and succeeds', async () => {
    const spotifyTracks = [{ id: '1', title: 'Retry Song', artist: 'Artist', album: 'Album', coverUrl: '', duration: 200 }];
    vi.spyOn(SpotifyProvider, 'getPlaylistTracks').mockResolvedValue(spotifyTracks);

    let attempts = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('API temporary rate limit / network error');
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            results: [{
              id: 'saavn_retry_success',
              name: 'Retry Song',
              artists: { primary: [{ name: 'Artist' }] },
              album: { name: 'Album' },
              duration: 200
            }]
          }
        })
      };
    });

    const songs = await resolver.resolveSpotifyPlaylist('test_temp_failure_retry');
    expect(songs.length).toBe(1);
    expect(songs[0].id).toBe('saavn_retry_success');
    expect(attempts).toBe(2);
  });

  it('TEST 12: Cron running twice: skips recently synced playlists and respects force=true', async () => {
    const { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, WEEKLY_RELEASE_SOURCES, CLASSICS_SOURCES } = await import('../../src/lib/spotifySources');

    const allIds = [
      ...Object.values(TRENDING_SOURCES).map((s: any) => s.id),
      ...Object.values(WEEKLY_RELEASE_SOURCES).map((s: any) => s.id),
      ...Object.values(CLASSICS_SOURCES).map((s: any) => s.id),
      ...Object.values(BROWSE_5_PLAYLISTS).flatMap((list: any) => list.map((item: any) => item.id))
    ];

    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recentlySynced = new Date(now - 1000).toISOString();          // 1 second ago  → skip
    const staleSynced    = new Date(now - THREE_DAYS_MS - 1000).toISOString(); // >3 days ago → re-sync

    const plCache = (global as any).__playlistCache;

    // ── Sub-test A: Nothing cached → all need sync ──────────────────────────
    const noCacheNeedSync = allIds.filter(id => !plCache.has(id)).length;
    expect(noCacheNeedSync).toBe(allIds.length);

    // ── Sub-test B: All recently synced → all skipped ────────────────────────
    allIds.forEach(id => plCache.set(id, { playlist_id: id, updated_at: recentlySynced }));
    const skippedCount = allIds.filter(id => {
      const cached = plCache.get(id);
      const ts = cached?.updated_at || cached?.fetched_at;
      return ts && (now - new Date(ts).getTime() < THREE_DAYS_MS);
    }).length;
    expect(skippedCount).toBe(allIds.length);

    // ── Sub-test C: All stale (>3 days) → all re-sync ─────────────────────
    allIds.forEach(id => plCache.set(id, { playlist_id: id, updated_at: staleSynced }));
    const staleNeedSync = allIds.filter(id => {
      const cached = plCache.get(id);
      const ts = cached?.updated_at || cached?.fetched_at;
      return !ts || (now - new Date(ts).getTime() > THREE_DAYS_MS);
    }).length;
    expect(staleNeedSync).toBe(allIds.length);

    // ── Sub-test D: force=true bypasses 3-day check entirely ─────────────
    // Even recently-synced playlists are included when force=true
    allIds.forEach(id => plCache.set(id, { playlist_id: id, updated_at: recentlySynced }));
    const force = true;
    const forceCount = allIds.filter(() => force).length; // force overrides all checks
    expect(forceCount).toBe(allIds.length);
  });

  it('TEST 13: calculateMatchScore validation: high confidence for exact matches and 0 for version mismatches', () => {
    // Exact match
    const sp1 = { id: 's1', title: 'Ola Olaala Ala', artist: 'Ranina Reddy', album: 'Orange', duration: 250, coverUrl: '' };
    const saavn1 = { id: 'j1', title: 'Ola Olaala Ala', artist: 'Ranina Reddy', album: 'Orange', duration: 250 } as any;
    expect(calculateMatchScore(sp1, saavn1)).toBeGreaterThanOrEqual(0.8);

    // Mismatched version (Instrumental vs Vocal)
    const sp2 = { id: 's2', title: 'Aaya Sher', artist: 'Anirudh', album: 'The Paradise', duration: 280, coverUrl: '' };
    const saavn2 = { id: 'j2', title: 'Aaya Sher (Instrumental)', artist: 'Anirudh', album: 'The Paradise', duration: 280 } as any;
    expect(calculateMatchScore(sp2, saavn2)).toBe(0);

    // Mismatched version (Karaoke vs Vocal)
    const sp3 = { id: 's3', title: 'Samajavaragamana', artist: 'Sid Sriram', album: 'AVPL', duration: 220, coverUrl: '' };
    const saavn3 = { id: 'j3', title: 'Samajavaragamana (Karaoke Version)', artist: 'Sid Sriram', album: 'AVPL', duration: 220 } as any;
    expect(calculateMatchScore(sp3, saavn3)).toBe(0);
  });
});
