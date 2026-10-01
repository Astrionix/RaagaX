/**
 * Fast client-side image color extractor that extracts 4 vibrant harmonic
 * dominant colors from album artwork using an offscreen canvas.
 */
import { MeshGradientResult, getMeshGradient } from "./mesh-gradient";

const paletteCache = new Map<string, MeshGradientResult>();

export function extractPaletteFromImage(
  imageUrl: string,
  fallbackSeed: string = "raaga"
): Promise<MeshGradientResult> {
  if (paletteCache.has(imageUrl)) {
    return Promise.resolve(paletteCache.get(imageUrl)!);
  }

  return new Promise((resolve) => {
    const fallback = getMeshGradient(fallbackSeed);
    if (typeof window === "undefined") {
      resolve(fallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    const timeout = setTimeout(() => {
      resolve(fallback);
    }, 1500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(fallback);
          return;
        }

        const size = 32;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;

        // Sample 4 distinct quadrant regions of the image to get spatial color variety
        const quadrants = [
          { x: 4, y: 4, w: 12, h: 12 },   // Top Left (often sky/ambient)
          { x: 16, y: 4, w: 12, h: 12 },  // Top Right
          { x: 16, y: 16, w: 12, h: 12 }, // Bottom Right
          { x: 4, y: 16, w: 12, h: 12 },  // Bottom Left (often ground/water/body)
        ];

        const colors: [string, string, string, string] = ["", "", "", ""];

        for (let q = 0; q < 4; q++) {
          const { x: qx, y: qy, w: qw, h: qh } = quadrants[q];
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let count = 0;

          for (let y = qy; y < qy + qh; y++) {
            for (let x = qx; x < qx + qw; x++) {
              const idx = (y * size + x) * 4;
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              const a = imgData[idx + 3];

              if (a > 128) {
                rSum += r;
                gSum += g;
                bSum += b;
                count++;
              }
            }
          }

          if (count > 0) {
            const r = Math.round(rSum / count);
            const g = Math.round(gSum / count);
            const b = Math.round(bSum / count);

            // Boost saturation and clamp luminance for rich, radiant liquid lighting
            const tuned = tuneColor(r, g, b);
            colors[q] = tuned;
          } else {
            colors[q] = fallback.colors[q];
          }
        }

        const res: MeshGradientResult = {
          background: `
            radial-gradient(at 20% 25%, ${colors[0]}B3 0px, transparent 65%),
            radial-gradient(at 80% 20%, ${colors[1]}99 0px, transparent 65%),
            radial-gradient(at 75% 80%, ${colors[2]}99 0px, transparent 65%),
            radial-gradient(at 25% 75%, ${colors[3]}80 0px, transparent 65%),
            #070709
          `,
          primaryColor: colors[0],
          secondaryColor: colors[1],
          accentColor: colors[2],
          fourthColor: colors[3],
          baseColor: "#070709",
          colors,
        };

        paletteCache.set(imageUrl, res);
        resolve(res);
      } catch {
        // CORS or security error fallback
        resolve(fallback);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(fallback);
    };

    img.src = imageUrl;
  });
}

function tuneColor(r: number, g: number, b: number): string {
  // Convert RGB to HSL
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Boost saturation for vivid, luminous ambient light (match Raaga mobile s * 1.35)
  s = Math.min(1.0, Math.max(0.6, s * 1.35));
  // Clamp lightness so it's never pitch black or blown out white (34% - 56%)
  l = Math.min(0.56, Math.max(0.34, l));

  // Convert back to RGB Hex
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rFinal = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const gFinal = Math.round(hue2rgb(p, q, h) * 255);
  const bFinal = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${((1 << 24) + (rFinal << 16) + (gFinal << 8) + bFinal).toString(16).slice(1)}`;
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
