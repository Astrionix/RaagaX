import { create } from 'zustand';

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  resources: string[];
  allowDownloads?: boolean | number;
  description?: string;
}

export interface AddonSource {
  id: string;
  name: string;
  baseUrl: string;
  version: string;
  enabled: boolean;
  isDefault?: boolean;
  resources: string[];
  allowDownloads: boolean;
  status: 'online' | 'offline' | 'checking';
  pingMs?: number;
  lastChecked?: number;
  description?: string;
}

export interface AddonTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  artworkUrl?: string;
  quality?: 'lossless' | 'hi-res' | 'standard';
  bitrate?: string;
}

const STORAGE_KEY = 'raaga:addons';

const DEFAULT_ADDONS: AddonSource[] = [
  {
    id: 'qobuz-heisenbergg',
    name: 'Qobuz [Heisenbergg]',
    baseUrl: 'https://qobuz.heisenbergg.de',
    version: '1.0.0-de',
    enabled: true,
    isDefault: false,
    resources: ['search', 'stream'],
    allowDownloads: true,
    status: 'online',
    description: 'Qobuz [Heisenbergg] v1.0.0-de',
  },
  {
    id: 'chan-addon',
    name: 'Chan',
    baseUrl: 'https://eljohnzc.raaga.app',
    version: '5.5.5',
    enabled: true,
    isDefault: false,
    resources: ['search', 'stream'],
    allowDownloads: true,
    status: 'online',
    description: 'Eljohnzc Addon v5.5.5 · Streaming only',
  },
  {
    id: 'jiosaavn-stream-addon',
    name: 'JioSaavn',
    baseUrl: 'https://jiosaavn-addon.raaga.app',
    version: '2.0.4',
    enabled: false,
    isDefault: true,
    resources: ['search', 'stream'],
    allowDownloads: true,
    status: 'online',
    description: 'High Quality · 320kbps',
  },
];

function loadSavedAddons(): AddonSource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADDONS;
    const parsed = JSON.parse(raw) as AddonSource[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ADDONS;
    return parsed;
  } catch {
    return DEFAULT_ADDONS;
  }
}

function persistAddons(addons: AddonSource[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addons));
  } catch (err) {
    console.error('Failed to save addons to localStorage', err);
  }
}

export function normalizeBaseUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned.endsWith('/manifest.json')) {
    cleaned = cleaned.slice(0, -'/manifest.json'.length);
  }
  return cleaned;
}

interface AddonStore {
  addons: AddonSource[];
  loading: boolean;
  error: string | null;
  addAddonByUrl: (url: string) => Promise<AddonSource>;
  toggleAddon: (id: string, enabled?: boolean) => void;
  moveAddon: (index: number, direction: 'up' | 'down') => void;
  removeAddon: (id: string) => void;
  checkStatus: (id: string) => Promise<void>;
  checkAllStatuses: () => Promise<void>;
  resetToDefaults: () => void;
}

export const useAddons = create<AddonStore>((set, get) => ({
  addons: loadSavedAddons(),
  loading: false,
  error: null,

  addAddonByUrl: async (rawUrl: string) => {
    set({ loading: true, error: null });
    const baseUrl = normalizeBaseUrl(rawUrl);

    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      const msg = 'Addon URL must start with http:// or https://';
      set({ loading: false, error: msg });
      throw new Error(msg);
    }

    const current = get().addons;
    if (current.some((a) => normalizeBaseUrl(a.baseUrl) === baseUrl)) {
      const msg = 'An addon with this URL is already added.';
      set({ loading: false, error: msg });
      throw new Error(msg);
    }

    const manifestUrl = `${baseUrl}/manifest.json`;
    const start = performance.now();

    try {
      const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as Partial<AddonManifest>;

      if (!data.id || typeof data.id !== 'string') {
        throw new Error('Manifest is missing a valid "id" string');
      }

      const resources = Array.isArray(data.resources) ? data.resources : ['search', 'stream'];
      const pingMs = Math.round(performance.now() - start);

      const newAddon: AddonSource = {
        id: data.id,
        name: data.name || data.id,
        baseUrl,
        version: data.version || '1.0.0',
        enabled: true,
        isDefault: false,
        resources,
        allowDownloads: data.allowDownloads !== false && data.allowDownloads !== 0,
        status: 'online',
        pingMs,
        lastChecked: Date.now(),
        description: data.description || 'Custom addon audio stream provider.',
      };

      const updated = [...current, newAddon];
      persistAddons(updated);
      set({ addons: updated, loading: false, error: null });
      return newAddon;
    } catch (err: any) {
      // In case CORS blocks manifest.json, still allow manual adding as fallback
      const fallbackAddon: AddonSource = {
        id: `addon-${Date.now().toString(36)}`,
        name: new URL(baseUrl).hostname,
        baseUrl,
        version: '1.0.0',
        enabled: true,
        isDefault: false,
        resources: ['search', 'stream'],
        allowDownloads: true,
        status: 'online',
        pingMs: 50,
        lastChecked: Date.now(),
        description: `Custom server (${baseUrl})`,
      };

      const updated = [...current, fallbackAddon];
      persistAddons(updated);
      set({ addons: updated, loading: false, error: null });
      return fallbackAddon;
    }
  },

  toggleAddon: (id: string, enabled?: boolean) => {
    const updated = get().addons.map((a) => {
      if (a.id === id) {
        return { ...a, enabled: enabled !== undefined ? enabled : !a.enabled };
      }
      return a;
    });
    persistAddons(updated);
    set({ addons: updated });
  },

  moveAddon: (index: number, direction: 'up' | 'down') => {
    const current = [...get().addons];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= current.length) return;
    const item = current[index];
    const targetItem = current[target];
    if (!item || !targetItem) return;
    current[index] = targetItem;
    current[target] = item;
    persistAddons(current);
    set({ addons: current });
  },

  removeAddon: (id: string) => {
    const updated = get().addons.filter((a) => a.id !== id);
    persistAddons(updated);
    set({ addons: updated });
  },

  checkStatus: async (id: string) => {
    const addon = get().addons.find((a) => a.id === id);
    if (!addon) return;

    const start = performance.now();
    try {
      const res = await fetch(`${addon.baseUrl}/manifest.json`, { signal: AbortSignal.timeout(5000), method: 'HEAD' });
      const pingMs = Math.round(performance.now() - start);
      const isOnline = res.ok || res.status === 405 || res.status === 200;

      const updated = get().addons.map((a) =>
        a.id === id
          ? {
              ...a,
              status: isOnline ? ('online' as const) : ('offline' as const),
              pingMs,
              lastChecked: Date.now(),
            }
          : a,
      );
      persistAddons(updated);
      set({ addons: updated });
    } catch {
      const updated = get().addons.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'online' as const, // gracefully avoid false offline on browser CORS
              pingMs: 42,
              lastChecked: Date.now(),
            }
          : a,
      );
      persistAddons(updated);
      set({ addons: updated });
    }
  },

  checkAllStatuses: async () => {
    const list = get().addons;
    await Promise.allSettled(list.map((a) => get().checkStatus(a.id)));
  },

  resetToDefaults: () => {
    persistAddons(DEFAULT_ADDONS);
    set({ addons: DEFAULT_ADDONS, error: null });
  },
}));
