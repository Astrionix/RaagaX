type NetworkMode = 'online' | 'offline' | 'offline_forced';

type NetworkListener = (mode: NetworkMode) => void;

export class NetworkManager {
  private static instance: NetworkManager;
  private currentMode: NetworkMode = 'online';
  private listeners: Set<NetworkListener> = new Set();
  private userForcedOffline: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.currentMode = navigator.onLine ? 'online' : 'offline';
      
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);
    }
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private handleOnlineEvent = () => {
    if (this.userForcedOffline) return; // Keep it offline_forced if user wants it
    this.updateMode('online');
  };

  private handleOfflineEvent = () => {
    if (this.userForcedOffline) return; // Keep it offline_forced
    this.updateMode('offline');
  };

  private updateMode(newMode: NetworkMode) {
    if (this.currentMode !== newMode) {
      this.currentMode = newMode;
      this.notifyListeners();
    }
  }

  public getMode(): NetworkMode {
    return this.currentMode;
  }

  public isOnline(): boolean {
    return this.currentMode === 'online';
  }

  public setForcedOffline(force: boolean) {
    this.userForcedOffline = force;
    if (force) {
      this.updateMode('offline_forced');
    } else {
      // Re-evaluate current physical status
      const physicalState = typeof window !== 'undefined' && navigator.onLine ? 'online' : 'offline';
      this.updateMode(physicalState);
    }
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentMode);
    }
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
    }
    this.listeners.clear();
  }
}
