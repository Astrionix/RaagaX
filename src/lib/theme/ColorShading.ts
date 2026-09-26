/**
 * Color Shading & Ambient Palette Engine
 * Layered ambient UI palette interpolation.
 */

/**
 * Mathematically darkens or lightens a hex color by a specified percentage.
 * Positive percent = lighter / tint
 * Negative percent = darker / shade
 *
 * @param color Hex color (e.g. '#FA233B' or 'FA233B' or '#F00')
 * @param percent Number between -100 and +100
 */
export function shadeColor(color: string, percent: number): string {
  if (!color || typeof color !== 'string') return '#000000';
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#000000';

  const num = parseInt(hex, 16);
  if (isNaN(num)) return '#000000';

  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;

  const clampedR = Math.max(0, Math.min(255, R));
  const clampedG = Math.max(0, Math.min(255, G));
  const clampedB = Math.max(0, Math.min(255, B));

  return (
    '#' +
    (0x1000000 + clampedR * 0x10000 + clampedG * 0x100 + clampedB)
      .toString(16)
      .slice(1)
  );
}

/**
 * Generates a layered ambient palette from a dominant artwork color.
 */
export function generateLayeredPalette(dominantHex?: string | null) {
  const base = dominantHex && dominantHex.startsWith('#') ? dominantHex : '#FA233B';
  return {
    base,
    highlight: shadeColor(base, 25),
    glow: shadeColor(base, 10),
    midTone: shadeColor(base, -25),
    deepShadow: shadeColor(base, -55),
    abyss: shadeColor(base, -80),
    borderGlow: shadeColor(base, -15),
  };
}

export const generateAppleMusicPalette = generateLayeredPalette;
