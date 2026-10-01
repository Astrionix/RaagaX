import {
  Song,
  HomeShelf,
  NewFeedData,
  SearchResultGroup,
  SearchFilter,
  DetailPage,
  LyricsData,
} from "@/types/music";
import {
  searchInnerTube,
  getInnerTubeSuggestions,
  getInnerTubeHome,
  getInnerTubeCharts,
  getInnerTubeExplore,
  getInnerTubeBrowseDetail,
  getInnerTubeRadio,
} from "./innertube";
import { fetchLyrics } from "./lyrics";

export interface IMusicProvider {
  search(query: string, filter?: SearchFilter): Promise<SearchResultGroup>;
  getSuggestions(query: string): Promise<string[]>;
  getHome(): Promise<HomeShelf[]>;
  getExplore(): Promise<NewFeedData>;
  getDetail(browseId: string): Promise<DetailPage | null>;
  getLyrics(
    title: string,
    artist: string,
    duration?: number,
    videoId?: string,
    album?: string,
    preferredSource?: any
  ): Promise<LyricsData>;
}

export class RaagaMusicProvider implements IMusicProvider {
  /**
   * Pure YouTube InnerTube search.
   * Returns real songs, albums, artists, playlists, and videos directly from YouTube Music.
   */
  async search(query: string, filter: SearchFilter = "All"): Promise<SearchResultGroup> {
    try {
      return await searchInnerTube(query, filter);
    } catch (err) {
      console.error("MusicProvider search error:", err);
      return { songs: [], albums: [], artists: [], playlists: [], videos: [] };
    }
  }

  async getSuggestions(query: string): Promise<string[]> {
    return getInnerTubeSuggestions(query);
  }

  /**
   * Pure YouTube Home feed.
   * Combines YouTube Home feeds, YouTube Charts, and Daily Top Music Videos
   * so all cards display real YouTube tracks, real artists, real playlists, and real thumbnails.
   */
  async getHome(): Promise<HomeShelf[]> {
    try {
      const [homeShelves, chartsShelves, topVideosPlaylist] = await Promise.all([
        getInnerTubeHome().catch(() => []),
        getInnerTubeCharts().catch(() => []),
        getInnerTubeBrowseDetail("VLPL4fGSI1pDJn5oibdgJt8Hy0-dr2B7kSs2").catch(() => null),
      ]);

      const result: HomeShelf[] = [];

      // 1. Quick Picks: Direct playable songs from YouTube Daily Top Music Videos
      if (topVideosPlaylist && topVideosPlaylist.songs.length > 0) {
        result.push({
          title: "Quick Picks",
          subtitle: "Playable right now from YouTube Charts",
          items: topVideosPlaylist.songs.slice(0, 12).map((song) => ({
            title: song.title,
            subtitle: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            videoId: song.videoId,
            type: "PLAYLIST",
          })),
        });

        // 2. Trending on YouTube
        result.push({
          title: "Trending on YouTube",
          subtitle: "Most streamed music videos & audio tracks",
          items: topVideosPlaylist.songs.slice(12, 28).map((song) => ({
            title: song.title,
            subtitle: song.artist,
            thumbnailUrl: song.thumbnailUrl,
            videoId: song.videoId,
            type: "PLAYLIST",
          })),
        });
      }

      // 3. YouTube Charts & Top Artists
      for (const cShelf of chartsShelves) {
        if (cShelf.items.length > 0) {
          result.push(cShelf);
        }
      }

      // 4. Recommended playlists & albums from YouTube Home
      for (const hShelf of homeShelves) {
        if (hShelf.items.length > 0) {
          result.push(hShelf);
        }
      }

      return result;
    } catch (err) {
      console.error("Error fetching YouTube home feed:", err);
      return [];
    }
  }

  async getExplore(): Promise<NewFeedData> {
    return getInnerTubeExplore();
  }

  async getDetail(browseId: string): Promise<DetailPage | null> {
    return getInnerTubeBrowseDetail(browseId);
  }

  async getRadio(videoId: string): Promise<Song[]> {
    return getInnerTubeRadio(videoId);
  }

  async getLyrics(
    title: string,
    artist: string,
    duration?: number,
    videoId?: string,
    album?: string,
    preferredSource?: any
  ): Promise<LyricsData> {
    return fetchLyrics(title, artist, duration, videoId, album, preferredSource);
  }

  async getStream(song: Song): Promise<{ url: string; kbps: number }> {
    // Official YouTube IFrame Player is the playback mechanism.
    return { url: song.streamUrl || "", kbps: song.kbps || 256 };
  }
}

export const musicService = new RaagaMusicProvider();
