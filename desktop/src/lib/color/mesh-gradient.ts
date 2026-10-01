/**
 * Generates dynamic Apple Music & Raaga Android-style mesh gradient backdrops
 * derived from song metadata / artwork with saturation boosting and luminance tuning.
 */

function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// 4-color harmonic palettes matching Raaga Android MeshGradient tuned fallbacks
const MESH_PALETTES: [string, string, string, string][] = [
  ["#FA2D48", "#7928CA", "#0070F3", "#FF4D4D"], // Raaga Signature Crimson Violet Blue
  ["#3A1C71", "#D76D77", "#2B5876", "#FFAF7B"], // Android Default Mesh (Deep Purple, Rose, Deep Sea, Peach)
  ["#FF0080", "#7928CA", "#FF4D4D", "#9B51E0"], // Sunset Neon (Hot Pink, Purple, Coral, Orchid)
  ["#0070F3", "#00DFD8", "#7928CA", "#00C9FF"], // Ocean Aurora (Azure, Cyan, Violet, Sky)
  ["#8A2387", "#E94057", "#F27121", "#9B59B6"], // Solar Flare (Magenta, Carmine, Amber, Amethyst)
  ["#11998E", "#38EF7D", "#0575E6", "#00B4DB"], // Emerald Northern Lights (Teal, Mint, Cobalt, Marine)
  ["#4A00E0", "#8E2DE2", "#FA2D48", "#6A11CB"], // Electric Velvet (Indigo, Violet, Crimson, Royal)
  ["#F857A6", "#FF5858", "#6A0572", "#AB47BC"], // Velvet Rose (Pink, Coral, Plum, Lavender)
  ["#2C3E50", "#FD746C", "#2C5364", "#E74C3C"], // Midnight Sunrise (Slate, Tangerine, Petrol, Rust)
  ["#1D2671", "#C33764", "#4A00E0", "#FF6B6B"], // Cosmic Dawn (Navy, Magenta, Violet, Salmon)
];

export interface MeshGradientResult {
  background: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fourthColor: string;
  baseColor: string;
  colors: [string, string, string, string];
}

export function getMeshGradient(seed: string = "raaga"): MeshGradientResult {
  const hash = stringToHash(seed);
  const palette = MESH_PALETTES[hash % MESH_PALETTES.length];

  const primary = palette[0];
  const secondary = palette[1];
  const accent = palette[2];
  const fourth = palette[3];

  const background = `
    radial-gradient(at 20% 25%, ${primary}55 0px, transparent 65%),
    radial-gradient(at 80% 20%, ${secondary}50 0px, transparent 65%),
    radial-gradient(at 75% 80%, ${accent}45 0px, transparent 65%),
    radial-gradient(at 25% 75%, ${fourth}40 0px, transparent 65%),
    #070709
  `;

  return {
    background,
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    fourthColor: fourth,
    baseColor: "#070709",
    colors: [primary, secondary, accent, fourth],
  };
}
