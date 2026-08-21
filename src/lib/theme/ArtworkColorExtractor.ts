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
          let hasVibrant = false;

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

            // Track dominant saturated primary (e.g. deep burgundy, sapphire, emerald, amber)
            if (sat > 0.25) hasVibrant = true;

            if (sat > maxSat && max > 35 && min < 245) {
              secondSat = maxSat;
              secondR = maxSatR;
              secondG = maxSatG;
              secondB = maxSatB;

              maxSat = sat;
              maxSatR = r;
              maxSatG = g;
              maxSatB = b;
            } else if (sat > secondSat && max > 30) {
              secondSat = sat;
              secondR = r;
              secondG = g;
              secondB = b;
            }

            // Detect highlight color (warm or bright accent)
            if (max > 120 && sat > 0.35) {
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

          // Handle monochrome/dark covers gracefully (charcoal + subtle accent)
          if (!hasVibrant) {
            maxSatR = Math.max(25, Math.min(80, avgR));
            maxSatG = Math.max(25, Math.min(80, avgG));
            maxSatB = Math.max(30, Math.min(90, avgB));
            secondR = Math.max(15, Math.floor(maxSatR * 0.7));
            secondG = Math.max(15, Math.floor(maxSatG * 0.7));
            secondB = Math.max(20, Math.floor(maxSatB * 0.7));
            warmHighlightR = Math.min(180, Math.max(70, avgR + 30));
            warmHighlightG = Math.min(180, Math.max(70, avgG + 30));
            warmHighlightB = Math.min(190, Math.max(80, avgB + 40));
          }

          const primary = `rgb(${maxSatR}, ${maxSatG}, ${maxSatB})`;
          const secondary = `rgb(${secondR}, ${secondG}, ${secondB})`;
          const highlight = `rgb(${warmHighlightR}, ${warmHighlightG}, ${warmHighlightB})`;
          const accent = `rgb(${Math.min(255, maxSatR + 35)}, ${Math.min(255, maxSatG + 25)}, ${Math.min(255, maxSatB + 35)})`;
          const darkAmbient = `rgb(${Math.max(6, Math.floor(maxSatR * 0.12))}, ${Math.max(6, Math.floor(maxSatG * 0.10))}, ${Math.max(8, Math.floor(maxSatB * 0.15))})`;
          const glow = `rgba(${warmHighlightR}, ${warmHighlightG}, ${warmHighlightB}, 0.35)`;

          const gradientCss = `radial-gradient(circle at 50% 25%, rgba(${maxSatR}, ${maxSatG}, ${maxSatB}, 0.45) 0%, rgba(${secondR}, ${secondG}, ${secondB}, 0.28) 45%, rgba(${darkAmbient}, 0.95) 100%)`;
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
