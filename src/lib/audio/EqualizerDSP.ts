'use client';

export interface EqualizerBand {
  frequency: number;
  label: string;
  gain: number; // -12 to +12 dB
}

export type EqualizerPreset = 
  | 'flat' 
  | 'bass_boost' 
  | 'vocal_clarity' 
  | 'rock' 
  | 'pop' 
  | 'electronic' 
  | 'acoustic' 
  | 'classical' 
  | 'hip_hop' 
  | 'custom';

export interface EqualizerSettings {
  isEnabled: boolean;
  preset: EqualizerPreset;
  bands: EqualizerBand[];
  bassBoost: number; // 0 to 100
  virtualizer: boolean;
  virtualizerIntensity: number; // 0 to 100
  loudnessNormalization: boolean;
}

export const DEFAULT_EQ_BANDS: EqualizerBand[] = [
  { frequency: 32, label: '32Hz', gain: 0 },
  { frequency: 64, label: '64Hz', gain: 0 },
  { frequency: 125, label: '125Hz', gain: 0 },
  { frequency: 250, label: '250Hz', gain: 0 },
  { frequency: 500, label: '500Hz', gain: 0 },
  { frequency: 1000, label: '1kHz', gain: 0 },
  { frequency: 2000, label: '2kHz', gain: 0 },
  { frequency: 4000, label: '4kHz', gain: 0 },
  { frequency: 8000, label: '8kHz', gain: 0 },
  { frequency: 16000, label: '16kHz', gain: 0 },
];

export const PRESET_GAINS: Record<EqualizerPreset, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass_boost: [6, 5.5, 4, 2, 0, 0, 0, 0.5, 1, 1.5],
  vocal_clarity: [-2, -1, 0, 1.5, 3.5, 4.5, 3.5, 2, 1, 0],
  rock: [4.5, 3.5, 2, -1, -2, -1, 1.5, 3, 4, 4.5],
  pop: [-1.5, -0.5, 1.5, 3, 4, 3, 1.5, 0, -1, -1.5],
  electronic: [5, 4.5, 2, 0, -1.5, 2, 1, 3, 4.5, 5],
  acoustic: [3, 2, 1, 1, 2, 2.5, 3, 3.5, 3, 2.5],
  classical: [4, 3, 2, 1.5, -1, -1, 0, 2, 3, 3.5],
  hip_hop: [6, 5, 3, 1, -1, -0.5, 1, 2, 3.5, 4],
  custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const STORAGE_KEY = 'raagax_equalizer_settings_v1';

export class EqualizerDSP {
  private static instance: EqualizerDSP;
  private settings: EqualizerSettings;
  private listeners = new Set<(settings: EqualizerSettings) => void>();

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): EqualizerDSP {
    if (!EqualizerDSP.instance) {
      EqualizerDSP.instance = new EqualizerDSP();
    }
    return EqualizerDSP.instance;
  }

  public getSettings(): EqualizerSettings {
    return { ...this.settings, bands: this.settings.bands.map(b => ({ ...b })) };
  }

  public setEnabled(enabled: boolean) {
    this.settings.isEnabled = enabled;
    this.saveSettings();
  }

  public setPreset(preset: EqualizerPreset) {
    this.settings.preset = preset;
    if (preset !== 'custom') {
      const gains = PRESET_GAINS[preset];
      this.settings.bands = this.settings.bands.map((band, idx) => ({
        ...band,
        gain: gains[idx] ?? 0,
      }));
    }
    this.saveSettings();
  }

  public setBandGain(frequency: number, gain: number) {
    const clampedGain = Math.max(-12, Math.min(12, Math.round(gain * 10) / 10));
    this.settings.bands = this.settings.bands.map(b => 
      b.frequency === frequency ? { ...b, gain: clampedGain } : b
    );
    this.settings.preset = 'custom';
    this.saveSettings();
  }

  public setBassBoost(value: number) {
    this.settings.bassBoost = Math.max(0, Math.min(100, value));
    this.saveSettings();
  }

  public setVirtualizer(enabled: boolean, intensity: number = 75) {
    this.settings.virtualizer = enabled;
    this.settings.virtualizerIntensity = Math.max(0, Math.min(100, intensity));
    this.saveSettings();
  }

  public setLoudnessNormalization(enabled: boolean) {
    this.settings.loudnessNormalization = enabled;
    this.saveSettings();
  }

  public resetToDefault() {
    this.settings = {
      isEnabled: true,
      preset: 'flat',
      bands: DEFAULT_EQ_BANDS.map(b => ({ ...b })),
      bassBoost: 25,
      virtualizer: true,
      virtualizerIntensity: 70,
      loudnessNormalization: true,
    };
    this.saveSettings();
  }

  public subscribe(listener: (settings: EqualizerSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const current = this.getSettings();
    this.listeners.forEach(l => {
      try { l(current); } catch {}
    });
  }

  private loadSettings(): EqualizerSettings {
    if (typeof window === 'undefined') {
      return {
        isEnabled: true,
        preset: 'flat',
        bands: DEFAULT_EQ_BANDS.map(b => ({ ...b })),
        bassBoost: 20,
        virtualizer: true,
        virtualizerIntensity: 65,
        loudnessNormalization: true,
      };
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          isEnabled: parsed.isEnabled ?? true,
          preset: parsed.preset || 'flat',
          bands: Array.isArray(parsed.bands) && parsed.bands.length === 10 ? parsed.bands : DEFAULT_EQ_BANDS,
          bassBoost: parsed.bassBoost ?? 20,
          virtualizer: parsed.virtualizer ?? true,
          virtualizerIntensity: parsed.virtualizerIntensity ?? 65,
          loudnessNormalization: parsed.loudnessNormalization ?? true,
        };
      }
    } catch {}

    return {
      isEnabled: true,
      preset: 'flat',
      bands: DEFAULT_EQ_BANDS.map(b => ({ ...b })),
      bassBoost: 20,
      virtualizer: true,
      virtualizerIntensity: 65,
      loudnessNormalization: true,
    };
  }

  private saveSettings() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {}
    }
    this.notify();
  }
}
