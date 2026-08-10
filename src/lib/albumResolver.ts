import { JioSaavnProvider } from './jioSaavnProvider';

export interface CanonicalAlbum {
  id: string;
  title: string;
  artist: string;
  language: string;
  year: number;
  coverUrl: string;
  sources: {
    jiosaavn?: { albumId: string };
    youtube?: { videoId?: string; playlistId?: string };
  };
  songs: any[];
  verified: boolean;
  type: 'album' | 'playlist';
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\(from[^)]*\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(official album|jukebox|audio|full video|lyrical|video|songs)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractImage(image: any): string {
  let coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
  if (Array.isArray(image)) {
    const hi = image.find((i: any) => i.quality === '500x500') || image[image.length - 1];
    if (hi?.url) coverUrl = hi.url.replace('http://', 'https://');
  } else if (typeof image === 'string' && image) {
    coverUrl = image.replace('http://', 'https://');
  }
  return coverUrl;
}

export class AlbumResolver {
  private saavn: JioSaavnProvider;
  private youtubeApiKey = process.env.YOUTUBE_API_KEY || '';

  constructor(baseUrl: string) {
    this.saavn = JioSaavnProvider.getInstance(baseUrl);
  }

  async resolveAlbums(lang: string, query: string, limit = 10, type: 'album' | 'playlist' = 'album'): Promise<CanonicalAlbum[]> {
    const rawItems = type === 'album' 
      ? await this.saavn.searchAlbums(query, limit)
      : await this.saavn.searchPlaylists(query, limit);

    const canonicalAlbums: CanonicalAlbum[] = [];
    const seenMap = new Map<string, CanonicalAlbum>();
    const ytCandidates: any[] = [];

    // 1. Process Saavn as Primary source
    for (const item of rawItems) {
      const title = item.title || item.name || '';
      const artist = item.subtitle || item.primaryArtists || 'Various Artists';
      const normKey = normalizeText(title);

      if (!normKey) continue;
      if (seenMap.has(normKey)) continue;

      const canonical: CanonicalAlbum = {
        id: item.id || crypto.randomUUID(),
        title: title
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&'),
        artist: artist,
        language: lang,
        year: parseInt(item.year) || new Date().getFullYear(),
        coverUrl: extractImage(item.image),
        sources: {
          jiosaavn: { albumId: item.id }
        },
        songs: [], // Populate if needed
        verified: true,
        type: type
      };

      seenMap.set(normKey, canonical);
      canonicalAlbums.push(canonical);
    }

    // 2. Cross-check with YouTube (Merge if duplicate, Add if highly confident)
    for (const yt of ytCandidates) {
      const normKey = normalizeText(yt.title);
      if (seenMap.has(normKey)) {
        // Merge sources
        const existing = seenMap.get(normKey)!;
        existing.sources.youtube = yt.isPlaylist 
          ? { playlistId: yt.id }
          : { videoId: yt.id };
      } else {
        // We strictly don't create albums purely from YT unless it's heavily verified
        // "Never create an album unless it is backed by real source data"
        // If it's just a single YT video, we discard it unless it's a confirmed Playlist/Jukebox.
        if (yt.isPlaylist || yt.title.toLowerCase().includes('jukebox')) {
           const canonical: CanonicalAlbum = {
            id: yt.id,
            title: yt.title,
            artist: yt.channelTitle || 'YouTube',
            language: lang,
            year: new Date().getFullYear(),
            coverUrl: yt.thumbnail,
            sources: {
              youtube: yt.isPlaylist ? { playlistId: yt.id } : { videoId: yt.id }
            },
            songs: [],
            verified: true, // Passed checks
            type: 'album'
          };
          seenMap.set(normKey, canonical);
          canonicalAlbums.push(canonical);
        }
      }
    }

    return canonicalAlbums;
  }

  private async searchYouTubeAlbums(query: string) {
    if (!this.youtubeApiKey) return [];
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          query
        )}&type=playlist,video&videoDuration=long&maxResults=5&key=${this.youtubeApiKey}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      
      return (data.items || []).map((item: any) => ({
        id: item.id.playlistId || item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        isPlaylist: !!item.id.playlistId,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
      }));
    } catch {
      return [];
    }
  }
}
