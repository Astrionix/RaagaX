import { describe, it, expect } from 'vitest';
import { SongFormatter } from '@/lib/music/SongFormatter';

describe('SongFormatter — Clean Display Title & Movie/Album Extraction', () => {
  it('strips (From &quot;Movie&quot;) and unescapes HTML entities from song titles', () => {
    const raw = 'Gehra Hua (From &quot;Dhurandhar&quot;)';
    const clean = SongFormatter.cleanSongTitle(raw);
    expect(clean).toBe('Gehra Hua');
  });

  it('extracts clean movie name from (From &quot;Movie&quot;) for the album field', () => {
    const rawTitle = 'Chikiri Chikiri (From &quot;Peddi&quot;) - Telugu';
    const rawAlbum = 'Chikiri Chikiri (From &quot;Peddi&quot;) - Telugu';
    const cleanAlbum = SongFormatter.cleanAlbumTitle(rawAlbum, rawTitle);
    expect(cleanAlbum).toBe('Peddi');
  });

  it('strips language suffixes from song titles', () => {
    const raw = 'Rai Rai Raa Raa (From "Peddi") - Telugu';
    const clean = SongFormatter.cleanSongTitle(raw);
    expect(clean).toBe('Rai Rai Raa Raa');
  });

  it('handles complex OST / edition strings cleanly', () => {
    const rawAlbum = 'Manam (Original Motion Picture Soundtrack)';
    const clean = SongFormatter.cleanAlbumTitle(rawAlbum);
    expect(clean).toBe('Manam');
  });

  it('formats entire Song object cleanly without &quot; or clutter', () => {
    const song = {
      id: 'test-1',
      title: 'Aaya Sher (From &quot;The Paradise&quot;) (Telugu)',
      album: 'Aaya Sher (From &quot;The Paradise&quot;) (Telugu)',
      artist: 'Anirudh Ravichander &amp; Vishal Dadlani',
    };

    const formatted = SongFormatter.formatSong(song);
    expect(formatted.title).toBe('Aaya Sher');
    expect(formatted.album).toBe('The Paradise');
    expect(formatted.artist).toBe('Anirudh Ravichander & Vishal Dadlani');
  });
});
