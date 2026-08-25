/**
 * SongFormatter — Universal Clean Display Text Formatter for RaagaX
 *
 * Removes unescaped HTML entities (like &quot;, &#039;, &amp;)
 * Cleans song titles from clutter like (From "Movie"), [From "Movie"], - Telugu, etc.
 * Extracts clean movie/album names so subtitles show the clean movie name without &quot; or clutter.
 */

export class SongFormatter {
  public static decodeHtml(str?: string | null): string {
    if (!str) return '';
    let decoded = str;
    // Decode HTML entities thoroughly
    for (let i = 0; i < 3; i++) {
      if (!decoded.includes('&')) break;
      decoded = decoded
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#34;/gi, '"')
        .replace(/&amp;/gi, '&')
        .replace(/&#38;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&copy;/gi, '')
        .replace(/&reg;/gi, '');
    }
    return decoded.trim();
  }

  /**
   * Extracts clean movie name from a string like "Song (From \"Movie\")" or "Song (From &quot;Movie&quot;)"
   */
  public static extractMovieName(str?: string | null): string | null {
    if (!str) return null;
    const decoded = this.decodeHtml(str);

    // Match (From "MovieName") or [From "MovieName"] or (From MovieName)
    const fromMatch = decoded.match(/[\(\[\{]\s*from\s*[\"\']?\s*([^\"\'\)\]\}]+)\s*[\"\']?\s*[\)\]\}]/i);
    if (fromMatch && fromMatch[1]) {
      const movie = fromMatch[1].trim();
      if (movie.length > 1 && !/^(the|a|an)$/i.test(movie)) {
        return this.cleanAlbumTitle(movie);
      }
    }
    return null;
  }

  /**
   * Cleans a song title for display:
   * e.g. "Chikiri Chikiri (From \"Peddi\") - Telugu" -> "Chikiri Chikiri"
   * e.g. "Gehra Hua (From &quot;Dhurandhar&quot;)" -> "Gehra Hua"
   * e.g. "Tabassum (From &quot;Batwara 1947&quot;)" -> "Tabassum"
   */
  public static cleanSongTitle(title?: string | null): string {
    if (!title) return 'Unknown Title';
    let clean = this.decodeHtml(title);

    // Remove (From "Movie/Album") or [From "Movie/Album"] or (From Movie)
    clean = clean.replace(/[\(\[\{]\s*from\b[^\)\]\}]*[\)\]\}]/gi, '');

    // Remove language qualifiers: - Telugu, (Telugu), [Telugu], - Hindi, etc.
    clean = clean.replace(/\s*[-–—:]\s*(telugu|hindi|tamil|kannada|malayalam|punjabi|english|bhojpuri|bengali|marathi|gujarati)\b.*/gi, '');
    clean = clean.replace(/[\(\[\{]\s*(telugu|hindi|tamil|kannada|malayalam|punjabi|english|bhojpuri|bengali|marathi|gujarati)\s*[\)\]\}]/gi, '');

    // Remove common bracketed audio/video noise
    clean = clean.replace(/[\(\[\{]\s*(original\s+motion\s+picture\s+soundtrack|soundtrack|ost|audio|official|lyrical|video|full\s+song|version|remix|lofi|slowed|reverb|cover|feat\b|with\b|duet|solo)[^\)\]\}]*[\)\]\}]/gi, '');

    // Clean any remaining quotes
    clean = clean.replace(/[\"\']/g, '').trim();

    // Collapse whitespace
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean || this.decodeHtml(title) || 'Unknown Title';
  }

  /**
   * Cleans an album / movie title for display:
   * e.g. "Chikiri Chikiri (From \"Peddi\") - Telugu" -> "Peddi"
   * e.g. "Gehra Hua (From &quot;Dhurandhar&quot;)" -> "Dhurandhar"
   * e.g. "Manam (Original Motion Picture Soundtrack)" -> "Manam"
   */
  public static cleanAlbumTitle(album?: string | null, fallbackSongTitle?: string | null): string {
    if (!album && !fallbackSongTitle) return '';
    const raw = album || fallbackSongTitle || '';

    // First check if a movie name can be extracted from (From "...")
    const extractedMovie = this.extractMovieName(raw);
    if (extractedMovie) {
      return extractedMovie;
    }

    if (fallbackSongTitle) {
      const fromSong = this.extractMovieName(fallbackSongTitle);
      if (fromSong) return fromSong;
    }

    let clean = this.decodeHtml(raw);

    // Remove (From "Movie")
    clean = clean.replace(/[\(\[\{]\s*from\b[^\)\]\}]*[\)\]\}]/gi, '');

    // Remove soundtrack / OST / edition markers
    clean = clean.replace(/[\(\[\{]\s*(original\s+motion\s+picture\s+soundtrack|original\s+soundtrack|soundtrack|ost|deluxe\s+edition|special\s+edition|anniversary\s+edition|ep|single)[^\)\]\}]*[\)\]\}]/gi, '');

    // Remove language tags
    clean = clean.replace(/\s*[-–—:]\s*(telugu|hindi|tamil|kannada|malayalam|punjabi|english)\b.*/gi, '');
    clean = clean.replace(/[\(\[\{]\s*(telugu|hindi|tamil|kannada|malayalam|punjabi|english)\s*[\)\]\}]/gi, '');

    // Clean remaining quotes
    clean = clean.replace(/[\"\']/g, '').trim();
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
  }

  /**
   * Formats a complete Song object so title and album are guaranteed clean for display and UI
   */
  public static formatSong<T extends { title?: string; album?: string; artist?: string }>(song: T): T {
    if (!song) return song;

    const rawTitle = song.title || '';
    const rawAlbum = song.album || '';
    const rawArtist = song.artist || '';

    const cleanTitle = this.cleanSongTitle(rawTitle);
    const cleanAlbum = this.cleanAlbumTitle(rawAlbum, rawTitle) || cleanTitle;
    const cleanArtist = this.decodeHtml(rawArtist);

    return {
      ...song,
      title: cleanTitle,
      album: cleanAlbum,
      artist: cleanArtist,
    };
  }
}
