import { create } from 'zustand';

export type NotificationType =
  | 'download_completed'
  | 'download_failed'
  | 'download_paused'
  | 'insufficient_storage'
  | 'new_release'
  | 'playlist_updated'
  | 'personalized_mix'
  | 'device_connected'
  | 'device_disconnected'
  | 'playback_transferred'
  | 'lyrics_available';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  imageUrl?: string;
  actionPayload?: {
    tab?: string;
    songId?: string;
    playlistId?: string;
    artistId?: string;
    deviceId?: string;
  };
}

interface NotificationStore {
  notifications: NotificationItem[];
  isOpen: boolean;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  addNotification: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  notifyDownloadCompleted: (songTitle: string, songId?: string, imageUrl?: string) => void;
  notifyDownloadFailed: (songTitle: string, reason?: string) => void;
  notifyDownloadPaused: () => void;
  notifyInsufficientStorage: () => void;
  notifyDeviceConnected: (deviceName: string) => void;
  notifyDeviceDisconnected: (deviceName: string) => void;
  notifyPlaybackTransferred: (deviceName: string, songTitle?: string) => void;
  notifyNewRelease: (artistName: string, songTitle: string, songId?: string, imageUrl?: string) => void;
  notifyPersonalizedMix: (mixTitle: string) => void;
  notifyLyricsAvailable: (songTitle: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

const STORAGE_KEY = 'raagax_notifications_v1';

function loadPersistedNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Default welcome notifications
      return [
        {
          id: 'welcome-1',
          type: 'personalized_mix',
          title: 'Daily Mix 1 is Ready',
          message: 'Personalized Telugu & Hindi melodies based on your listening habits.',
          timestamp: Date.now() - 1000 * 60 * 25,
          read: false,
          actionPayload: { tab: 'home' },
        },
        {
          id: 'welcome-2',
          type: 'download_completed',
          title: 'Download completed',
          message: 'Offline storage ready with 320 kbps High Fidelity audio.',
          timestamp: Date.now() - 1000 * 60 * 180,
          read: true,
          actionPayload: { tab: 'downloads' },
        }
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistNotifications(items: NotificationItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {}
}

// Anti-Spam Batcher for Downloads
let downloadBatchTimeout: NodeJS.Timeout | null = null;
let batchedDownloadTitles: string[] = [];

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: loadPersistedNotifications(),
  isOpen: false,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open: boolean) => set({ isOpen: open }),

  addNotification: (item) => {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      read: false,
    };

    set((s) => {
      const updated = [newItem, ...s.notifications].slice(0, 60);
      persistNotifications(updated);
      return { notifications: updated };
    });
  },

  notifyDownloadCompleted: (songTitle: string, songId?: string, imageUrl?: string) => {
    batchedDownloadTitles.push(songTitle);

    if (downloadBatchTimeout) {
      clearTimeout(downloadBatchTimeout);
    }

    downloadBatchTimeout = setTimeout(() => {
      const count = batchedDownloadTitles.length;
      if (count === 1) {
        get().addNotification({
          type: 'download_completed',
          title: 'Download completed',
          message: `"${batchedDownloadTitles[0]}" is now available offline.`,
          imageUrl,
          actionPayload: { tab: 'downloads', songId },
        });
      } else if (count > 1) {
        get().addNotification({
          type: 'download_completed',
          title: 'Downloads completed',
          message: `${count} songs are now available offline.`,
          actionPayload: { tab: 'downloads' },
        });
      }
      batchedDownloadTitles = [];
      downloadBatchTimeout = null;
    }, 2000);
  },

  notifyDownloadFailed: (songTitle: string, reason?: string) => {
    get().addNotification({
      type: 'download_failed',
      title: 'Download failed',
      message: `Failed to download "${songTitle}"${reason ? `: ${reason}` : ''}. Tap to retry.`,
      actionPayload: { tab: 'downloads' },
    });
  },

  notifyDownloadPaused: () => {
    get().addNotification({
      type: 'download_paused',
      title: 'Downloads paused',
      message: 'Waiting for Wi-Fi connection according to your download preferences.',
      actionPayload: { tab: 'downloads' },
    });
  },

  notifyInsufficientStorage: () => {
    get().addNotification({
      type: 'insufficient_storage',
      title: 'Low Device Storage',
      message: 'Automatic downloads paused to preserve remaining device space.',
      actionPayload: { tab: 'downloads' },
    });
  },

  notifyDeviceConnected: (deviceName: string) => {
    get().addNotification({
      type: 'device_connected',
      title: 'Device connected',
      message: `Connected to ${deviceName} for synchronized playback.`,
      actionPayload: { tab: 'home' },
    });
  },

  notifyDeviceDisconnected: (deviceName: string) => {
    get().addNotification({
      type: 'device_disconnected',
      title: 'Device disconnected',
      message: `${deviceName} is no longer reachable on this network.`,
    });
  },

  notifyPlaybackTransferred: (deviceName: string, songTitle?: string) => {
    get().addNotification({
      type: 'playback_transferred',
      title: 'Playback transferred',
      message: songTitle 
        ? `"${songTitle}" is now playing on ${deviceName}.`
        : `Active playback transferred to ${deviceName}.`,
      actionPayload: { tab: 'home' },
    });
  },

  notifyNewRelease: (artistName: string, songTitle: string, songId?: string, imageUrl?: string) => {
    get().addNotification({
      type: 'new_release',
      title: `New release from ${artistName}`,
      message: `"${songTitle}" is out now. Listen first on RaagaX.`,
      imageUrl,
      actionPayload: { tab: 'home', songId },
    });
  },

  notifyPersonalizedMix: (mixTitle: string) => {
    get().addNotification({
      type: 'personalized_mix',
      title: 'New Mix Available',
      message: `"${mixTitle}" has been refreshed with new music tailored for you.`,
      actionPayload: { tab: 'home' },
    });
  },

  notifyLyricsAvailable: (songTitle: string) => {
    get().addNotification({
      type: 'lyrics_available',
      title: 'Lyrics ready',
      message: `Live synchronized lyrics are now available for "${songTitle}".`,
    });
  },

  markAsRead: (id: string) => {
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      persistNotifications(updated);
      return { notifications: updated };
    });
  },

  markAllAsRead: () => {
    set((s) => {
      const updated = s.notifications.map((n) => ({ ...n, read: true }));
      persistNotifications(updated);
      return { notifications: updated };
    });
  },

  dismissNotification: (id: string) => {
    set((s) => {
      const updated = s.notifications.filter((n) => n.id !== id);
      persistNotifications(updated);
      return { notifications: updated };
    });
  },

  clearAll: () => {
    set(() => {
      persistNotifications([]);
      return { notifications: [] };
    });
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },
}));
