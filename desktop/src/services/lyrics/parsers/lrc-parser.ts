import { LyricLine, LyricWord } from "@/types/lyrics";
import { withInstrumentalGaps } from "./ttml-parser";

/**
 * Parses standard line-synced LRC and enhanced word-synced Karaoke LRC.
 */
export function parseLrc(content: string): LyricLine[] {
  if (!content) return [];

  // Check if Karaoke LRC format: [1234,2500](0,500)Word1(500,1000)Word2
  if (isKaraokeLrc(content)) {
    return parseKaraokeLrc(content);
  }

  // Check if Enhanced LRC format: [00:12.34]<00:12.34>Word1<00:13.00>Word2
  if (isEnhancedLrc(content)) {
    return parseEnhancedLrc(content);
  }

  // Standard LRC parsing
  const lines = content.split("\n");
  const parsedLines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Skip metadata tags like [ar:Artist], [ti:Title]
    if (/^\[[a-zA-Z]+:.*\]$/.test(trimmed)) continue;

    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (!matches.length) continue;

    const text = trimmed.replace(timeRegex, "").trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millisStr = match[3] || "0";
      const millis =
        millisStr.length === 2
          ? parseInt(millisStr, 10) * 10
          : parseInt(millisStr, 10);

      const startTimeMs = minutes * 60 * 1000 + seconds * 1000 + millis;

      parsedLines.push({
        startTimeMs,
        text,
      });
    }
  }

  parsedLines.sort((a, b) => a.startTimeMs - b.startTimeMs);

  for (let i = 0; i < parsedLines.length; i++) {
    if (i < parsedLines.length - 1) {
      parsedLines[i].endTimeMs = parsedLines[i + 1].startTimeMs;
    } else {
      parsedLines[i].endTimeMs = parsedLines[i].startTimeMs + 3000;
    }
  }

  return withInstrumentalGaps(parsedLines);
}

function isKaraokeLrc(content: string): boolean {
  return /^\[\d{1,8},\d{1,8}\]/m.test(content) && /\(\d{1,8},\d{1,8}/.test(content);
}

function parseKaraokeLrc(content: string): LyricLine[] {
  const lineRegex = /^\[(\d{1,8}),(\d{1,8})\](.*)$/;
  const wordRegex = /\((\d{1,8}),(\d{1,8})(?:,\d{1,8})?\)([^()]+)/g;

  const result: LyricLine[] = [];

  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    const match = trimmed.match(lineRegex);
    if (!match) continue;

    const lineStartMs = parseInt(match[1], 10);
    const lineDurationMs = parseInt(match[2], 10);
    const body = match[3];

    const words: LyricWord[] = [];
    let wordMatch: RegExpExecArray | null;

    while ((wordMatch = wordRegex.exec(body)) !== null) {
      const offsetMs = parseInt(wordMatch[1], 10);
      const durationMs = parseInt(wordMatch[2], 10);
      const wordText = wordMatch[3];

      words.push({
        startMs: lineStartMs + offsetMs,
        endMs: lineStartMs + offsetMs + durationMs,
        text: wordText,
      });
    }

    const plainText = body.replace(/\([^)]+\)/g, "").trim();
    if (!plainText) continue;

    result.push({
      startTimeMs: lineStartMs,
      endTimeMs: lineStartMs + lineDurationMs,
      text: plainText,
      words: words.length ? words : undefined,
    });
  }

  result.sort((a, b) => a.startTimeMs - b.startTimeMs);
  return withInstrumentalGaps(result);
}

function isEnhancedLrc(content: string): boolean {
  return /<\d{2}:\d{2}\.\d{2,3}>/.test(content);
}

function parseEnhancedLrc(content: string): LyricLine[] {
  const lines = content.split("\n");
  const result: LyricLine[] = [];
  const lineTimeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;
  const wordTagRegex = /<(\d{2}):(\d{2})(?:\.(\d{2,3}))?>([^<]+)/g;

  for (const raw of lines) {
    const trimmed = raw.trim();
    const match = trimmed.match(lineTimeRegex);
    if (!match) continue;

    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const msStr = match[3] || "0";
    const lineStartMs = min * 60000 + sec * 1000 + (msStr.length === 2 ? parseInt(msStr, 10) * 10 : parseInt(msStr, 10));

    const words: LyricWord[] = [];
    let wordMatch: RegExpExecArray | null;

    while ((wordMatch = wordTagRegex.exec(trimmed)) !== null) {
      const wMin = parseInt(wordMatch[1], 10);
      const wSec = parseInt(wordMatch[2], 10);
      const wMsStr = wordMatch[3] || "0";
      const wStartMs = wMin * 60000 + wSec * 1000 + (wMsStr.length === 2 ? parseInt(wMsStr, 10) * 10 : parseInt(wMsStr, 10));
      const wText = wordMatch[4].trim();

      if (wText) {
        words.push({
          startMs: wStartMs,
          endMs: wStartMs + 400,
          text: wText,
        });
      }
    }

    // Set endMs of words to the startMs of the next word
    for (let w = 0; w < words.length - 1; w++) {
      words[w].endMs = words[w + 1].startMs;
    }

    const plainText = trimmed.replace(/\[[^\]]+\]/g, "").replace(/<[^>]+>/g, "").trim();
    if (!plainText) continue;

    result.push({
      startTimeMs: lineStartMs,
      endTimeMs: words.length ? words[words.length - 1].endMs + 300 : lineStartMs + 3000,
      text: plainText,
      words: words.length ? words : undefined,
    });
  }

  result.sort((a, b) => a.startTimeMs - b.startTimeMs);
  return withInstrumentalGaps(result);
}
