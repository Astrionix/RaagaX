import { LyricsLine, LyricsType } from './LyricsTypes';

export class LyricsParser {
  /**
   * Parses a raw lyrics string (LRC or plain text) into structured LyricsLine objects.
   */
  public static parse(raw: string): { type: LyricsType, lines: LyricsLine[] } {
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

        parsedLines.push({
          id: `line-${i}-${startMs}`,
          startMs,
          text
        });
      } else if (!isSynced) {
        // If we haven't encountered any synced lines yet, just add as plain text.
        // We assign arbitrary increasing timestamps to maintain structure, 
        // though they won't be used for synced scrolling.
        parsedLines.push({
          id: `line-${i}`,
          startMs: i * 1000, 
          text: line
        });
      } else {
        // We encountered a plain line in the middle of an LRC file (like metadata [ar:Artist]).
        // Usually, we ignore non-timestamped lines in a synced file unless we want to parse tags.
      }
    }

    // Sort synced lines by timestamp (LRCs can sometimes have tags out of order)
    if (isSynced) {
      parsedLines.sort((a, b) => a.startMs - b.startMs);
      
      // Calculate endMs
      for (let i = 0; i < parsedLines.length - 1; i++) {
        parsedLines[i].endMs = parsedLines[i + 1].startMs;
      }
      
      // For the last line, we assume it lasts a long time (e.g., to the end of the song)
      if (parsedLines.length > 0) {
        parsedLines[parsedLines.length - 1].endMs = Number.MAX_SAFE_INTEGER;
      }
    }

    return {
      type: isSynced ? 'line-synced' : 'plain',
      lines: parsedLines
    };
  }
}
