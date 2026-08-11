import { describe, it, expect, vi } from 'vitest';
import { PlaybackQueue } from '../../src/lib/queue/PlaybackQueue';
import { AlbumCollectionBuilder } from '../../src/lib/queue/AlbumCollectionBuilder';
import { CapacitorAndroidAudioAdapter } from '../../src/lib/playback/platform/CapacitorAndroidAudioAdapter';
import { RealMusicEngine } from '../../src/lib/realMusicEngine';
import { Song } from '../../src/types/music';

describe('Authoritative PlaybackQueue, 50-Album Collection & Android Focus Tests', () => {
  it('Test 1: PlaybackQueue is driven by currentItemId authority rather than index position', () => {
    const items = [
      { queueItemId: 'item_1', trackId: 'trk_1', song: { id: 'trk_1', title: 'Track 1' } as any } as any,
      { queueItemId: 'item_2', trackId: 'trk_2', song: { id: 'trk_2', title: 'Track 2' } as any } as any,
      { queueItemId: 'item_3', trackId: 'trk_3', song: { id: 'trk_3', title: 'Track 3' } as any } as any,
    ];

    const queue = new PlaybackQueue('q_test', items, 'item_2');

    expect(queue.getCurrentItem()?.trackId).toBe('trk_2');
    expect(queue.getCurrentIndex()).toBe(1);

    // Change currentItemId to item_3
    queue.setCurrentItemById('item_3');
    expect(queue.getCurrentItem()?.trackId).toBe('trk_3');
    expect(queue.getCurrentIndex()).toBe(2);
  });

  it('Test 2: Deterministic Shuffle calculation produces identical sequence across devices', () => {
    const items = [
      { queueItemId: 'item_1', trackId: 'trk_1' } as any,
      { queueItemId: 'item_2', trackId: 'trk_2' } as any,
      { queueItemId: 'item_3', trackId: 'trk_3' } as any,
      { queueItemId: 'item_4', trackId: 'trk_4' } as any,
    ];

    const queueLaptop = new PlaybackQueue('q_sync', items, 'item_1');
    const queueMobile = new PlaybackQueue('q_sync', items, 'item_1');

    const seed = 'shared_seed_12345';
    const shuffleLaptop = queueLaptop.enableShuffle(seed);
    const shuffleMobile = queueMobile.enableShuffle(seed);

    // Active item stays at index 0
    expect(shuffleLaptop.order[0]).toBe('item_1');
    expect(shuffleMobile.order[0]).toBe('item_1');

    // Remaining items MUST match identically across devices
    expect(shuffleLaptop.order).toEqual(shuffleMobile.order);
  });

  it('Test 3: AlbumCollectionBuilder annotates albumIndex & trackIndex and deduplicates across 50 albums', async () => {
    const builder = AlbumCollectionBuilder.getInstance();

    const mockGetPlaylistDetails = vi.spyOn(RealMusicEngine.getInstance(), 'getPlaylistDetails').mockImplementation(async (id: string) => {
      const albumNum = parseInt(id.replace(/[^0-9]/g, '')) || 1;
      const songs: Song[] = [
        { id: 'shared_hit', title: 'Global Hit', artist: 'Popular Artist' } as any,
        { id: `alb_${albumNum}_trk_1`, title: `Album ${albumNum} Track 1`, artist: 'Artist A' } as any,
        { id: `alb_${albumNum}_trk_2`, title: `Album ${albumNum} Track 2`, artist: 'Artist B' } as any,
      ];
      return { id, name: `Album ${albumNum}`, songs } as any;
    });

    const mock50AlbumIds = Array.from({ length: 50 }, (_, i) => `album_${i + 1}`);

    const result = await builder.buildCollectionQueue(mock50AlbumIds, 100);

    expect(result.albumsProcessed).toBe(50);
    expect(result.uniqueTrackCount).toBeGreaterThanOrEqual(100);

    // Verify first item metadata
    const firstItem = result.items[0];
    expect(firstItem.albumIndex).toBe(0);
    expect(firstItem.source).toBe('ALBUM_COLLECTION');

    // Verify ZERO duplicate tracks
    const trackIds = result.items.map(i => i.trackId);
    const uniqueTrackIds = new Set(trackIds);
    expect(trackIds.length).toBe(uniqueTrackIds.size);

    mockGetPlaylistDetails.mockRestore();
  });

  it('Test 4: CapacitorAndroidAudioAdapter bridges native Android AudioManager callbacks to InterruptionManager', () => {
    const adapter = new CapacitorAndroidAudioAdapter();
    const focusListener = vi.fn();
    const rawListener = vi.fn();

    adapter.subscribe(focusListener);
    adapter.subscribeRaw(rawListener);

    adapter.handleNativeFocusChange('AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK');
    expect(focusListener).toHaveBeenLastCalledWith({ type: 'LOSS_DUCK' });
    expect(rawListener).toHaveBeenLastCalledWith({ type: 'LOSS_DUCK', reason: 'NOTIFICATION' });

    adapter.handleNativeFocusChange('AUDIOFOCUS_LOSS_TRANSIENT');
    expect(focusListener).toHaveBeenLastCalledWith({ type: 'LOSS_TRANSIENT' });
    expect(rawListener).toHaveBeenLastCalledWith({ type: 'LOSS_TRANSIENT', reason: 'CALL' });

    adapter.handleNativeFocusChange('AUDIOFOCUS_LOSS');
    expect(focusListener).toHaveBeenLastCalledWith({ type: 'LOSS' });
    expect(rawListener).toHaveBeenLastCalledWith({ type: 'LOSS', reason: 'OTHER_MEDIA' });

    adapter.handleNativeFocusChange('AUDIOFOCUS_GAIN');
    expect(focusListener).toHaveBeenLastCalledWith({ type: 'GAIN' });
    expect(rawListener).toHaveBeenLastCalledWith({ type: 'GAIN' });
  });
});
