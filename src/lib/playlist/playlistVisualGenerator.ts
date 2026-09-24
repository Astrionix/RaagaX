import { PLAYLIST_PALETTES, PlaylistPalette } from './playlistPalettes';

export interface VisualKineticNode {
  baseX: number;
  baseY: number;
  radius: number;
  speedX: number;
  speedY: number;
  phaseX: number;
  phaseY: number;
  harmonics: number;
  color: [number, number, number];
  alpha: number;
}

export interface PlaylistVisualSpec {
  seed: number;
  palette: PlaylistPalette;
  style: 'aurora' | 'mesh' | 'drift' | 'pulse';
  animationSpeed: number;
  intensity: number;
  nodes: VisualKineticNode[];
  cssStaticGradient: string;
}

/**
 * 32-bit FNV-1a hash algorithm.
 * Guarantees that the exact same playlist ID always yields the exact same 32-bit integer.
 */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG (Pseudo-Random Number Generator).
 * Fast, high-entropy 32-bit pseudo-random sequence generator from a single seed.
 */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// In-memory LRU cache to make repeat calls instantaneous (0ms)
const visualCache = new Map<string, PlaylistVisualSpec>();

/**
 * Deterministically generates a unique, premium visual specification for any playlist.
 *
 * @param playlistId - Canonical playlist identifier
 * @param playlistTitle - Optional fallback title for supplemental entropy
 */
export function generatePlaylistVisual(
  playlistId: string,
  playlistTitle?: string
): PlaylistVisualSpec {
  const cacheKey = (playlistId || playlistTitle || 'default_playlist').trim();
  if (visualCache.has(cacheKey)) {
    return visualCache.get(cacheKey)!;
  }

  // Combine ID and title for maximum entropy if ID is generic
  const seedString = `${playlistId || ''}_${playlistTitle || ''}`;
  const seed = hashString(seedString || 'raagax_default_seed');
  const prng = createPrng(seed);

  // 1. Pick Palette Family deterministically
  const paletteIndex = Math.floor(prng() * PLAYLIST_PALETTES.length);
  const palette = PLAYLIST_PALETTES[paletteIndex] || PLAYLIST_PALETTES[0];

  // 2. Pick Animation Style
  const styles: PlaylistVisualSpec['style'][] = ['aurora', 'mesh', 'drift', 'pulse'];
  const style = styles[Math.floor(prng() * styles.length)];

  // 3. Cinematic Motion Factors (Slow, hypnotic, non-distracting)
  const animationSpeed = 0.28 + prng() * 0.18; // ~0.28 to 0.46
  const intensity = 0.75 + prng() * 0.15;      // ~0.75 to 0.90

  // 4. Generate 4 Unique Kinetic Nodes
  // Anchor positions spaced organically across the 4 quadrants with random jitter
  const quadrantAnchors = [
    { x: 0.28, y: 0.26 }, // Top-left
    { x: 0.74, y: 0.30 }, // Top-right
    { x: 0.50, y: 0.72 }, // Bottom-center
    { x: 0.22, y: 0.78 }, // Bottom-left accent
  ];

  const nodes: VisualKineticNode[] = quadrantAnchors.map((anchor, idx) => {
    const color = palette.colors[idx] || palette.colors[0];
    const jitterX = (prng() - 0.5) * 0.18;
    const jitterY = (prng() - 0.5) * 0.18;

    return {
      baseX: Math.max(0.12, Math.min(0.88, anchor.x + jitterX)),
      baseY: Math.max(0.12, Math.min(0.88, anchor.y + jitterY)),
      radius: 0.42 + prng() * 0.22, // 0.42 to 0.64
      speedX: (0.00035 + prng() * 0.00035) * (prng() > 0.5 ? 1 : -1),
      speedY: (0.00030 + prng() * 0.00035) * (prng() > 0.5 ? 1 : -1),
      phaseX: prng() * Math.PI * 2,
      phaseY: prng() * Math.PI * 2,
      harmonics: 0.35 + prng() * 0.35,
      color,
      alpha: 0.78 + prng() * 0.18,
    };
  });

  // Glowing white specular highlight node (smaller, localized highlight)
  if (palette.highlightColor) {
    const jitterX = (prng() - 0.5) * 0.12;
    const jitterY = (prng() - 0.5) * 0.12;
    nodes.push({
      baseX: Math.max(0.68, Math.min(0.92, 0.82 + jitterX)),
      baseY: Math.max(0.12, Math.min(0.36, 0.22 + jitterY)),
      radius: 0.26 + prng() * 0.08, // Glowing highlight without washing out the deep rose base
      speedX: (0.00025 + prng() * 0.0002) * (prng() > 0.5 ? 1 : -1),
      speedY: (0.00025 + prng() * 0.0002) * (prng() > 0.5 ? 1 : -1),
      phaseX: prng() * Math.PI * 2,
      phaseY: prng() * Math.PI * 2,
      harmonics: 0.45,
      color: palette.highlightColor,
      alpha: 0.82 + prng() * 0.12,
    });
  }

  // 5. CSS Fallback Static Multi-Stop Radial Gradient
  let cssStaticGradient: string;
  if (palette.id === 'red-rose') {
    cssStaticGradient =
      'radial-gradient(circle at 85% 20%, #FFFFFF 0%, #FFD1DC 12%, transparent 42%), radial-gradient(circle at 25% 30%, #D41445 0%, #A9002D 35%, transparent 65%), radial-gradient(circle at 70% 75%, #F02B5B 0%, #700018 45%, transparent 75%), linear-gradient(135deg, #3A0010 0%, #A9002D 45%, #F02B5B 70%, #FFFFFF 100%)';
  } else {
    const c0 = `rgb(${palette.colors[0].join(',')})`;
    const c1 = `rgb(${palette.colors[1].join(',')})`;
    const c2 = `rgb(${palette.colors[2].join(',')})`;
    const c3 = `rgb(${palette.colors[3].join(',')})`;
    cssStaticGradient = `radial-gradient(circle at 75% 25%, ${c0} 0%, transparent 55%), radial-gradient(circle at 25% 35%, ${c1} 0%, transparent 60%), radial-gradient(circle at 50% 80%, ${c2} 0%, transparent 65%), linear-gradient(135deg, ${palette.darkBase} 0%, ${c3} 100%)`;
  }

  const spec: PlaylistVisualSpec = {
    seed,
    palette,
    style,
    animationSpeed,
    intensity,
    nodes,
    cssStaticGradient,
  };

  visualCache.set(cacheKey, spec);
  return spec;
}
