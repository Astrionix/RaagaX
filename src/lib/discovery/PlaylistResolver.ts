import { SpotifyProvider, SpotifyTrack } from './SpotifyProvider';
import { JioSaavnProvider } from '@/lib/jioSaavnProvider';
import { Song } from '@/types/music';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { InternetDateScraper } from './InternetDateScraper';
import { BROWSE_5_PLAYLISTS, TRENDING_SOURCES, WEEKLY_RELEASE_SOURCES, CLASSICS_SOURCES, NEW_RELEASES_SOURCES } from '@/lib/spotifySources';
import { Buffer } from 'buffer';

export class PlaylistResolver {
  private saavn: JioSaavnProvider;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.saavn = JioSaavnProvider.getInstance(baseUrl);
    this.baseUrl = baseUrl;
  }

  /**
   * Resolves a Spotify Playlist ID into an array of playable JioSaavn Songs using Supabase Durable Cache.
   * Caches matched metadata and respects match confidence threshold.
   */
  async resolveSpotifyPlaylist(playlistId: string, langParam?: string, catParam?: string): Promise<Song[]> {
    try {
      // 1. Lookup configured metadata
      const info = lookupPlaylistInfo(playlistId);
      const lang = langParam || info.language;
      const category = catParam || info.category;
      const playlistName = info.name;

      // 2. Fetch COMPLETE Spotify playlist tracks
      const spotifyTracks = await SpotifyProvider.getPlaylistTracks(playlistId);
      if (!spotifyTracks || spotifyTracks.length === 0) {
        console.warn(`[PlaylistResolver] No tracks found for playlist ${playlistId}`);
        return [];
      }

      // 3. Compute current playlist snapshot hash
      const trackIds = spotifyTracks.map(t => t.id).filter(Boolean);
      const currentSnapshotId = Buffer.from(trackIds.join(',')).toString('base64');

      // 4. Load existing cache from DB
      const { data: cached } = await supabaseAdmin
        .from('spotify_playlist_cache')
        .select('*')
        .eq('playlist_id', playlistId)
        .maybeSingle();

      let cachedSongs: Song[] = [];
      let previousSnapshotId = '';

      if (cached && cached.data) {
        if (Array.isArray(cached.data)) {
          cachedSongs = cached.data;
        } else if (typeof cached.data === 'object' && Array.isArray((cached.data as any).songs)) {
          cachedSongs = (cached.data as any).songs;
          previousSnapshotId = (cached.data as any).metadata?.snapshotId || '';
        }
      }

      // 5. Detect playlist changes (Requirement 4)
      if (previousSnapshotId && previousSnapshotId === currentSnapshotId) {
        // Print required logs
        console.log(`[BrowseSync]\nPlaylist: ${playlistName}`);
        console.log(`[BrowseSync]\nSource tracks: ${spotifyTracks.length}`);
        console.log(`[BrowseSync]\nPrevious synced tracks: ${cachedSongs.length}`);
        console.log(`[BrowseSync]\nNew tracks detected: 0`);
        console.log(`[BrowseSync]\nJioSaavn matched: 0`);
        console.log(`[BrowseSync]\nJioSaavn unmatched: 0`);
        console.log(`[BrowseSync]\nNewly added to Browse: 0`);
        console.log(`[BrowseSync]\nFinal unique Browse songs: ${cachedSongs.length}`);

        return cachedSongs;
      }

      // 6. Scan tracks and check cache
      const resolvedSongs: Song[] = [];
      const newTracksToProcess: SpotifyTrack[] = [];
      const concurrencyLimit = 5;
      const externalBase = process.env.JIOSAAVN_API_BASE_URL || 'https://saavn.sumit.co';

      let matchedCount = 0;
      let unmatchedCount = 0;
      let newlyAddedCount = 0;

      // Map track cache keys to index for quick checks
      const trackStatuses = await Promise.all(spotifyTracks.map(async (st) => {
        const primaryArtist = st.artist.split(',')[0].trim();
        const titleKey = st.title.trim();
        const cacheKey = Buffer.from(`${titleKey}_${primaryArtist}`).toString('base64');

        const { data: cachedRes } = await supabaseAdmin
          .from('song_resolution_cache')
          .select('*')
          .eq('cache_key', cacheKey)
          .maybeSingle();

        return { track: st, cacheKey, cachedRes };
      }));

      // Segregate new vs cached (Requirement 6, 7)
      for (const item of trackStatuses) {
        const { track, cachedRes } = item;
        if (cachedRes) {
          if (cachedRes.status === 'resolved' && cachedRes.raw_response) {
            resolvedSongs.push(cachedRes.raw_response as Song);
          } else if (cachedRes.status === 'not_found') {
            // Already resolved as not found, skip
          } else {
            // Failed status: retry it
            newTracksToProcess.push(track);
          }
        } else {
          // Completely new track
          newTracksToProcess.push(track);
        }
      }

      // 7. Process new tracks sequentially or in concurrency batches
      for (let i = 0; i < newTracksToProcess.length; i += concurrencyLimit) {
        const batch = newTracksToProcess.slice(i, i + concurrencyLimit);

        const promises = batch.map(async (st) => {
          const primaryArtist = st.artist.split(',')[0].trim();
          const titleKey = st.title.trim();
          const cacheKey = Buffer.from(`${titleKey}_${primaryArtist}`).toString('base64');

          const query = `${titleKey} ${primaryArtist}`;
          try {
            const { results, success } = await searchJioSaavnRaw(this.baseUrl, externalBase, query, 5);
            if (!success) {
              await supabaseAdmin.from('song_resolution_cache').upsert({
                cache_key: cacheKey,
                title: titleKey,
                artist: primaryArtist,
                status: 'failed',
                updated_at: new Date().toISOString()
              }, { onConflict: 'cache_key' });
              return null;
            }

            if (results && results.length > 0) {
              const candidates = results.map((r, idx) => mapTrackToSong(r, idx));
              let bestCandidate: Song | null = null;
              let bestScore = 0;

              for (const cand of candidates) {
                const score = calculateMatchScore(st, cand);
                if (score >= 0.55 && score > bestScore) {
                  bestScore = score;
                  bestCandidate = cand;
                }
              }

              if (bestCandidate) {
                const matchedSong = bestCandidate;
                const scrapedDate = await InternetDateScraper.fetchExactReleaseDate(matchedSong.title, matchedSong.artist);
                if (scrapedDate) matchedSong.releaseDate = scrapedDate;

                // Upsert match into cache
                await supabaseAdmin.from('song_resolution_cache').upsert({
                  cache_key: cacheKey,
                  title: titleKey,
                  artist: primaryArtist,
                  jiosaavn_song_id: matchedSong.id,
                  status: 'resolved',
                  raw_response: matchedSong,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'cache_key' });

                matchedCount++;
                return matchedSong;
              }
            }

            // Not found
            await supabaseAdmin.from('song_resolution_cache').upsert({
              cache_key: cacheKey,
              title: titleKey,
              artist: primaryArtist,
              status: 'not_found',
              updated_at: new Date().toISOString()
            }, { onConflict: 'cache_key' });

            unmatchedCount++;
            return null;
          } catch (e) {
            console.error(`[BrowseSync] Error resolving ${st.title} - ${st.artist}:`, e);
            await supabaseAdmin.from('song_resolution_cache').upsert({
              cache_key: cacheKey,
              title: titleKey,
              artist: primaryArtist,
              status: 'failed',
              updated_at: new Date().toISOString()
            }, { onConflict: 'cache_key' });
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        const resolvedBatch = batchResults.filter(Boolean) as Song[];
        
        // Transactional insert to public.canonical_songs (Requirement 9, 23)
        if (resolvedBatch.length > 0) {
          const songsToUpsert: Array<{
            id: string; title: string; artist: string; album: string;
            language: string; cover_url: string; duration: string;
            raw_data: { audioUrl: string } | null;
          }> = [];
          for (const s of resolvedBatch) {
            const { data: existingCanonical } = await supabaseAdmin
              .from('canonical_songs')
              .select('id')
              .eq('id', s.id)
              .maybeSingle();

            if (!existingCanonical) {
              songsToUpsert.push({
                id: s.id,
                title: s.title,
                artist: s.artist,
                album: s.album,
                language: s.language || lang,
                cover_url: s.coverUrl,
                duration: String(s.duration),
                raw_data: s.audioUrl ? { audioUrl: s.audioUrl } : null
              });
            }
          }

          if (songsToUpsert.length > 0) {
            const { error: canonicalError } = await supabaseAdmin
              .from('canonical_songs')
              .upsert(songsToUpsert, { onConflict: 'id' });
            if (canonicalError) {
              console.error('[BrowseSync] Failed to upsert canonical songs:', canonicalError);
            }
          }

          resolvedSongs.push(...resolvedBatch);
        }
      }

      // 8. Construct final list preserving ordering and disappeared tracks (Requirement 21, 22)
      const allMatchedSongs = [...resolvedSongs];
      const finalUniqueSongs: Song[] = [];

      // Add active tracks in Spotify ordering
      spotifyTracks.forEach(st => {
        const matched = allMatchedSongs.find(s => s.title.toLowerCase() === st.title.toLowerCase() || s.coverUrl.includes(st.id));
        if (matched && !finalUniqueSongs.some(s => s.id === matched.id)) {
          finalUniqueSongs.push(matched);
        }
      });

      // Append disappeared tracks from cachedSongs (Requirement 21)
      cachedSongs.forEach(cs => {
        if (!finalUniqueSongs.some(s => s.id === cs.id)) {
          finalUniqueSongs.push(cs);
        }
      });

      // Calculate newly added count
      finalUniqueSongs.forEach(song => {
        if (!cachedSongs.some(s => s.id === song.id)) {
          newlyAddedCount++;
        }
      });

      // Print logs (Requirement 19)
      console.log(`[BrowseSync]\nPlaylist: ${playlistName}`);
      console.log(`[BrowseSync]\nSource tracks: ${spotifyTracks.length}`);
      console.log(`[BrowseSync]\nPrevious synced tracks: ${cachedSongs.length}`);
      console.log(`[BrowseSync]\nNew tracks detected: ${newTracksToProcess.length}`);
      console.log(`[BrowseSync]\nJioSaavn matched: ${matchedCount}`);
      console.log(`[BrowseSync]\nJioSaavn unmatched: ${unmatchedCount}`);
      console.log(`[BrowseSync]\nNewly added to Browse: ${newlyAddedCount}`);
      console.log(`[BrowseSync]\nFinal unique Browse songs: ${finalUniqueSongs.length}`);

      // 9. Save to Playlist Cache with metadata wrapper (Requirement 17)
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days
      const cachePayload = {
        songs: finalUniqueSongs,
        metadata: {
          lastSyncedAt: new Date().toISOString(),
          snapshotId: currentSnapshotId,
          sourceTrackCount: spotifyTracks.length,
          processedCount: newTracksToProcess.length,
          matchedCount,
          unmatchedCount,
          newlyAddedCount,
          syncStatus: 'success',
          errorInfo: null
        }
      };

      await supabaseAdmin.from('spotify_playlist_cache').upsert({
        playlist_id: playlistId,
        playlist_name: playlistName,
        language: lang,
        category,
        track_count: spotifyTracks.length,
        resolved_count: finalUniqueSongs.length,
        data: cachePayload,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'playlist_id' });

      return finalUniqueSongs;
    } catch (err: any) {
      console.error(`[BrowseSync] Sync failed for playlist ${playlistId}:`, err);
      try {
        await supabaseAdmin.from('spotify_playlist_cache').upsert({
          playlist_id: playlistId,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          data: {
            songs: [],
            metadata: {
              lastSyncedAt: new Date().toISOString(),
              snapshotId: '',
              sourceTrackCount: 0,
              processedCount: 0,
              matchedCount: 0,
              unmatchedCount: 0,
              newlyAddedCount: 0,
              syncStatus: 'failed',
              errorInfo: err.message || String(err)
            }
          }
        }, { onConflict: 'playlist_id' });
      } catch (upsertErr) {
        console.error('Failed to log sync error state:', upsertErr);
      }
      throw err;
    }
  }

  /**
   * Resolves multiple Spotify playlists, merges tracks, verifies via JioSaavn,
   * deduplicates, and sorts the final list by release date (newest first).
   */
  async resolveAggregatedCandidates(playlistIds: string[], limit = 100): Promise<Song[]> {
    try {
      console.log(`[PlaylistResolver] Aggregating ${playlistIds.length} candidate playlists...`);
      
      const allSpotifyTracks: SpotifyTrack[] = [];
      const fetchPromises = playlistIds.map(id => SpotifyProvider.getPlaylistTracks(id).catch(() => []));
      const results = await Promise.all(fetchPromises);
      
      results.forEach(tracks => {
        if (tracks && tracks.length > 0) {
          allSpotifyTracks.push(...tracks);
        }
      });

      if (allSpotifyTracks.length === 0) {
        console.warn(`[PlaylistResolver] No tracks found across ${playlistIds.length} candidate playlists`);
        return [];
      }

      const uniqueSpotifyTracks: SpotifyTrack[] = [];
      const seenRaw = new Set<string>();
      
      for (const st of allSpotifyTracks) {
        const primaryArtist = st.artist.split(',')[0].trim().toLowerCase();
        const titleKey = st.title.trim().toLowerCase();
        const key = `${titleKey}_${primaryArtist}`;
        
        if (!seenRaw.has(key)) {
          seenRaw.add(key);
          uniqueSpotifyTracks.push(st);
        }
      }

      console.log(`[PlaylistResolver] Deduplicated ${allSpotifyTracks.length} raw tracks into ${uniqueSpotifyTracks.length} unique candidates.`);

      const resolvedSongs: Song[] = [];
      const concurrencyLimit = 5;
      const externalBase = process.env.JIOSAAVN_API_BASE_URL || 'https://saavn.sumit.co';

      for (let i = 0; i < uniqueSpotifyTracks.length; i += concurrencyLimit) {
        const batch = uniqueSpotifyTracks.slice(i, i + concurrencyLimit);

        const promises = batch.map(async (st) => {
          const primaryArtist = st.artist.split(',')[0].trim();
          const titleKey = st.title.trim();
          const cacheKey = Buffer.from(`${titleKey}_${primaryArtist}`).toString('base64');

          const { data: cachedRes } = await supabaseAdmin
            .from('song_resolution_cache')
            .select('*')
            .eq('cache_key', cacheKey)
            .maybeSingle();

          if (cachedRes) {
            if (cachedRes.status === 'not_found') return null;
            if (cachedRes.status === 'resolved' && cachedRes.raw_response) {
              return cachedRes.raw_response as Song;
            }
          }

          const query = `${titleKey} ${primaryArtist}`;
          try {
            const { results, success } = await searchJioSaavnRaw(this.baseUrl, externalBase, query, 5);
            if (!success) return null;

            if (results && results.length > 0) {
              const candidates = results.map((r, idx) => mapTrackToSong(r, idx));
              let bestCandidate: Song | null = null;
              let bestScore = 0;

              for (const cand of candidates) {
                const score = calculateMatchScore(st, cand);
                if (score >= 0.55 && score > bestScore) {
                  bestScore = score;
                  bestCandidate = cand;
                }
              }

              if (bestCandidate) {
                const matchedSong = bestCandidate;
                const scrapedDate = await InternetDateScraper.fetchExactReleaseDate(matchedSong.title, matchedSong.artist);
                if (scrapedDate) matchedSong.releaseDate = scrapedDate;
                
                await supabaseAdmin.from('song_resolution_cache').upsert({
                  cache_key: cacheKey,
                  title: titleKey,
                  artist: primaryArtist,
                  jiosaavn_song_id: matchedSong.id,
                  status: 'resolved',
                  raw_response: matchedSong,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'cache_key' });
                return matchedSong;
              }
            }

            await supabaseAdmin.from('song_resolution_cache').upsert({
              cache_key: cacheKey,
              title: titleKey,
              artist: primaryArtist,
              status: 'not_found',
              updated_at: new Date().toISOString()
            }, { onConflict: 'cache_key' });
            return null;
          } catch (e) {
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        resolvedSongs.push(...(batchResults.filter(Boolean) as Song[]));
      }

      const uniqueSongs = deduplicateSongs(resolvedSongs);

      uniqueSongs.sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : new Date(`${a.releaseYear}-01-01`).getTime();
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : new Date(`${b.releaseYear}-01-01`).getTime();
        return dateB - dateA;
      });

      return uniqueSongs;
    } catch (err) {
      console.error(`[PlaylistResolver] Fatal error aggregating playlists`, err);
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

export function lookupPlaylistInfo(playlistId: string): { name: string; language: string; category: string } {
  const languages = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English'];
  for (const lang of languages) {
    if (TRENDING_SOURCES[lang]?.id === playlistId) {
      return { name: TRENDING_SOURCES[lang].title, language: lang, category: 'charts' };
    }
    if (NEW_RELEASES_SOURCES[lang]?.id === playlistId) {
      return { name: NEW_RELEASES_SOURCES[lang].title, language: lang, category: 'new_music' };
    }
    if (CLASSICS_SOURCES[lang]?.id === playlistId) {
      return { name: CLASSICS_SOURCES[lang].title, language: lang, category: 'genres' };
    }
    const extra = BROWSE_5_PLAYLISTS[lang] || [];
    const idx = extra.findIndex(p => p.id === playlistId);
    if (idx !== -1) {
      let cat = 'playlists';
      if (idx === 0) cat = 'language';
      if (idx === 3) cat = 'mood';
      if (idx === 4) cat = 'genres';
      return { name: extra[idx].title, language: lang, category: cat };
    }
  }
  return { name: 'Unknown Playlist', language: 'Telugu', category: 'Playlist' };
}

// ── MATCH SCORING UTILITIES ──

function cleanString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/\(from[^)]*\)/gi, '')
    .replace(/\-[^-]*motion picture soundtrack.*/gi, '')
    .replace(/\-[^-]*original motion picture soundtrack.*/gi, '')
    .replace(/\(original motion picture soundtrack\)/gi, '')
    .replace(/\b(remastered|remaster|original|bgm|karaoke|instrumental|cover|reprise|version|tribute|unplugged|mashup|mix|lullaby)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateTitleScore(sTitle: string, jTitle: string): number {
  const sClean = cleanString(sTitle);
  const jClean = cleanString(jTitle);
  const sWords = sClean.split(' ').filter(Boolean);
  const jWords = jClean.split(' ').filter(Boolean);

  if (sWords.length === 0 || jWords.length === 0) return 0;

  let overlap = 0;
  sWords.forEach(w => {
    if (jWords.includes(w)) overlap++;
  });

  return overlap / Math.max(sWords.length, jWords.length);
}

export function calculateMatchScore(spotify: SpotifyTrack, saavn: Song): number {
  const hasWord = (str: string, word: string) => new RegExp(`\\b${word}\\b`, 'i').test(str);
  
  const versionMismatch = 
    (hasWord(spotify.title, 'instrumental') !== hasWord(saavn.title, 'instrumental')) ||
    (hasWord(spotify.title, 'karaoke') !== hasWord(saavn.title, 'karaoke')) ||
    (hasWord(spotify.title, 'cover') !== hasWord(saavn.title, 'cover')) ||
    (hasWord(spotify.title, 'remix') !== hasWord(saavn.title, 'remix')) ||
    (hasWord(spotify.title, 'lullaby') !== hasWord(saavn.title, 'lullaby'));

  if (versionMismatch) return 0;

  const titleScore = calculateTitleScore(spotify.title, saavn.title);
  if (titleScore < 0.4) return 0;

  const cleanArtistStr = (str: string) => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const getArtistList = (str: string) => {
    return cleanArtistStr(str).split(/[\s,]+/).filter(Boolean);
  };
  const sArtists = getArtistList(spotify.artist);
  const jArtists = getArtistList(saavn.artist);

  let artistOverlap = 0;
  sArtists.forEach(a => {
    if (jArtists.includes(a)) artistOverlap++;
  });
  const artistScore = sArtists.length > 0 ? artistOverlap / sArtists.length : 0;

  const primarySArtist = sArtists[0] || '';
  const primaryJArtist = jArtists[0] || '';
  const primaryMatch = primarySArtist && (jArtists.includes(primarySArtist) || primaryJArtist.includes(primarySArtist));

  if (!primaryMatch && artistScore === 0) {
    return 0;
  }

  let durationScore = 1.0;
  if (spotify.duration && saavn.duration) {
    const diff = Math.abs(spotify.duration - saavn.duration);
    if (diff > 45) {
      durationScore = 0.0;
    } else if (diff > 15) {
      durationScore = 0.5;
    }
  }

  return (titleScore * 0.5) + (artistScore * 0.3) + (durationScore * 0.2);
}

// ── DIRECT JIOSAAVN RAW API HANDLERS ──

async function searchJioSaavnRaw(baseUrl: string, externalBase: string, query: string, limit = 5): Promise<{ results: any[] | null, success: boolean }> {
  const encoded = encodeURIComponent(query.trim() || 'popular songs');
  const urls = [
    `${baseUrl}/api/search/songs?query=${encoded}&limit=${limit}`,
    `${externalBase}/api/search/songs?query=${encoded}&limit=${limit}`,
  ];

  const safeFetchRaw = async (url: string): Promise<any[] | null> => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return null;
      const data = await res.json();
      return data.data?.results || data.results || [];
    } catch (e) {
      clearTimeout(tid);
      throw e;
    }
  };

  let lastErr: any;
  for (const url of urls) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const results = await safeFetchRaw(url);
        if (results !== null) {
          return { results, success: true };
        }
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }
  }

  console.warn(`[SaavnMatcher] Failed querying both endpoints for query: "${query}"`, lastErr);
  return { results: null, success: false };
}

function decode(s: string): string {
  return (s || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function mapTrackToSong(track: any, idx: number): Song {
  const pa = track.artists?.primary || track.artists?.all || [];
  const artist =
    pa.length > 0
      ? pa.map((a: any) => decode(a.name)).join(', ')
      : decode(track.artist || track.subtitle || 'Unknown Artist');

  let coverUrl = '/app-icon.png';
  if (Array.isArray(track.image) && track.image.length > 0) {
    const hi =
      track.image.find((i: any) => i?.quality === '500x500' || i?.quality === '500X500') ||
      track.image[track.image.length - 1] ||
      track.image[0];
    const rawUrl = hi?.url || hi?.link || (typeof hi === 'string' ? hi : '');
    if (rawUrl) coverUrl = rawUrl.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500');
  } else if (typeof track.image === 'string' && track.image) {
    coverUrl = track.image.replace('http://', 'https://').replace(/150x150|50x50/g, '500x500');
  }
  if (!coverUrl) coverUrl = '/app-icon.png';

  let audioUrl = '';
  if (Array.isArray(track.downloadUrl) && track.downloadUrl.length > 0) {
    const best =
      track.downloadUrl.find((a: any) => a?.quality === '320kbps') ||
      track.downloadUrl.find((a: any) => a?.quality === '160kbps') ||
      track.downloadUrl[track.downloadUrl.length - 1];
    const rawAudio = best?.url || best?.link || (typeof best === 'string' ? best : '');
    if (rawAudio) audioUrl = rawAudio.replace('http://', 'https://');
  } else if (typeof track.downloadUrl === 'string' && track.downloadUrl) {
    audioUrl = track.downloadUrl.replace('http://', 'https://');
  } else if (track.media_preview_url) {
    audioUrl = track.media_preview_url.replace('http://', 'https://').replace('_preview.mp3', '_320.mp4');
  }

  const duration =
    typeof track.duration === 'number' ? track.duration : parseInt(track.duration) || 210;
  const playCount =
    typeof track.playCount === 'number' ? track.playCount : parseInt(track.playCount) || 0;
  const trackLanguage = track.language || '';
  const genre = trackLanguage ? `${trackLanguage.toUpperCase()} HITS` : 'MELODY HITS';

  return {
    id: track.id || `saavn-${idx}`,
    title: decode(track.name || track.title || 'Untitled Track'),
    artist,
    artistId: pa[0]?.id || `art-${idx}`,
    album: decode(track.album?.name || 'Single'),
    albumId: track.album?.id || `alb-${idx}`,
    duration,
    coverUrl,
    audioUrl,
    genre,
    category: 'latest_telugu' as const,
    releaseYear: parseInt(track.year) || new Date().getFullYear(),
    plays: playCount,
    likes: Math.floor(playCount * 0.15),
    downloads: Math.floor(playCount * 0.08),
    audioQuality: '24-bit FLAC' as const,
    bitrate: '320 kbps',
    sampleRate: '48 kHz',
    codec: 'AAC HQ Stream',
    lyrics: [
      { time: 0, text: `${decode(track.name || track.title || '')} — Audio Stream` },
    ],
    credits: {
      composer: artist,
      lyricist: 'RaagaX Catalog',
      singers: pa.map((a: any) => decode(a.name)),
      label: track.label || 'Sony / Aditya Music',
    },
  };
}
