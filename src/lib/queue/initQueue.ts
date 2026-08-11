import { QueueManager } from './QueueManager';
import { usePlayerStore } from '@/context/usePlayerStore';

export async function initQueueSystem() {
  const manager = QueueManager.getInstance();
  await manager.init();

  manager.subscribe((items, currentIndex) => {
    // Map internal queue items back to the Song[] array for legacy UI compatibility
    const songs = items.map(item => item.song);
    
    usePlayerStore.setState({
      queue: songs,
      queueIndex: currentIndex,
      currentSong: songs[currentIndex] || null,
      shuffleMode: manager.getShuffleMode(),
      repeatMode: manager.getRepeatMode().toLowerCase() as 'off' | 'all' | 'one',
      isAutoplayEnabled: manager.isAutoplayEnabled(),
    });
  });
}
