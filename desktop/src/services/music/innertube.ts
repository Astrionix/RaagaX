import {
  Song,
  BrowseItem,
  HomeShelf,
  ShelfItem,
  DetailPage,
  MoodGenreSection,
  NewFeedData,
  SearchResultGroup,
  SearchFilter,
} from "@/types/music";

const YTM_URL = "https://music.youtube.com/youtubei/v1";

const INNERTUBE_CONTEXT = {
  client: {
    clientName: "WEB_REMIX",
    clientVersion: "1.20240501.01.00",
    hl: "en",
    gl: "US",
  },
};

const FILTER_PARAMS: Record<string, string> = {
  Songs: "EgWKAQIIAWoKEAkQChAFEAMQBA==",
  Videos: "EgWKAQIQAWoKEAkQChAFEAMQBA==",
  Albums: "EgWKAQIYAWoKEAkQChAFEAMQBA==",
  Artists: "EgWKAQIgAWoKEAkQChAFEAMQBA==",
  Playlists: "EgWKAQIoAWoKEAkQChAFEAMQBA==",
};

async function postInnerTube(endpoint: string, body: any = {}) {
  try {
    const res = await fetch(`${YTM_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://music.youtube.com/",
      },
      body: JSON.stringify({
        context: INNERTUBE_CONTEXT,
        ...body,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`InnerTube error for ${endpoint}:`, error);
    return null;
  }
}

function extractThumbnail(thumbnails: any[]): string {
  if (!thumbnails || !thumbnails.length) return "";
  const last = thumbnails[thumbnails.length - 1];
  return (last.url || "").replace(/=w\d+-h\d+[^"]*/, "=w500-h500-c");
}

function parseRunsText(runs?: any[]): string {
  if (!runs) return "";
  return runs.map((r) => r.text || "").join("");
}

export async function searchInnerTube(
  query: string,
  filter: SearchFilter = "All"
): Promise<SearchResultGroup> {
  const body: any = { query };
  if (filter !== "All" && FILTER_PARAMS[filter]) {
    body.params = FILTER_PARAMS[filter];
  }

  const data = await postInnerTube("search", body);
  const result: SearchResultGroup = {
    songs: [],
    albums: [],
    artists: [],
    playlists: [],
    videos: [],
  };

  if (!data) return result;

  try {
    const sectionList =
      data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents ||
      data.contents?.sectionListRenderer?.contents ||
      [];

    for (const section of sectionList) {
      const contents =
        section.musicShelfRenderer?.contents ||
        section.musicCardShelfRenderer?.contents ||
        section.shelfRenderer?.contents ||
        section.itemSectionRenderer?.contents ||
        [];

      if (!contents.length) continue;
      for (const item of contents) {
        const renderer =
          item.musicResponsiveListItemRenderer ||
          item.musicTwoRowItemRenderer ||
          item;

        if (!renderer) continue;

        const flexColumns = renderer.flexColumns || [];
        const titleRun =
          flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text
            ?.runs?.[0] || renderer.title?.runs?.[0];
        const title = titleRun?.text || "";

        const subtitleRuns =
          flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text
            ?.runs || renderer.subtitle?.runs || [];
        const subtitle = parseRunsText(subtitleRuns);

        const thumbnails =
          renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
            ?.thumbnails ||
          [];
        const thumbnailUrl = extractThumbnail(thumbnails);

        const navEndpoint =
          renderer.navigationEndpoint ||
          renderer.onTap ||
          titleRun?.navigationEndpoint ||
          renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint;

        const videoId =
          navEndpoint?.watchEndpoint?.videoId ||
          renderer.playlistItemData?.videoId;
        const browseId =
          navEndpoint?.browseEndpoint?.browseId ||
          renderer.navigationEndpoint?.browseEndpoint?.browseId;

        // Categorize by browseId / videoId / filter
        if (videoId) {
          const song: Song = {
            videoId,
            title,
            artist: subtitle.split("•")[0]?.trim() || subtitle,
            thumbnailUrl,
            durationText: subtitle.split("•").pop()?.trim(),
            isVideo: subtitle.toLowerCase().includes("video"),
          };
          if (!result.topResult) result.topResult = song;
          result.songs.push(song);
        } else if (browseId) {
          const isArtist =
            browseId.startsWith("UC") ||
            subtitle.toLowerCase().includes("artist");
          const isAlbum =
            browseId.startsWith("MPRE") ||
            subtitle.toLowerCase().includes("album") ||
            subtitle.toLowerCase().includes("ep") ||
            subtitle.toLowerCase().includes("single");

          const browseItem: BrowseItem = {
            browseId,
            title,
            subtitle,
            thumbnailUrl,
            type: isArtist ? "ARTIST" : isAlbum ? "ALBUM" : "PLAYLIST",
          };

          if (!result.topResult) result.topResult = browseItem;
          if (isArtist) result.artists.push(browseItem);
          else if (isAlbum) result.albums.push(browseItem);
          else result.playlists.push(browseItem);
        }
      }
    }
  } catch (err) {
    console.error("Error parsing search results:", err);
  }

  return result;
}

export async function getInnerTubeSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length === 0) return [];
  try {
    const data = await postInnerTube("music/get_search_suggestions", {
      input: query,
    });
    if (!data) return [];
    const contents =
      data.contents?.[0]?.searchSuggestionsSectionRenderer?.contents || [];
    const suggestions: string[] = [];

    for (const item of contents) {
      const renderer = item.searchSuggestionRenderer || item.historySuggestionRenderer;
      if (renderer?.navigationEndpoint?.searchEndpoint?.query) {
        suggestions.push(renderer.navigationEndpoint.searchEndpoint.query);
      } else if (renderer?.suggestion?.runs) {
        suggestions.push(parseRunsText(renderer.suggestion.runs));
      }
    }
    return suggestions.slice(0, 10);
  } catch (err) {
    console.error("Suggestions error:", err);
    return [];
  }
}

export async function getInnerTubeHome(): Promise<HomeShelf[]> {
  const data = await postInnerTube("browse", { browseId: "FEmusic_home" });
  const shelves: HomeShelf[] = [];

  if (!data) return shelves;

  try {
    const sectionList =
      data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents || [];

    for (const section of sectionList) {
      const carousel =
        section.musicCarouselShelfRenderer || section.musicShelfRenderer;
      if (!carousel) continue;

      const headerObj =
        carousel.header?.musicCarouselShelfBasicHeaderRenderer ||
        carousel.header?.musicCarouselShelfHeaderRenderer;

      const title =
        parseRunsText(headerObj?.title?.runs) ||
        parseRunsText(carousel.title?.runs) ||
        "Recommended";
      const strapline =
        parseRunsText(headerObj?.strapline?.runs) || "";

      const items: ShelfItem[] = [];
      const contents = carousel.contents || [];

      for (const item of contents) {
        const renderer =
          item.musicTwoRowItemRenderer ||
          item.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const flexCols = renderer.flexColumns || [];
        const titleText =
          parseRunsText(renderer.title?.runs) ||
          parseRunsText(flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
        const subtitleText =
          parseRunsText(renderer.subtitle?.runs) ||
          parseRunsText(flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);

        const thumbnails =
          renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          renderer.thumbnail?.thumbnails ||
          [];
        const thumbnailUrl = extractThumbnail(thumbnails);

        const nav =
          renderer.navigationEndpoint ||
          renderer.title?.runs?.[0]?.navigationEndpoint ||
          flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint;
        const videoId =
          nav?.watchEndpoint?.videoId ||
          renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
            ?.videoId ||
          renderer.playlistItemData?.videoId;
        const browseId = nav?.browseEndpoint?.browseId;

        if (titleText && (videoId || browseId)) {
          items.push({
            title: titleText,
            subtitle: subtitleText,
            thumbnailUrl,
            videoId,
            browseId,
            type: browseId?.startsWith("UC")
              ? "ARTIST"
              : browseId?.startsWith("MPRE")
              ? "ALBUM"
              : "PLAYLIST",
          });
        }
      }

      if (items.length > 0) {
        shelves.push({
          title,
          subtitle: strapline,
          items,
        });
      }
    }
  } catch (err) {
    console.error("Error parsing Home feed:", err);
  }

  return shelves;
}

export async function getInnerTubeCharts(): Promise<HomeShelf[]> {
  const data = await postInnerTube("browse", { browseId: "FEmusic_charts" });
  const shelves: HomeShelf[] = [];

  if (!data) return shelves;

  try {
    const sectionList =
      data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents || [];

    for (const section of sectionList) {
      const carousel =
        section.musicCarouselShelfRenderer || section.musicShelfRenderer;
      if (!carousel) continue;

      const headerObj =
        carousel.header?.musicCarouselShelfBasicHeaderRenderer ||
        carousel.header?.musicCarouselShelfHeaderRenderer;

      const title =
        parseRunsText(headerObj?.title?.runs) ||
        parseRunsText(carousel.title?.runs) ||
        "";
      if (!title) continue;

      const strapline =
        parseRunsText(headerObj?.strapline?.runs) || "";

      const items: ShelfItem[] = [];
      const contents = carousel.contents || [];

      for (const item of contents) {
        const renderer =
          item.musicTwoRowItemRenderer ||
          item.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const flexCols = renderer.flexColumns || [];
        const titleText =
          parseRunsText(renderer.title?.runs) ||
          parseRunsText(flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
        const subtitleText =
          parseRunsText(renderer.subtitle?.runs) ||
          parseRunsText(flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);

        const thumbnails =
          renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          renderer.thumbnail?.thumbnails ||
          [];
        const thumbnailUrl = extractThumbnail(thumbnails);

        const nav =
          renderer.navigationEndpoint ||
          renderer.title?.runs?.[0]?.navigationEndpoint ||
          flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint;
        const videoId =
          nav?.watchEndpoint?.videoId ||
          renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
            ?.videoId ||
          renderer.playlistItemData?.videoId;
        const browseId = nav?.browseEndpoint?.browseId;

        if (titleText && (videoId || browseId)) {
          items.push({
            title: titleText,
            subtitle: subtitleText,
            thumbnailUrl,
            videoId,
            browseId,
            type: browseId?.startsWith("UC")
              ? "ARTIST"
              : browseId?.startsWith("MPRE")
              ? "ALBUM"
              : "PLAYLIST",
          });
        }
      }

      if (items.length > 0) {
        shelves.push({
          title,
          subtitle: strapline,
          items,
        });
      }
    }
  } catch (err) {
    console.error("Error parsing Charts feed:", err);
  }

  return shelves;
}

export async function getInnerTubeExplore(): Promise<NewFeedData> {
  const data = await postInnerTube("browse", { browseId: "FEmusic_explore" });
  const result: NewFeedData = {
    newReleases: [],
    charts: [],
    exploreShelves: [],
    moodGenres: [
      {
        title: "Moods & Moments",
        items: [
          { title: "Chill & Relax", browseId: "FEmusic_moods_and_genres_category_chill", color: "#4A00E0" },
          { title: "Workout & Energy", browseId: "FEmusic_moods_and_genres_category_workout", color: "#FF0080" },
          { title: "Focus & Study", browseId: "FEmusic_moods_and_genres_category_focus", color: "#0070F3" },
          { title: "Party & Dance", browseId: "FEmusic_moods_and_genres_category_party", color: "#FA2D48" },
          { title: "Romance & Love", browseId: "FEmusic_moods_and_genres_category_romance", color: "#FC3C63" },
          { title: "Sleep & Calm", browseId: "FEmusic_moods_and_genres_category_sleep", color: "#11998e" },
          { title: "Feel Good", browseId: "FEmusic_moods_and_genres_category_feel_good", color: "#F27121" },
          { title: "Commute & Drive", browseId: "FEmusic_moods_and_genres_category_commute", color: "#8E2DE2" },
        ],
      },
      {
        title: "Genres",
        items: [
          { title: "Pop & Top Hits", browseId: "FEmusic_moods_and_genres_category_pop", color: "#FA2D48" },
          { title: "Hip-Hop & Rap", browseId: "FEmusic_moods_and_genres_category_hip_hop", color: "#FF4D4D" },
          { title: "Bollywood & Desi", browseId: "FEmusic_moods_and_genres_category_bollywood", color: "#F27121" },
          { title: "Rock & Alternative", browseId: "FEmusic_moods_and_genres_category_rock", color: "#2C3E50" },
          { title: "Electronic & EDM", browseId: "FEmusic_moods_and_genres_category_electronic", color: "#00DFD8" },
          { title: "R&B & Soul", browseId: "FEmusic_moods_and_genres_category_r_and_b", color: "#8A2387" },
          { title: "Indie & Acoustic", browseId: "FEmusic_moods_and_genres_category_indie", color: "#38ef7d" },
          { title: "Classical & Instrumental", browseId: "FEmusic_moods_and_genres_category_classical", color: "#6A0572" },
        ],
      },
    ],
  };

  if (!data) return result;

  try {
    const sectionList =
      data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents || [];

    for (const section of sectionList) {
      const carousel =
        section.musicCarouselShelfRenderer || section.musicShelfRenderer;
      if (!carousel) continue;

      const title =
        parseRunsText(carousel.header?.musicCarouselShelfHeaderRenderer?.title?.runs) ||
        parseRunsText(carousel.title?.runs) ||
        "Explore";
      const items: ShelfItem[] = [];

      for (const item of carousel.contents || []) {
        const renderer =
          item.musicTwoRowItemRenderer ||
          item.musicResponsiveListItemRenderer;
        if (!renderer) continue;

        const titleText = parseRunsText(renderer.title?.runs);
        const subtitleText = parseRunsText(renderer.subtitle?.runs);
        const thumbnails =
          renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
            ?.thumbnails || [];
        const thumbnailUrl = extractThumbnail(thumbnails);
        const nav = renderer.navigationEndpoint;
        const videoId = nav?.watchEndpoint?.videoId;
        const browseId = nav?.browseEndpoint?.browseId;

        if (titleText && (videoId || browseId)) {
          items.push({
            title: titleText,
            subtitle: subtitleText,
            thumbnailUrl,
            videoId,
            browseId,
            type: browseId?.startsWith("UC") ? "ARTIST" : "ALBUM",
          });
        }
      }

      if (items.length > 0) {
        const shelf: HomeShelf = { title, items };
        if (title.toLowerCase().includes("new")) {
          result.newReleases.push(shelf);
        } else if (title.toLowerCase().includes("chart")) {
          result.charts.push(shelf);
        } else {
          result.exploreShelves.push(shelf);
        }
      }
    }
  } catch (err) {
    console.error("Explore parse error:", err);
  }

  return result;
}

export async function getInnerTubeBrowseDetail(
  browseId: string
): Promise<DetailPage | null> {
  const actualBrowseId =
    browseId.startsWith("PL") || browseId.startsWith("RD")
      ? `VL${browseId}`
      : browseId;

  const data = await postInnerTube("browse", { browseId: actualBrowseId });
  if (!data) return null;

  try {
    const twoCol = data.contents?.twoColumnBrowseResultsRenderer;
    const singleCol = data.contents?.singleColumnBrowseResultsRenderer;

    let header =
      data.header?.musicResponsiveHeaderRenderer ||
      data.header?.musicVisualHeaderRenderer ||
      data.header?.musicHeaderRenderer;

    // In twoColumnBrowseResultsRenderer, header is often nested in tabs[0]
    if (!header && twoCol) {
      const tab0Sections =
        twoCol.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const sec of tab0Sections) {
        if (sec.musicResponsiveHeaderRenderer) {
          header = sec.musicResponsiveHeaderRenderer;
          break;
        }
        if (sec.musicHeaderRenderer) {
          header = sec.musicHeaderRenderer;
          break;
        }
      }
    }

    const title =
      parseRunsText(header?.title?.runs) ||
      header?.title?.runs?.[0]?.text ||
      "YouTube Playlist";
    const subtitle =
      parseRunsText(header?.subtitle?.runs) ||
      parseRunsText(header?.straplineTextOne?.runs) ||
      "";
    const thumbnails =
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      header?.thumbnail?.thumbnails ||
      [];
    const thumbnailUrl = extractThumbnail(thumbnails);

    const isArtist = actualBrowseId.startsWith("UC");
    const isAlbum = actualBrowseId.startsWith("MPRE");

    const songs: Song[] = [];
    const sections: HomeShelf[] = [];

    // Gather candidate sections from both twoColumn and singleColumn structures
    const sectionCandidates: any[] = [];
    if (twoCol?.secondaryContents?.sectionListRenderer?.contents) {
      sectionCandidates.push(...twoCol.secondaryContents.sectionListRenderer.contents);
    }
    if (twoCol?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents) {
      sectionCandidates.push(...twoCol.tabs[0].tabRenderer.content.sectionListRenderer.contents);
    }
    if (singleCol?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents) {
      sectionCandidates.push(...singleCol.tabs[0].tabRenderer.content.sectionListRenderer.contents);
    }
    if (data.contents?.sectionListRenderer?.contents) {
      sectionCandidates.push(...data.contents.sectionListRenderer.contents);
    }

    for (const section of sectionCandidates) {
      // 1. Direct track list from playlist / album shelf
      const musicShelf =
        section.musicPlaylistShelfRenderer ||
        section.musicShelfRenderer;

      if (musicShelf && musicShelf.contents) {
        for (const item of musicShelf.contents) {
          const renderer = item.musicResponsiveListItemRenderer;
          if (!renderer) continue;

          const flexCols = renderer.flexColumns || [];
          const songTitle = parseRunsText(
            flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
          );
          const songSubtitle = parseRunsText(
            flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
          );
          const songThumbs =
            renderer.thumbnail?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails || [];
          const thumb = extractThumbnail(songThumbs) || thumbnailUrl;

          const nav =
            renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
              ?.musicPlayButtonRenderer?.playNavigationEndpoint ||
            renderer.navigationEndpoint;
          const videoId =
            nav?.watchEndpoint?.videoId ||
            renderer.playlistItemData?.videoId;

          if (songTitle && videoId) {
            songs.push({
              videoId,
              title: songTitle,
              artist: songSubtitle.split("•")[0]?.trim() || subtitle || title,
              thumbnailUrl: thumb,
              durationText: songSubtitle.split("•").pop()?.trim(),
              albumName: isAlbum ? title : undefined,
              albumId: isAlbum ? actualBrowseId : undefined,
            });
          }
        }
      }

      // 2. Discography carousel / Related artist shelf
      const carousel = section.musicCarouselShelfRenderer;
      if (carousel) {
        const carouselTitle = parseRunsText(
          carousel.header?.musicCarouselShelfHeaderRenderer?.title?.runs
        );
        const shelfItems: ShelfItem[] = [];

        for (const item of carousel.contents || []) {
          const r = item.musicTwoRowItemRenderer;
          if (!r) continue;
          const itemTitle = parseRunsText(r.title?.runs);
          const itemSub = parseRunsText(r.subtitle?.runs);
          const itemThumbs =
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
              ?.thumbnails || [];
          const itemThumb = extractThumbnail(itemThumbs);
          const itemBrowseId = r.navigationEndpoint?.browseEndpoint?.browseId;
          const itemVideoId = r.navigationEndpoint?.watchEndpoint?.videoId;

          if (itemTitle && (itemBrowseId || itemVideoId)) {
            shelfItems.push({
              title: itemTitle,
              subtitle: itemSub,
              thumbnailUrl: itemThumb,
              browseId: itemBrowseId,
              videoId: itemVideoId,
              type: itemBrowseId?.startsWith("UC") ? "ARTIST" : "ALBUM",
            });
          }
        }

        if (shelfItems.length > 0) {
          sections.push({
            title: carouselTitle || "More",
            items: shelfItems,
          });
        }
      }
    }

    return {
      browseId: actualBrowseId,
      title,
      subtitle,
      thumbnailUrl,
      type: isArtist ? "ARTIST" : isAlbum ? "ALBUM" : "PLAYLIST",
      songs,
      sections,
      description: parseRunsText(header?.description?.runs),
      subscriberCountText: header?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText?.runs?.[0]?.text,
      trackCount: songs.length,
    };
  } catch (err) {
    console.error("Browse detail parse error:", err);
    return null;
  }
}

export async function getInnerTubeRadio(videoId: string): Promise<Song[]> {
  const data = await postInnerTube("next", { videoId });
  const radioSongs: Song[] = [];

  if (!data) return radioSongs;

  try {
    const tabs =
      data.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
        ?.watchNextTabbedResultsRenderer?.tabs || [];
    const contents =
      tabs[0]?.tabRenderer?.content?.musicQueueRenderer?.content
        ?.playlistPanelRenderer?.contents || [];

    for (const item of contents) {
      const renderer = item.playlistPanelVideoRenderer;
      if (!renderer) continue;

      const title = parseRunsText(renderer.title?.runs);
      const artist = parseRunsText(renderer.longBylineText?.runs);
      const videoId = renderer.videoId;
      const thumbnails = renderer.thumbnail?.thumbnails || [];
      const thumbnailUrl = extractThumbnail(thumbnails);
      const durationText = parseRunsText(renderer.lengthText?.runs);

      if (title && videoId) {
        radioSongs.push({
          videoId,
          title,
          artist,
          thumbnailUrl,
          durationText,
          queueTier: "AUTOPLAY",
        });
      }
    }
  } catch (err) {
    console.error("Radio fetch error:", err);
  }

  return radioSongs;
}
