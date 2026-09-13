# RaagaX Project Rules

## YouTube API Integration Policies

When building features for RaagaX, you **must strictly adhere to the following policies regarding YouTube usage**:

### ✅ ALLOWED (Discovery, Playback & Offline)
- **YouTube Music Catalog & Discovery**: Search songs, artists, albums, and playlists from YouTube Music for comprehensive discovery.
- **Audio Playback via Server Proxy**: Stream YouTube Music audio via the dedicated internal server proxy (`/api/ytmusic/stream/[id]`) with HTTP 206 range headers for seamless background playback and lockscreen media session integration.
- **Personal Offline Caching**: Allow users to cache/download tracks locally on their personal device (IndexedDB / device storage) for offline listening.
- **New Releases & Signals**: Discover recent uploads from official channels and use public signals for trending algorithms.
- **Artwork**: Use official high-resolution thumbnails for cover art.

### ❌ PROHIBITED
- **Do NOT** upload, backup, or host YouTube audiovisual content in external cloud databases (e.g. Supabase, public S3 buckets, or third-party CDNs).
- **Do NOT** bypass the server proxy to expose direct temporary `googlevideo.com` signed URLs to clients (which cause 403 IP lockouts and break over time).

### Architecture Principle
Use **JioSaavn** as the primary high-fidelity (320kbps) studio catalog provider. Use **YouTube Music** to augment search with indie, cover, remix, and non-catalog tracks. Canonical identifiers: `song.id` with `ytm-` prefix for YouTube Music tracks (`videoId`) and standard numeric IDs for JioSaavn.
