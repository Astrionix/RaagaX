/**
 * InternetDateScraper
 * Uses reliable public Internet APIs (like iTunes Search API) to scrape 
 * exact release dates for songs when the primary provider only gives a year.
 */

export class InternetDateScraper {
  /**
   * Fetches the exact release date of a song.
   * Returns an ISO date string (e.g., "2026-06-19T12:00:00Z") or null if not found.
   */
  public static async fetchExactReleaseDate(title: string, artist: string): Promise<string | null> {
    try {
      // Clean up title for better search results
      const cleanTitle = title.replace(/[\(\[].*?[\)\]]/g, '').trim();
      const cleanArtist = artist.split(',')[0].trim();
      
      const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
      const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`;
      
      const response = await fetch(url, {
        // Adding a short timeout so we don't hang the discovery process
        signal: AbortSignal.timeout(3000) 
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return data.results[0].releaseDate || null;
      }
      
      return null;
    } catch (error) {
      console.warn(`[InternetDateScraper] Failed to scrape date for ${title}:`, error);
      return null;
    }
  }
}
