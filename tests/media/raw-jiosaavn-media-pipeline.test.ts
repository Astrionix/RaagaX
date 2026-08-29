import { describe, it, expect } from 'vitest';
import { JioSaavnMediaPipeline } from '@/lib/media/JioSaavnMediaPipeline';
import { StreamResolver } from '@/lib/streamResolver';
import { Song } from '@/types/music';

describe('RaagaX Strict Raw JioSaavn Media Pipeline & Zero-Fallback Suite', () => {
  const pipeline = JioSaavnMediaPipeline.getInstance();

  it('1. Rejects external fallback providers (Pixabay, YouTube, Spotify)', () => {
    const fakeSong1: Partial<Song> = {
      id: 'fake_1',
      title: 'Fake Track',
      audioUrl: 'https://cdn.pixabay.com/audio/test.mp3',
    };
    const fakeSong2: Partial<Song> = {
      id: 'fake_2',
      title: 'YouTube Track',
      audioUrl: 'https://youtube.com/watch?v=12345',
    };
    const validSong: Partial<Song> = {
      id: 'saavn_123',
      title: 'Rana Kumbha',
      audioUrl: 'https://aac.saavncdn.com/123/sample_320.mp4',
    };

    expect(pipeline.isValidRawJioSaavnTrack(fakeSong1 as Song)).toBe(false);
    expect(pipeline.isValidRawJioSaavnTrack(fakeSong2 as Song)).toBe(false);
    expect(pipeline.isValidRawJioSaavnTrack(validSong as Song)).toBe(true);
  });

  it('2. Selects the highest available real quality directly from JioSaavn downloadUrl array', () => {
    const downloadUrls = [
      { quality: '12kbps', url: 'https://aac.saavncdn.com/test_12.mp4' },
      { quality: '48kbps', url: 'https://aac.saavncdn.com/test_48.mp4' },
      { quality: '96kbps', url: 'https://aac.saavncdn.com/test_96.mp4' },
      { quality: '160kbps', url: 'https://aac.saavncdn.com/test_160.mp4' },
      { quality: '320kbps', url: 'https://aac.saavncdn.com/test_320.mp4' },
    ];

    const result = pipeline.selectHighestRawStream(downloadUrls);
    expect(result.streamUrl).toBe('https://aac.saavncdn.com/test_320.mp4');
    expect(result.bitrate).toBe('320 kbps');
  });

  it('3. Falls back cleanly to 160kbps or 256kbps when 320kbps is NOT provided by JioSaavn without fabricating URLs', () => {
    const downloadUrls = [
      { quality: '48kbps', url: 'https://aac.saavncdn.com/test_48.mp4' },
      { quality: '160kbps', url: 'https://aac.saavncdn.com/test_160.mp4' },
    ];

    const result = pipeline.selectHighestRawStream(downloadUrls);
    expect(result.streamUrl).toBe('https://aac.saavncdn.com/test_160.mp4');
    expect(result.bitrate).toBe('160 kbps');
  });

  it('4. Formats raw JioSaavn cover image to direct 500x500 CDN URL without proxying or Supabase storage', () => {
    const rawCover = 'http://c.saavncdn.com/123/album_150x150.jpg';
    const formatted = pipeline.getRawJioSaavnCoverUrl(rawCover, '500x500');

    expect(formatted).toBe('https://c.saavncdn.com/123/album_500x500.jpg');
    expect(formatted).not.toContain('supabase.co');
    expect(formatted).not.toContain('/api/proxy');
  });

  it('5. Marks missing or unresolvable artwork as null rather than generating fake placeholder artwork', () => {
    expect(pipeline.getRawJioSaavnCoverUrl(null)).toBeNull();
    expect(pipeline.getRawJioSaavnCoverUrl('')).toBeNull();
    expect(pipeline.getRawJioSaavnCoverUrl('http://c.saavncdn.com/null/null.jpg')).toBeNull();
  });

  it('6. Produces strict telemetry diagnostics verifying ZERO transcoding, ZERO proxies, and ZERO fallback providers', () => {
    const sampleTrack: Song = {
      id: 'track_999',
      title: 'Deva Deva',
      artist: 'Arijit Singh',
      artistId: 'art_arijit',
      album: 'Brahmastra',
      albumId: 'alb_brahmastra',
      duration: 270,
      coverUrl: 'https://c.saavncdn.com/999/brahmastra_500x500.jpg',
      audioUrl: 'https://aac.saavncdn.com/999/deva_deva_320.mp4',
      genre: 'HINDI HITS',
      category: 'latest_telugu',
      releaseYear: 2022,
      plays: 500000,
      likes: 50000,
      downloads: 20000,
      audioQuality: '24-bit FLAC',
      bitrate: '320 kbps',
      sampleRate: '48 kHz',
      codec: 'AAC HQ Stream',
    };

    const diagnostics = pipeline.inspectPipeline(sampleTrack);
    expect(diagnostics.provider).toBe('JioSaavn');
    expect(diagnostics.transcoding).toBe('NONE');
    expect(diagnostics.proxy).toBe('NONE');
    expect(diagnostics.fallback).toBe('NONE');
    expect(diagnostics.selectedBitrate).toBe('320 kbps');
    expect(diagnostics.isPlayable).toBe(true);
    expect(diagnostics.hasArtwork).toBe(true);
  });

  it('7. Rejects editorial, curated, and playlist banners from being assigned as song/album artwork', () => {
    const playlistCover = 'https://c.saavncdn.com/editorial/WorldMusicDayTop10Telugu_500x500.jpg';
    const chartCover = 'https://c.saavncdn.com/featured/TrendingTodayTelugu_150x150.jpg';
    const validAlbumCover = 'https://c.saavncdn.com/832/Devara-Part-1-Telugu-2024-20240927140417-500x500.jpg';
    const validSongCover = 'https://c.saavncdn.com/999/Chuttamalle-500x500.jpg';

    expect(pipeline.isPlaylistOrDiscoveryArtwork(playlistCover)).toBe(true);
    expect(pipeline.isPlaylistOrDiscoveryArtwork(chartCover)).toBe(true);
    expect(pipeline.isPlaylistOrDiscoveryArtwork(validAlbumCover)).toBe(false);
    expect(pipeline.isPlaylistOrDiscoveryArtwork(validSongCover)).toBe(false);

    expect(pipeline.isDirectSongOrAlbumArtwork(playlistCover)).toBe(false);
    expect(pipeline.isDirectSongOrAlbumArtwork(chartCover)).toBe(false);
    expect(pipeline.isDirectSongOrAlbumArtwork(validAlbumCover)).toBe(true);
    expect(pipeline.isDirectSongOrAlbumArtwork(validSongCover)).toBe(true);
  });

  it('8. Test Case (Chuttamalle / Devara Part 1): Resolves actual Devara Part 1 album artwork and NEVER playlist artwork', () => {
    const playlistCover = 'https://c.saavncdn.com/editorial/WorldMusicDayTop10Telugu_500x500.jpg';
    const devaraAlbumCover = 'https://c.saavncdn.com/832/Devara-Part-1-Telugu-2024-20240927140417-500x500.jpg';

    // Track discovered inside curated playlist "World Music Day – Top 10 Telugu"
    const resolvedArtwork = pipeline.resolveSongArtwork({
      songCoverUrl: playlistCover, // Contaminated playlist image
      albumCoverUrl: devaraAlbumCover, // True album artwork
      coverUrl: playlistCover,
    });

    expect(resolvedArtwork).toBe(devaraAlbumCover);
    expect(resolvedArtwork).not.toContain('editorial');
    expect(resolvedArtwork).not.toContain('WorldMusicDay');
  });

  it('9. Consistent Artwork Across Entry Points: Same canonical song returns same authentic artwork regardless of origin', () => {
    const devaraAlbumCover = 'https://c.saavncdn.com/832/Devara-Part-1-Telugu-2024-20240927140417-500x500.jpg';
    
    // Entry Point 1: Curated Playlist
    const fromPlaylist = pipeline.resolveSongArtwork({
      albumCoverUrl: devaraAlbumCover,
      coverUrl: 'https://c.saavncdn.com/editorial/Top10Telugu_500x500.jpg',
    });

    // Entry Point 2: Search
    const fromSearch = pipeline.resolveSongArtwork({
      albumCoverUrl: devaraAlbumCover,
      coverUrl: devaraAlbumCover,
    });

    // Entry Point 3: Category Browse
    const fromCategory = pipeline.resolveSongArtwork({
      albumCoverUrl: devaraAlbumCover,
      coverUrl: 'https://c.saavncdn.com/playlists/TeluguHits_500x500.jpg',
    });

    // Entry Point 4: Recommendation
    const fromRecommendation = pipeline.resolveSongArtwork({
      albumCoverUrl: devaraAlbumCover,
      coverUrl: 'https://c.saavncdn.com/channels/RadioTelugu_500x500.jpg',
    });

    expect(fromPlaylist).toBe(devaraAlbumCover);
    expect(fromSearch).toBe(devaraAlbumCover);
    expect(fromCategory).toBe(devaraAlbumCover);
    expect(fromRecommendation).toBe(devaraAlbumCover);
  });
});
