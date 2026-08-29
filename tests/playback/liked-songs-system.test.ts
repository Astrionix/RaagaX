import { describe, it, expect, vi } from 'vitest';

// Simulating fallback mapping and sorting from SongResolver & FavoritesView
interface MockSong {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
  releaseYear: number;
  releaseDate?: string | null;
}

function generateFallbackSong(id: string): MockSong {
  return {
    id,
    title: 'Unknown Track',
    artist: 'Unknown Artist',
    coverUrl: '/app-icon.png',
    duration: 180,
    releaseYear: new Date().getFullYear(),
  };
}

describe('Liked Songs System Tests', () => {
  describe('Unresolved Track Fallback Generator', () => {
    it('should generate a valid fallback object for a missing track ID', () => {
      const fallback = generateFallbackSong('missing_track_123');
      expect(fallback.id).toBe('missing_track_123');
      expect(fallback.title).toBe('Unknown Track');
      expect(fallback.artist).toBe('Unknown Artist');
      expect(fallback.coverUrl).toBe('/app-icon.png');
      expect(fallback.duration).toBe(180);
      expect(fallback.releaseYear).toBe(new Date().getFullYear());
    });
  });

  describe('Deduplication & Attempted Resolving set', () => {
    it('should filter out already attempted IDs and only resolve new ones', () => {
      const attempted = new Set<string>(['song1', 'song2']);
      const likedSongIds = ['song1', 'song2', 'song3', 'song4'];
      const knownMap = new Map<string, MockSong>(); // none known in memory yet
      
      const missingIds = likedSongIds.filter((id) => !knownMap.has(id) && !attempted.has(id));
      
      // Should only try to resolve song3 and song4
      expect(missingIds).toEqual(['song3', 'song4']);

      // Simulating marking them as attempted
      missingIds.forEach((id) => attempted.add(id));
      expect(attempted.has('song3')).toBe(true);
      expect(attempted.has('song4')).toBe(true);
    });
  });

  describe('Local Sorting & Release Year Parsing', () => {
    const rawDbSongs = [
      { id: '1', title: 'Zara Zara', artist: 'Bombay Jayashri', cover_url: 'cover1.jpg', release_date: '2001-05-12' },
      { id: '2', title: 'Jawan Title Track', artist: 'Anirudh', cover_url: 'cover2.jpg', release_date: '2023-09-07' },
      { id: '3', title: 'Manjal Veyil', artist: 'Hariharan', cover_url: '', release_date: null }, // no cover, no date
    ];

    const mappedSongs: MockSong[] = rawDbSongs.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      coverUrl: s.cover_url || '/app-icon.png',
      duration: 180,
      releaseYear: s.release_date ? new Date(s.release_date).getFullYear() : 2024,
      releaseDate: s.release_date || null,
    }));

    it('should dynamically parse releaseYear from release_date or fallback to 2024', () => {
      expect(mappedSongs[0].releaseYear).toBe(2001);
      expect(mappedSongs[1].releaseYear).toBe(2023);
      expect(mappedSongs[2].releaseYear).toBe(2024);
    });

    it('should sort locally by Title A-Z', () => {
      const sorted = [...mappedSongs].sort((a, b) => a.title.localeCompare(b.title));
      expect(sorted[0].title).toBe('Jawan Title Track');
      expect(sorted[1].title).toBe('Manjal Veyil');
      expect(sorted[2].title).toBe('Zara Zara');
    });

    it('should sort locally by Release Date (Newest first)', () => {
      const sorted = [...mappedSongs].sort((a, b) => {
        const dateA = a.releaseDate || `${a.releaseYear}-01-01`;
        const dateB = b.releaseDate || `${b.releaseYear}-01-01`;
        return dateB.localeCompare(dateA);
      });
      expect(sorted[0].id).toBe('3'); // 2024
      expect(sorted[1].id).toBe('2'); // 2023
      expect(sorted[2].id).toBe('1'); // 2001
    });
  });

  describe('Duration Formatting (Hours & Minutes)', () => {
    function formatTotalDuration(songs: { duration?: number }[]): string {
      const totalDurationSec = songs.reduce((acc, s) => acc + (s.duration || 180), 0);
      const totalMins = Math.round(totalDurationSec / 60);
      if (totalMins <= 0) return '';
      const hours = Math.floor(totalMins / 60);
      const minutes = totalMins % 60;
      if (hours > 0) {
        return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
      }
      return `${minutes} min`;
    }

    it('should format duration in hours and minutes when >= 60 minutes', () => {
      // 83 tracks with total ~350 minutes = 5 hours 50 minutes
      const songs = Array.from({ length: 83 }, () => ({ duration: Math.round(350 * 60 / 83) }));
      expect(formatTotalDuration(songs)).toBe('5 hr 50 min');
    });

    it('should format exact hours without 0 min', () => {
      const songs = [{ duration: 7200 }]; // 2 hours exact
      expect(formatTotalDuration(songs)).toBe('2 hr');
    });

    it('should format minutes only when < 60 minutes', () => {
      const songs = [{ duration: 180 }, { duration: 240 }]; // 7 minutes
      expect(formatTotalDuration(songs)).toBe('7 min');
    });
  });
});
