import { ProviderCandidate } from './ProviderRegistry';
import { Song } from '@/types/music';
import { supabase } from '@/lib/supabase'; // Using the client initialized with SERVICE_ROLE
import { InternetDateScraper } from './InternetDateScraper';
import { getApiUrl } from '@/lib/config/apiConfig';
import { isOfflineMode } from '@/context/usePlayerStore';
import { RaagaDB, STORES } from '@/lib/storage/IndexedDB';

export class SongResolver {
  /**
   * Decodes basic HTML entities like &quot; and &amp;
   */
  public static decodeHtmlEntities(text: string): string {
    if (!text) return '';
    return text
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  /**
   * Normalizes strings for robust comparison
   */
  private static normalize(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[\(\[].*?[\)\]]/g, '') // Remove text in brackets
      .replace(/[^a-z0-9]/g, '')      // Remove special characters
      .trim();
  }

  /**
   * Evaluates a candidate to generate a base confidence score
   */
  public static evaluateCandidate(candidate: ProviderCandidate): number {
    let score = 0;
    if (candidate.title) score += 30;
    if (candidate.artist) score += 30;
    if (candidate.coverUrl) score += 10;
    if (candidate.downloadUrl && candidate.downloadUrl.length > 0) score += 30;

    const titleLower = candidate.title.toLowerCase();
    if (titleLower.includes('karaoke') || titleLower.includes('instrumental')) {
      score -= 50;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Resolves a raw list of candidates into canonical songs
   */
  public static async resolveAndStore(
    candidates: ProviderCandidate[], 
    category: 'trending' | 'new_releases' | 'top100', 
    language: string
  ): Promise<any[]> {
    const resolved: any[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const dedupKey = this.normalize(candidate.title);
      if (seen.has(dedupKey)) continue;

      // STRICT VERIFICATION: If this is the "New Releases" category, it MUST be from the last 20 days.
      if (category === 'new_releases') {
        let finalReleaseDate = candidate.releaseDate;
        
        // Try to get exact date
        if (!finalReleaseDate || finalReleaseDate.toString().length <= 4) {
          const scrapedDate = await InternetDateScraper.fetchExactReleaseDate(candidate.title, candidate.artist);
          if (scrapedDate) {
            finalReleaseDate = scrapedDate;
            candidate.releaseDate = scrapedDate; 
          }
        }
        
        if (!finalReleaseDate) {
           console.log(`[SongResolver] Rejected ${candidate.title}: No exact release date found.`);
           continue; // Strict reject if no date
        }

        const releaseDate = new Date(finalReleaseDate);
        if (isNaN(releaseDate.getTime())) {
           console.log(`[SongResolver] Rejected ${candidate.title}: Unparseable date ${finalReleaseDate}`);
           continue;
        }

        // STRICT VERIFICATION: 10 day window
        const now = new Date();
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(now.getDate() - 10);
        
        if (releaseDate < tenDaysAgo || releaseDate > now) {
           console.log(`[SongResolver] Rejected ${candidate.title}: Date ${finalReleaseDate} is outside 10-day window.`);
           continue; // Strict reject if outside 10 days
        }
      }

      seen.add(dedupKey);

      let confidence = this.evaluateCandidate(candidate);

      // To keep syncing "so quick", we temporarily bypass MusicBrainz here.
      // In a production system, MB verification would happen in an async queue.
      /*
      if (confidence >= 70 && confidence < 80) {
        const isVerified = await MusicBrainzProvider.verifyTrack(candidate.title, candidate.artist);
        if (isVerified) {
          confidence += 20; 
          console.log(`[SongResolver] MusicBrainz verified borderline track: ${candidate.title}`);
        }
      }
      */
      
      // Require at least 70% confidence (since we disabled the MB boost)
      if (confidence < 70) continue;

      // We cast to any here because we are building a backend canonical object
      // that gets stored in Supabase, not the final frontend Song object.
      const canonicalSong: any = {
        id: candidate.id, // In Phase 2 this will be a UUID, mapping to provider IDs
        title: this.decodeHtmlEntities(candidate.title),
        artist: candidate.artist,
        album: this.decodeHtmlEntities(candidate.album || ''),
        language: candidate.language,
        coverUrl: candidate.coverUrl,
        downloadUrl: candidate.downloadUrl,
        duration: candidate.duration,
      };

      resolved.push(canonicalSong);
    }

    // Attempt to upsert the resolved songs into Supabase cache.
    // If table doesn't exist, this fails silently, returning the resolved array to memory.
    try {
      if (resolved.length > 0) {
        // Upsert into canonical_songs
        const { error: songError } = await supabase
          .from('canonical_songs')
          .upsert(
            resolved.map((s: any) => ({
              id: s.id,
              title: s.title,
              artist: s.artist,
              album: s.album,
              language: s.language,
              cover_url: s.coverUrl,
              duration: s.duration,
              raw_data: s.downloadUrl // Storing download URLs as JSONB
            })),
            { onConflict: 'id' }
          );

        if (songError) {
          // Client anon keys may not have direct write access; fallback cleanly
          return resolved;
        }

        // Upsert into charts
        const { error: chartError } = await supabase
          .from('charts')
          .upsert(
            resolved.map((s, idx) => ({
              section_name: category,
              language: language.toLowerCase(),
              song_id: s.id,
              rank: idx + 1,
              discovered_at: new Date().toISOString()
            })),
            { onConflict: 'section_name,language,song_id' }
          );

        if (chartError) throw chartError;
      }
    } catch (e) {
      console.warn('Supabase Cache Error (Table might not exist yet):', e);
    }

    // Map to frontend Song objects before returning
    return resolved.map(s => {
      let audioUrl = '';
      if (s.downloadUrl && Array.isArray(s.downloadUrl)) {
        const highest = s.downloadUrl.find((d: any) => d.quality === '320kbps') || s.downloadUrl[s.downloadUrl.length - 1];
        audioUrl = highest?.url || '';
      }

      return {
        id: s.id,
        title: s.title,
        artist: s.artist,
        artistId: s.artist,
        album: s.album || '',
        albumId: s.album || '',
        coverUrl: s.coverUrl,
        audioUrl: audioUrl,
        duration: Number(s.duration) || 0,
        genre: 'Telugu',
        category: 'latest_telugu',
        releaseYear: 2024,
        plays: 1000,
        likes: 100,
      };
    });
  }

  /**
   * Fetches full Song objects from canonical_songs table or local IndexedDB cache given an array of song IDs.
   */
  public static async resolveSongs(songIds: string[]): Promise<Song[]> {
    if (!songIds || songIds.length === 0) return [];

    const db = RaagaDB.getInstance();
    const resolved: Song[] = [];
    const missingIds: string[] = [];

    // Try to resolve from local IndexedDB cache first
    if (typeof window !== 'undefined') {
      try {
        for (const id of songIds) {
          const cachedSong = await db.get<Song>(STORES.SONGS_METADATA, id);
          if (cachedSong) {
            resolved.push(cachedSong);
          } else {
            missingIds.push(id);
          }
        }
      } catch (err) {
        console.warn('[SongResolver] IndexedDB cache read failed, falling back:', err);
        resolved.length = 0;
        missingIds.push(...songIds);
      }
    } else {
      missingIds.push(...songIds);
    }

    if (missingIds.length === 0) {
      // Re-order to match input sequence
      const resolvedMap = new Map(resolved.map(s => [s.id, s]));
      return songIds
        .map(id => resolvedMap.get(id))
        .filter((s): s is Song => Boolean(s));
    }

    const newlyResolved: Song[] = [];

    if (isOfflineMode()) {
      // Offline mode: resolve from local player store state if available
      try {
        const { usePlayerStore } = await import('@/context/usePlayerStore');
        const store = usePlayerStore.getState();
        const pool = [...(store.queue || []), ...(store.likedSongs || [])];
        const idSet = new Set(missingIds);
        for (const s of pool) {
          if (s?.id && idSet.has(s.id) && !resolved.some(f => f.id === s.id) && !newlyResolved.some(f => f.id === s.id)) {
            newlyResolved.push(s);
          }
        }
      } catch {}
    } else {
      try {
        const { data, error } = await supabase
          .from('canonical_songs')
          .select('*')
          .in('id', missingIds);
          
        if (!error && data) {
          data.forEach((s: any) => {
            let audioUrl = '';
            if (s.raw_data && Array.isArray(s.raw_data)) {
              const highest = s.raw_data.find((d: any) => d.quality === '320kbps') || s.raw_data[s.raw_data.length - 1];
              audioUrl = highest?.url || '';
            }

            newlyResolved.push({
              id: s.id,
              title: s.title,
              artist: s.artist,
              artistId: s.artist,
              album: s.album || '',
              albumId: s.album || '',
              coverUrl: s.cover_url || s.coverUrl,
              audioUrl: audioUrl,
              duration: Number(s.duration) || 0,
              genre: 'Telugu',
              category: 'latest_telugu',
              releaseYear: 2024,
              plays: 1000,
              likes: 100,
            });
          });
        }

        // Check which IDs still need full metadata
        const foundSet = new Set(newlyResolved.map(s => s.id));
        const apiMissingIds: string[] = [];
        missingIds.forEach(id => {
          if (!foundSet.has(id) && !resolved.some(s => s.id === id)) {
            apiMissingIds.push(id);
          }
        });

        // Query /api/songs for missing IDs (JioSaavn provider) in batches of 50
        if (apiMissingIds.length > 0 && typeof window !== 'undefined') {
          const BATCH_SIZE = 50;
          const batches: string[][] = [];
          for (let i = 0; i < apiMissingIds.length; i += BATCH_SIZE) {
            batches.push(apiMissingIds.slice(i, i + BATCH_SIZE));
          }

          const fetchPromises = batches.map(async (batch) => {
            try {
              const url = getApiUrl(`/api/songs?ids=${encodeURIComponent(batch.join(','))}`);
              const res = await fetch(url);
              if (res.ok) {
                const json = await res.json();
                return json.data || [];
              }
            } catch (err) {
              console.warn('[SongResolver] Batch resolution failed:', err);
            }
            return [];
          });

          const results = await Promise.all(fetchPromises);
          const rawTracks = results.flat();

          if (rawTracks.length > 0) {
            const { mapTrackToSong } = await import('@/lib/jioSaavnProvider');
            rawTracks.forEach((track, idx) => {
              const mapped = mapTrackToSong(track, idx);
              if (mapped?.id && !foundSet.has(mapped.id) && !resolved.some(s => s.id === mapped.id)) {
                newlyResolved.push(mapped);
                foundSet.add(mapped.id);
              }
            });
          }
        }
      } catch (e) {
        if (!isOfflineMode()) {
          console.error("Failed to resolve songs from canonical_songs / API:", e);
        }
      }
    }

    // Save newly resolved songs to IndexedDB cache
    if (newlyResolved.length > 0 && typeof window !== 'undefined') {
      try {
        for (const song of newlyResolved) {
          if (song && song.id) {
            await db.put(STORES.SONGS_METADATA, song);
          }
        }
      } catch (err) {
        console.warn('[SongResolver] IndexedDB write failed:', err);
      }
    }

    resolved.push(...newlyResolved);

    // Re-order resolved array to match the input songIds sequence
    const resolvedMap = new Map(resolved.map(s => [s.id, s]));
    return songIds
      .map(id => resolvedMap.get(id))
      .filter((s): s is Song => Boolean(s));
  }
}
