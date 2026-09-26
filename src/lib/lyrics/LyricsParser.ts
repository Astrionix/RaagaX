import { LyricsLine, LyricsType, LyricToken } from './LyricsTypes';
import { Romanizer } from './Romanizer';

// Standard & Enhanced LRC Timestamps: [m:ss.xx] or [mm:ss.xxx] or [mm:ss]
const TIME_TAG_GLOBAL = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const TIME_TAG_LINE_START = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/;

// Metadata tags: [ti:Title], [ar:Artist], [al:Album], [offset:500]
const META_TAG = /^\[([a-zA-Z]+):(.*)\]$/;

// Word-level / Syllable timing tags within a line: <m:ss.xx> or <mm:ss.xxx>
const WORD_TAG_GLOBAL = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g;

function parseTimestampToMs(minStr: string, secStr: string, fracStr?: string): number {
  const min = parseInt(minStr, 10);
  const sec = parseInt(secStr, 10);
  let fracMs = 0;
  if (fracStr) {
    if (fracStr.length === 1) fracMs = parseInt(fracStr, 10) * 100;
    else if (fracStr.length === 2) fracMs = parseInt(fracStr, 10) * 10;
    else fracMs = parseInt(fracStr.slice(0, 3), 10);
  }
  return (min * 60 * 1000) + (sec * 1000) + fracMs;
}

/**
 * Extracts word-level tokens from an enhanced LRC line:
 * e.g. "[00:01.00]<00:01.00>Hello <00:01.50>world"
 */
function parseTokens(raw: string, lineStartMs: number): { cleanText: string; tokens?: LyricToken[] } {
  if (!WORD_TAG_GLOBAL.test(raw)) {
    return { cleanText: raw.trim() };
  }
  WORD_TAG_GLOBAL.lastIndex = 0;

  const tokens: LyricToken[] = [];
  let lastIndex = 0;
  let lastTimeMs = lineStartMs;
  let match: RegExpExecArray | null;
  let clean = '';

  while ((match = WORD_TAG_GLOBAL.exec(raw)) !== null) {
    const chunk = raw.slice(lastIndex, match.index);
    if (chunk.length > 0) {
      tokens.push({ timeMs: lastTimeMs, text: chunk });
      clean += chunk;
    }
    lastTimeMs = parseTimestampToMs(match[1], match[2], match[3]);
    lastIndex = WORD_TAG_GLOBAL.lastIndex;
  }

  const tail = raw.slice(lastIndex);
  if (tail.length > 0) {
    tokens.push({ timeMs: lastTimeMs, text: tail });
    clean += tail;
  }

  return { cleanText: clean.trim(), tokens: tokens.length > 0 ? tokens : undefined };
}

export class LyricsParser {
  /**
   * Parses a raw lyrics string (Standard LRC, Enhanced word-level LRC, or plain text).
   * Supports:
   * - [offset:xxx] tag calibration (both positive and negative)
   * - Repeated timestamps on single lines ([00:01.00][00:05.00]Chorus)
   * - Enhanced word-level tokens (<00:01.50>word)
   * - Single-digit and double-digit minute tags ([1:23.45])
   * - Romanization derivation
   */
  public static parse(
    raw: string,
    languageHint?: string,
    durationMs?: number
  ): { type: LyricsType; lines: LyricsLine[]; offsetMs?: number } {
    if (!raw || !raw.trim()) {
      return { type: 'plain', lines: [] };
    }

    const rawLines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsedLines: LyricsLine[] = [];
    let fileOffsetMs = 0;
    let isSynced = false;

    // First pass: extract [offset:xxx] and metadata
    for (const rawLine of rawLines) {
      const metaMatch = rawLine.match(META_TAG);
      if (metaMatch && !TIME_TAG_GLOBAL.test(rawLine)) {
        const key = metaMatch[1].toLowerCase();
        const value = metaMatch[2].trim();
        if (key === 'offset') {
          const parsedNum = parseInt(value, 10);
          if (!isNaN(parsedNum)) {
            fileOffsetMs = parsedNum;
          }
        }
      }
      TIME_TAG_GLOBAL.lastIndex = 0;
    }

    // Second pass: extract synced lines (including repeated timestamps)
    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];

      // Skip pure metadata lines
      if (META_TAG.test(rawLine) && !TIME_TAG_GLOBAL.test(rawLine)) {
        TIME_TAG_GLOBAL.lastIndex = 0;
        continue;
      }
      TIME_TAG_GLOBAL.lastIndex = 0;

      // Extract all leading timestamps (e.g. "[00:01.00][00:05.00]Repeated lyric")
      const lineTimesMs: number[] = [];
      let remainder = rawLine;
      let startMatch: RegExpMatchArray | null;

      while ((startMatch = remainder.match(TIME_TAG_LINE_START)) !== null) {
        const tMs = parseTimestampToMs(startMatch[1], startMatch[2], startMatch[3]);
        lineTimesMs.push(tMs);
        remainder = remainder.slice(startMatch[0].length);
      }

      if (lineTimesMs.length > 0) {
        isSynced = true;
        // Parse word-level tokens if present in remainder text
        const baseStart = lineTimesMs[0];
        const { cleanText, tokens } = parseTokens(remainder, baseStart);
        const romanized = Romanizer.romanize(cleanText, languageHint);

        for (const rawTime of lineTimesMs) {
          // Apply file offset tag
          const startMs = Math.max(0, rawTime + fileOffsetMs);

          // Adjust token timestamps with the offset if word tokens exist
          const adjustedTokens = tokens
            ? tokens.map(tok => ({
                timeMs: Math.max(0, tok.timeMs + fileOffsetMs),
                text: tok.text
              }))
            : undefined;

          parsedLines.push({
            id: `line-${parsedLines.length}-${startMs}`,
            startMs,
            text: cleanText,
            nativeText: cleanText,
            romanizedText: romanized !== cleanText ? romanized : undefined,
            tokens: adjustedTokens
          });
        }
      } else if (!isSynced) {
        // Plain text line before any timestamp is seen
        const romanized = Romanizer.romanize(rawLine, languageHint);
        parsedLines.push({
          id: `line-${i}`,
          startMs: i * 1000,
          text: rawLine,
          nativeText: rawLine,
          romanizedText: romanized !== rawLine ? romanized : undefined
        });
      }
    }

    if (isSynced) {
      // Sort in strict chronological order
      parsedLines.sort((a, b) => a.startMs - b.startMs);

      // Deduplicate lines with exact identical timestamps
      const uniqueLines: LyricsLine[] = [];
      for (const line of parsedLines) {
        const prev = uniqueLines[uniqueLines.length - 1];
        if (!prev || prev.startMs !== line.startMs || prev.text !== line.text) {
          uniqueLines.push(line);
        }
      }

      // Calculate endMs based on the start of the next line
      for (let i = 0; i < uniqueLines.length - 1; i++) {
        uniqueLines[i].endMs = uniqueLines[i + 1].startMs;
      }
      if (uniqueLines.length > 0) {
        uniqueLines[uniqueLines.length - 1].endMs = Number.MAX_SAFE_INTEGER;
      }

      return {
        type: 'line-synced',
        lines: uniqueLines,
        offsetMs: fileOffsetMs
      };
    } else if (durationMs && durationMs > 10000 && parsedLines.length > 0) {
      // Smart Auto-Pacing for plain text lyrics: pace evenly with song duration
      const introMs = Math.min(10000, durationMs * 0.07);
      const outroMs = Math.min(8000, durationMs * 0.05);
      const activeDurationMs = Math.max(1000, durationMs - introMs - outroMs);
      const lineInterval = activeDurationMs / parsedLines.length;

      for (let i = 0; i < parsedLines.length; i++) {
        const startMs = Math.round(introMs + (i * lineInterval));
        parsedLines[i].startMs = startMs;
        parsedLines[i].endMs = i < parsedLines.length - 1
          ? Math.round(introMs + ((i + 1) * lineInterval))
          : Number.MAX_SAFE_INTEGER;
      }

      return {
        type: 'line-synced',
        lines: parsedLines,
        offsetMs: 0
      };
    }

    return {
      type: 'plain',
      lines: parsedLines,
      offsetMs: 0
    };
  }
}
