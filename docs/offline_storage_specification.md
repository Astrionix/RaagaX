# RaagaX Offline & Protected Storage Architecture Specification

This document establishes the architecture for RaagaX offline music downloads, governed by the standard streaming subscription storage model:

> **Audio is downloaded into app-private, encrypted/protected storage. Raw media is NEVER dumped into public `/Music/` or exposed as loose user files in external File Managers.**

---

## 🏛️ 1. Core Principles

```
RAAGAX CLOUD
     │
     │ User taps Download (Album / Playlist / Track)
     ▼
Download Authorization & Entitlement Check (30-Day Offline Lease)
     ▼
Media3 DownloadService / DownloadManager
     ▼
Device-Local App-Private Protected Storage
┌───────────────────────────┴───────────────────────────┐
▼                                                       ▼
Song Metadata (JSON / LocalDB)           Audio Chunk Data (Encrypted Binary)
└───────────────────────────┬───────────────────────────┘
                            ▼
                  Local Database Index
                            ▼
              ExoPlayer Offline Playback
```

---

## 🔒 2. Scoped Storage: Zero Broad Storage Permissions

* **No Broad Permission Required:** Under Android 10+ Scoped Storage guidelines, RaagaX uses its app-specific sandboxed directory:
  ```
  context.getExternalFilesDir(Environment.DIRECTORY_MUSIC) 
  → /storage/emulated/0/Android/data/com.raagax.music/files/downloads/<download_id>/
  ```
* **No `READ_EXTERNAL_STORAGE` / `MANAGE_EXTERNAL_STORAGE` Prompts:** RaagaX never presents permission prompts like *"Allow RaagaX to access all files on your device"*. App-private storage works out of the box with zero runtime permission friction.
* **Security & License Protection:** Downloaded audio chunks are protected blobs indexed by internal `song_id` and can only be decrypted and rendered by the RaagaX player engine.

---

## 🧩 3. Separation of Song Identity vs Local Resource

```
   Online Mode:
   song_id = "RAAGAX_123" ───► Fetch Dynamic Streaming CDN URL ───► Play

   Offline Mode:
   song_id = "RAAGAX_123" ───► Lookup Local Download Index (file://...) ───► Play
```

* **Likes vs Downloads:**
  - Removing a downloaded song sets `downloaded = false` and deletes the local media cache.
  - The song **remains in the user's `liked_songs` cloud library** and streams normally when online.
* **Reference Counting:**
  - If Track A is in both *Liked Songs* and *Workout Playlist*, deleting the playlist removes the playlist reference without purging the physical audio file if it is still referenced by *Liked Songs*.

---

## 🌐 4. Device-Local Storage vs Cloud Account Separation

| Layer | Phone | Laptop | Supabase Cloud |
| :--- | :--- | :--- | :--- |
| **Liked Songs** | 142 Tracks | 142 Tracks | 142 Tracks (Authoritative) |
| **Playlists** | 8 Playlists | 8 Playlists | 8 Playlists (Authoritative) |
| **Downloaded Media** | 142 Tracks (Local GB) | 0 Tracks (Not downloaded) | Metadata Only |

Downloading on Phone does not consume Laptop storage. Laptop shows:
```
Song A
❤️ Liked • 📱 Downloaded on Phone • [↓ Download Here]
```

---

## ⚙️ 5. Settings & UX Flows

### 1. First-Time Download Prompt
```
┌───────────────────────────────────────────────┐
│ Download for offline listening?               │
│                                               │
│ Quality:        High (320 kbps AAC)          │
│ Estimated Size: ~340 MB (12 Songs)            │
│ Wi-Fi Only:     [ ✓ ]                         │
│                                               │
│          [ Download ]     [ Cancel ]          │
└───────────────────────────────────────────────┘
```

### 2. Settings → Downloads & Storage
```
DOWNLOADS & STORAGE

Downloaded Music
━━━━━━━━━━━━━━━━━━━━━━━━━━
184 songs • 2.8 GB
Available Device Storage: 38.4 GB

Preferences
Wi-Fi only downloads        [ ON ]
Download Quality            [ High - 320 kbps ]
Smart Downloads             [ OFF ]
Offline Mode                [ OFF ]

Actions
[ Manage Downloads ]
[ Clear Streaming Cache ]
[ Purge All Offline Downloads ]
```

---

## 📱 6. Android Media3 Implementation Details

* `androidx.media3.exoplayer.offline.DownloadService`: Manages background download lifecycle with persistent foreground notification and progress bar (`03 / 12 songs • 45%`).
* `androidx.media3.exoplayer.offline.DownloadManager`: Handles task concurrency, network requirements (`Requirements.NETWORK_UNMETERED`), and resume on device reboot.
* `DownloadIndex`: SQLite-backed state index surviving app crashes and OS restarts.
