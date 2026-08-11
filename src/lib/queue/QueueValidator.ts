import { Song } from '@/types/music';

export class QueueValidator {
  
  /**
   * Validates if a song meets the production queue invariant.
   */
  public static isValidSong(song: Song): boolean {
    if (!song.id || song.id.startsWith('auto-') || song.id.includes('generated')) return false;
    if (!song.title || song.title.toLowerCase().includes('generated track')) return false;
    if (!song.artist || song.artist.toLowerCase().includes('auto artist')) return false;
    if (!song.duration || song.duration <= 0) return false;
    
    // Artwork must not be the exact generic fallback string used for auto-generated items previously.
    // Assuming UI will handle generic fallback display if missing, but we shouldn't have 'placeholder' as url.
    if (song.coverUrl && song.coverUrl.includes('placeholder')) return false;

    return true;
  }

  /**
   * Normalizes a string for deduplication (removes (Remastered), (From "Movie"), etc.)
   */
  public static normalizeString(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/\s*\(.*?(remaster|movie|soundtrack|video|lyric|hd|4k).*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Normalizes an artist name by extracting the primary artist.
   */
  public static normalizeArtist(artist: string): string {
    if (!artist) return '';
    // Split by common delimiters and take the first one
    const parts = artist.split(/[,&]| ft\.| feat\./i);
    return this.normalizeString(parts[0]);
  }

  /**
   * Creates a strict deduplication key.
   */
  public static getDeduplicationKey(song: Song): string {
    const normTitle = this.normalizeString(song.title);
    const normArtist = this.normalizeArtist(song.artist);
    // Duration bucket: round to nearest 10 seconds
    const durationBucket = Math.round(song.duration / 10);
    
    return `${normTitle}|${normArtist}|${durationBucket}`;
  }
}
