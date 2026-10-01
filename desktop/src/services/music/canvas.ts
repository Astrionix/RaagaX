/**
 * Spotify & Apple Music Canvas provider for Raaga Desktop.
 * Fetches vertical video canvas clips (.cnvs.mp4) mirroring the mobile app's CanvasArtworkPlayer.
 */

interface CanvasResult {
  canvasUrl: string | null;
  title?: string;
  artist?: string;
  source: "spotify" | "apple" | null;
}

// In-memory cache to avoid duplicate API requests
const canvasCache = new Map<string, { result: CanvasResult; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

// Cached Spotify web access token
let cachedSpotifyToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedSpotifyToken && now < tokenExpiresAt - 60000) {
    return cachedSpotifyToken;
  }

  try {
    const res = await fetch(
      "https://open.spotify.com/get_access_token?reason=transport&productType=web_player",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        next: { revalidate: 3000 },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        cachedSpotifyToken = data.accessToken;
        tokenExpiresAt = data.accessTokenExpirationTimestampMs || now + 3600000;
        return cachedSpotifyToken;
      }
    }
  } catch (err) {
    console.warn("[Canvas] Failed to mint Spotify web token:", err);
  }

  return null;
}

export async function fetchCanvas(
  title: string,
  artist: string,
  album?: string
): Promise<CanvasResult> {
  if (!title) return { canvasUrl: null, source: null };

  const cacheKey = `${title.toLowerCase().trim()}:::${(artist || "").toLowerCase().trim()}`;
  const cached = canvasCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // Clean title: remove "(Official Video)", "[Audio]", "(Lyric Video)", etc.
  const cleanTitle = title
    .replace(/\s*[([].*?(official|video|audio|lyric|remaster|visualizer).*?[)\]]/gi, "")
    .trim();
  const cleanArtist = (artist || "")
    .replace(/ - Topic/gi, "")
    .replace(/,.*$/, "")
    .trim();

  // 1. Try Spotify Canvas
  try {
    const token = await getSpotifyAccessToken();
    if (token) {
      const query = encodeURIComponent(`track:${cleanTitle} artist:${cleanArtist}`);
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?type=track&limit=2&q=${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
          },
        }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const hit = searchData?.tracks?.items?.[0];
        if (hit && hit.uri) {
          // Query Canvas endpoint
          const canvasRes = await fetch(
            "https://spclient.wg.spotify.com/canvaz-cache/v0/canvases",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/x-protobuf",
                "User-Agent": "Spotify/9.0.34.593 iOS/18.4 (iPhone15,3)",
              },
              body: JSON.stringify({ tracks: [{ track_uri: hit.uri }] }),
            }
          );

          if (canvasRes.ok) {
            const rawBody = await canvasRes.text();
            // Match .cnvs.mp4 video url using regex
            const match = rawBody.match(/https:\/\/[^"'\s\x00-\x1F]+\.cnvs\.mp4/);
            if (match && match[0]) {
              const res: CanvasResult = {
                canvasUrl: match[0],
                title: hit.name,
                artist: hit.artists?.[0]?.name,
                source: "spotify",
              };
              canvasCache.set(cacheKey, { result: res, timestamp: Date.now() });
              return res;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Canvas] Spotify lookup error:", err);
  }

  // Fallback: No canvas available
  const emptyRes: CanvasResult = { canvasUrl: null, source: null };
  canvasCache.set(cacheKey, { result: emptyRes, timestamp: Date.now() });
  return emptyRes;
}
