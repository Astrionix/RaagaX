import { describe, expect, it } from 'vitest';
import { AddonClient, maskUrl, normalizeBaseUrl, toPlayableStreamUrl } from './addonClient';

describe('addonClient', () => {
  describe('normalizeBaseUrl', () => {
    it('normalizes base url by trimming and removing trailing slashes', () => {
      expect(normalizeBaseUrl('  https://addon.example.com/  ')).toBe('https://addon.example.com');
      expect(normalizeBaseUrl('https://addon.example.com///')).toBe('https://addon.example.com');
    });

    it('strips manifest.json or addon.json path', () => {
      expect(normalizeBaseUrl('https://addon.example.com/manifest.json')).toBe('https://addon.example.com');
      expect(normalizeBaseUrl('https://addon.example.com/sub/addon.json')).toBe('https://addon.example.com/sub');
    });

    it('prepends https if protocol is missing', () => {
      expect(normalizeBaseUrl('addon.example.com')).toBe('https://addon.example.com');
    });
  });

  describe('maskUrl', () => {
    it('masks paths containing tokens for safe display', () => {
      expect(maskUrl('https://addon.example.com/token123/manifest.json')).toBe('https://addon.example.com/token123/••••');
    });

    it('keeps clean host origin as is', () => {
      expect(maskUrl('https://addon.example.com')).toBe('https://addon.example.com');
    });
  });

  describe('toPlayableStreamUrl', () => {
    it('preserves https stream URLs', () => {
      expect(toPlayableStreamUrl('https://addon.example.com/audio.flac')).toBe('https://addon.example.com/audio.flac');
    });

    it('handles empty or null URLs gracefully', () => {
      expect(toPlayableStreamUrl('')).toBe('');
    });
  });

  describe('AddonClient instance', () => {
    it('initializes with normalized base URL', () => {
      const client = new AddonClient('https://my-addon.local:8080/manifest.json');
      expect(client.baseUrl).toBe('https://my-addon.local:8080');
    });

    it('fetches manifest and searches live user addon URL', async () => {
      const client = new AddonClient('https://eljohnzcaddon.velixir.run/c57e7b0ef2031b2f1fcd/manifest.json');
      expect(client.baseUrl).toBe('https://eljohnzcaddon.velixir.run/c57e7b0ef2031b2f1fcd');

      const manifest = await client.manifest();
      expect(manifest.id).toBe('eljohnzc.addon.music');
      expect(manifest.name).toBe('Eljohnzc Addon');
      expect(manifest.resources).toContain('search');

      const searchResults = await client.search('Shape of You', 'LOSSLESS');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0]?.title).toBe('Shape of You');
    });

    it('fetches manifest, searches and streams from bitchord-hires addon', async () => {
      const client = new AddonClient('https://bitchord-hires-addon.vercel.app/');
      expect(client.baseUrl).toBe('https://bitchord-hires-addon.vercel.app');

      const manifest = await client.manifest();
      expect(manifest.id).toBe('dev.akira.bitchord-hires');
      expect(manifest.name).toBe('juanjob hi res');

      const searchResults = await client.search('Adele', 'LOSSLESS');
      expect(searchResults.length).toBeGreaterThan(0);

      const stream = await client.stream('ia:AdeleKeshelak-slovakFolkSongsFrom1928', 'LOSSLESS');
      expect(stream).not.toBeNull();
      expect(stream?.url).toContain('archive.org');
    }, 15000);
  });
});
