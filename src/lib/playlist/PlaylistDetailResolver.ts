import { Song } from '@/types/music';
import dynamicPlaylistsData from '@/lib/dynamic_home_playlists.json';
import { getCuratedPlaylists } from '@/constants/playlists';
import { RealMusicEngine } from '@/lib/realMusicEngine';
import { SongUniquenessEngine } from '@/lib/music/SongUniquenessEngine';
import { getApiUrl } from '@/lib/config/apiConfig';

const dynamicPlaylists = dynamicPlaylistsData as Record<string, any>;

export interface ResolvedPlaylist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  songs: Song[];
  isUserOwned: boolean;
  isCollaborative: boolean;
  ownerName?: string;
}

export class PlaylistDetailResolver {
  private static instance: PlaylistDetailResolver;

  private constructor() {}

  public static getInstance(): PlaylistDetailResolver {
    if (!PlaylistDetailResolver.instance) {
      PlaylistDetailResolver.instance = new PlaylistDetailResolver();
    }
    return PlaylistDetailResolver.instance;
  }

  /**
   * Resolves ANY playlist ID (JioSaavn ID, Curated ID, Dynamic ID, Album ID)
   * into a fully populated playlist with real distinct tracks.
   */
  public async resolve(playlistId: string, preferredLanguage: string = 'Telugu'): Promise<ResolvedPlaylist | null> {
    if (!playlistId) return null;

    // 1. Check if it's an Album ID
    if (playlistId.startsWith('album:')) {
      const details = await RealMusicEngine.getInstance().getPlaylistDetails(playlistId);
      if (details && details.songs.length > 0) {
        return {
          id: playlistId,
          title: details.title,
          description: `Album • ${details.songs.length} Tracks`,
          coverUrl: details.coverUrl || '/app-icon.png',
          songs: details.songs,
          isUserOwned: false,
          isCollaborative: false,
        };
      }
    }

    // 2. Find metadata from dynamic catalog or curated collections
    let foundMeta: { title: string; desc: string; coverUrl: string; language: string; category?: string } | null = null;

    // Search dynamic_home_playlists.json across all languages
    for (const [lang, categories] of Object.entries(dynamicPlaylists)) {
      if (typeof categories !== 'object' || !categories) continue;
      for (const [catName, items] of Object.entries(categories as Record<string, any[]>)) {
        if (!Array.isArray(items)) continue;
        const match = items.find((it: any) => String(it.id) === String(playlistId));
        if (match) {
          foundMeta = {
            title: match.title,
            desc: `${lang} • Curated ${catName.replace(/_/g, ' ')} Collection`,
            coverUrl: match.imageUrl || '/app-icon.png',
            language: lang,
            category: catName,
          };
          break;
        }
      }
      if (foundMeta) break;
    }

    // Search curated static playlists
    if (!foundMeta) {
      const languagesToCheck = [preferredLanguage, 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Punjabi', 'English'];
      for (const lang of languagesToCheck) {
        const curatedList = getCuratedPlaylists(lang);
        const match = curatedList.find((p) => p.id === playlistId);
        if (match) {
          foundMeta = {
            title: match.name,
            desc: match.desc || `${lang} Curated Mix`,
            coverUrl: match.coverUrl || '/app-icon.png',
            language: lang,
          };
          break;
        }
      }
    }

    // 3. Attempt direct API fetch from /api/playlists or /api/playlist/details
    const targetLang = foundMeta?.language || preferredLanguage || 'Telugu';
    const realEngine = RealMusicEngine.getInstance();
    let apiSongs: Song[] = [];
    let apiTitle = '';
    let apiCover = '';

    // First try RealMusicEngine catalog lookup (authoritative for JioSaavn playlist IDs)
    try {
      const apiResult = await realEngine.getPlaylistDetails(playlistId);
      if (apiResult && apiResult.songs && apiResult.songs.length > 0) {
        apiSongs = apiResult.songs;
        apiTitle = apiResult.title;
        apiCover = apiResult.coverUrl;
      }
    } catch {}

    // Next try /api/playlist/details via absolute getApiUrl if needed
    if (apiSongs.length === 0) {
      try {
        const fullUrl = getApiUrl(`/api/playlist/details?playlistId=${encodeURIComponent(playlistId)}&lang=${encodeURIComponent(targetLang)}`);
        const res = await fetch(fullUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const json = await res.json();
          if (json?.playlist?.songs && json.playlist.songs.length > 0) {
            apiSongs = json.playlist.songs;
            if (json.playlist.title) apiTitle = json.playlist.title;
            if (json.playlist.coverUrl) apiCover = json.playlist.coverUrl;
          }
        }
      } catch {}
    }

    if (apiSongs.length > 0) {
      const finalTitle = foundMeta?.title || apiTitle || 'Curated Playlist';
      const finalCover = foundMeta?.coverUrl || apiCover || '/app-icon.png';
      const finalDesc = foundMeta?.desc || `${targetLang} • ${apiSongs.length} Tracks`;

      return {
        id: playlistId,
        title: finalTitle,
        description: finalDesc,
        coverUrl: finalCover,
        songs: SongUniquenessEngine.deduplicate(apiSongs),
        isUserOwned: false,
        isCollaborative: false,
      };
    }

    // 4. If API returned few/no songs (e.g. dynamic category / curated pack), generate targeted authentic search queries
    const targetTitle = foundMeta?.title || playlistId;

    const cleanTitle = targetTitle
      .replace(/^Let's Play\s*[-–:]*\s*/i, '')
      .replace(/[-–:]*\s*(Telugu|Hindi|Tamil|Kannada|Malayalam|Punjabi|English)\s*$/i, '')
      .trim();

    // If cleanTitle is purely numeric, formulate generic top queries for target language
    const isNumeric = /^\d+$/.test(cleanTitle);
    const primaryQuery = isNumeric ? `${targetLang} Top Hits` : `${cleanTitle} ${targetLang} Hits`;
    const secondaryQuery = isNumeric ? `${targetLang} Trending Songs` : `${cleanTitle} Best Songs`;

    const [primaryResults, secondaryResults] = await Promise.all([
      realEngine.searchRealSongs(primaryQuery, 25).catch(() => []),
      cleanTitle.length > 3 ? realEngine.searchRealSongs(secondaryQuery, 15).catch(() => []) : Promise.resolve([]),
    ]);

    const combined = [...apiSongs, ...primaryResults, ...secondaryResults];
    const uniqueSongs = SongUniquenessEngine.deduplicate(combined);

    if (uniqueSongs.length > 0) {
      const finalTitle = foundMeta?.title || cleanTitle;
      const finalCover = foundMeta?.coverUrl || uniqueSongs[0]?.coverUrl || '/app-icon.png';
      const finalDesc = foundMeta?.desc || `${targetLang} • ${uniqueSongs.length} Tracks`;

      return {
        id: playlistId,
        title: finalTitle,
        description: finalDesc,
        coverUrl: finalCover,
        songs: uniqueSongs,
        isUserOwned: false,
        isCollaborative: false,
      };
    }

    return null;
  }
}
