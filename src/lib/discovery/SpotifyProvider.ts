export interface SpotifyTrack {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
}

export class SpotifyProvider {
  /**
   * Fetches the track list from a Spotify playlist using the unauthenticated embed endpoint.
   */
  static async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
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

      const tracks: SpotifyTrack[] = trackList.map((track: any) => ({
        title: track.title,
        artist: track.subtitle, // Usually contains the primary artists
        album: track.albumTitle || '',
        coverUrl: track.coverArt?.sources?.[0]?.url || ''
      }));

      return tracks;
    } catch (error) {
      console.error(`[SpotifyProvider] Error fetching playlist ${playlistId}:`, error);
      return [];
    }
  }
}
