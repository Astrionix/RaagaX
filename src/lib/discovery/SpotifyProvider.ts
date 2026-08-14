export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration?: number; // in seconds
}

export class SpotifyProvider {
  /**
   * Generates a Spotify access token using the Client Credentials Flow.
   */
  private static async getSpotifyAccessToken(): Promise<string | null> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    try {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials',
        next: { revalidate: 3000 } // Cache token for 50 minutes at Next.js level if applicable
      });

      if (!res.ok) {
        throw new Error(`Token request failed: ${res.statusText}`);
      }

      const data = await res.json();
      return data.access_token || null;
    } catch (err) {
      console.error('[SpotifyProvider] Failed to get Access Token:', err);
      return null;
    }
  }

  /**
   * Fetches the track list from a Spotify playlist using either official API or embed scraper fallback.
   */
  static async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const token = await this.getSpotifyAccessToken();
    if (token) {
      console.log(`[SpotifyProvider] Found Spotify credentials. Fetching playlist ${playlistId} via Web API...`);
      return this.getPlaylistTracksWithAuth(playlistId, token);
    } else {
      console.log(`[SpotifyProvider] No Spotify credentials. Scraping playlist ${playlistId} via Embed...`);
      return this.getPlaylistTracksScrape(playlistId);
    }
  }

  /**
   * Fetches all tracks from a Spotify playlist using Web API and handles pagination.
   */
  private static async getPlaylistTracksWithAuth(playlistId: string, token: string): Promise<SpotifyTrack[]> {
    const tracks: SpotifyTrack[] = [];
    let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
    let pageCount = 1;

    while (nextUrl) {
      try {
        console.log(`[SpotifyProvider] Fetching Spotify page ${pageCount}...`);
        const res = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch tracks page: ${res.statusText}`);
        }

        const data = await res.json();
        const items = data.items || [];
        
        items.forEach((item: any) => {
          if (!item.track) return;
          const track = item.track;
          const trackId = track.id || track.uri?.replace('spotify:track:', '') || '';
          tracks.push({
            id: trackId,
            title: track.name || '',
            artist: track.artists ? track.artists.map((a: any) => a.name).join(', ') : '',
            album: track.album?.name || '',
            coverUrl: track.album?.images?.[0]?.url || '',
            duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : undefined
          });
        });

        nextUrl = data.next;
        pageCount++;
      } catch (err) {
        console.error(`[SpotifyProvider] Error fetching page ${pageCount} from Spotify API:`, err);
        break;
      }
    }

    console.log(`[SpotifyProvider] Total Spotify tracks fetched: ${tracks.length}`);
    return tracks;
  }

  /**
   * Fetches tracks from a Spotify playlist using the unauthenticated embed endpoint (fallback, max 100).
   */
  private static async getPlaylistTracksScrape(playlistId: string): Promise<SpotifyTrack[]> {
    try {
      const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 3600 } // Cache at Next.js level for 1 hour
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Spotify embed: ${res.statusText}`);
      }

      const html = await res.text();
      
      // Extract the __NEXT_DATA__ JSON blob
      const split1 = html.split('<script id="__NEXT_DATA__" type="application/json">');
      if (split1.length < 2) throw new Error('Spotify embed structure changed: __NEXT_DATA__ not found');
      
      const split2 = split1[1].split('</script>');
      const jsonStr = split2[0];
      
      const data = JSON.parse(jsonStr);
      
      // Navigate to the trackList
      const trackList = data?.props?.pageProps?.state?.data?.entity?.trackList;
      
      if (!Array.isArray(trackList)) {
        throw new Error('Spotify embed structure changed: trackList not found');
      }

      const tracks: SpotifyTrack[] = trackList.map((track: any) => {
        const trackId = track.id || track.uri?.replace('spotify:track:', '') || '';
        return {
          id: trackId,
          title: track.title,
          artist: track.subtitle, // Usually contains the primary artists
          album: track.albumTitle || '',
          coverUrl: track.coverArt?.sources?.[0]?.url || '',
          duration: track.duration ? Math.round(track.duration / 1000) : undefined // Convert to seconds
        };
      });

      return tracks;
    } catch (error) {
      console.error(`[SpotifyProvider] Error scraping playlist ${playlistId}:`, error);
      return [];
    }
  }
}

