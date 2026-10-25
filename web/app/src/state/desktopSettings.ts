import { create } from 'zustand';

export type AudioQualitySetting = 'standard' | 'high' | 'lossless';
export type AutomixPerformanceSetting = 'efficient' | 'balanced' | 'performance';
export type OutputPrecisionSetting = 'PCM_16' | 'FLOAT_32';

export interface DesktopAppSettings {
  // Audio Quality
  audioQuality: AudioQualitySetting;
  outputPrecision: OutputPrecisionSetting;
  downloadQuality: AudioQualitySetting;

  // Playback
  automix: boolean;
  automixPerformance: AutomixPerformanceSetting;
  skipSilence: boolean;
  spatialAudio: boolean;
  dolbyAtmos: boolean;
  playbackSpeed: number;
  sleepTimer: number | 'track' | null; // minutes or end of track
  sleepTimerEndsAt: number | null; // timestamp

  // Appearance
  reduceDynamicBlur: boolean;
  ambientBackdrop: boolean;
  fullBleedArtwork: boolean;
  legacyMeshGradient: boolean;
  hideVolumeBar: boolean;

  // Lyrics
  syncedLyrics: boolean;
  blurUnfocusedLyrics: boolean;

  // Storage & Cache
  songCacheLimitMb: number;

  // Miscellaneous
  dontRepeatSuggestions: boolean;
  showNerdStats: boolean;
}

const SETTINGS_KEY = 'raaga:desktop-features';

const DEFAULT_SETTINGS: DesktopAppSettings = {
  audioQuality: 'lossless',
  outputPrecision: 'FLOAT_32',
  downloadQuality: 'lossless',
  automix: false,
  automixPerformance: 'balanced',
  skipSilence: false,
  spatialAudio: false,
  dolbyAtmos: false,
  playbackSpeed: 1.0,
  sleepTimer: null,
  sleepTimerEndsAt: null,
  reduceDynamicBlur: false,
  ambientBackdrop: true,
  fullBleedArtwork: false,
  legacyMeshGradient: false,
  hideVolumeBar: false,
  syncedLyrics: true,
  blurUnfocusedLyrics: true,
  songCacheLimitMb: 2048,
  dontRepeatSuggestions: true,
  showNerdStats: false,
};

function loadSettings(): DesktopAppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<DesktopAppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: DesktopAppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}

interface DesktopSettingsStore extends DesktopAppSettings {
  updateSetting: <K extends keyof DesktopAppSettings>(key: K, value: DesktopAppSettings[K]) => void;
  setSleepTimer: (minutes: number | 'track' | null) => void;
  clearSongCache: () => Promise<number>;
  clearImageCache: () => Promise<void>;
  resetAllSettings: () => void;
}

export const useDesktopSettings = create<DesktopSettingsStore>((set, get) => ({
  ...loadSettings(),

  updateSetting: (key, value) => {
    set((state) => {
      const updated = { ...state, [key]: value };
      persistSettings(updated);
      return { [key]: value };
    });
  },

  setSleepTimer: (minutes) => {
    const endsAt = typeof minutes === 'number' ? Date.now() + minutes * 60 * 1000 : null;
    set((state) => {
      const updated = { ...state, sleepTimer: minutes, sleepTimerEndsAt: endsAt };
      persistSettings(updated);
      return { sleepTimer: minutes, sleepTimerEndsAt: endsAt };
    });
  },

  clearSongCache: async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes('audio') || key.includes('media') || key.includes('stream')) {
            await caches.delete(key);
          }
        }
      }
      return 1;
    } catch {
      return 0;
    }
  },

  clearImageCache: async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes('image') || key.includes('artwork')) {
            await caches.delete(key);
          }
        }
      }
    } catch {
      // ignore
    }
  },

  resetAllSettings: () => {
    persistSettings(DEFAULT_SETTINGS);
    set(DEFAULT_SETTINGS);
  },
}));
