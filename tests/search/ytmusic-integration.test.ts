import { describe, it, expect, vi } from 'vitest';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { Song } from '@/types/music';

describe('YouTube Music Integration Engine', () => {
  it('1. Searches YouTube Music and returns valid Song models', async () => {
    const engine = YouTubeMusicEngine.getInstance();
    const songs = await engine.searchSongs('Samajavaragamana', 5);

    expect(Array.isArray(songs)).toBe(true);
    expect(songs.length).toBeGreaterThan(0);

    const first = songs[0];
    expect(first.id).toMatch(/^ytm-/);
    expect(first.title).toBeTruthy();
    expect(first.artist).toBeTruthy();
    expect(first.coverUrl).toBeTruthy();
    expect(first.duration).toBeGreaterThan(0);
    expect(first.audioUrl).toMatch(/^\/api\/ytmusic\/stream\//);
    expect(first.source).toBe('youtube');
  }, 20000);

  it('2. Resolves direct audio stream format for playback', async () => {
    const engine = YouTubeMusicEngine.getInstance();
    // Video: Samajavaragamana by Sid Sriram
    const streamInfo = await engine.getAudioStreamInfo('peLhDdjKUWU');

    expect(streamInfo).not.toBeNull();
    expect(streamInfo?.url).toBeTruthy();
    expect(streamInfo?.mimeType).toContain('audio');
    expect(streamInfo?.expiresAt).toBeGreaterThan(Date.now());
  }, 20000);

  it('3. PlaybackSourceResolver routes ytm- songs to streaming proxy endpoint', async () => {
    const resolver = PlaybackSourceResolver.getInstance();
    const testSong: Song = {
      id: 'ytm-peLhDdjKUWU',
      title: 'Test Song',
      artist: 'Test Artist',
      artistId: 'art-1',
      album: 'Test Album',
      albumId: 'alb-1',
      duration: 200,
      coverUrl: '/app-icon.png',
      audioUrl: '/api/ytmusic/stream/peLhDdjKUWU',
      genre: 'YouTube Music',
      category: 'melody',
      releaseYear: 2026,
      plays: 100,
      likes: 1,
      source: 'youtube',
    };

    const source = await resolver.resolvePlayableSource(testSong);

    expect(source).not.toBeNull();
    expect(source?.type).toBe('remote');
    expect(source?.url).toContain('/api/ytmusic/stream/peLhDdjKUWU');
    expect((source as any)?.videoId).toBe('ytm-peLhDdjKUWU');
  });

  it('4. Fetches lyrics for YouTube Music track', async () => {
    const engine = YouTubeMusicEngine.getInstance();
    const lyrics = await engine.getLyrics('peLhDdjKUWU');

    expect(lyrics).not.toBeNull();
    expect(typeof lyrics).toBe('string');
    expect(lyrics!.length).toBeGreaterThan(10);
  }, 20000);

  it('5. Fetches artist bio and top songs for YouTube Music artist', async () => {
    const engine = YouTubeMusicEngine.getInstance();
    const artist = await engine.getArtistDetails('UCbRSywya_rl8YS15Lo9ttsA');

    expect(artist).not.toBeNull();
    expect(artist?.name).toBeTruthy();
    expect(Array.isArray(artist?.bio)).toBe(true);
    expect(artist?.bio[0]?.text).toBeTruthy();
    expect(Array.isArray(artist?.topSongs)).toBe(true);
    expect(artist?.topSongs.length).toBeGreaterThan(0);
  }, 20000);
});

