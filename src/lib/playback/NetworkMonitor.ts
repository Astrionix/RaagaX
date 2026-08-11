export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'unknown';

export interface NetworkProfile {
  type: NetworkType;
  effectiveType?: string; // e.g. '4g', '3g'
  downlinkMbps?: number;
  latencyMs?: number;
  saveData: boolean;
  isOnline: boolean;
}

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private profile: NetworkProfile;
  private listeners: Set<(profile: NetworkProfile) => void> = new Set();

  private constructor() {
    this.profile = this.detectProfile();
    this.setupListeners();
  }

  public static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  public getProfile(): NetworkProfile {
    return this.profile;
  }

  public subscribe(listener: (profile: NetworkProfile) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.profile);
    }
  }

  private detectProfile(): NetworkProfile {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const connection: any = typeof navigator !== 'undefined' ? (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection : null;
    
    return {
      isOnline,
      type: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType,
      downlinkMbps: connection?.downlink,
      latencyMs: connection?.rtt,
      saveData: connection?.saveData || false,
    };
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.profile = this.detectProfile();
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.profile = this.detectProfile();
      this.notify();
    });

    const connection: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.profile = this.detectProfile();
        this.notify();
      });
    }
  }
}
