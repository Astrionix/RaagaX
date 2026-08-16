'use client';

/**
 * RemoteFeatureFlags — Client-side feature flag engine with safe local fallback.
 * Allows instant rollback of features without shipping a new APK.
 */

export interface FeatureFlags {
  newPlayerModal: boolean;
  smartQueueAutoplay: boolean;
  dualLyricsMode: boolean;
  deviceConnectV2: boolean;
  aiNaturalSearch: boolean;
  losslessAudioPreset: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  newPlayerModal: true,
  smartQueueAutoplay: true,
  dualLyricsMode: true,
  deviceConnectV2: true,
  aiNaturalSearch: true,
  losslessAudioPreset: true,
};

const STORAGE_KEY = 'raagax_feature_flags_override_v1';

export class RemoteFeatureFlags {
  private static instance: RemoteFeatureFlags;
  private flags: FeatureFlags = { ...DEFAULT_FLAGS };

  private constructor() {
    this.loadOverrides();
  }

  public static getInstance(): RemoteFeatureFlags {
    if (!RemoteFeatureFlags.instance) {
      RemoteFeatureFlags.instance = new RemoteFeatureFlags();
    }
    return RemoteFeatureFlags.instance;
  }

  private loadOverrides() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.flags = { ...DEFAULT_FLAGS, ...JSON.parse(raw) };
      }
    } catch {}
  }

  public isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag] ?? DEFAULT_FLAGS[flag];
  }

  public getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public setFlagOverride(flag: keyof FeatureFlags, value: boolean) {
    this.flags[flag] = value;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.flags));
      } catch {}
    }
  }

  public resetAllFlags() {
    this.flags = { ...DEFAULT_FLAGS };
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }
}
