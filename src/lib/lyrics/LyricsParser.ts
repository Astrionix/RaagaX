import { LyricsLine, LyricsType } from './LyricsTypes';
import { Romanizer } from './Romanizer';

export class LyricsParser {
  /**
   * Parses a raw lyrics string (LRC or plain text) into structured LyricsLine objects.
   * Automatically derives nativeText and romanizedText using the Romanizer registry.
   * If plain lyrics are provided with song duration, automatically calculates synced pacing.
   */
  public static parse(raw: string, languageHint?: string, durationMs?: number): { type: LyricsType, lines: LyricsLine[] } {
    if (!raw || !raw.trim()) {
      return { type: 'plain', lines: [] };
    }

    const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    const parsedLines: LyricsLine[] = [];
    let isSynced = false;

    // LRC Regex: [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
    const lrcRegex = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\](.*)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = lrcRegex.exec(line);

      if (match) {
        isSynced = true;
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
        
        const text = match[4].trim();
        const startMs = (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
        const romanized = Romanizer.romanize(text, languageHint);

        parsedLines.push({
          id: `line-${i}-${startMs}`,
          startMs,
          text,
          nativeText: text,
          romanizedText: romanized !== text ? romanized : undefined
        });
      } else if (!isSynced) {
        // If we haven't encountered any synced lines yet, just add as plain text.
        const romanized = Romanizer.romanize(line, languageHint);
        parsedLines.push({
          id: `line-${i}`,
          startMs: i * 1000, 
          text: line,
          nativeText: line,
          romanizedText: romanized !== line ? romanized : undefined
        });
      }
    }

    // Sort synced lines by timestamp
    if (isSynced) {
      parsedLines.sort((a, b) => a.startMs - b.startMs);
      
      // Calculate endMs
      for (let i = 0; i < parsedLines.length - 1; i++) {
        parsedLines[i].endMs = parsedLines[i + 1].startMs;
      }
      
      if (parsedLines.length > 0) {
        parsedLines[parsedLines.length - 1].endMs = Number.MAX_SAFE_INTEGER;
      }
    } else if (durationMs && durationMs > 10000 && parsedLines.length > 0) {
      // Smart Auto-Pacing for plain text lyrics: pace evenly with song duration
      const introMs = Math.min(10000, durationMs * 0.07);
      const outroMs = Math.min(8000, durationMs * 0.05);
      const activeDurationMs = Math.max(1000, durationMs - introMs - outroMs);
      const lineInterval = activeDurationMs / parsedLines.length;

      for (let i = 0; i < parsedLines.length; i++) {
        const startMs = Math.round(introMs + (i * lineInterval));
        parsedLines[i].startMs = startMs;
        parsedLines[i].endMs = i < parsedLines.length - 1 ? Math.round(introMs + ((i + 1) * lineInterval)) : Number.MAX_SAFE_INTEGER;
      }
      isSynced = true;
    }

    return {
      type: isSynced ? 'line-synced' : 'plain',
      lines: parsedLines
    };
  }
}
