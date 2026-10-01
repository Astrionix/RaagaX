import { LyricLine, LyricWord, LyricAlignment } from "@/types/lyrics";

const MIN_GAP_MS = 4000;

function parseTimestamp(val: string): number {
  if (!val) return 0;
  val = val.trim();
  if (val.includes(":")) {
    const parts = val.split(":");
    if (parts.length === 2) {
      return Math.round((parseFloat(parts[0]) * 60 + parseFloat(parts[1])) * 1000);
    } else if (parts.length === 3) {
      return Math.round(
        (parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])) * 1000
      );
    }
  }
  return Math.round(parseFloat(val) * 1000) || 0;
}

/**
 * Parses Apple Music and Portato TTML documents into word/syllable-synced LyricLine items.
 */
export function parseTtml(ttmlContent: string): LyricLine[] {
  if (!ttmlContent || !ttmlContent.includes("<p")) return [];

  const lines: LyricLine[] = [];

  // Match all <p ...>...</p> tags
  const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(ttmlContent)) !== null) {
    const pAttrs = pMatch[1];
    const pBody = pMatch[2];

    // Extract begin & end from <p>
    const beginMatch = pAttrs.match(/\bbegin=["']([^"']+)["']/i);
    const endMatch = pAttrs.match(/\bend=["']([^"']+)["']/i);
    const agentMatch = pAttrs.match(/\bttm:agent=["']([^"']+)["']/i);
    const roleMatch = pAttrs.match(/\bttm:role=["']([^"']+)["']/i);

    const lineStartMs = beginMatch ? parseTimestamp(beginMatch[1]) : 0;
    const lineEndMs = endMatch ? parseTimestamp(endMatch[1]) : undefined;
    const isBackground = roleMatch && roleMatch[1].toLowerCase().includes("x-bg");
    const alignment: LyricAlignment = agentMatch && agentMatch[1] === "v2" ? "End" : "Start";

    // Extract spans (syllables/words)
    const spanRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
    let spanMatch: RegExpExecArray | null;

    const syllables: { startMs: number; endMs: number; text: string; hasTrailingSpace: boolean }[] = [];
    let plainText = "";

    while ((spanMatch = spanRegex.exec(pBody)) !== null) {
      const spanAttrs = spanMatch[1];
      const rawText = spanMatch[2].replace(/<[^>]+>/g, ""); // strip inner tags

      const sBegin = spanAttrs.match(/\bbegin=["']([^"']+)["']/i);
      const sEnd = spanAttrs.match(/\bend=["']([^"']+)["']/i);

      const startMs = sBegin ? parseTimestamp(sBegin[1]) : lineStartMs;
      const endMs = sEnd ? parseTimestamp(sEnd[1]) : startMs + 300;

      const hasTrailingSpace = /\s$/.test(rawText);
      const trimmedText = rawText.trim();

      if (trimmedText) {
        syllables.push({
          startMs,
          endMs,
          text: trimmedText,
          hasTrailingSpace,
        });
        plainText += rawText;
      }
    }

    // Merge adjacent syllables into words when there is no whitespace between them
    const words: LyricWord[] = [];
    let currentWord: { startMs: number; endMs: number; text: string } | null = null;

    for (const syl of syllables) {
      if (!currentWord) {
        currentWord = { startMs: syl.startMs, endMs: syl.endMs, text: syl.text };
      } else {
        currentWord.text += syl.text;
        currentWord.endMs = Math.max(currentWord.endMs, syl.endMs);
      }

      if (syl.hasTrailingSpace) {
        words.push(currentWord);
        currentWord = null;
      }
    }
    if (currentWord) {
      words.push(currentWord);
    }

    const cleanedLineText = (plainText || pBody.replace(/<[^>]+>/g, "")).trim();
    if (!cleanedLineText) continue;

    const line: LyricLine = {
      startTimeMs: lineStartMs,
      endTimeMs: lineEndMs || (words.length ? words[words.length - 1].endMs : lineStartMs + 3000),
      text: cleanedLineText,
      words: words.length > 0 ? words : undefined,
      alignment,
    };

    if (isBackground && lines.length > 0) {
      lines[lines.length - 1].background = line;
    } else {
      lines.push(line);
    }
  }

  // Sort lines chronologically
  lines.sort((a, b) => a.startTimeMs - b.startTimeMs);

  // Insert instrumental gaps
  return withInstrumentalGaps(lines);
}

/**
 * Inserts placeholder gap lines during long instrumental stretches (>= 4000ms).
 */
export function withInstrumentalGaps(lines: LyricLine[]): LyricLine[] {
  if (!lines.length) return [];
  const result: LyricLine[] = [];

  // If track starts with an intro of >= 4s
  if (lines[0].startTimeMs >= MIN_GAP_MS) {
    result.push({
      startTimeMs: 0,
      endTimeMs: lines[0].startTimeMs,
      text: "",
      isGap: true,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    result.push(current);

    const next = lines[i + 1];
    if (!next) continue;

    const currentEnd = current.endTimeMs || current.startTimeMs + 2500;
    const silenceDuration = next.startTimeMs - currentEnd;

    if (silenceDuration >= MIN_GAP_MS) {
      result.push({
        startTimeMs: currentEnd,
        endTimeMs: next.startTimeMs,
        text: "",
        isGap: true,
      });
    }
  }

  return result;
}
