# RaagaX Project Rules

## YouTube API Integration Policies

When building features for RaagaX, you **must strictly adhere to the following policies regarding YouTube usage**:

### ✅ ALLOWED (Discovery & Metadata)
- **New Releases**: Discover recent uploads from official channels and cross-check upload dates.
- **Song/Video Discovery**: Use YouTube search to find music videos.
- **Album/Playlist Discovery**: Find official playlists or "jukeboxes", but cross-check with a legitimate music catalog (like JioSaavn) before claiming it's an "Album".
- **Artist/Channel Discovery**: Use channels to find official artist catalogs.
- **Artwork**: Use YouTube video/playlist thumbnails as fallback cover art.
- **Trending**: Use public YouTube signals (views, likes, comments) as inputs to our own internal Trending Score algorithm.
- **Playback**: Embed and control YouTube videos using the official **YouTube IFrame Player API**.

### ❌ PROHIBITED (Data Extraction & Storage)
- **Do NOT** extract raw audio (MP3/MP4) from YouTube videos.
- **Do NOT** download, import, backup, cache, or store copies of YouTube audiovisual content in Supabase or any other CDN.
- **Do NOT** separate the audio and video components of a YouTube stream.
- **Do NOT** build a hidden or background YouTube player that circumvents the official YouTube IFrame player's display requirements.

### Architecture Principle
Use **JioSaavn** (or another licensed metadata provider) for structured music/album catalogs. Use **YouTube** to augment discovery, fetch playback IFrames, and extract popularity metrics. Never build the database solely around raw extracted YouTube URLs; use stable canonical identifiers (`youtubeVideoId`, `saavnAlbumId`).

## Android APK Release & Update Deployment Protocol

Whenever building, updating, or pushing releases for RaagaX Mobile, **strictly observe this 5-step workflow**:

1. **Package Identity**: ALWAYS maintain `applicationId "com.raagax.music"` in `android/app/build.gradle`.
2. **Release Keystore**: ALWAYS sign ALL build targets (`debug` and `release`) with `raagax-release-key.jks` via `signingConfig signingConfigs.release`. NEVER generate a new keystore or use generic debug keys.
3. **Incremental Versioning**: Increment `versionCode` by +1 (e.g., 19 → 20 → 21) and update `versionName` (e.g., `"1.4.2"` → `"1.4.3"`) in `android/app/build.gradle` before every release.
4. **Automated Release Build**: ALWAYS execute `npm run apk:build`. This triggers `./gradlew assembleRelease`, updates `public/releases/latest.json` dynamically, outputs `public/releases/RaagaX-latest.apk`, and copies `Raaga.apk` to Desktop.
5. **Git Deployment**: Push to `origin main` so `/api/app/version` serves the latest OTA manifest and APK binary to all active mobile users automatically.
