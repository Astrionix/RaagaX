export interface BufferHealth {
  bufferedDurationSec: number;
  stalls: number;
  isStalled: boolean;
}

export class BufferMonitor {
  private static instance: BufferMonitor;
  private activeElement: HTMLMediaElement | null = null;
  private health: BufferHealth = { bufferedDurationSec: 0, stalls: 0, isStalled: false };
  private monitorInterval: NodeJS.Timeout | null = null;
  
  private listeners: Set<(health: BufferHealth) => void> = new Set();

  private constructor() {}

  public static getInstance(): BufferMonitor {
    if (!BufferMonitor.instance) {
      BufferMonitor.instance = new BufferMonitor();
    }
    return BufferMonitor.instance;
  }

  public getHealth(): BufferHealth {
    return this.health;
  }

  public attach(mediaElement: HTMLMediaElement) {
    if (this.activeElement === mediaElement) return;
    
    this.detach();
    this.activeElement = mediaElement;
    
    this.activeElement.addEventListener('waiting', this.handleWaiting);
    this.activeElement.addEventListener('playing', this.handlePlaying);
    
    this.monitorInterval = setInterval(() => this.evaluateBuffer(), 1000);
  }

  public detach() {
    if (this.activeElement) {
      this.activeElement.removeEventListener('waiting', this.handleWaiting);
      this.activeElement.removeEventListener('playing', this.handlePlaying);
      this.activeElement = null;
    }
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this.health = { bufferedDurationSec: 0, stalls: 0, isStalled: false };
  }

  public subscribe(listener: (health: BufferHealth) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.health);
    }
  }

  private handleWaiting = () => {
    this.health.stalls += 1;
    this.health.isStalled = true;
    this.notify();
  };

  private handlePlaying = () => {
    this.health.isStalled = false;
    this.notify();
  };

  private evaluateBuffer() {
    if (!this.activeElement) return;
    
    const time = this.activeElement.currentTime;
    const ranges = this.activeElement.buffered;
    
    let maxBuffered = time;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= time && ranges.end(i) >= time) {
        maxBuffered = Math.max(maxBuffered, ranges.end(i));
      }
    }
    
    const duration = maxBuffered - time;
    
    if (this.health.bufferedDurationSec !== duration) {
      this.health.bufferedDurationSec = duration;
      this.notify();
    }
  }
}
