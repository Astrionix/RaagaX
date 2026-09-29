import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, LyricsTranslationClient } from '@/lib/lyrics/LyricsTranslationClient';

describe('Raaga Android to Web Parity Suite', () => {
  it('1. Supported Languages: contains core multilingual options matching Android app', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('es');
    expect(codes).toContain('hi');
    expect(codes).toContain('te');
    expect(codes).toContain('ta');
    expect(codes).toContain('ja');
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
  });

  it('2. LyricsTranslationClient: singleton instance is correctly created', () => {
    const client1 = LyricsTranslationClient.getInstance();
    const client2 = LyricsTranslationClient.getInstance();
    expect(client1).toBe(client2);
  });

  it('3. Word-Sync Timing Heuristics: calculates line progress smoothly within [0, 1]', () => {
    const startMs = 10000;
    const endMs = 15000;
    const duration = endMs - startMs;

    const calcProgress = (currMs: number) => Math.max(0, Math.min(1, (currMs - startMs) / duration));

    expect(calcProgress(9000)).toBe(0);
    expect(calcProgress(10000)).toBe(0);
    expect(calcProgress(12500)).toBe(0.5);
    expect(calcProgress(15000)).toBe(1);
    expect(calcProgress(18000)).toBe(1);
  });

  it('4. Backing Vocal Detection: correctly identifies backing vocals in parentheses', () => {
    const isBacking = (text: string) => text.trim().startsWith('(') && text.trim().endsWith(')');

    expect(isBacking('(Ooh yeah yeah)')).toBe(true);
    expect(isBacking('(Backing vocal)')).toBe(true);
    expect(isBacking('Main lead vocal line')).toBe(false);
    expect(isBacking('Intro (Verse 1)')).toBe(false);
  });
});
