import { useEffect, useState } from 'react';
import { artworkAtPixels } from './artwork';

export interface ArtworkColor {
  /** The background colour behind the page ("joe colour", report §3). */
  background: string;
  /** Whether text on it should be light (a dark colour) or dark. */
  dark: boolean;
}

const cache = new Map<string, ArtworkColor>();

interface HueBucket {
  count: number;
  weight: number;
  rSum: number;
  gSum: number;
  bSum: number;
}

/**
 * Extracts the true dominant chromatic colour of album/single artwork using
 * hue-clustering, preserving vibrant hues while ensuring dark-theme legibility.
 * YouTube's image hosts send `Access-Control-Allow-Origin: *`, so the canvas
 * stays readable without the extension.
 */
async function measure(url: string): Promise<ArtworkColor> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.referrerPolicy = 'no-referrer';
  image.decoding = 'async';
  // 60px: a size YouTube's pages request, so the CDN has it cached (lib/artwork.ts).
  image.src = artworkAtPixels(url, 60);
  await image.decode();
  const side = 16;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, side, side);
  const { data } = context.getImageData(0, 0, side, side);

  const buckets: HueBucket[] = Array.from({ length: 12 }, () => ({
    count: 0,
    weight: 0,
    rSum: 0,
    gSum: 0,
    bSum: 0,
  }));

  let totalSampled = 0;
  let chromaticCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]! / 255;
    const g = data[i + 1]! / 255;
    const b = data[i + 2]! / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = max === min ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);

    totalSampled++;
    // Discard near-black noise, blown-out highlights, and low-saturation grays
    if (l < 0.08 || l > 0.94 || s < 0.13) continue;

    let h = 0;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / d + 2) * 60;
    } else {
      h = ((r - g) / d + 4) * 60;
    }

    const bin = Math.min(11, Math.max(0, Math.floor((((h % 360) + 360) % 360) / 30)));
    const lumWeight = 1.0 - Math.abs(l - 0.5) * 0.7;
    const w = s * Math.max(0.2, lumWeight);

    const bucket = buckets[bin]!;
    bucket.count++;
    bucket.weight += w;
    bucket.rSum += r;
    bucket.gSum += g;
    bucket.bSum += b;
    chromaticCount++;
  }

  const hasColor = chromaticCount >= totalSampled * 0.05;
  if (!hasColor || chromaticCount === 0) {
    // Pure neutral monochrome dark background
    return { background: 'rgb(18, 20, 26)', dark: true };
  }

  const bestBucket = buckets
    .filter((b) => b.count > 0)
    .sort((a, b) => b.weight - a.weight)[0];

  if (!bestBucket) {
    return { background: 'rgb(18, 20, 26)', dark: true };
  }

  const rawR = bestBucket.rSum / bestBucket.count;
  const rawG = bestBucket.gSum / bestBucket.count;
  const rawB = bestBucket.bSum / bestBucket.count;

  // Adapt for dark mode wash (matching Apple Music / Compose lightness 0.13 - 0.18)
  const currentMax = Math.max(rawR, rawG, rawB);
  const targetMax = 0.38;
  const factor = currentMax > 0 ? targetMax / currentMax : 1;

  const finalR = Math.round(Math.min(255, Math.max(12, rawR * factor * 255)));
  const finalG = Math.round(Math.min(255, Math.max(12, rawG * factor * 255)));
  const finalB = Math.round(Math.min(255, Math.max(12, rawB * factor * 255)));

  return { background: `rgb(${finalR}, ${finalG}, ${finalB})`, dark: true };
}

export function useArtworkColor(url: string | null | undefined): ArtworkColor | null {
  const [color, setColor] = useState<ArtworkColor | null>(() => (url ? cache.get(url) ?? null : null));
  useEffect(() => {
    if (!url) return setColor(null);
    const known = cache.get(url);
    if (known) return setColor(known);
    let live = true;
    measure(url)
      .then((measured) => {
        cache.set(url, measured);
        if (live) setColor(measured);
      })
      .catch(() => {
        // An unreadable image leaves the page in its normal colours.
      });
    return () => {
      live = false;
    };
  }, [url]);
  return color;
}
