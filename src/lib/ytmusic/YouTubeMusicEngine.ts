import { Innertube, UniversalCache, ClientType, Log } from 'youtubei.js';
import { Song } from '@/types/music';

interface CachedStreamInfo {
  url: string;
  mimeType: string;
  contentLength?: number;
  expiresAt: number;
}

export interface YouTubePlaylistResult {
  id: string;
  title: string;
  coverUrl: string;
  songCount?: number;
  source: string;
}

export interface YouTubePlaylistDetails {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  songs: Song[];
  isUserOwned: boolean;
  isCollaborative: boolean;
}

export class YouTubeMusicEngine {
  private static instance: YouTubeMusicEngine;
  private ytPromise: Promise<Innertube> | null = null;
  private streamCache = new Map<string, CachedStreamInfo>();

  private constructor() {}

  public static getInstance(): YouTubeMusicEngine {
    if (!YouTubeMusicEngine.instance) {
      YouTubeMusicEngine.instance = new YouTubeMusicEngine();
    }
    return YouTubeMusicEngine.instance;
  }

  private async getClient(): Promise<Innertube> {
    if (!this.ytPromise) {
      Log.setLevel(Log.Level.ERROR);
      this.ytPromise = Innertube.create({
        client_type: ClientType.VISIONOS,
        cache: new UniversalCache(false),
        generate_session_locally: true,
      }).catch((err) => {
        this.ytPromise = null;
        console.error('[YouTubeMusicEngine] Failed to initialize InnerTube client:', err);
        throw err;
      });
    }
    return this.ytPromise;
  }

  /**
   * Search for songs and music videos on YouTube Music.
   * Concurrently queries both official songs and music videos (for remixes, bass boosted, covers).
   */
  public async searchSongs(query: string, limit = 25): Promise<Song[]> {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    try {
      const yt = await this.getClient();

      // Check if query is looking for specialized edits (bass boosted, remix, 8d, etc.)
      const isSpecialEditQuery = /bass|boost|remix|dj|mashup|8d|slowed|reverb|cover|mix|edit/i.test(trimmed);

      const [songsResult, videosResult] = await Promise.allSettled([
        yt.music.search(trimmed, { type: 'song' }),
        yt.music.search(trimmed, { type: 'video' }),
      ]);

      const rawSongs = songsResult.status === 'fulfilled'
        ? ((songsResult.value.songs?.contents || songsResult.value.contents || []) as any[])
        : [];
      const rawVideos = videosResult.status === 'fulfilled'
        ? ((videosResult.value.videos?.contents || videosResult.value.contents || []) as any[])
        : [];

      // If user specifically asked for bass boosted/remixes/edits, prioritize videos
      const combined = isSpecialEditQuery
        ? [...rawVideos, ...rawSongs]
        : [...rawSongs, ...rawVideos];

      const songs: Song[] = [];
      const seenVideoIds = new Set<string>();

      for (const item of combined) {
        if (!item || (!item.id && !item.videoId)) continue;

        const videoId = String(item.id || item.videoId);
        if (seenVideoIds.has(videoId)) continue;
        seenVideoIds.add(videoId);

        const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Unknown Track';

        let authorName = '';
        let channelId = '';
        if (Array.isArray(item.artists) && item.artists.length > 0) {
          authorName = item.artists.map((a: any) => a.name || a.text || '').filter(Boolean).join(', ');
          channelId = item.artists[0]?.channel_id || item.artists[0]?.id || '';
        } else if (item.author) {
          authorName = item.author.name || item.author.text || '';
          channelId = item.author.channel_id || item.author.id || '';
        }

        const parsed = this.parseTrackMetadata(rawTitle, authorName);
        const title = parsed.title;
        const artist = parsed.artist || authorName || 'Various Artists';
        const artistId = channelId ? `art-ytm-${channelId}` : `art-ytm-${videoId}`;

        const rawAlbum = item.album?.name || item.album?.title || parsed.album;
        const album = rawAlbum || title;
        const albumId = item.album?.id ? `alb-ytm-${item.album.id}` : `alb-ytm-${videoId}`;

        let duration = 210;
        if (typeof item.duration === 'number') {
          duration = item.duration;
        } else if (item.duration?.seconds) {
          duration = item.duration.seconds;
        } else if (item.duration?.text) {
          duration = this.parseDurationText(item.duration.text);
        }

        // Get highest quality thumbnail
        let coverUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
          const last = item.thumbnails[item.thumbnails.length - 1];
          if (last?.url) {
            coverUrl = last.url.includes('ytimg.com/vi/') ? last.url.split('?')[0] : last.url;
          }
        } else if (item.thumbnail?.contents?.[0]?.url) {
          const raw = item.thumbnail.contents[0].url;
          coverUrl = raw.includes('ytimg.com/vi/') ? raw.split('?')[0] : raw;
        } else if (item.thumbnail?.url) {
          const raw = item.thumbnail.url;
          coverUrl = raw.includes('ytimg.com/vi/') ? raw.split('?')[0] : raw;
        }

        if (coverUrl.includes('googleusercontent.com') && coverUrl.includes('=')) {
          coverUrl = coverUrl.replace(/=w\d+-h\d+[^?&]*/, '=w500-h500-l90-rj').replace(/=s\d+[^?&]*/, '=s500');
        }

        songs.push({
          id: `ytm-${videoId}`,
          title: title.trim(),
          artist: artist.trim(),
          artistId,
          album: album.trim(),
          albumId,
          duration,
          coverUrl,
          audioUrl: `/api/ytmusic/stream/${videoId}`,
          genre: 'YouTube Music',
          category: 'melody',
          releaseYear: new Date().getFullYear(),
          plays: 5000,
          likes: 1,
          audioQuality: 'Hi-Res Lossless',
          bitrate: '130 kbps',
          codec: 'AAC',
          source: 'youtube',
          sources: {
            youtube: {
              videoId,
              channelId,
              channelTitle: artist,
              publishedAt: new Date().toISOString(),
            },
          },
        });

        if (songs.length >= limit) break;
      }

      return songs;
    } catch (err: any) {
      console.warn('[YouTubeMusicEngine] Search error for query:', query, err?.message || err);
      return [];
    }
  }

  /**
   * Search for playlists on YouTube Music (e.g. Bass Boosted Telugu Songs playlists).
   */
  public async searchPlaylists(query: string, limit = 10): Promise<YouTubePlaylistResult[]> {
    const trimmed = (query || '').trim();
    if (!trimmed) return [];

    try {
      const yt = await this.getClient();
      const res = await yt.music.search(trimmed, { type: 'playlist' });
      const rawPlaylists = (res.playlists?.contents || res.contents || []) as any[];

      const playlists: YouTubePlaylistResult[] = [];

      for (const item of rawPlaylists) {
        if (!item || !item.id) continue;

        const id = String(item.id);
        const title = typeof item.title === 'string' ? item.title : item.title?.text || 'YouTube Playlist';

        let coverUrl = '/app-icon.png';
        if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
          const last = item.thumbnails[item.thumbnails.length - 1];
          coverUrl = last.url || coverUrl;
        }

        let songCount: number | undefined;
        if (item.item_count) {
          songCount = parseInt(String(item.item_count), 10);
        }

        playlists.push({
          id: `ytp-${id}`,
          title: title.trim(),
          coverUrl,
          songCount: isNaN(songCount as any) ? undefined : songCount,
          source: 'YouTube Music',
        });

        if (playlists.length >= limit) break;
      }

      return playlists;
    } catch (err: any) {
      console.warn('[YouTubeMusicEngine] Playlist search error for query:', query, err?.message || err);
      return [];
    }
  }

  /**
   * Fetches full playlist details and tracks for a YouTube Music playlist.
   */
  public async getPlaylistDetails(playlistId: string): Promise<YouTubePlaylistDetails | null> {
    const cleanId = (playlistId || '').replace(/^ytp-/, '').trim();
    if (!cleanId) return null;

    try {
      const yt = await this.getClient();
      const pl = await yt.music.getPlaylist(cleanId);
      if (!pl) return null;

      const header = pl.header as any;
      const title = header?.title?.text || header?.title || 'YouTube Music Playlist';
      const description = header?.description?.text || header?.description || 'YouTube Music Playlist Collection';
      
      let coverUrl = '/app-icon.png';
      if (Array.isArray(header?.thumbnails) && header.thumbnails.length > 0) {
        coverUrl = header.thumbnails[header.thumbnails.length - 1]?.url || coverUrl;
      } else if (header?.thumbnail?.contents?.[0]?.url) {
        coverUrl = header.thumbnail.contents[0].url;
      }

      const items = (pl.items || []) as any[];
      if ((!coverUrl || coverUrl === '/app-icon.png') && items.length > 0) {
        const firstVid = items[0]?.id || items[0]?.videoId;
        if (firstVid) {
          coverUrl = `https://i.ytimg.com/vi/${firstVid}/hqdefault.jpg`;
        }
      }

      const songs: Song[] = [];

      for (const item of items) {
        if (!item || !item.id) continue;

        const videoId = String(item.id);
        const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Track';

        let authorName = '';
        let channelId = '';
        if (Array.isArray(item.artists) && item.artists.length > 0) {
          authorName = item.artists.map((a: any) => a.name || a.text || '').filter(Boolean).join(', ');
          channelId = item.artists[0]?.channel_id || item.artists[0]?.id || '';
        } else if (item.author) {
          authorName = item.author.name || item.author.text || '';
          channelId = item.author.channel_id || item.author.id || '';
        }

        const parsed = this.parseTrackMetadata(rawTitle, authorName);
        const songTitle = parsed.title;
        const artist = parsed.artist || authorName || 'Various Artists';
        const artistId = channelId ? `art-ytm-${channelId}` : `art-ytm-${videoId}`;

        let duration = 210;
        if (typeof item.duration === 'number') {
          duration = item.duration;
        } else if (item.duration?.seconds) {
          duration = item.duration.seconds;
        } else if (item.duration?.text) {
          duration = this.parseDurationText(item.duration.text);
        }

        let thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
          const raw = item.thumbnails[item.thumbnails.length - 1].url;
          if (raw) thumb = raw.includes('ytimg.com/vi/') ? raw.split('?')[0] : raw;
        } else if (item.thumbnail?.contents?.[0]?.url) {
          const raw = item.thumbnail.contents[0].url;
          if (raw) thumb = raw.includes('ytimg.com/vi/') ? raw.split('?')[0] : raw;
        }

        songs.push({
          id: `ytm-${videoId}`,
          title: songTitle.trim(),
          artist: artist.trim(),
          artistId,
          album: parsed.album || title,
          albumId: `alb-ytp-${cleanId}`,
          duration,
          coverUrl: thumb,
          audioUrl: `/api/ytmusic/stream/${videoId}`,
          genre: 'YouTube Music',
          category: 'melody',
          releaseYear: new Date().getFullYear(),
          plays: 5000,
          likes: 1,
          audioQuality: 'Hi-Res Lossless',
          bitrate: '130 kbps',
          codec: 'AAC',
          source: 'youtube',
          sources: {
            youtube: {
              videoId,
              channelId,
              channelTitle: artist,
              publishedAt: new Date().toISOString(),
            },
          },
        });
      }

      return {
        id: `ytp-${cleanId}`,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        coverUrl,
        songs,
        isUserOwned: false,
        isCollaborative: false,
      };
    } catch (err: any) {
      console.error(`[YouTubeMusicEngine] Error fetching playlist ${cleanId}:`, err?.message || err);
      return null;
    }
  }

  /**
   * Clears any cached stream information for a specific video.
   */
  public invalidateStream(videoId: string): void {
    const cleanId = (videoId || '').replace(/^ytm-/, '').trim();
    if (cleanId) {
      this.streamCache.delete(cleanId);
    }
  }

  /**
   * Resolves direct playable audio format stream URL for a YouTube video.
   * Returns cached URL if still valid to avoid redundant network overhead.
   */
  public async getAudioStreamInfo(videoId: string, forceRefresh = false): Promise<CachedStreamInfo | null> {
    const cleanId = (videoId || '').replace(/^ytm-/, '').trim();
    if (!cleanId) return null;

    if (!forceRefresh) {
      const cached = this.streamCache.get(cleanId);
      if (cached && Date.now() < cached.expiresAt) {
        return cached;
      }
    } else {
      this.streamCache.delete(cleanId);
    }

    try {
      const yt = await this.getClient();
      const info = await yt.getBasicInfo(cleanId);

      const adaptive = info.streaming_data?.adaptive_formats || [];
      const audioFormats = adaptive.filter((f) => f.has_audio && !f.has_video && Boolean(f.url));

      if (!audioFormats.length) {
        console.warn(`[YouTubeMusicEngine] No direct audio format available for video: ${cleanId}`);
        return null;
      }

      // Prefer itag 140 (128kbps AAC / audio/mp4) for universal browser audio playback compatibility,
      // fallback to highest bitrate audio format available
      const mp4Format = audioFormats.find((f) => f.itag === 140 || (f.mime_type?.includes('audio/mp4') && (f.bitrate || 0) >= 120000));
      const best = mp4Format || audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      const streamInfo: CachedStreamInfo = {
        url: best.url as string,
        mimeType: best.mime_type || 'audio/mp4',
        contentLength: best.content_length ? parseInt(String(best.content_length), 10) : undefined,
        expiresAt: Date.now() + 3 * 60 * 60 * 1000, // 3 hours TTL
      };

      this.streamCache.set(cleanId, streamInfo);
      return streamInfo;
    } catch (err: any) {
      console.error(`[YouTubeMusicEngine] Failed to resolve stream for ${cleanId}:`, err?.message || err);
      return null;
    }
  }

  /**
   * Parses time string like "3:45" or "1:04:20" into seconds.
   */
  private parseDurationText(text: string): number {
    if (!text || typeof text !== 'string') return 180;
    const parts = text.split(':').map((p) => parseInt(p.trim(), 10));
    if (parts.some(isNaN)) return 180;

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 180;
  }

  /**
   * Intelligently parses raw YouTube video / song titles
   * into clean Song Title, Album/Movie, and Artists while preserving important tags like (Bass Boosted), (Remix).
   */
  public parseTrackMetadata(
    rawTitle: string,
    defaultAuthor?: string
  ): { title: string; album: string; artist: string } {
    const text = (rawTitle || '').trim();
    if (!text) {
      return { title: 'Unknown Track', album: 'YouTube Music', artist: defaultAuthor || 'Various Artists' };
    }

    // Detect special edition / audio modification tags in title and author
    const fullContext = `${text} ${defaultAuthor || ''}`;
    const specialTags: string[] = [];
    if (/bass\s*boost(?:ed)?/i.test(fullContext)) specialTags.push('Bass Boosted');
    const remixMatch = text.match(/\b(remix|mashup|dj\s*mix|club\s*mix)\b/i);
    if (remixMatch && !specialTags.includes('Bass Boosted')) specialTags.push(remixMatch[0]);
    if (/slowed(?:\s*\+\s*reverb)?/i.test(fullContext)) specialTags.push('Slowed + Reverb');
    if (/lo-?fi/i.test(fullContext)) specialTags.push('Lofi');
    if (/8d(?:\s*audio)?/i.test(fullContext)) specialTags.push('8D Audio');

    // Split by pipe '|', '//', '•'
    let segments = text.split(/\s*[|•/]{1,2}\s*/).map((s) => s.trim()).filter(Boolean);

    // Filter out channel handles and video noise tags
    segments = segments.filter(
      (seg) => !seg.startsWith('@') && !/^(official|video|audio|full\s+song|lyrical|4k|hd|visualizer|promo)$/i.test(seg)
    );

    let songTitle = '';
    let album = '';
    const artists: string[] = [];

    if (segments.length > 0) {
      const first = segments[0];
      if (first.includes(' - ')) {
        const sub = first.split(/\s*-\s*/);
        songTitle = sub[0].trim();
        album = sub.slice(1).join(' - ').trim();
      } else {
        songTitle = first;
      }
    }

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (!album && i === 1 && !seg.toLowerCase().includes('feat') && segments.length > 2) {
        album = seg;
      } else {
        artists.push(seg);
      }
    }

    // Clean brackets
    songTitle = songTitle.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim();
    if (album) {
      album = album.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim();
    }

    // Append special tags if not already present
    if (specialTags.length > 0 && !new RegExp(specialTags.join('|'), 'i').test(songTitle)) {
      songTitle = `${songTitle} (${specialTags.join(', ')})`;
    }

    let finalArtist = artists.filter((a) => !a.startsWith('@')).join(', ');
    if (!finalArtist) {
      finalArtist = defaultAuthor ? defaultAuthor.replace(/^@/, '') : 'Various Artists';
    }

    return {
      title: songTitle || rawTitle,
      album: album || songTitle || 'YouTube Music',
      artist: finalArtist || defaultAuthor || 'Various Artists',
    };
  }

  /**
   * Fetches official lyrics for a YouTube Music track.
   */
  public async getLyrics(videoId: string): Promise<string | null> {
    const cleanId = (videoId || '').replace(/^ytm-/, '').trim();
    if (!cleanId) return null;

    try {
      const yt = await this.getClient();
      const lyrics = await yt.music.getLyrics(cleanId);
      const text = lyrics?.description?.text || '';
      return text.trim().length > 0 ? text.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches full artist bio, thumbnail, and top songs for YouTube Music artists.
   */
  public async getArtistDetails(artistIdOrName: string): Promise<any> {
    let cleanId = (artistIdOrName || '').replace(/^art-ytm-/, '').trim();
    if (!cleanId) return null;

    try {
      const yt = await this.getClient();
      let artistObj: any = null;

      // If cleanId is a YouTube channel ID (e.g. starts with UC)
      if (cleanId.startsWith('UC')) {
        try {
          artistObj = await yt.music.getArtist(cleanId);
        } catch {
          artistObj = null;
        }
      }

      // If not found by channel ID, search by artist name
      if (!artistObj) {
        try {
          const searchRes = await yt.music.search(cleanId, { type: 'artist' });
          const list = (searchRes.artists?.contents || searchRes.contents || []) as any[];
          if (list.length > 0 && list[0]?.id) {
            cleanId = list[0].id;
            artistObj = await yt.music.getArtist(cleanId);
          }
        } catch (searchErr) {
          console.warn('[YouTubeMusicEngine] Failed to search artist:', cleanId, searchErr);
        }
      }

      if (!artistObj) return null;

      const header = artistObj.header as any;
      const name = header?.title?.text || header?.title || cleanId;
      const bioText = header?.description?.text || header?.description || '';

      let thumbUrl = '/app-icon.png';
      const thumbs = header?.thumbnail?.contents || header?.thumbnails || [];
      if (thumbs.length > 0) {
        thumbUrl = thumbs[thumbs.length - 1]?.url || thumbUrl;
      }

      const sections = (artistObj.sections || []) as any[];
      const songsSec = sections.find((s: any) =>
        (s.title?.text || s.title || '').toLowerCase().includes('song')
      );
      const rawSongs = (songsSec?.contents || []) as any[];

      const topSongs = rawSongs.slice(0, 30).map((s: any) => {
        const vid = s.id || s.videoId || '';
        const rawSongTitle = typeof s.title === 'string' ? s.title : s.title?.text || 'Track';
        const parsed = this.parseTrackMetadata(rawSongTitle, name);
        return {
          id: `ytm-${vid}`,
          name: parsed.title,
          title: parsed.title,
          artists: {
            primary: [{ id: `art-ytm-${cleanId}`, name }],
          },
          album: {
            id: `alb-ytm-${vid}`,
            name: s.album?.name || s.album?.title || parsed.album || parsed.title,
          },
          duration: s.duration?.seconds || 210,
          image: [{ quality: '500x500', url: thumbUrl }],
          downloadUrl: [{ quality: '320kbps', url: `/api/ytmusic/stream/${vid}` }],
          audioUrl: `/api/ytmusic/stream/${vid}`,
          source: 'youtube',
        };
      });

      return {
        id: `art-ytm-${cleanId}`,
        name,
        bio: bioText ? [{ title: 'Introduction', text: bioText }] : [],
        image: [{ quality: '500x500', url: thumbUrl }],
        topSongs,
        topAlbums: [],
        isVerified: true,
      };
    } catch (err: any) {
      console.error(`[YouTubeMusicEngine] Error fetching artist ${artistIdOrName}:`, err?.message || err);
      return null;
    }
  }
}

