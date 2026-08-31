# Account Isolation Implementation — Task Tracker

## Component 1: Central Auth Generation & Account Isolation Guard
- [x] Create `src/lib/auth/AccountIsolationGuard.ts` with atomic `authGeneration`, `activeUserId`, ownership assertion, and `[ACCOUNT_STATE]` diagnostic logging.

## Component 2: Auth Store & Complete Logout Purge Lifecycle
- [x] Update `src/context/useAuthStore.ts`:
  - `signOut()`: full teardown of stores, caches, realtime, IndexedDB/localStorage.
  - `onAuthStateChange`: clean login bootstrap & switch-user protection.

## Component 3: Player Store & User Library Isolation
- [x] Update `src/context/usePlayerStore.ts`:
  - Add `resetUserLibraryState()`.
  - Remove user-owned items (`likedSongIds`, `librarySongIds`, `favoriteArtistIds`, `favoriteAlbumIds`) from global `raagax_player_prefs` partialize payload.
  - Guard session restoration in `getInitialSession`.

## Component 4: Playlist Store Isolation
- [x] Update `src/context/usePlaylistStore.ts`:
  - Add `resetPlaylistState()`.
  - Add `authGeneration` & `reqUserId` discard guards in `fetchPlaylists`.
  - Scope/clean persistence.

## Component 5: Sync Engines & Realtime Isolation
- [x] Update `src/lib/sync/AccountSyncEngine.ts`:
  - Guard `reconcile` with auth generation.
  - Verify `payload.new?.user_id === activeUserId` in realtime callback.
  - Guard `migrateGuestDataToUser` against post-logout residue.
  - Complete `unsubscribe()`.
- [x] Update `src/lib/sync/LibrarySyncManager.ts`:
  - Verify `payload.user_id === activeUserId` in realtime.
  - Complete `cleanup()`.
- [x] Update `src/components/modals/SettingsModal.tsx` to use `useAuthStore.getState().signOut()`.

## Component 6: Automated Tests & Verification
- [x] Create `tests/auth/account-isolation.test.ts`.
- [x] Run full test suite: `npx vitest run tests/auth/account-isolation.test.ts` (6/6 passed) and `npx vitest run` (77/77 test files, 356/356 tests passed).
