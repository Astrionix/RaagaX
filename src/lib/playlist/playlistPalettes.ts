/**
 * Playlist Palette System
 * Harmonious, curated color palettes for generative playlist covers.
 * Designed to feel like high-end modern streaming products (Apple Music / Spotify).
 */

export interface PlaylistPalette {
  id: string;
  name: string;
  family: 'red-rose' | 'aurora' | 'neon-lime' | 'sunset' | 'ocean' | 'violet' | 'fire' | 'emerald' | 'cyber-pink' | 'golden-hour' | 'celestial';
  darkBase: string; // Dark atmospheric base color
  primaryHex: string;
  accentHex: string;
  whiteGlowHex?: string;
  colors: [number, number, number][]; // 4 RGB nodes [r, g, b]
  highlightColor?: [number, number, number];
}

export const PLAYLIST_PALETTES: PlaylistPalette[] = [
  // 1. Red Rose + White (Deep Burgundy, Dark Rose, Crimson, Rose Red, Hot Rose, Glowing White Highlight)
  {
    id: 'red-rose',
    name: 'Velvet Rose',
    family: 'red-rose',
    darkBase: '#3A0010',
    primaryHex: '#A9002D',
    accentHex: '#F02B5B',
    whiteGlowHex: '#FFFFFF',
    colors: [
      [212, 20, 69],    // Rose Red (#D41445)
      [169, 0, 45],     // Crimson (#A9002D)
      [240, 43, 91],    // Hot Rose (#F02B5B)
      [112, 0, 24],     // Dark Rose (#700018)
    ],
    highlightColor: [255, 255, 255], // White Glow (#FFFFFF)
  },
  // 2. Aurora (Cyan, Blue, Purple, Deep Indigo)
  {
    id: 'aurora',
    name: 'Nordic Aurora',
    family: 'aurora',
    darkBase: '#040814',
    primaryHex: '#00F5D4',
    accentHex: '#8338EC',
    colors: [
      [0, 245, 212],    // Electric Mint Cyan
      [0, 187, 249],    // Azure Blue
      [131, 56, 236],   // Royal Purple
      [14, 25, 60],     // Deep Midnight
    ],
  },
  // 2. Neon Lime (Lime, Emerald, Cyan, Deep Black)
  {
    id: 'neon-lime',
    name: 'Cyber Lime',
    family: 'neon-lime',
    darkBase: '#030D06',
    primaryHex: '#A6FF00',
    accentHex: '#00E676',
    colors: [
      [166, 255, 0],    // Vivid Laser Lime
      [0, 230, 118],    // Neon Emerald
      [0, 210, 255],    // Hyper Cyan
      [5, 45, 20],      // Forest Abyss
    ],
  },
  // 3. Sunset (Orange, Pink, Magenta, Purple)
  {
    id: 'sunset',
    name: 'Pacific Sunset',
    family: 'sunset',
    darkBase: '#10050D',
    primaryHex: '#FF5E36',
    accentHex: '#FF007A',
    colors: [
      [255, 94, 54],    // Fire Orange
      [255, 0, 122],    // Hot Pink / Fuchsia
      [142, 36, 170],   // Deep Magenta
      [45, 10, 50],     // Twilight Plum
    ],
  },
  // 4. Ocean (Cyan, Teal, Sapphire, Navy)
  {
    id: 'ocean',
    name: 'Bioluminescent Ocean',
    family: 'ocean',
    darkBase: '#020C18',
    primaryHex: '#00E5FF',
    accentHex: '#0077B6',
    colors: [
      [0, 229, 255],    // Neon Cyan
      [0, 180, 216],    // Marine Teal
      [0, 119, 182],    // Deep Sapphire
      [3, 25, 55],      // Midnight Navy
    ],
  },
  // 5. Violet (Electric Violet, Magenta, Indigo, Deep Void)
  {
    id: 'violet',
    name: 'Ultraviolet Dream',
    family: 'violet',
    darkBase: '#0B0414',
    primaryHex: '#9D4EDD',
    accentHex: '#E01A8A',
    colors: [
      [157, 78, 221],   // Electric Violet
      [224, 26, 138],   // Neon Orchid
      [90, 24, 154],    // Royal Indigo
      [20, 8, 45],      // Cosmic Shadow
    ],
  },
  // 6. Fire (Red, Orange, Amber, Deep Purple)
  {
    id: 'fire',
    name: 'Solar Flare',
    family: 'fire',
    darkBase: '#120208',
    primaryHex: '#FF7700',
    accentHex: '#FF0054',
    colors: [
      [255, 119, 0],    // Solar Amber
      [255, 0, 84],     // Crimson Blaze
      [158, 0, 89],     // Dark Magenta Flare
      [40, 5, 20],      // Deep Charcoal Ember
    ],
  },
  // 7. Emerald (Mint, Emerald, Teal, Pitch)
  {
    id: 'emerald',
    name: 'Jade Forest',
    family: 'emerald',
    darkBase: '#020D0C',
    primaryHex: '#2EC4B6',
    accentHex: '#06D6A0',
    colors: [
      [46, 196, 182],   // Mint Glow
      [6, 214, 160],    // Emerald Light
      [11, 82, 91],     // Forest Teal
      [4, 30, 32],      // Deep Jade
    ],
  },
  // 8. Cyber Pink (Hot Pink, Cyan Spark, Violet, Charcoal)
  {
    id: 'cyber-pink',
    name: 'Neon Tokyo',
    family: 'cyber-pink',
    darkBase: '#0B0312',
    primaryHex: '#FF007F',
    accentHex: '#00F0FF',
    colors: [
      [255, 0, 127],    // Electric Rose
      [0, 240, 255],    // Neon Cyan
      [114, 9, 183],    // Laser Purple
      [18, 6, 35],      // Cyber Abyss
    ],
  },
  // 9. Golden Hour (Warm Gold, Coral, Dusky Plum, Dark Bronze)
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    family: 'golden-hour',
    darkBase: '#120803',
    primaryHex: '#FFB703',
    accentHex: '#FB8500',
    colors: [
      [255, 183, 3],    // Warm Amber Gold
      [251, 133, 0],    // Coral Sunset
      [186, 24, 27],    // Ruby Velvet
      [35, 15, 6],      // Rich Sepia
    ],
  },
  // 10. Celestial (Starlight Lavender, Periwinkle, Space Indigo)
  {
    id: 'celestial',
    name: 'Celestial Cosmos',
    family: 'celestial',
    darkBase: '#060412',
    primaryHex: '#B8C0FF',
    accentHex: '#7066E0',
    colors: [
      [184, 192, 255],  // Starlight Lavender
      [112, 102, 224],  // Neon Periwinkle
      [60, 9, 108],     // Deep Galaxy Violet
      [10, 6, 30],      // Void Navy
    ],
  },
];
