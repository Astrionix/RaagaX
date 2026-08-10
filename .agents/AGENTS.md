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
