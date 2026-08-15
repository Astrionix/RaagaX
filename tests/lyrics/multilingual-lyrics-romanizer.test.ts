import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Romanizer } from '@/lib/lyrics/Romanizer';
import { LyricsParser } from '@/lib/lyrics/LyricsParser';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';

describe('Multilingual Synchronized Lyrics & Romanization Engine Tests', () => {
  const teluguLRC = `
[00:05.00]నువ్వంటే నాకు ఇష్టం
[00:15.00]చూడాలని ఉంది నిన్ను
[00:30.00]గుండెల్లో దాచాను ప్రేమ
  `;

  const tamilLRC = `
[00:08.00]நீ எனக்கு பிடிக்கும்
[00:18.00]உன்னை பார்க்க வேண்டும்
  `;

  const hindiLRC = `
[00:04.00]तुम मुझे पसंद हो
[00:14.00]दिल में छुपाया है प्यार
  `;

  const kannadaLRC = `
[00:06.00]ನೀನು ನನಗೆ ಇಷ್ಟ
[00:16.00]ನಿನ್ನನ್ನು ನೋಡಬೇಕು
  `;

  const malayalamLRC = `
[00:05.00]നീ എനിക്ക് ഇഷ്ടമാണ്
  `;

  beforeEach(() => {
    LyricsEngine.getInstance().clear();
    useLyricsStore.getState().reset();
    usePlayerStore.setState({
      currentTime: 0,
      isPlaying: false,
      playbackIntent: 'IDLE',
    });
  });

  // Test 1: Telugu native + Tinglish transliteration
  it('Test 1: Transliterates Telugu native script into Tinglish romanization', () => {
    const text = 'నువ్వంటే నాకు ఇష్టం';
    const romanized = Romanizer.romanize(text, 'telugu');
    expect(romanized.toLowerCase()).toContain('nuvvante');
    expect(romanized.toLowerCase()).toContain('naaku');
    expect(romanized.toLowerCase()).toContain('ishtam');
  });

  // Test 2: Tamil native + Tanglish transliteration
  it('Test 2: Transliterates Tamil native script into Tanglish romanization', () => {
    const text = 'நீ எனக்கு பிடிக்கும்';
    const romanized = Romanizer.romanize(text, 'tamil');
    expect(romanized.toLowerCase()).toContain('nee');
    expect(romanized.toLowerCase()).toContain('enakku');
    expect(romanized.toLowerCase()).toContain('pidikkum');
  });

  // Test 3: Hindi native + Hinglish transliteration
  it('Test 3: Transliterates Hindi native script into Hinglish romanization', () => {
    const text = 'तुम मुझे पसंद हो';
    const romanized = Romanizer.romanize(text, 'hindi');
    expect(romanized.toLowerCase()).toContain('tum');
    expect(romanized.toLowerCase()).toContain('mujhe');
    expect(romanized.toLowerCase()).toContain('pasand');
  });

  // Test 4: Kannada & Malayalam transliteration
  it('Test 4: Transliterates Kannada (Kanglish) & Malayalam (Manglish) correctly', () => {
    const kn = Romanizer.romanize('ನೀನು ನನಗೆ ಇಷ್ಟ', 'kannada');
    expect(kn.toLowerCase()).toContain('neenu');
    expect(kn.toLowerCase()).toContain('nanage');

    const ml = Romanizer.romanize('നീ എനിക്ക് ഇഷ്ടമാണ്', 'malayalam');
    expect(ml.toLowerCase()).toContain('nee');
    expect(ml.toLowerCase()).toContain('enikku');
  });

  // Test 5: Exact timestamps shared between native and romanized lines
  it('Test 5: Preserves exact identical timestamps for native and romanized scripts', () => {
    const parsed = LyricsParser.parse(teluguLRC, 'telugu');
    expect(parsed.lines).toHaveLength(3);
    
    // First line
    expect(parsed.lines[0].startMs).toBe(5000);
    expect(parsed.lines[0].nativeText).toBe('నువ్వంటే నాకు ఇష్టం');
    expect(parsed.lines[0].romanizedText).toBeDefined();
    expect(parsed.lines[0].romanizedText?.toLowerCase()).toContain('nuvvante');

    // Second line
    expect(parsed.lines[1].startMs).toBe(15000);
    expect(parsed.lines[1].nativeText).toBe('చూడాలని ఉంది నిన్ను');
    expect(parsed.lines[1].romanizedText).toBeDefined();

    // Third line
    expect(parsed.lines[2].startMs).toBe(30000);
    expect(parsed.lines[2].nativeText).toBe('గుండెల్లో దాచాను ప్రేమ');
    expect(parsed.lines[2].romanizedText).toBeDefined();
  });

  // Test 6: Script Display Mode Switching (native, romanized, both)
  it('Test 6: Allows switching between native, romanized, and both script display modes', () => {
    const parsed = LyricsParser.parse(teluguLRC, 'telugu');
    const store = useLyricsStore.getState();

    store.setLyricsData('track_telugu_1', {
      trackId: 'track_telugu_1',
      type: parsed.type,
      lines: parsed.lines,
      source: 'LRCLIB'
    }, 'ready');

    expect(useLyricsStore.getState().hasRomanized).toBe(true);
    expect(useLyricsStore.getState().scriptMode).toBe('both');

    useLyricsStore.getState().setScriptMode('native');
    expect(useLyricsStore.getState().scriptMode).toBe('native');

    useLyricsStore.getState().setScriptMode('romanized');
    expect(useLyricsStore.getState().scriptMode).toBe('romanized');

    useLyricsStore.getState().setScriptMode('both');
    expect(useLyricsStore.getState().scriptMode).toBe('both');
  });

  // Test 7: Backward Seek (3:00 -> 1:45 / 180s -> 105s) smoothly snaps active lyric line
  it('Test 7: Backward Seek (3:00 -> 1:45 / 180000ms -> 105000ms) snaps active lyric line immediately', () => {
    const multiMinuteLRC = `
[00:30.00]Intro line
[01:40.00]Line around 1:40
[01:45.00]Exact target line at 1:45
[02:10.00]Mid section line
[03:00.00]Line at 3:00
[03:30.00]Outro line
    `;

    const parsed = LyricsParser.parse(multiMinuteLRC, 'telugu');
    const engine = LyricsEngine.getInstance();
    (engine as any).activeLines = parsed.lines;

    useLyricsStore.getState().setLyricsData('track_seek_1', {
      trackId: 'track_seek_1',
      type: parsed.type,
      lines: parsed.lines,
      source: 'LRCLIB'
    }, 'ready');

    // Currently at 3:00 (180,000ms) -> index 4
    engine.seek(180000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(4);

    // User backward seeks 3:00 -> 1:45 (105,000ms)
    engine.seek(105000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(2);
    expect(parsed.lines[2].startMs).toBe(105000);
    expect(parsed.lines[2].nativeText).toBe('Exact target line at 1:45');
  });

  // Test 8: Forward Seek (1:45 -> 3:00 / 105s -> 180s) remains intact
  it('Test 8: Forward Seek (1:45 -> 3:00 / 105000ms -> 180000ms) snaps active lyric line immediately', () => {
    const multiMinuteLRC = `
[01:45.00]Exact target line at 1:45
[03:00.00]Line at 3:00
    `;

    const parsed = LyricsParser.parse(multiMinuteLRC, 'telugu');
    const engine = LyricsEngine.getInstance();
    (engine as any).activeLines = parsed.lines;

    engine.seek(105000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(0);

    engine.seek(180000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(1);
  });

  // Test 9: Romanization failure gracefully retains native lyrics
  it('Test 9: Romanization failure or unknown language gracefully falls back to native text without throwing', () => {
    const unknownScriptText = 'Some non-Indic text or unmapped chars';
    const res = Romanizer.romanize(unknownScriptText, 'unknown');
    expect(res).toBe(unknownScriptText);

    const parsed = LyricsParser.parse(`[00:10.00]${unknownScriptText}`);
    expect(parsed.lines[0].text).toBe(unknownScriptText);
    expect(parsed.lines[0].nativeText).toBe(unknownScriptText);
  });
});
