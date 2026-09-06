import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '@/context/usePlayerStore';
import { QueueManager } from '@/lib/queue/QueueManager';
import { Song } from '@/types/music';

// Mock song builder
function createMockSong(id: string, title: string, artist = 'Artist'): Song {
  return {
    id,
    title,
    artist,
    album: 'Album',
    duration: 200,
    coverUrl: 'https://example.com/cover.jpg',
    audioUrl: `https://example.com/${id}.mp3`,
    genre: 'TELUGU HITS',
  } as unknown as Song;
}

describe('Search Playback Queue Behavior: Queue Preservation & Smart Radio', () => {
  beforeEach(() => {
    // Reset store state
    usePlayerStore.setState({
      queue: [],
      queueIndex: 0,
      currentSong: null,
      isPlaying: false,
      isLocalPlayback: true,
    });
    QueueManager.getInstance().clearQueue();
  });

  it('Scenario 1: Paatha queue unte — preserves existing queue and inserts search song next', async () => {
    const song1 = createMockSong('song-1', 'Initial Track 1');
    const song2 = createMockSong('song-2', 'Initial Track 2');
    const song3 = createMockSong('song-3', 'Initial Track 3');
    const searchSong = createMockSong('search-song', 'Search Selected Hit');

    // 1. User was listening to an active playlist: [song1, song2, song3] on song1 (index 0)
    usePlayerStore.getState().playSong(song1, [song1, song2, song3]);

    const initialQueue = usePlayerStore.getState().queue;
    expect(initialQueue.length).toBe(3);
    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(usePlayerStore.getState().currentSong?.id).toBe('song-1');

    // 2. User searches and plays `searchSong` via playSearchSong
    await usePlayerStore.getState().playSearchSong(searchSong);

    const updatedQueue = usePlayerStore.getState().queue;
    const updatedIndex = usePlayerStore.getState().queueIndex;

    // Invariant 1: Queue length increased to 4 (did NOT get wiped out or replaced)
    expect(updatedQueue.length).toBe(4);

    // Invariant 2: Current song is the search song at index 1
    expect(updatedIndex).toBe(1);
    expect(usePlayerStore.getState().currentSong?.id).toBe('search-song');

    // Invariant 3: Original queue order is preserved: song1 (played) -> searchSong (now playing) -> song2 (next) -> song3 (after)
    expect(updatedQueue[0].id).toBe('song-1');
    expect(updatedQueue[1].id).toBe('search-song');
    expect(updatedQueue[2].id).toBe('song-2');
    expect(updatedQueue[3].id).toBe('song-3');
  });

  it('Scenario 2: Queue emi lekapothe — plays song and triggers Smart Radio recommendations', async () => {
    const { RealMusicEngine } = await import('@/lib/realMusicEngine');
    const searchSong = createMockSong('pushpa-1', 'Pushpa Pushpa', 'Devi Sri Prasad');
    const rec1 = createMockSong('kissik', 'Kissik', 'Devi Sri Prasad');
    const rec2 = createMockSong('sooseki', 'Sooseki', 'Devi Sri Prasad');
    const rec3 = createMockSong('fear-song', 'Fear Song', 'Anirudh');
    const rec4 = createMockSong('daakko', 'Daakko Daakko Meka', 'Devi Sri Prasad');
    const rec5 = createMockSong('eyy-bidda', 'Eyy Bidda', 'Devi Sri Prasad');

    const spy = vi.spyOn(RealMusicEngine.prototype, 'getSongSuggestions').mockResolvedValue([rec1, rec2, rec3, rec4, rec5]);

    // 1. Queue is empty
    expect(usePlayerStore.getState().queue.length).toBe(0);

    // 2. Play search song
    await usePlayerStore.getState().playSearchSong(searchSong);

    // Wait a tick for async radio suggestions
    await new Promise(resolve => setTimeout(resolve, 80));

    const finalQueue = usePlayerStore.getState().queue;

    // Invariant 1: Currently playing is the searched song
    expect(usePlayerStore.getState().currentSong?.id).toBe('pushpa-1');
    expect(usePlayerStore.getState().queueIndex).toBe(0);

    // Invariant 2: Smart Radio populated similar vibe songs into Up Next!
    expect(finalQueue.length).toBe(6);
    expect(finalQueue[0].id).toBe('pushpa-1');
    expect(finalQueue[1].id).toBe('kissik');
    expect(finalQueue[2].id).toBe('sooseki');
    expect(finalQueue[3].id).toBe('fear-song');
    expect(finalQueue[4].id).toBe('daakko');
    expect(finalQueue[5].id).toBe('eyy-bidda');

    spy.mockRestore();
  });

  it('Scenario 3: Deduplication — search song is not duplicated in Smart Radio recommendations', async () => {
    const { RealMusicEngine } = await import('@/lib/realMusicEngine');
    const searchSong = createMockSong('pushpa-1', 'Pushpa Pushpa', 'Devi Sri Prasad');
    const duplicateOfSearch = createMockSong('pushpa-1', 'Pushpa Pushpa (Dupe)', 'Devi Sri Prasad');
    const rec1 = createMockSong('sooseki', 'Sooseki', 'Devi Sri Prasad');
    const rec2 = createMockSong('kissik', 'Kissik', 'Devi Sri Prasad');
    const rec3 = createMockSong('fear-song', 'Fear Song', 'Anirudh');
    const rec4 = createMockSong('daakko', 'Daakko Daakko Meka', 'Devi Sri Prasad');
    const rec5 = createMockSong('eyy-bidda', 'Eyy Bidda', 'Devi Sri Prasad');

    const spy = vi.spyOn(RealMusicEngine.prototype, 'getSongSuggestions').mockResolvedValue([
      duplicateOfSearch, rec1, rec2, rec3, rec4, rec5
    ]);

    usePlayerStore.setState({ queue: [], queueIndex: 0, currentSong: null });
    await usePlayerStore.getState().playSearchSong(searchSong);
    await new Promise(resolve => setTimeout(resolve, 80));

    const finalQueue = usePlayerStore.getState().queue;
    const ids = finalQueue.map(s => s.id);

    // Ensure 'pushpa-1' only occurs ONCE as the active track
    const pushpaCount = ids.filter(id => id === 'pushpa-1').length;
    expect(pushpaCount).toBe(1);
    expect(ids).toEqual(['pushpa-1', 'sooseki', 'kissik', 'fear-song', 'daakko', 'eyy-bidda']);

    spy.mockRestore();
  });
});
