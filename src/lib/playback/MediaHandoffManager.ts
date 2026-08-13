import { usePlayerStore } from '@/context/usePlayerStore';

export class MediaHandoffManager {
  private static instance: MediaHandoffManager;
  private transitionId = 0;

  private constructor() {}

  public static getInstance(): MediaHandoffManager {
    if (!MediaHandoffManager.instance) {
      MediaHandoffManager.instance = new MediaHandoffManager();
    }
    return MediaHandoffManager.instance;
  }

  public async transition(target: 'audio' | 'video') {
    const id = ++this.transitionId;
    const store = usePlayerStore.getState();

    // Ensure audio renderer is active
    store.setRenderer('audio');
    
    // In a real implementation with the YT IFrame API, we would await seek here
    // before playing, but since we use a basic iframe URL with ?start=, it seeks on load.
    
    if (this.transitionId !== id) return; // Cancelled by newer transition
    
    // Slight delay to allow renderer switch before playing
    setTimeout(() => {
        if (this.transitionId !== id) return;
        store.setIsPlaying(true, true);
    }, 100);
  }
}
