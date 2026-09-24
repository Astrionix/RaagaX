import { describe, it, expect } from 'vitest';
import { generatePlaylistVisual } from '@/lib/playlist/playlistVisualGenerator';
import { PLAYLIST_PALETTES } from '@/lib/playlist/playlistPalettes';

describe('Dynamic Animated Playlist Cover System', () => {
  it('should deterministically generate the exact same visual spec for the same playlist ID', () => {
    const id = 'playlist_83hd92';
    const title = 'Late Night Drive';

    const visual1 = generatePlaylistVisual(id, title);
    const visual2 = generatePlaylistVisual(id, title);

    expect(visual1.seed).toBe(visual2.seed);
    expect(visual1.palette.id).toBe(visual2.palette.id);
    expect(visual1.style).toBe(visual2.style);
    expect(visual1.animationSpeed).toBe(visual2.animationSpeed);
    expect(visual1.intensity).toBe(visual2.intensity);
    expect(visual1.cssStaticGradient).toBe(visual2.cssStaticGradient);
    expect(visual1.nodes.length).toBe(4);
    expect(visual1.nodes[0].color).toEqual(visual2.nodes[0].color);
  });

  it('should generate visually distinct specs for different playlist IDs', () => {
    const visualA = generatePlaylistVisual('playlist_alpha_01', 'Chill Vibes');
    const visualB = generatePlaylistVisual('playlist_beta_99', 'Gym Mode');

    expect(visualA.seed).not.toBe(visualB.seed);
  });

  it('should always select a valid curated palette family with 4 distinct RGB nodes', () => {
    const testIds = ['pl_1', 'pl_2', 'pl_3', 'pl_4', 'pl_5', 'pl_6', 'pl_7', 'pl_8'];
    const validFamilyNames = PLAYLIST_PALETTES.map((p) => p.family);

    testIds.forEach((id) => {
      const visual = generatePlaylistVisual(id);
      expect(validFamilyNames).toContain(visual.palette.family);
      expect(visual.palette.colors.length).toBe(4);
      visual.palette.colors.forEach(([r, g, b]) => {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      });
    });
  });

  it('should generate safe kinetic nodes within normalized boundaries', () => {
    const visual = generatePlaylistVisual('playlist_ambient_test');
    expect(visual.nodes.length).toBe(4);

    visual.nodes.forEach((node) => {
      expect(node.baseX).toBeGreaterThanOrEqual(0);
      expect(node.baseX).toBeLessThanOrEqual(1);
      expect(node.baseY).toBeGreaterThanOrEqual(0);
      expect(node.baseY).toBeLessThanOrEqual(1);
      expect(node.radius).toBeGreaterThan(0.2);
      expect(node.radius).toBeLessThan(1.0);
      expect(node.alpha).toBeGreaterThanOrEqual(0.5);
      expect(node.alpha).toBeLessThanOrEqual(1.0);
    });
  });
});
