import * as THREE from 'three';

export type PaletteName =
  | 'midnight-violet'
  | 'deep-ocean'
  | 'burgundy-rose'
  | 'emerald-noir'
  // Backward compatibility aliases
  | 'magenta'
  | 'blue'
  | 'amber'
  | 'emerald';

export interface FluidPaletteConfig {
  name: PaletteName;
  color1: THREE.Vector3; // Primary tone
  color2: THREE.Vector3; // Secondary tone
  color3: THREE.Vector3; // Vibrant highlight tone
  color4: THREE.Vector3; // Secondary accent depth
  colorBg: THREE.Vector3; // Deep dark base
  glowColor: string; // CSS ambient glow
  borderColor: string;
  rimColor: THREE.Vector3; // Soft specular rim
  roughness: number;
  metalness: number;
  displacementScale: number;
  noiseFrequency: number;
  fallbackCss: string;
}

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

export const FLUID_PALETTES: Record<PaletteName, FluidPaletteConfig> = {
  // ── Card 1: Midnight Violet (Favorites Mix) ──
  // Deep #24143D, #5B3A8C, #9B6BFF, Soft lavender highlights #D6C2FF
  'midnight-violet': {
    name: 'midnight-violet',
    color1: hexToVec3('#24143D'), // Deep
    color2: hexToVec3('#5B3A8C'), // Mid
    color3: hexToVec3('#9B6BFF'), // Vibrant Violet
    color4: hexToVec3('#3D1B5E'), // Subtle shadow depth
    colorBg: hexToVec3('#120721'), // Deep dark base
    glowColor: 'rgba(155, 107, 255, 0.28)',
    borderColor: 'rgba(155, 107, 255, 0.22)',
    rimColor: hexToVec3('#D6C2FF'), // Soft lavender highlight
    roughness: 0.14,
    metalness: 0.16,
    displacementScale: 0.44,
    noiseFrequency: 1.05,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #9B6BFF 0%, #5B3A8C 35%, transparent 65%), linear-gradient(135deg, #120721 0%, #24143D 45%, #5B3A8C 100%)',
  },

  // ── Card 2: Deep Ocean (Chill Mix) ──
  // #071E2F, #0B4F6C, #2389A8, Soft cyan highlights #7BE0FF
  'deep-ocean': {
    name: 'deep-ocean',
    color1: hexToVec3('#071E2F'), // Deep
    color2: hexToVec3('#0B4F6C'), // Mid
    color3: hexToVec3('#2389A8'), // Vibrant Ocean
    color4: hexToVec3('#041421'), // Base depth
    colorBg: hexToVec3('#030F18'), // Deep dark base
    glowColor: 'rgba(35, 137, 168, 0.28)',
    borderColor: 'rgba(35, 137, 168, 0.22)',
    rimColor: hexToVec3('#7BE0FF'), // Soft cyan highlight
    roughness: 0.12,
    metalness: 0.18,
    displacementScale: 0.46,
    noiseFrequency: 1.0,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #2389A8 0%, #0B4F6C 35%, transparent 65%), linear-gradient(135deg, #030F18 0%, #071E2F 45%, #0B4F6C 100%)',
  },

  // ── Card 3: Burgundy Rose (New Music Mix) ──
  // #2A101C, #68243F, #A84D6F, Soft rose highlights #FFA6C5
  'burgundy-rose': {
    name: 'burgundy-rose',
    color1: hexToVec3('#2A101C'), // Deep
    color2: hexToVec3('#68243F'), // Mid
    color3: hexToVec3('#A84D6F'), // Vibrant Burgundy
    color4: hexToVec3('#1F0813'), // Base depth
    colorBg: hexToVec3('#14040B'), // Deep dark base
    glowColor: 'rgba(168, 77, 111, 0.28)',
    borderColor: 'rgba(168, 77, 111, 0.22)',
    rimColor: hexToVec3('#FFA6C5'), // Soft rose highlight
    roughness: 0.13,
    metalness: 0.17,
    displacementScale: 0.45,
    noiseFrequency: 1.08,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #A84D6F 0%, #68243F 35%, transparent 65%), linear-gradient(135deg, #14040B 0%, #2A101C 45%, #68243F 100%)',
  },

  // ── Card 4: Emerald Noir (Discovery Mix) ──
  // #071F19, #145C4A, #299477, Soft mint highlights #80EED2
  'emerald-noir': {
    name: 'emerald-noir',
    color1: hexToVec3('#071F19'), // Deep
    color2: hexToVec3('#145C4A'), // Mid
    color3: hexToVec3('#299477'), // Vibrant Emerald
    color4: hexToVec3('#03120E'), // Base depth
    colorBg: hexToVec3('#020B08'), // Deep dark base
    glowColor: 'rgba(41, 148, 119, 0.28)',
    borderColor: 'rgba(41, 148, 119, 0.22)',
    rimColor: hexToVec3('#80EED2'), // Soft mint highlight
    roughness: 0.12,
    metalness: 0.16,
    displacementScale: 0.44,
    noiseFrequency: 1.1,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #299477 0%, #145C4A 35%, transparent 65%), linear-gradient(135deg, #020B08 0%, #071F19 45%, #145C4A 100%)',
  },

  // ── Aliases for backward compatibility ──
  magenta: {
    name: 'magenta',
    color1: hexToVec3('#24143D'),
    color2: hexToVec3('#5B3A8C'),
    color3: hexToVec3('#9B6BFF'),
    color4: hexToVec3('#3D1B5E'),
    colorBg: hexToVec3('#120721'),
    glowColor: 'rgba(155, 107, 255, 0.28)',
    borderColor: 'rgba(155, 107, 255, 0.22)',
    rimColor: hexToVec3('#D6C2FF'),
    roughness: 0.14,
    metalness: 0.16,
    displacementScale: 0.44,
    noiseFrequency: 1.05,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #9B6BFF 0%, #5B3A8C 35%, transparent 65%), linear-gradient(135deg, #120721 0%, #24143D 45%, #5B3A8C 100%)',
  },
  blue: {
    name: 'blue',
    color1: hexToVec3('#071E2F'),
    color2: hexToVec3('#0B4F6C'),
    color3: hexToVec3('#2389A8'),
    color4: hexToVec3('#041421'),
    colorBg: hexToVec3('#030F18'),
    glowColor: 'rgba(35, 137, 168, 0.28)',
    borderColor: 'rgba(35, 137, 168, 0.22)',
    rimColor: hexToVec3('#7BE0FF'),
    roughness: 0.12,
    metalness: 0.18,
    displacementScale: 0.46,
    noiseFrequency: 1.0,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #2389A8 0%, #0B4F6C 35%, transparent 65%), linear-gradient(135deg, #030F18 0%, #071E2F 45%, #0B4F6C 100%)',
  },
  amber: {
    name: 'amber',
    color1: hexToVec3('#2A101C'),
    color2: hexToVec3('#68243F'),
    color3: hexToVec3('#A84D6F'),
    color4: hexToVec3('#1F0813'),
    colorBg: hexToVec3('#14040B'),
    glowColor: 'rgba(168, 77, 111, 0.28)',
    borderColor: 'rgba(168, 77, 111, 0.22)',
    rimColor: hexToVec3('#FFA6C5'),
    roughness: 0.13,
    metalness: 0.17,
    displacementScale: 0.45,
    noiseFrequency: 1.08,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #A84D6F 0%, #68243F 35%, transparent 65%), linear-gradient(135deg, #14040B 0%, #2A101C 45%, #68243F 100%)',
  },
  emerald: {
    name: 'emerald',
    color1: hexToVec3('#071F19'),
    color2: hexToVec3('#145C4A'),
    color3: hexToVec3('#299477'),
    color4: hexToVec3('#03120E'),
    colorBg: hexToVec3('#020B08'),
    glowColor: 'rgba(41, 148, 119, 0.28)',
    borderColor: 'rgba(41, 148, 119, 0.22)',
    rimColor: hexToVec3('#80EED2'),
    roughness: 0.12,
    metalness: 0.16,
    displacementScale: 0.44,
    noiseFrequency: 1.1,
    fallbackCss: 'radial-gradient(circle at 80% 20%, #299477 0%, #145C4A 35%, transparent 65%), linear-gradient(135deg, #020B08 0%, #071F19 45%, #145C4A 100%)',
  },
};
