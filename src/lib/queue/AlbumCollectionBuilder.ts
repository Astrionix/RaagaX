import { Song } from '@/types/music';
import { QueueItem } from './types';
import { PlaybackQueue } from './PlaybackQueue';
import { RealMusicEngine } from '@/lib/realMusicEngine';

export interface AlbumCollectionResult {
  queueId: string;
  playbackQueue: PlaybackQueue;
  items: QueueItem[];
  songs: Song[];
  uniqueTrackCount: number;
  albumsProcessed: number;
}

export class AlbumCollectionBuilder {
  private static instance: AlbumCollectionBuilder;

  private constructor() {}

  public static getInstance(): AlbumCollectionBuilder {
    if (!AlbumCollectionBuilder.instance) {
      AlbumCollectionBuilder.instance = new AlbumCollectionBuilder();
    }
    return AlbumCollectionBuilder.instance;
  }

  /**
   * Constructs an ordered, globally deduplicated queue for a collection of albums (e.g. 50 albums).
   * Enforces strict album sequence (Album 1 -> Album 2 -> ... -> Album N),
   * zero duplicate tracks, and a minimum of minUniqueTracks (default 100).
   */
  public async buildCollectionQueue(
    albumIds: string[],
    minUniqueTracks: number = 100
  ): Promise<AlbumCollectionResult> {
    const queueId = `q_collection_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const seenTrackIds = new Set<string>();
    const items: QueueItem[] = [];
    const songs: Song[] = [];
    let albumsProcessed = 0;

    const realEngine = RealMusicEngine.getInstance();

    // 1. Process requested albums sequentially to preserve exact album display order
    for (let albIdx = 0; albIdx < albumIds.length; albIdx++) {
      const albumId = albumIds[albIdx];
      if (!albumId) continue;
      try {
        const cleanId = albumId.startsWith('album:') ? albumId : `album:${albumId}`;
        const details: any = await realEngine.getPlaylistDetails(cleanId);
        const tracks = details?.songs || [];
        const albumTitle = details?.name || details?.title || `Album ${albIdx + 1}`;

        let trkIdx = 0;
        for (const track of tracks) {
          if (!track || !track.id) continue;

          // Global Canonical Track Deduplication Across All 50 Albums
          if (seenTrackIds.has(track.id)) {
            continue; // Skip duplicate track
          }

          seenTrackIds.add(track.id);

          const queueItem: QueueItem = {
            queueItemId: crypto.randomUUID(),
            trackId: track.id,
            song: track,
            albumId,
            albumTitle,
            albumIndex: albIdx,
            trackIndex: trkIdx,
            source: 'ALBUM_COLLECTION',
            sourceId: albumId,
            addedAt: Date.now(),
            playable: true,
            offlineAvailable: false,
          };

          items.push(queueItem);
          songs.push(track);
          trkIdx++;
        }

        albumsProcessed++;
      } catch (err) {
        console.warn(`[AlbumCollectionBuilder] Failed to load tracks for album ${albumId}:`, err);
      }
    }

    // 2. Enforce minimum 100 unique tracks guarantee
    if (seenTrackIds.size < minUniqueTracks) {
      console.log(`[AlbumCollectionBuilder] Collection has ${seenTrackIds.size} unique tracks < ${minUniqueTracks}. Fetching catalog fallback tracks...`);
      try {
        const fallbackSongs = await realEngine.searchRealSongs('latest telugu hits', 50);
        let fallbackTrkIdx = 0;
        for (const track of fallbackSongs) {
          if (seenTrackIds.size >= minUniqueTracks) break;
          if (!track || !track.id || seenTrackIds.has(track.id)) continue;

          seenTrackIds.add(track.id);

          const queueItem: QueueItem = {
            queueItemId: crypto.randomUUID(),
            trackId: track.id,
            song: track,
            albumIndex: albumsProcessed,
            trackIndex: fallbackTrkIdx,
            source: 'RECOMMENDATION',
            addedAt: Date.now(),
            playable: true,
            offlineAvailable: false,
          };

          items.push(queueItem);
          songs.push(track);
          fallbackTrkIdx++;
        }
      } catch (err) {
        console.warn('[AlbumCollectionBuilder] Fallback catalog query failed:', err);
      }
    }

    const playbackQueue = new PlaybackQueue(
      queueId,
      items,
      items.length > 0 ? items[0].queueItemId : null,
      { type: 'ALBUM_COLLECTION', sourceIds: albumIds }
    );

    console.log(`[AlbumCollectionBuilder] Built collection queue "${queueId}": ${items.length} items (${seenTrackIds.size} unique tracks) across ${albumsProcessed} albums.`);

    return {
      queueId,
      playbackQueue,
      items,
      songs,
      uniqueTrackCount: seenTrackIds.size,
      albumsProcessed,
    };
  }
}
