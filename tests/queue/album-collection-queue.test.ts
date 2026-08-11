import { describe, it, expect, vi } from 'vitest';
import { AlbumCollectionBuilder } from '../../src/lib/queue/AlbumCollectionBuilder';
import { RealMusicEngine } from '../../src/lib/realMusicEngine';
import { Song } from '../../src/types/music';

describe('AlbumCollectionBuilder & 100+ Unique Track Queue Tests', () => {
  it('Test 1 & 2: 50 albums collection builds >= 100 unique tracks with ZERO duplicate songs', async () => {
    const builder = AlbumCollectionBuilder.getInstance();

    // Mock RealMusicEngine to return overlapping tracks across 50 simulated albums
    const mockGetPlaylistDetails = vi.spyOn(RealMusicEngine.getInstance(), 'getPlaylistDetails').mockImplementation(async (id: string) => {
      const albumNum = parseInt(id.replace(/[^0-9]/g, '')) || 1;
      const songs: Song[] = [];

      // Generate 4 tracks per album, with deliberate duplicates (song_common appears in every album)
      songs.push({ id: 'song_common', title: 'Common Hit Song', artist: 'Popular Artist', duration: 210 } as any);
      songs.push({ id: `song_alb_${albumNum}_track_1`, title: `Track 1 of Album ${albumNum}`, artist: 'Artist A', duration: 180 } as any);
      songs.push({ id: `song_alb_${albumNum}_track_2`, title: `Track 2 of Album ${albumNum}`, artist: 'Artist B', duration: 200 } as any);
      songs.push({ id: `song_alb_${albumNum}_track_3`, title: `Track 3 of Album ${albumNum}`, artist: 'Artist C', duration: 220 } as any);

      return { id, name: `Album ${albumNum}`, songs } as any;
    });

    const mock50AlbumIds = Array.from({ length: 50 }, (_, i) => `album_${i + 1}`);

    const result = await builder.buildCollectionQueue(mock50AlbumIds, 100);

    expect(result.albumsProcessed).toBe(50);
    expect(result.uniqueTrackCount).toBeGreaterThanOrEqual(100);

    // Verify ZERO duplicate tracks
    const trackIds = result.songs.map(s => s.id);
    const uniqueIds = new Set(trackIds);
    expect(trackIds.length).toBe(uniqueIds.size);

    // Common hit song should appear EXACTLY ONCE
    const commonCount = trackIds.filter(id => id === 'song_common').length;
    expect(commonCount).toBe(1);

    mockGetPlaylistDetails.mockRestore();
  });

  it('Test 3: Album track order is strictly preserved (Album 1 -> Album 2 -> ... -> Album N)', async () => {
    const builder = AlbumCollectionBuilder.getInstance();

    const mockGetPlaylistDetails = vi.spyOn(RealMusicEngine.getInstance(), 'getPlaylistDetails').mockImplementation(async (id: string) => {
      const albumNum = parseInt(id.replace(/[^0-9]/g, '')) || 1;
      return {
        id,
        name: `Album ${albumNum}`,
        songs: [
          { id: `s_${albumNum}_1`, title: `Album ${albumNum} Track 1`, artist: 'Artist' } as any,
          { id: `s_${albumNum}_2`, title: `Album ${albumNum} Track 2`, artist: 'Artist' } as any,
        ],
      } as any;
    });

    const albumIds = ['album_1', 'album_2', 'album_3'];
    const result = await builder.buildCollectionQueue(albumIds, 5);

    expect(result.songs[0].id).toBe('s_1_1');
    expect(result.songs[1].id).toBe('s_1_2');
    expect(result.songs[2].id).toBe('s_2_1');
    expect(result.songs[3].id).toBe('s_2_2');
    expect(result.songs[4].id).toBe('s_3_1');

    mockGetPlaylistDetails.mockRestore();
  });

  it('Test 4: Each queue item in collection has a unique queueItemId', async () => {
    const builder = AlbumCollectionBuilder.getInstance();

    const mockGetPlaylistDetails = vi.spyOn(RealMusicEngine.getInstance(), 'getPlaylistDetails').mockImplementation(async () => {
      return {
        id: 'album_test',
        name: 'Test Album',
        songs: [
          { id: 'track_1', title: 'Track 1', artist: 'Artist' } as any,
          { id: 'track_2', title: 'Track 2', artist: 'Artist' } as any,
        ],
      } as any;
    });

    const result = await builder.buildCollectionQueue(['album_test'], 2);

    expect(result.items.length).toBe(2);
    expect(result.items[0].queueItemId).toBeDefined();
    expect(result.items[1].queueItemId).toBeDefined();
    expect(result.items[0].queueItemId).not.toBe(result.items[1].queueItemId);

    mockGetPlaylistDetails.mockRestore();
  });
});
