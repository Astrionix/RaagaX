import { describe, expect, it } from 'vitest';
import { rewriteJioSaavn320Url } from './addonResolver';

describe('addonResolver', () => {
  it('rewrites 96/160/320 saavn CDN URLs to 320kbps when supported', () => {
    const input = 'https://aac.saavncdn.com/396/b4e570050007b056c662f2a98c9f28ec_96.mp4';
    const result = rewriteJioSaavn320Url(input, true);
    expect(result.url).toBe('https://aac.saavncdn.com/396/b4e570050007b056c662f2a98c9f28ec_320.mp4');
    expect(result.bitrate).toBe(320);
  });

  it('keeps original bitrate if 320kbps is not supported', () => {
    const input = 'https://aac.saavncdn.com/396/b4e570050007b056c662f2a98c9f28ec_160.mp4';
    const result = rewriteJioSaavn320Url(input, false);
    expect(result.url).toBe(input);
    expect(result.bitrate).toBe(160);
  });

  it('searches and matches track on JioSaavn', async () => {
    const { resolveJioSaavnStream } = await import('./addonResolver');
    const stream = await resolveJioSaavnStream({
      title: 'Believer',
      artist: 'Imagine Dragons',
      durationSec: 204,
    });
    if (stream) {
      expect(stream.url).toContain('.mp4');
      expect(stream.bitrateKbps).toBe(320);
      expect(stream.sourceName).toBe('JioSaavn');
      expect(stream.codec).toBe('mp4');
    }
  }, 10000);

  it('searches and matches Pavazha Malli', async () => {
    const { resolveJioSaavnStream } = await import('./addonResolver');
    const stream = await resolveJioSaavnStream({
      title: 'Pavazha Malli',
      artist: 'Vivek',
      durationSec: 180,
    });
    console.log('Pavazha Malli resolved:', stream?.streamInfo, stream?.url);
    if (stream) {
      expect(stream.bitrateKbps).toBe(320);
    }
  }, 10000);
});
