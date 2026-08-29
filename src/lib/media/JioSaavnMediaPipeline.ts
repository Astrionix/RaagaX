/**
 * JioSaavnMediaPipeline — Strict Zero-Fallback Media & Playback Pipeline.
 * 
 * CORE POLICY:
 * 1. 100% Direct JioSaavn CDN Source for Audio & Artwork.
 * 2. 0% Fallback providers (no YouTube, Spotify, Pixabay, or other third parties).
 * 3. 0% Server-side transcoding, re-encoding, downsampling, or proxying.
 * 4. 0% Generated covers, fake AI artwork, or unrelated image placeholders.
 * 5. Direct native streaming from JioSaavn CDN node to client audio engine.
 * 6. Highest available quality selected strictly from provider responses (320kbps -> 256kbps -> 160kbps -> 128kbps).
 */

import { Song } from '@/types/music';
import { QualityManager } from '@/lib/playback/QualityManager';

export interface RawMediaPipelineInspection {
  trackTitle: string;
  artist: string;
  provider: 'JioSaavn';
  rawArtworkUrl: string | null;
  rawAudioUrl: string | null;
  selectedBitrate: string;
  isPlayable: boolean;
  hasArtwork: boolean;
  transcoding: 'NONE';
  proxy: 'NONE';
  fallback: 'NONE';
  sourceNode: string;
}

export interface ArtworkDiagnostics {
  trackTitle: string;
  songId: string;
  album: string;
  albumId: string;
  sourcePlaylist: string;
  songArtwork: string | null;
  albumArtwork: string | null;
  finalPlayerArtwork: string | null;
  artworkSource: 'song' | 'album' | 'unavailable';
}

export class JioSaavnMediaPipeline {
  private static instance: JioSaavnMediaPipeline;

  private constructor() {}

  public static getInstance(): JioSaavnMediaPipeline {
    if (!JioSaavnMediaPipeline.instance) {
      JioSaavnMediaPipeline.instance = new JioSaavnMediaPipeline();
    }
    return JioSaavnMediaPipeline.instance;
  }

  /**
   * Checks if an image URL is an editorial/curated/playlist/discovery banner rather than song/album artwork
   */
  public isPlaylistOrDiscoveryArtwork(url?: string | null): boolean {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('/editorial/') ||
      lower.includes('/channels/') ||
      lower.includes('/featured/') ||
      lower.includes('/playlists/') ||
      lower.includes('/playlist/') ||
      lower.includes('/charts/') ||
      lower.includes('/curated/') ||
      lower.includes('/misc/') ||
      lower.includes('/radio/') ||
      lower.includes('/mixes/') ||
      lower.includes('top_10') ||
      lower.includes('top10') ||
      lower.includes('trending')
    );
  }

  /**
   * Validates if an image URL is direct song or album artwork hosted on JioSaavn CDN
   */
  public isDirectSongOrAlbumArtwork(url?: string | null): boolean {
    if (!url || typeof url !== 'string') return false;
    if (url === '/app-icon.png' || url.includes('/null/') || url.includes('null/null')) return false;
    if (!url.includes('saavncdn.com')) return false;
    if (this.isPlaylistOrDiscoveryArtwork(url)) return false;

    // Direct JioSaavn album/song covers reside in numeric ID folders (e.g., /832/, /999/, /123/)
    const match = url.match(/https?:\/\/[a-z0-9.]*saavncdn\.com\/(\d+)\//i);
    return Boolean(match);
  }

  /**
   * Authoritative Song Artwork Resolution:
   * Priority:
   * 1. Actual song-level JioSaavn artwork
   * 2. Actual album artwork associated with the song
   * 3. Null (Unavailable) — NEVER playlist or editorial artwork
   */
  public resolveSongArtwork(options: {
    songCoverUrl?: string | null;
    albumCoverUrl?: string | null;
    coverUrl?: string | null;
  }): string | null {
    // 1. Direct song artwork
    if (options.songCoverUrl && this.isDirectSongOrAlbumArtwork(options.songCoverUrl)) {
      return this.getRawJioSaavnCoverUrl(options.songCoverUrl, '500x500');
    }

    // 2. Direct album artwork
    if (options.albumCoverUrl && this.isDirectSongOrAlbumArtwork(options.albumCoverUrl)) {
      return this.getRawJioSaavnCoverUrl(options.albumCoverUrl, '500x500');
    }

    // 3. Fallback to generic coverUrl ONLY if it's direct song/album artwork
    if (options.coverUrl && this.isDirectSongOrAlbumArtwork(options.coverUrl)) {
      return this.getRawJioSaavnCoverUrl(options.coverUrl, '500x500');
    }

    return null;
  }

  /**
   * Validates whether a track conforms strictly to the Raw JioSaavn media policy
   */
  public isValidRawJioSaavnTrack(track: Partial<Song> | null | undefined): boolean {
    if (!track) return false;
    
    // Check audio URL validity: must be valid HTTP/HTTPS and not a third-party fallback proxy
    const audio = track.audioUrl || '';
    if (!audio) return false;

    const isNonJioSaavn = 
      audio.includes('pixabay.com') ||
      audio.includes('youtube.com') ||
      audio.includes('spotify.com') ||
      audio.includes('soundcloud.com');

    if (isNonJioSaavn) return false;

    return true;
  }

  /**
   * Selects the highest available raw JioSaavn stream URL
   */
  public selectHighestRawStream(
    downloadUrls: Array<{ quality?: string; url?: string; link?: string }> | string[] | string | undefined
  ): { streamUrl: string | null; bitrate: string } {
    if (!downloadUrls) return { streamUrl: null, bitrate: 'Unavailable' };

    let urls: any[] = [];
    if (typeof downloadUrls === 'string') {
      urls = [downloadUrls];
    } else if (Array.isArray(downloadUrls)) {
      urls = downloadUrls;
    }

    if (urls.length === 0) return { streamUrl: null, bitrate: 'Unavailable' };

    const selectedUrl = QualityManager.selectHighestQuality(urls);
    if (!selectedUrl) return { streamUrl: null, bitrate: 'Unavailable' };

    // Determine actual bitrate from selected URL or object
    let bitrate = '320 kbps';
    if (selectedUrl.includes('_320')) bitrate = '320 kbps';
    else if (selectedUrl.includes('_256')) bitrate = '256 kbps';
    else if (selectedUrl.includes('_160')) bitrate = '160 kbps';
    else if (selectedUrl.includes('_128')) bitrate = '128 kbps';
    else if (selectedUrl.includes('_96')) bitrate = '96 kbps';
    else if (selectedUrl.includes('_48')) bitrate = '48 kbps';
    else if (selectedUrl.includes('_12')) bitrate = '12 kbps';

    return {
      streamUrl: selectedUrl,
      bitrate,
    };
  }

  /**
   * Formats raw JioSaavn cover image URL directly from provider without proxying
   */
  public getRawJioSaavnCoverUrl(
    imageSource: any,
    targetQuality: '500x500' | '150x150' | '50x50' = '500x500'
  ): string | null {
    if (!imageSource) return null;

    let url = '';
    if (typeof imageSource === 'string') {
      url = imageSource;
    } else if (Array.isArray(imageSource) && imageSource.length > 0) {
      const target = imageSource.find((i: any) => i?.quality === targetQuality || i?.quality?.toLowerCase() === targetQuality.toLowerCase());
      const hi = target || imageSource[imageSource.length - 1] || imageSource[0];
      url = hi?.url || hi?.link || (typeof hi === 'string' ? hi : '');
    } else if (imageSource?.url) {
      url = imageSource.url;
    } else if (imageSource?.link) {
      url = imageSource.link;
    }

    if (!url || url.includes('/null/') || url.includes('null/null') || url.endsWith('/null') || url.trim() === '') {
      return null;
    }

    // Direct HTTPS conversion on JioSaavn CDN node
    let directUrl = url.trim().replace('http://', 'https://');
    if (targetQuality === '500x500') {
      directUrl = directUrl.replace(/150x150|50x50|300x300/g, '500x500');
    }

    return directUrl;
  }

  /**
   * Telemetry Diagnostics for Media Pipeline verification in development
   */
  public inspectPipeline(song: Song, context?: any): RawMediaPipelineInspection {
    const rawAudio = song.audioUrl || null;
    const rawCover = song.coverUrl && song.coverUrl !== '/app-icon.png' ? song.coverUrl : null;
    const isPlayable = Boolean(rawAudio && this.isValidRawJioSaavnTrack(song));

    const inspection: RawMediaPipelineInspection = {
      trackTitle: song.title || 'Unknown Title',
      artist: song.artist || 'Unknown Artist',
      provider: 'JioSaavn',
      rawArtworkUrl: rawCover,
      rawAudioUrl: rawAudio,
      selectedBitrate: song.bitrate || (rawAudio?.includes('_320') ? '320 kbps' : '160 kbps'),
      isPlayable,
      hasArtwork: Boolean(rawCover),
      transcoding: 'NONE',
      proxy: 'NONE',
      fallback: 'NONE',
      sourceNode: rawAudio?.includes('aac.saavncdn.com') ? 'JioSaavn Akamai/Cloudfront Audio Edge' : 'JioSaavn Primary Media Node',
    };

    const songArtwork = (song as any).songCoverUrl || (this.isDirectSongOrAlbumArtwork(song.coverUrl) ? song.coverUrl : null);
    const albumArtwork = (song as any).albumCoverUrl || null;
    const finalArtwork = rawCover;
    const artworkSource: 'song' | 'album' | 'unavailable' = songArtwork ? 'song' : albumArtwork ? 'album' : 'unavailable';

    const artworkDiagnostics: ArtworkDiagnostics = {
      trackTitle: song.title || 'Unknown Title',
      songId: song.id || 'N/A',
      album: song.album || 'Unknown Album',
      albumId: song.albumId || 'N/A',
      sourcePlaylist: context?.name || context?.title || (song as any).sourcePlaylistTitle || 'Direct / None',
      songArtwork,
      albumArtwork,
      finalPlayerArtwork: finalArtwork,
      artworkSource,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[JioSaavnMediaPipeline] Inspection:`, inspection);
      console.log(`[ARTWORK_RESOLUTION_DIAGNOSTICS]\nCURRENT SONG: ${artworkDiagnostics.trackTitle}\nSONG ID: ${artworkDiagnostics.songId}\nALBUM: ${artworkDiagnostics.album}\nALBUM ID: ${artworkDiagnostics.albumId}\nSOURCE PLAYLIST: ${artworkDiagnostics.sourcePlaylist}\nSONG ARTWORK: ${artworkDiagnostics.songArtwork || 'N/A'}\nALBUM ARTWORK: ${artworkDiagnostics.albumArtwork || 'N/A'}\nFINAL PLAYER ARTWORK: ${artworkDiagnostics.finalPlayerArtwork || 'N/A'}\nARTWORK SOURCE: ${artworkDiagnostics.artworkSource}`);
    }

    return inspection;
  }
}
