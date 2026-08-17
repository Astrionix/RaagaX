'use client';

export interface ChameleonPalette {
  primary: string;
  secondary: string;
  darkAmbient: string;
  glow: string;
}

const DEFAULT_PALETTE: ChameleonPalette = {
  primary: '#FA233B',
  secondary: '#8B5CF6',
  darkAmbient: '#07090E',
  glow: 'rgba(250, 35, 59, 0.25)',
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

    if (paletteCache.has(imageUrl)) {
      return paletteCache.get(imageUrl)!;
    }

    try {
      const palette = await this.processImage(imageUrl);
      paletteCache.set(imageUrl, palette);
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
      }, 1500);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(DEFAULT_PALETTE);
            return;
          }

          ctx.drawImage(img, 0, 0, 32, 32);
          const imageData = ctx.getImageData(0, 0, 32, 32).data;
          
          let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;
          let maxSat = -1, maxSatR = 250, maxSatG = 35, maxSatB = 59;

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

            // Calculate saturation
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;

            if (sat > maxSat && max > 60 && min < 220) {
              maxSat = sat;
              maxSatR = r;
              maxSatG = g;
              maxSatB = b;
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
          const secondary = `rgb(${Math.min(255, avgR + 30)}, ${Math.max(0, avgG - 20)}, ${Math.min(255, avgB + 40)})`;
          const darkAmbient = `rgb(${Math.max(5, Math.floor(avgR * 0.15))}, ${Math.max(7, Math.floor(avgG * 0.15))}, ${Math.max(12, Math.floor(avgB * 0.2))})`;
          const glow = `rgba(${maxSatR}, ${maxSatG}, ${maxSatB}, 0.28)`;

          resolve({ primary, secondary, darkAmbient, glow });
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
