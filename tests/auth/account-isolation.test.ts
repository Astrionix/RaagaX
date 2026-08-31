import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AccountIsolationGuard } from '@/lib/auth/AccountIsolationGuard';
import { useAuthStore, purgeAllUserScopedState } from '@/context/useAuthStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { usePlaylistStore } from '@/context/usePlaylistStore';
import { AccountSyncEngine } from '@/lib/sync/AccountSyncEngine';
import { supabase } from '@/lib/supabase';
import { Song } from '@/types/music';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const sampleSongA: Song = {
  id: 'SONG_USER_A_1',
  title: 'Song of User A',
  artist: 'Artist A',
  artistId: 'ART_A',
  album: 'Album A',
  albumId: 'ALB_A',
  duration: 210,
  coverUrl: 'https://cdn.example.com/a.jpg',
  audioUrl: 'https://cdn.example.com/a.mp3',
  genre: 'Pop',
  category: 'melody',
  releaseYear: 2024,
  plays: 100,
  likes: 10,
};

const sampleSongB: Song = {
  id: 'SONG_USER_B_1',
  title: 'Song of User B',
  artist: 'Artist B',
  artistId: 'ART_B',
  album: 'Album B',
  albumId: 'ALB_B',
  duration: 180,
  coverUrl: 'https://cdn.example.com/b.jpg',
  audioUrl: 'https://cdn.example.com/b.mp3',
  genre: 'Rock',
  category: 'mass',
  releaseYear: 2024,
  plays: 200,
  likes: 20,
};

// Mock localStorage for Node test environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
};

describe('RaagaX Critical Security & State — Account Isolation Suite', () => {
  let guard: AccountIsolationGuard;

  beforeEach(() => {
    guard = AccountIsolationGuard.getInstance();
    guard.resetForTesting();

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: mockLocalStorage,
      sessionStorage: mockLocalStorage,
      location: { reload: vi.fn() },
    });
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    });
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockLocalStorage);
    mockLocalStorage.clear();

    usePlayerStore.getState().resetUserLibraryState();
    usePlaylistStore.getState().resetPlaylistState();
    useAuthStore.setState({ user: null, session: null, isLoading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 1: Account Switch Isolation (User A -> Logout -> User B)
  // ──────────────────────────────────────────────────────────────────
  it('1. Account Switch Isolation: User A likes song -> logout -> User B logs in -> User B sees zero of User A data', async () => {
    const userAId = '00000000-0000-4000-a000-000000000001';
    const userBId = '00000000-0000-4000-b000-000000000002';

    // 1. User A logs in
    guard.setAuthenticatedUser(userAId, 'LOGIN_USER_A');
    useAuthStore.setState({
      user: { id: userAId, email: 'usera@example.com' } as any,
      session: { user: { id: userAId } } as any,
    });

    // User A likes Song A and adds a playlist
    usePlayerStore.setState({
      likedSongIds: [sampleSongA.id],
      likedSongs: [sampleSongA],
      librarySongIds: [sampleSongA.id],
    });
    usePlaylistStore.setState({
      playlists: [{
        id: 'PL_USER_A_1',
        title: "User A's Rock Mix",
        visibility: 'private',
        ownerId: userAId,
        songs: [sampleSongA],
        songIds: [sampleSongA.id],
      }],
    });

    expect(usePlayerStore.getState().likedSongIds).toContain(sampleSongA.id);
    expect(usePlaylistStore.getState().playlists.length).toBe(1);

    // 2. User A logs out
    await purgeAllUserScopedState('TEST_LOGOUT');
    useAuthStore.setState({ user: null, session: null });

    // Verify logged out state is clean
    expect(usePlayerStore.getState().likedSongIds.length).toBe(0);
    expect(usePlayerStore.getState().likedSongs.length).toBe(0);
    expect(usePlaylistStore.getState().playlists.length).toBe(0);
    expect(guard.getActiveUserId()).toBeNull();

    // 3. User B logs in
    guard.setAuthenticatedUser(userBId, 'LOGIN_USER_B');
    useAuthStore.setState({
      user: { id: userBId, email: 'userb@example.com' } as any,
      session: { user: { id: userBId } } as any,
    });

    // User B's state MUST be completely empty of User A's songs
    expect(usePlayerStore.getState().likedSongIds).not.toContain(sampleSongA.id);
    expect(usePlayerStore.getState().likedSongIds.length).toBe(0);
    expect(usePlaylistStore.getState().playlists.length).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 2: Stale Async Response Rejection via Monotonic authGeneration
  // ──────────────────────────────────────────────────────────────────
  it('2. Stale Async Rejection: User A async fetch resolves after User B logs in -> Discarded', async () => {
    const userAId = '00000000-0000-4000-a000-000000000001';
    const userBId = '00000000-0000-4000-b000-000000000002';

    // 1. User A logs in (generation = 2)
    guard.setAuthenticatedUser(userAId, 'LOGIN_USER_A');
    const userAGen = guard.getAuthGeneration();

    // Simulate in-flight request started by User A capturing userAGen
    let capturedGen = userAGen;
    let capturedUserId = userAId;

    // 2. User A logs out (generation bumps to 3) -> User B logs in (generation bumps to 4)
    await purgeAllUserScopedState('TEST_LOGOUT');
    guard.setAuthenticatedUser(userBId, 'LOGIN_USER_B');

    // 3. Now User A's slow network request finishes with User A's playlists
    const isStillValid = guard.isCurrentAuthGeneration(capturedGen, capturedUserId);
    expect(isStillValid).toBe(false);

    // The guard MUST block applying state
    const assertionResult = guard.assertAccountIsolation(capturedUserId, 'TEST_ASYNC_CALLBACK', capturedGen);
    expect(assertionResult).toBe(false);

    // User B's playlist store remains empty
    expect(usePlaylistStore.getState().playlists.length).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 3: Realtime Event Isolation (User A channel event arriving on User B)
  // ──────────────────────────────────────────────────────────────────
  it('3. Realtime Isolation: User A realtime event arrives while User B is logged in -> Ignored', () => {
    const userAId = '00000000-0000-4000-a000-000000000001';
    const userBId = '00000000-0000-4000-b000-000000000002';

    // User B is active
    guard.setAuthenticatedUser(userBId, 'LOGIN_USER_B');

    // Mismatched realtime event arrives for User A
    const allowed = guard.assertAccountIsolation(userAId, 'REALTIME_EVENT');
    expect(allowed).toBe(false);

    // Matching realtime event for User B is accepted
    const userBAllowed = guard.assertAccountIsolation(userBId, 'REALTIME_EVENT');
    expect(userBAllowed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 4: LocalStorage / Safe Preference Isolation
  // ──────────────────────────────────────────────────────────────────
  it('4. LocalStorage Isolation: purgeAllUserScopedState removes all account-specific keys', async () => {
    mockLocalStorage.setItem('raagax_latest_playback_session', JSON.stringify({ userId: 'user_a', currentSong: sampleSongA }));
    mockLocalStorage.setItem('raagax-playlists-store-v2', JSON.stringify({ state: { playlists: [{ id: 'pl_1' }] } }));
    mockLocalStorage.setItem('liked_songs_sort', 'recently_added');
    mockLocalStorage.setItem('raagax_library_mutation_queue', JSON.stringify([{ id: 'mut_1' }]));

    await purgeAllUserScopedState('TEST_STORAGE_PURGE');

    expect(mockLocalStorage.getItem('raagax_latest_playback_session')).toBeNull();
    expect(mockLocalStorage.getItem('raagax-playlists-store-v2')).toBeNull();
    expect(mockLocalStorage.getItem('liked_songs_sort')).toBeNull();
    expect(mockLocalStorage.getItem('raagax_library_mutation_queue')).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 5: Guest Data Migration Guard
  // ──────────────────────────────────────────────────────────────────
  it('5. Guest Migration Guard: Does NOT migrate previous user data after logout', async () => {
    const userAId = '00000000-0000-4000-a000-000000000001';
    const userBId = '00000000-0000-4000-b000-000000000002';

    // User A logs in and has liked songs
    guard.setAuthenticatedUser(userAId, 'LOGIN_USER_A');
    usePlayerStore.setState({ likedSongIds: [sampleSongA.id] });

    // User A logs out -> isGuestSession is reset properly, and store is wiped
    await purgeAllUserScopedState('TEST_LOGOUT');
    expect(guard.getActiveUserId()).toBeNull();
    expect(usePlayerStore.getState().likedSongIds.length).toBe(0);

    // User B logs in
    const syncEngine = AccountSyncEngine.getInstance();
    await syncEngine.migrateGuestDataToUser(userBId);

    // No rows should be migrated because store is empty and was not an unauthenticated guest session
    expect(usePlayerStore.getState().likedSongIds).not.toContain(sampleSongA.id);
  });

  // ──────────────────────────────────────────────────────────────────
  // Test 6: Diagnostic Logging Structure
  // ──────────────────────────────────────────────────────────────────
  it('6. Diagnostic Logging: Emits structured [ACCOUNT_STATE] logs without sensitive credentials', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    guard.logAccountState({
      userId: 'test-user-id',
      storeUserId: 'test-user-id',
      sessionUserId: 'test-user-id',
      source: 'TEST_DIAGNOSTIC',
      revision: 42,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ACCOUNT_STATE]')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('userId=test-user-id')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('revision=42')
    );

    consoleSpy.mockRestore();
  });
});
