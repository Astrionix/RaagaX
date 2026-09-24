import { describe, it, expect } from 'vitest';
import { ArtworkColorExtractor, ChameleonPalette } from '@/lib/theme/ArtworkColorExtractor';

describe('Apple Music Liquid Motion Background & Palette Extraction', () => {
  it('should provide default raw RGB nodes for mesh canvas rendering', async () => {
    const extractor = ArtworkColorExtractor.getInstance();
    const palette = await extractor.extractPalette(null);

    expect(palette).toBeDefined();
    expect(palette.rawRgb).toBeDefined();
    expect(palette.rawRgb?.length).toBe(4);
    expect(palette.rawRgb?.[0]).toEqual([140, 28, 48]);
  });

  it('should provide structured ChameleonPalette colors', async () => {
    const extractor = ArtworkColorExtractor.getInstance();
    const palette = await extractor.extractPalette(undefined);

    expect(palette.primary).toBe('rgb(140, 28, 48)');
    expect(palette.secondary).toBe('rgb(85, 30, 25)');
    expect(palette.highlight).toBe('rgb(215, 75, 45)');
    expect(palette.accent).toBe('rgb(250, 35, 59)');
    expect(palette.glow).toBeDefined();
    expect(palette.refractionRgba).toBeDefined();
  });
});
