import * as THREE from 'three';

export type PaletteName = 'magenta' | 'blue' | 'amber' | 'emerald';

export interface FluidPaletteConfig {
  name: PaletteName;
  color1: THREE.Vector3; // Primary vibrant
  color2: THREE.Vector3; // Secondary warm/cool
  color3: THREE.Vector3; // Tertiary highlight
  color4: THREE.Vector3; // Accent depth
  colorBg: THREE.Vector3; // Deep dark base
  glowColor: string; // CSS ambient glow
  borderColor: string;
  rimColor: THREE.Vector3;
  roughness: number;
  metalness: number;
  displacementScale: number;
  noiseFrequency: number;
}

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

export const FLUID_PALETTES: Record<PaletteName, FluidPaletteConfig> = {
  magenta: {
    name: 'magenta',
    color1: hexToVec3('#FF0066'), // Vivid Magenta
    color2: hexToVec3('#FF3388'), // Soft Warm Pink
    color3: hexToVec3('#FF6600'), // Fiery Coral
    color4: hexToVec3('#FFCC00'), // Bright Warm Accent
    colorBg: hexToVec3('#14000B'), // Deep Wine Base
    glowColor: 'rgba(255, 0, 102, 0.4)',
    borderColor: 'rgba(255, 102, 0, 0.3)',
    rimColor: hexToVec3('#FFB3E6'),
    roughness: 0.12,
    metalness: 0.15,
    displacementScale: 0.48,
    noiseFrequency: 1.1,
  },
  blue: {
    name: 'blue',
    color1: hexToVec3('#0055FF'), // Electric Blue
    color2: hexToVec3('#8800FF'), // Rich Violet
    color3: hexToVec3('#00F0FF'), // Neon Cyan
    color4: hexToVec3('#330099'), // Deep Indigo
    colorBg: hexToVec3('#020518'), // Midnight Slate Base
    glowColor: 'rgba(0, 140, 255, 0.4)',
    borderColor: 'rgba(0, 240, 255, 0.3)',
    rimColor: hexToVec3('#B3F5FF'),
    roughness: 0.1,
    metalness: 0.18,
    displacementScale: 0.5,
    noiseFrequency: 1.0,
  },
  amber: {
    name: 'amber',
    color1: hexToVec3('#FF7700'), // Molten Amber
    color2: hexToVec3('#FF2200'), // Fiery Red Orange
    color3: hexToVec3('#FFCC00'), // Pure Liquid Gold
    color4: hexToVec3('#441100'), // Deep Caramel Depth
    colorBg: hexToVec3('#180400'), // Dark Amber Base
    glowColor: 'rgba(255, 119, 0, 0.4)',
    borderColor: 'rgba(255, 204, 0, 0.3)',
    rimColor: hexToVec3('#FFE6B3'),
    roughness: 0.14,
    metalness: 0.2,
    displacementScale: 0.52,
    noiseFrequency: 1.05,
  },
  emerald: {
    name: 'emerald',
    color1: hexToVec3('#00E676'), // Vivid Emerald
    color2: hexToVec3('#00B8D4'), // Deep Subsea Teal
    color3: hexToVec3('#76FF03'), // Fresh Lime Glow
    color4: hexToVec3('#004D40'), // Dark Forest Depth
    colorBg: hexToVec3('#00120B'), // Deep Subsea Base
    glowColor: 'rgba(0, 230, 118, 0.4)',
    borderColor: 'rgba(118, 255, 3, 0.3)',
    rimColor: hexToVec3('#C2FFEB'),
    roughness: 0.11,
    metalness: 0.12,
    displacementScale: 0.46,
    noiseFrequency: 1.15,
  },
};
