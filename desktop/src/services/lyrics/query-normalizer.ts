/**
 * Sanitizes YouTube track titles and artists for external lyrics databases.
 * Directly ported from Raaga app / BitChord LyricsQuery logic.
 */

const CREDITS_PATTERNS = [
  // Bracketed credits: (feat. X), [ft. X], (with X)
  /\s*[(\[]\s*(feat|ft|featuring|with)\b[^)\]]*[)\]]/gi,
  // The same, unbracketed and running to the end of the title
  /\s+(feat|ft|featuring)\.?\s+.*$/gi,
  // Packaging labels, not song titles
  /\s*[(\[]\s*(official\s*)?(music\s*)?(video|audio|visuali[sz]er|lyrics?\s*video|lyrics?|m\/?v|hd|hq|4k|full\s*song)\s*[)\]]/gi,
  /\s*[(\[]\s*official\s*[)\]]/gi,
];

/**
 * Cleans track title for lyrics searches.
 * Deliberately preserves versions like (Remix), (Live), (Acoustic), (Sped Up)
 * because stripping them yields the wrong lyrics.
 */
export function normalizeTitle(title: string): string {
  let cleaned = title || "";
  for (const pattern of CREDITS_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim().replace(/[,-–—]+$/, "").trim();
  return cleaned || title.trim();
}

/**
 * Strips " - Topic" off auto-generated YouTube channel artist names.
 */
export function normalizeArtist(artist: string): string {
  if (!artist) return "";
  let cleaned = artist.replace(/\s*-\s*Topic$/i, "").trim();
  // Strip trailing "feat." or ", ..." if multiple artists are separated by comma
  cleaned = cleaned.replace(/\s+(feat|ft)\.?.*$/i, "").trim();
  return cleaned || artist.trim();
}
