import { describe, expect, it, vi } from 'vitest';
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

    it('fetches manifest and parses metadata properly', async () => {
      const mockManifest = {
        id: 'test.addon.music',
        name: 'Test Music Addon',
        version: '1.2.0',
        resources: ['search', 'stream'],
        allowDownloads: true,
        settings: [
          {
            key: 'quality',
            type: 'select',
            title: 'Quality',
            options: ['lossless', 'high', 'low'],
            default: 'high',
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        expect(String(url)).toBe('https://addon.test/manifest.json');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockManifest,
        } as Response;
      });

      const client = new AddonClient('https://addon.test');
      const manifest = await client.manifest();
      expect(manifest.id).toBe('test.addon.music');
      expect(manifest.name).toBe('Test Music Addon');
      expect(manifest.resources).toContain('search');

      fetchSpy.mockRestore();
    });

    it('searches tracks and handles response mapping', async () => {
      const mockSearch = {
        results: [
          {
            id: 'track-123',
            title: 'Shape of You',
            artist: 'Ed Sheeran',
            album: 'Divide',
            duration: 233,
            quality: 'LOSSLESS',
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/manifest.json')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ id: 'test.addon', name: 'Test Addon' }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockSearch,
        } as Response;
      });

      const client = new AddonClient('https://addon.test');
      const results = await client.search('Shape of You', 'LOSSLESS');
      expect(results.length).toBe(1);
      expect(results[0]?.title).toBe('Shape of You');
      expect(results[0]?.artist).toBe('Ed Sheeran');

      fetchSpy.mockRestore();
    });

    it('resolves audio stream URL properly', async () => {
      const mockStream = {
        url: 'https://cdn.example.com/audio.flac',
        format: 'flac',
        bitDepth: 24,
        sampleRateHz: 96000,
        bitrateKbps: 2800,
        quality: 'HI_RES',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/manifest.json')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ id: 'test.addon', name: 'Test Addon' }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => mockStream,
        } as Response;
      });

      const client = new AddonClient('https://addon.test');
      const stream = await client.stream('track-123', 'LOSSLESS');
      expect(stream).not.toBeNull();
      expect(stream?.url).toBe('https://cdn.example.com/audio.flac');
      expect(stream?.format?.bitDepth).toBe(24);
      expect(stream?.format?.sampleRateHz).toBe(96000);
      expect(stream?.format?.quality).toBe('HI_RES');

      fetchSpy.mockRestore();
    });
  });
});
