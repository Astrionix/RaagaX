# RaagaX Mobile — 62 Scenario & Behaviour Acceptance Specification

This document defines the strict, authoritative behavioral specification for RaagaX Mobile. Every UI interaction, playback state transition, offline event, synchronization routine, and background task must satisfy these exact invariants.

---

## 🏛️ The Core Hard Invariants

```
┌─────────────────────────────────────────────────────────────┐
│                  HARD PLAYBACK INVARIANTS                   │
├─────────────────────────────────────────────────────────────┤
│  APP OPEN         ≠ PLAY                                    │
│  SCREEN OPEN      ≠ PLAY                                    │
│  ALBUM OPEN       ≠ PLAY                                    │
│  SEARCH           ≠ PLAY                                    │
│  LOGIN            ≠ PLAY                                    │
│  CACHE RESTORE    ≠ PLAY                                    │
│  SUPABASE SYNC    ≠ PLAY                                    │
│  DEVICE CONNECT   ≠ PLAY                                    │
│  PLAYBACK RESTORE ≠ PLAY                                    │
├─────────────────────────────────────────────────────────────┤
│  ONLY EXPLICIT ACTIONS TRIGGER AUDIO:                       │
│  • USER PLAY                                                │
│  • USER RESUME                                              │
│  • USER "PLAY HERE"                                         │
│  • NATURAL TRACK_END → AUTHORIZED NEXT                      │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA & STATE AUTHORITY                   │
├─────────────────────────────────────────────────────────────┤
│  SUPABASE                 → Single Authoritative Account    │
│  INDEXEDDB / CACHE        → Fast Local Offline Copy         │
│  DEVICE                   → Audio Renderer / Remote Target  │
│  PLAYBACK SESSION         → Single Authoritative State      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Comprehensive 62 Scenario Matrix

### 1. Onboarding, Auth & Startup
* **S01 (First Launch):** Welcome screen with Sign Up / Login. 0 audio output, 0 player initialization, 0 stale state.
* **S02 (Signup Flow):** Username → Email → Password → Multi-language selection → Artist selection → Home. Languages stored as equal preferences in cloud profile.
* **S03 (Multi-Language Initial):** Selected languages (e.g. Telugu, Tamil, Hindi) serve as cold-start seeds. No single language becomes primary.
* **S04 (Home Arrival):** Home renders recommendations, new releases, and trends. Audio engine remains strictly `IDLE / PAUSED`.
* **S17 (App Open After Inactivity):** Restores song checkpoint (e.g. Song A @ 02:31) as `PAUSED`. Never autoplays.
* **S18 (Latest Checkpoint):** Restores only the most recent track played, never older session history.
* **S19 (Zero History Account):** Displays empty state Home without audio errors or default track insertion.
* **S20 (Re-opening from Active State):** Enforces `PAUSED` state by default on fresh boot.
* **S21 (Explicit Play on Restored State):** Resumes at restored position (e.g. 02:31), not from 00:00.
* **S32 (Account Logout):** Instantly purges account-specific memory (likes, playlists, history). Audio ceases.
* **S33 (Account Switch A → B):** Purges cache of Account A; hydrates exclusively from Account B Supabase records.

---

### 2. Queue & Playback Flow Authority
* **S05 (Album Play):** Tapping ▶ on Album `[A, B, C, D, E]` builds authoritative queue `[A, B, C, D, E]`, sets `currentIndex = 0`, and plays A.
* **S06 (Album Shuffle):** Generates deterministic shuffled order `[C, A, E, B, D]`, stores `shuffleSeed` in session, and advances sequentially.
* **S07 (Album Completion / Autoplay OFF):** When E finishes, playback halts (`STOP`). No recommendation injection.
* **S08 (Album Completion / Autoplay ON):** When E finishes, recommendation engine evaluates and appends Track X.
* **S09 (Playlist Play):** Playback sequence `[P1, P2, P3, P4]` is protected. Zero unrequested songs inserted before P4.
* **S10 (Manual Queue Insertion):** Explicit "Play Next" inserts Track X at `currentIndex + 1`. Automated engines cannot perform unprompted insertions.
* **S11 (User Press Next):** Transitions `B → C` exactly once. Rejects duplicate event triggers.
* **S12 (User Press Previous):** If playing >3s, restarts current song; if playing <3s, steps `C → B`.
* **S13 (Natural Track End):** Audio element emits single `ENDED` event → `PlaybackService` advances queue index → loads next track.
* **S14 (Repeat One):** Single track loops indefinitely `A → A → A` without advancing queue index.
* **S15 (Repeat All):** Queue loops continuously `[A, B, C] → A → B → C`.
* **S16 (Repeat Off):** Queue completes at last track and stops.
* **S41 (Queue Replacement):** Starting Album B while playing Album A immediately replaces active queue with Album B tracks.
* **S42 (Passive Browsing):** Scrolling Home/Browse generates zero audio output.
* **S43 (Opening Album Detail):** Navigating to Album page renders tracklist with ▶ button without starting playback.
* **S44 (Direct Track Tap):** Tapping Track C in Album `[A, B, C, D]` sets `currentIndex = 2` within the full album context.
* **S45 (Search Result Tap):** Playing search result creates explicit search-context queue.
* **S47 (Locked Next Invariant):** Recommendation generator never mutates `currentIndex + 1` during active album/playlist playback.

---

### 3. Language Neutrality & Personalization
* **S22 (Cross-Language Search):** Onboarding in Telugu + searching "Tamil" returns Tamil results without filtering.
* **S23 (Cross-Language Like):** Liking any song adds directly to `liked_songs` without language constraints.
* **S24 (Multi-Language Playlist):** Playlists accept tracks across all languages without validation blocks.
* **S25 (Dynamic Taste Affinity):** Recommendation weights reflect actual listening frequencies over time.
* **S37 (Language Fairness):** Search intent strictly supersedes static language preferences (`SEARCH INTENT > ONBOARDING`).

---

### 4. Account Synchronization & Offline Resiliency
* **S26 (8 vs 14 Likes Resolution):** Supabase `liked_songs` is authoritative; stale device cache updates to 14 upon reconcile.
* **S27 (Online Like):** Instant optimistic UI increment → Supabase mutation → Realtime broadcast → other devices update.
* **S28 (Offline Like):** Increments UI → records to `pending_mutations` in IndexedDB → syncs automatically on reconnect.
* **S29 (Concurrent Offline Likes):** Device 1 likes A, Device 2 likes B offline → both mutations commit upon reconnection (Total 16).
* **S30 (Duplicate Offline Likes):** PostgreSQL `UNIQUE(user_id, song_id)` prevents duplicate records.
* **S31 (Song Unlike):** Removes from Supabase and propagates instant unlike event to all subscribed clients.
* **S46 (Listening History):** Records account-level metadata (`song_id`, `timestamp`, `completion_ratio`, `source`) without polluting the playback queue.
* **S54 (Playlist Creation):** Creates cloud row in `playlists` and syncs to all devices.
* **S55 (Playlist Track Addition):** Appends track with deterministic order index.
* **S56 (Concurrent Playlist Modifications):** Order revision rules resolve simultaneous additions.
* **S57 (Playlist Deletion):** Deletion requires confirmation and purges cloud and local cached entries.
* **S58 (Cache Purge):** "Clear Cache" removes artwork and audio buffers; preserves liked songs, playlists, and user credentials.
* **S59 (Supabase Outage):** App operates seamlessly in read-only mode using cached records with "Sync Offline" badge.
* **S60 (Provider Outage):** Audio resolver retries backup stream sources; does not corrupt user library data.

---

### 5. Cross-Device Connect & Session Handoff
* **S34 (Remote Session Discovery):** Secondary device displays active remote song & position in paused controller mode.
* **S35 (4-Phase Transfer Handoff):** "Play Here" on Laptop executes `[PREPARE] → [COMMIT] → [START] → [ACK]`. Phone pauses; Laptop plays at matching timestamp.
* **S36 (Handoff Failure Rollback):** If target device fails to buffer audio within 8s timeout, source phone retains lease and resumes playback.
* **S38 (Network Reconnect):** Client reconnects to Realtime channel and synchronizes `sessionEpoch` and `revision`.
* **S39 (Stale Remote Command):** Outdated commands with invalid `sessionEpoch` or old `revision` are rejected by lease manager.
* **S40 (Double-Tap Debouncing):** Rapid sequential skip commands are debounced through the state machine.
* **S50 (Bluetooth Disconnect):** Audio pauses automatically when output route disconnects.
* **S51 (Bluetooth Reconnect):** Audio remains paused until user explicitly presses Play.

---

### 6. Mobile Platform Lifecycle & Background Playback
* **S48 (Memory Pressure):** Process recreation restores canonical playback session checkpoint as `PAUSED`.
* **S49 (Screen Rotation):** Layout adapts reactively; audio continues without re-creating the media player.
* **S52 (Notification Controls):** Android MediaSession notifications dispatch unified `PlaybackCommand` to central engine.
* **S53 (Lock-Screen Play):** Lock-screen Play resumes active `PlaybackSession` without creating duplicate players.
* **S61 (User Intent Primacy):** User explicit action always overrides recommendation and autoplay triggers.
