import { SpotifyProvider, SpotifyTrack } from './SpotifyProvider';
import { JioSaavnProvider } from '../jioSaavnProvider';
import { Song } from '@/types/music';
import { supabaseAdmin } from '../supabaseAdmin'; // Need to create this to use service_role for DB writes
import { InternetDateScraper } from './InternetDateScraper';
export class PlaylistResolver {
  private saavn: JioSaavnProvider;

  constructor(baseUrl: string) {
    this.saavn = JioSaavnProvider.getInstance(baseUrl);
  }

  /**
   * Resolves a Spotify Playlist ID into an array of playable JioSaavn Songs using Supabase Durable Cache.
   */
  async resolveSpotifyPlaylist(playlistId: string, limit = 15): Promise<Song[]> {
    try {
      // 1. Fetch Playlist Metadata & Tracks from Spotify
      const spotifyTracks = await SpotifyProvider.getPlaylistTracks(playlistId);
      if (!spotifyTracks || spotifyTracks.length === 0) {
        console.warn(`[PlaylistResolver] No tracks found for playlist ${playlistId}`);
        return [];
      }

      // Process only up to the requested limit + buffer
      const tracksToProcess = spotifyTracks.slice(0, Math.max(limit + 5, 20));
      const resolvedSongs: Song[] = [];
      const concurrencyLimit = 5;

      for (let i = 0; i < tracksToProcess.length; i += concurrencyLimit) {
        const batch = tracksToProcess.slice(i, i + concurrencyLimit);

        const promises = batch.map(async (st) => {
          const primaryArtist = st.artist.split(',')[0].trim();
          const titleKey = st.title.trim();
          const cacheKey = Buffer.from(`${titleKey}_${primaryArtist}`).toString('base64'); // Unique ID for the track

          // Check Song Resolution Cache
          const { data: cachedRes } = await supabaseAdmin
            .from('song_resolution_cache')
            .select('*')
            .eq('cache_key', cacheKey)
            .maybeSingle();

          if (cachedRes) {
            if (cachedRes.status === 'not_found' || cachedRes.status === 'failed') {
              // Avoid retrying permanently failed songs
              return null;
            }
            if (cachedRes.status === 'resolved' && cachedRes.raw_response) {
              const song = cachedRes.raw_response as Song;
              // Retroactively fetch date if missing in cache
              if (!song.releaseDate) {
                const scrapedDate = await InternetDateScraper.fetchExactReleaseDate(song.title, song.artist);
                if (scrapedDate) {
                  song.releaseDate = scrapedDate;
                  await supabaseAdmin.from('song_resolution_cache').update({ raw_response: song }).eq('cache_key', cacheKey);
                }
              }
              return song;
            }
          }

          // If not in cache, resolve through JioSaavn
          const query = `${titleKey} ${primaryArtist}`;
          try {
            const results = await this.saavn.searchSongs(query, 1);
            if (results && results.length > 0) {
              const matchedSong = results[0];
              
              // Try to get exact release date
              const scrapedDate = await InternetDateScraper.fetchExactReleaseDate(matchedSong.title, matchedSong.artist);
              if (scrapedDate) {
                matchedSong.releaseDate = scrapedDate;
              }
              
              // Persist resolution to DB
              await supabaseAdmin.from('song_resolution_cache').upsert({
                cache_key: cacheKey,
                title: titleKey,
                artist: primaryArtist,
                jiosaavn_song_id: matchedSong.id,
                status: 'resolved',
                raw_response: matchedSong,
              });

              return matchedSong;
            } else {
              // Store not_found to avoid repetitive searches
              await supabaseAdmin.from('song_resolution_cache').upsert({
                cache_key: cacheKey,
                title: titleKey,
                artist: primaryArtist,
                status: 'not_found',
              });
            }
          } catch (e) {
             await supabaseAdmin.from('song_resolution_cache').upsert({
                cache_key: cacheKey,
                title: titleKey,
                artist: primaryArtist,
                status: 'failed',
             });
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        resolvedSongs.push(...(batchResults.filter(Boolean) as Song[]));
      }

      const uniqueSongs = deduplicateSongs(resolvedSongs);

      // Sort by actual release date (newest first)
      uniqueSongs.sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : new Date(`${a.releaseYear}-01-01`).getTime();
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : new Date(`${b.releaseYear}-01-01`).getTime();
        return dateB - dateA;
      });

      return uniqueSongs.slice(0, limit);
    } catch (err) {
      console.error(`[PlaylistResolver] Fatal error resolving playlist ${playlistId}`, err);
      return [];
    }
  }
}

function deduplicateSongs(songs: Song[]): Song[] {
  const seenIds = new Set<string>();
  const unique: Song[] = [];
  for (const song of songs) {
    if (!seenIds.has(song.id)) {
      seenIds.add(song.id);
      unique.push(song);
    }
  }
  return unique;
}
