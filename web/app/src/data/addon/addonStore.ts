import { create } from 'zustand';
import { AddonClient, normalizeBaseUrl } from './addonClient';
import type { AddonSourceConfig, AddonTier, AddonUpgradeState } from './types';

const STORAGE_KEY = 'raaga:addons';

function loadAddons(): AddonSourceConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AddonSourceConfig[];
  } catch {
    return [];
  }
}

function saveAddons(addons: AddonSourceConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addons));
  } catch {
    // Ignore quota errors
  }
}

interface AddonStoreState {
  addons: AddonSourceConfig[];
  upgradeState: AddonUpgradeState | null;

  addAddon: (rawUrl: string, customName?: string) => Promise<AddonSourceConfig>;
  removeAddon: (id: string) => void;
  toggleAddon: (id: string, enabled?: boolean) => void;
  setTier: (id: string, tier: AddonTier) => void;
  setUpgradeState: (state: AddonUpgradeState | null) => void;
  clearUpgrade: () => void;
  getEnabledAddons: () => AddonSourceConfig[];
}

export const useAddonStore = create<AddonStoreState>()((set, get) => ({
  addons: loadAddons(),
  upgradeState: null,

  async addAddon(rawUrl: string, customName?: string) {
    const baseUrl = normalizeBaseUrl(rawUrl);
    if (!baseUrl) {
      throw new Error('Please enter a valid URL');
    }

    // Check if already added
    const existing = get().addons.find((a) => a.baseUrl.toLowerCase() === baseUrl.toLowerCase());
    if (existing) {
      throw new Error('This Add-on is already added');
    }

    // Test connection & fetch manifest
    const client = new AddonClient(baseUrl);
    const manifest = await client.manifest();

    const newAddon: AddonSourceConfig = {
      id: manifest.id || `addon_${Date.now()}`,
      name: customName?.trim() || manifest.name || manifest.id || 'Custom Add-on',
      baseUrl,
      enabled: true,
      tier: 'LOSSLESS',
      addedAt: Date.now(),
      manifest,
    };

    const updated = [...get().addons, newAddon];
    set({ addons: updated });
    saveAddons(updated);
    return newAddon;
  },

  removeAddon(id: string) {
    const updated = get().addons.filter((a) => a.id !== id);
    set({ addons: updated });
    saveAddons(updated);
  },

  toggleAddon(id: string, enabled?: boolean) {
    const updated = get().addons.map((a) => (a.id === id ? { ...a, enabled: enabled ?? !a.enabled } : a));
    set({ addons: updated });
    saveAddons(updated);
  },

  setTier(id: string, tier: AddonTier) {
    const updated = get().addons.map((a) => (a.id === id ? { ...a, tier } : a));
    set({ addons: updated });
    saveAddons(updated);
  },

  setUpgradeState(state) {
    set({ upgradeState: state });
  },

  clearUpgrade() {
    set({ upgradeState: null });
  },

  getEnabledAddons() {
    return get().addons.filter((a) => a.enabled);
  },
}));
