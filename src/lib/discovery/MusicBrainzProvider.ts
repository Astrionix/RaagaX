export class MusicBrainzProvider {
  private static readonly API_BASE = 'https://musicbrainz.org/ws/2';
  private static readonly USER_AGENT = 'RaagaX_Discovery/1.0.0 ( contact@raagax.com )';
  private static lastRequestTime = 0;

  /**
   * Enforces the MusicBrainz 1 req/sec rate limit
   */
  private static async throttle() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    if (timeSinceLast < 1100) {
      await new Promise(r => setTimeout(r, 1100 - timeSinceLast));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Queries MusicBrainz to verify if a track exists.
   * Returns true if a match is found.
   */
  public static async verifyTrack(title: string, artist: string): Promise<boolean> {
    if (!title) return false;
    
    // Clean up title and artist for better matching
    const cleanTitle = encodeURIComponent(title.replace(/[\(\[].*?[\)\]]/g, '').trim());
    const cleanArtist = encodeURIComponent(artist.split(',')[0].trim()); // Use primary artist
    
    let query = `recording:"${cleanTitle}"`;
    if (artist && artist !== 'Unknown Artist') {
      query += ` AND artist:"${cleanArtist}"`;
    }

    try {
      await this.throttle();
      const response = await fetch(`${this.API_BASE}/recording?query=${query}&fmt=json`, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) return false;
      
      const data = await response.json();
      return data && data.recordings && data.recordings.length > 0;
    } catch (e) {
      console.warn('[MusicBrainz] Verification failed:', e);
      return false; // Fail silently, we don't want to crash discovery if MB is down
    }
  }
}
