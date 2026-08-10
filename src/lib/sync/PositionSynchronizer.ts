import { usePlayerStore } from '@/context/usePlayerStore';

export class PositionSynchronizer {
  private static instance: PositionSynchronizer;
  private interval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): PositionSynchronizer {
    if (!PositionSynchronizer.instance) {
      PositionSynchronizer.instance = new PositionSynchronizer();
    }
    return PositionSynchronizer.instance;
  }

  public start() {
    if (this.interval) clearInterval(this.interval);
    
    // Remote Device Clock Interpolation
    this.interval = setInterval(() => {
       const store = usePlayerStore.getState();
       if (store.isActiveDevice || !store.isPlaying) return;
       
       if (!store.lastSyncDbTime || store.lastSyncPositionMs === null) return;

       const dbTime = new Date(store.lastSyncDbTime).getTime();
       const elapsed = Date.now() - dbTime;
       const livePositionSeconds = (store.lastSyncPositionMs + elapsed) / 1000;
       
       if (livePositionSeconds <= store.duration) {
         // Update the store directly without triggering a DB sync loop
         usePlayerStore.setState({ currentTime: livePositionSeconds });
       }
    }, 1000);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
