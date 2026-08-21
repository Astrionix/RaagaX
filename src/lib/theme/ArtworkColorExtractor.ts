'use client';

export interface ChameleonPalette {
  primary: string;
  secondary: string;
  highlight: string;
  accent: string;
  darkAmbient: string;
  glow: string;
  gradientCss: string;
  /** e.g. 'rgba(140,28,48,0.11)' — used to tint glass surfaces with the artwork color */
  refractionRgba: string;
}

const DEFAULT_PALETTE: ChameleonPalette = {
  primary: 'rgb(140, 28, 48)',
  secondary: 'rgb(85, 30, 25)',
  highlight: 'rgb(215, 75, 45)',
  accent: 'rgb(250, 35, 59)',
  darkAmbient: 'rgb(14, 8, 10)',
  glow: 'rgba(215, 75, 45, 0.35)',
  refractionRgba: 'rgba(140, 28, 48, 0.10)',
  gradientCss: 'radial-gradient(circle at 50% 20%, rgba(140, 28, 48, 0.45) 0%, rgba(85, 30, 25, 0.3) 50%, rgba(6, 7, 10, 0.95) 100%)',
};


const paletteCache = new Map<string, ChameleonPalette>();

export class ArtworkColorExtractor {
  private static instance: ArtworkColorExtractor;

  private constructor() {}

  public static getInstance(): ArtworkColorExtractor {
    if (!ArtworkColorExtractor.instance) {
      ArtworkColorExtractor.instance = new ArtworkColorExtractor();
    }
    return ArtworkColorExtractor.instance;
  }

  public async extractPalette(imageUrl?: string | null): Promise<ChameleonPalette> {
    if (!imageUrl || typeof window === 'undefined') {
      return DEFAULT_PALETTE;
    }

    // Clean URL for cache key
    const cleanUrl = imageUrl.trim();
    if (paletteCache.has(cleanUrl)) {
      return paletteCache.get(cleanUrl)!;
    }

    try {
      const palette = await this.processImage(cleanUrl);
      paletteCache.set(cleanUrl, palette);
      return palette;
    } catch {
      return DEFAULT_PALETTE;
    }
  }

  public applyToDocument(palette: ChameleonPalette) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--chameleon-primary', palette.primary);
    root.style.setProperty('--chameleon-secondary', palette.secondary);
    root.style.setProperty('--chameleon-highlight', palette.highlight);
    root.style.setProperty('--chameleon-accent', palette.accent);
    root.style.setProperty('--chameleon-dark', palette.darkAmbient);
    root.style.setProperty('--chameleon-glow', palette.glow);
  }

  private processImage(url: string): Promise<ChameleonPalette> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';

      const timeout = setTimeout(() => {
        resolve(DEFAULT_PALETTE);
      }, 2000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 36;
          canvas.height = 36;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(DEFAULT_PALETTE);
            return;
          }

          ctx.drawImage(img, 0, 0, 36, 36);
          const imageData = ctx.getImageData(0, 0, 36, 36).data;

          let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
          let maxSat = -1;
          let maxSatR = 140, maxSatG = 28, maxSatB = 48;
          let secondSat = -1;
          let secondR = 85, secondG = 30, secondB = 25;
          let warmHighlightR = 215, warmHighlightG = 75, warmHighlightB = 45;

          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];

            if (a < 128) continue;

            rTotal += r;
            gTotal += g;
            bTotal += b;
            count++;

            // Calculate saturation and brightness
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const sat = max === 0 ? 0 : delta / max;

            // Track dominant saturated primary (e.g. deep burgundy / crimson / sapphire)
            if (sat > maxSat && max > 40 && min < 240) {
              secondSat = maxSat;
              secondR = maxSatR;
              secondG = maxSatG;
              secondB = maxSatB;

              maxSat = sat;
              maxSatR = r;
              maxSatG = g;
              maxSatB = b;
            } else if (sat > secondSat && max > 35) {
              secondSat = sat;
              secondR = r;
              secondG = g;
              secondB = b;
            }

            // Detect warm golden/orange/crimson highlights
            if (r > 130 && r > b * 1.3 && sat > 0.4) {
              warmHighlightR = r;
              warmHighlightG = g;
              warmHighlightB = b;
            }
          }

          if (count === 0) {
            resolve(DEFAULT_PALETTE);
            return;
          }

          const avgR = Math.round(rTotal / count);
          const avgG = Math.round(gTotal / count);
          const avgB = Math.round(bTotal / count);

          const primary = `rgb(${maxSatR}, ${maxSatG}, ${maxSatB})`;
          const secondary = `rgb(${secondR}, ${secondG}, ${secondB})`;
          const highlight = `rgb(${warmHighlightR}, ${warmHighlightG}, ${warmHighlightB})`;
          const accent = `rgb(${Math.min(255, avgR + 40)}, ${Math.max(0, avgG - 20)}, ${Math.min(255, avgB + 50)})`;
          const darkAmbient = `rgb(${Math.max(6, Math.floor(avgR * 0.15))}, ${Math.max(6, Math.floor(avgG * 0.12))}, ${Math.max(10, Math.floor(avgB * 0.18))})`;
          const glow = `rgba(${warmHighlightR}, ${warmHighlightG}, ${warmHighlightB}, 0.35)`;

          const gradientCss = `radial-gradient(circle at 50% 25%, rgba(${maxSatR}, ${maxSatG}, ${maxSatB}, 0.45) 0%, rgba(${secondR}, ${secondG}, ${secondB}, 0.28) 45%, rgba(${darkAmbient}, 0.95) 100%)`;
          // refractionRgba: very low opacity tint injected into glass surfaces
          const refractionRgba = `rgba(${maxSatR}, ${maxSatG}, ${maxSatB}, 0.10)`;

          resolve({
            primary,
            secondary,
            highlight,
            accent,
            darkAmbient,
            glow,
            refractionRgba,
            gradientCss,
          });
        } catch {
          resolve(DEFAULT_PALETTE);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(DEFAULT_PALETTE);
      };

      img.src = url;
    });
  }
}
