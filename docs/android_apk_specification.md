# RaagaX Android APK — Native Media3 Architecture & Lifecycle Specification

This document defines the architecture, playback service lifecycle, Android OS integrations, and behavioral rules for the official **RaagaX Android APK**.

---

## 🏛️ 1. Native APK Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RAAGAX ANDROID APK                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Android UI (Capacitor WebContainer)                      │
│    • Home / Browse / Library / Search / Settings / Player   │
│    • Touch gestures, smooth scrolling, and bottom sheets    │
├─────────────────────────────────────────────────────────────┤
│ 2. Native Playback Service (RaagaXPlaybackService)          │
│    • Android Media3 ExoPlayer Foreground Service            │
│    • Android MediaSession & Lock Screen Controls            │
│    • System Notification Shade Media Controller             │
│    • Audio Focus & Noisy Audio (Bluetooth Disconnect) Handler│
│    • Autonomous Native Queue Auto-Advancement               │
├─────────────────────────────────────────────────────────────┤
│ 3. Unified Session & Account Layer                          │
│    • Supabase Realtime Channel (Session Epoch & Revision)   │
│    • Authoritative Cloud Library (liked_songs)              │
│    • Device Registry & Lease Coordinator (Cross-Device)     │
├─────────────────────────────────────────────────────────────┤
│ 4. Local Storage & Offline Cache                            │
│    • IndexedDB / SQLite LocalDatabase                       │
│    • Playback State Checkpoint (Always starts PAUSED)       │
│    • Pending Offline Mutations Queue                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 2. Core Android System Invariants

### 1. Zero Startup Autoplay
* Opening the APK from cold start or warm resume restores the last played song and position in **PAUSED** state.
* Audio **never** autoplays on boot, regardless of what occurred prior to app closure.

### 2. Autonomous Background Playback
* When the user presses the **Home button**, opens another app (e.g. WhatsApp, Maps), or turns the **screen off**, the foreground `RaagaXPlaybackService` keeps ExoPlayer streaming continuously.
* When a song ends, ExoPlayer automatically advances to the next `MediaItem` natively without needing the WebView or JavaScript thread to wake up.

### 3. Audio Focus & Bluetooth Behavior
* **Incoming Call:** System audio focus is lost → ExoPlayer pauses or ducks audio.
* **Bluetooth / Headset Disconnect:** `handleAudioBecomingNoisy` triggers instant pause to prevent audio blasting through phone speakers.
* **Bluetooth Remote Controls:** Headset hardware button presses (`Play`, `Pause`, `Next`, `Prev`) dispatch directly through `MediaSession` to the active `PlaybackSession`.

### 4. Swiping App Away vs Force Stop
* **Swiping App from Recents:** The foreground `RaagaXPlaybackService` and Media Notification remain active and continue audio playback.
* **Force Stop in Android Settings:** The OS kills the service and terminates playback immediately.

---

## 🔄 3. APK vs Web / PWA Architecture Comparison

| Feature | Browser / PWA Mode | Native Android APK |
| :--- | :--- | :--- |
| **Audio Engine** | Web HTMLAudio Element | Native Media3 ExoPlayer Foreground Service |
| **Queue Advance in Background** | Dependent on OS background tab timer | Fully autonomous native ExoPlayer queue traversal |
| **Media Notification** | Browser standard Web MediaSession | Custom Android Foreground Notification with Media3 session |
| **Bluetooth Disconnect** | Browser-dependent | Native `ACTION_AUDIO_BECOMING_NOISY` auto-pause |
| **Lock Screen Scrubber** | Limited | Full MediaSession seek and transport controls |
| **Audio Focus** | Web audio policy | Android `AudioManager.AUDIOFOCUS_GAIN` management |
| **Memory Pressure** | Browser tab eviction kills audio | Foreground Service persists independently of UI |

---

## 📋 4. Native Testing & Verification Checklist

1. **APK Cold Start:** Open app → displays Home with last played track as `PAUSED`.
2. **Background Transition:** Start song → press Home → song plays continuously.
3. **Screen Lock:** Turn screen off → lock screen widget displays song title, artist, and transport controls.
4. **Natural Advance in Screen Off:** Song 1 ends with screen locked → Song 2 starts automatically.
5. **Headphone Unplug:** Disconnect headphones → audio pauses immediately.
6. **Cross-Device Handshake:** Tap "Play Here" on Laptop → APK relinquishes lease and stops ExoPlayer cleanly.
