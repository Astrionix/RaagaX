import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LyricsEngine } from '@/lib/lyrics/LyricsEngine';
import { useLyricsStore } from '@/context/useLyricsStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { LyricsParser } from '@/lib/lyrics/LyricsParser';

describe('LyricsEngine Dynamic Synchronization & Realtime Position Tracking', () => {
  const sampleLRC = `
[00:05.00]First line of the song
[00:12.50]Second line after chorus
[00:20.00]Third line building up
[00:35.00]Fourth line high energy
[00:50.00]Outro final line
  `;

  beforeEach(() => {
    const engine = LyricsEngine.getInstance();
    engine.clear();
    usePlayerStore.setState({
      currentTime: 0,
      isPlaying: false,
      playbackIntent: 'IDLE',
    });
  });

  it('Test 1 (LRC Parsing & Millisecond Timing): Accurately parses timestamps into sorted millisecond lines', () => {
    const parsed = LyricsParser.parse(sampleLRC);
    expect(parsed.type).toBe('line-synced');
    expect(parsed.lines).toHaveLength(5);
    expect(parsed.lines[0].startMs).toBe(5000);
    expect(parsed.lines[1].startMs).toBe(12500);
    expect(parsed.lines[2].startMs).toBe(20000);
    expect(parsed.lines[3].startMs).toBe(35000);
    expect(parsed.lines[4].startMs).toBe(50000);
  });

  it('Test 2 (Realtime Position Synchronization): Correctly evaluates and updates currentLineIndex as song progresses', () => {
    const parsed = LyricsParser.parse(sampleLRC);
    const engine = LyricsEngine.getInstance();

    useLyricsStore.getState().setLyricsData('test_track_1', {
      trackId: 'test_track_1',
      type: parsed.type,
      lines: parsed.lines,
      source: 'LRCLIB'
    }, 'ready');

    // Manually prime active lines for engine evaluation
    (engine as any).activeLines = parsed.lines;

    // Intro (before 5s) -> index -1
    engine.evaluatePosition(2000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(-1);

    // Line 1: at 6s -> index 0
    engine.evaluatePosition(6000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(0);

    // Line 2: at 15s -> index 1
    engine.evaluatePosition(15000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(1);

    // Line 3: at 25s -> index 2
    engine.evaluatePosition(25000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(2);

    // Line 4: at 40s -> index 3
    engine.evaluatePosition(40000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(3);

    // Outro: at 55s -> index 4
    engine.evaluatePosition(55000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(4);
  });

  it('Test 3 (Seek Synchronization): Seeking directly snaps currentLineIndex to exact timestamp', () => {
    const parsed = LyricsParser.parse(sampleLRC);
    const engine = LyricsEngine.getInstance();
    (engine as any).activeLines = parsed.lines;

    // Seek directly to 36s (during 4th line)
    engine.seek(36000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(3);

    // Seek back to 8s (during 1st line)
    engine.seek(8000);
    expect(useLyricsStore.getState().currentLineIndex).toBe(0);
  });

  it('Test 4 (Store Time Fallback Sync): Syncs line index when usePlayerStore.currentTime updates', () => {
    const parsed = LyricsParser.parse(sampleLRC);
    const engine = LyricsEngine.getInstance();
    (engine as any).activeLines = parsed.lines;

    // Simulate Native Android ExoPlayer or Web Store timer update
    usePlayerStore.setState({ currentTime: 22 }); // 22 seconds

    // Evaluate effective position
    const effectiveMs = engine.getEffectivePositionMs();
    expect(effectiveMs).toBe(22000);

    engine.evaluatePosition(effectiveMs);
    expect(useLyricsStore.getState().currentLineIndex).toBe(2); // 20s <= 22s < 35s
  });
});
