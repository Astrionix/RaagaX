import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeMusicEngine } from '@/lib/ytmusic/YouTubeMusicEngine';
import { PlaybackSourceResolver } from '@/lib/playbackSourceResolver';
import { Song } from '@/types/music';

describe('YouTube Music Integration Engine', () => {
  let engine: YouTubeMusicEngine;

  beforeEach(() => {
    engine = YouTubeMusicEngine.getInstance();

    const mockInnertube: any = {
      music: {
        search: vi.fn().mockImplementation(async (query: string, opts: any) => {
          if (opts?.type === 'song') {
            return {
              songs: {
                contents: [
                  {
                    id: 'peLhDdjKUWU',
                    title: 'Samajavaragamana',
                    artists: [{ name: 'Sid Sriram', channel_id: 'UCbRSywya_rl8YS15Lo9ttsA' }],
                    album: { name: 'Ala Vaikunthapurramuloo', id: 'alb_avpl' },
                    duration: { seconds: 215 },
                    thumbnails: [{ url: 'https://i.ytimg.com/vi/peLhDdjKUWU/hqdefault.jpg' }],
                  },
                ],
              },
            };
          }
          return { videos: { contents: [] } };
        }),
        getLyrics: vi.fn().mockResolvedValue({
          description: { text: 'Samajavaragamana Ninu Chusina Kshanana\nManasuna Mamatala Mula Padala' },
        }),
        getArtist: vi.fn().mockResolvedValue({
          header: {
            title: { text: 'Sid Sriram' },
            description: { text: 'Sid Sriram is an Indian-American music producer and playback singer.' },
            thumbnail: { contents: [{ url: 'https://lh3.googleusercontent.com/artist_thumb.jpg' }] },
          },
          sections: [
            {
              title: { text: 'Songs' },
              contents: [
                {
                  id: 'peLhDdjKUWU',
                  title: 'Samajavaragamana',
                  artists: [{ name: 'Sid Sriram' }],
                  duration: { seconds: 215 },
                  thumbnails: [{ url: 'https://i.ytimg.com/vi/peLhDdjKUWU/hqdefault.jpg' }],
                },
              ],
            },
          ],
        }),
      },
      getBasicInfo: vi.fn().mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              itag: 140,
              url: 'https://rr5---sn-4g5edn6k.googlevideo.com/videoplayback?expire=9999999999&id=peLhDdjKUWU',
              mime_type: 'audio/mp4; codecs="mp4a.40.2"',
              bitrate: 160000,
              content_length: '4500000',
              has_audio: true,
              has_video: false,
            },
          ],
        },
      }),
      getInfo: vi.fn().mockResolvedValue({
        streaming_data: {
          adaptive_formats: [
            {
              itag: 140,
              url: 'https://rr5---sn-4g5edn6k.googlevideo.com/videoplayback?expire=9999999999&id=peLhDdjKUWU',
              mime_type: 'audio/mp4; codecs="mp4a.40.2"',
              bitrate: 160000,
              content_length: '4500000',
              has_audio: true,
              has_video: false,
            },
          ],
        },
      }),
    };

    vi.spyOn(engine as any, 'getClient').mockResolvedValue(mockInnertube);
  });

  it('1. Searches YouTube Music and returns valid Song models', async () => {
    const songs = await engine.searchSongs('Samajavaragamana', 5);

    expect(Array.isArray(songs)).toBe(true);
    expect(songs.length).toBeGreaterThan(0);

    const first = songs[0];
    expect(first.id).toBe('ytm-peLhDdjKUWU');
    expect(first.title).toBe('Samajavaragamana');
    expect(first.artist).toBe('Sid Sriram');
    expect(first.coverUrl).toBeTruthy();
    expect(first.duration).toBe(215);
    expect(first.audioUrl).toBe('/api/ytmusic/stream/peLhDdjKUWU');
    expect(first.source).toBe('youtube');
  });

  it('2. Resolves direct audio stream format for playback', async () => {
    const streamInfo = await engine.getAudioStreamInfo('peLhDdjKUWU');

    expect(streamInfo).not.toBeNull();
    expect(streamInfo?.url).toContain('googlevideo.com');
    expect(streamInfo?.mimeType).toContain('audio');
  });

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
    const lyrics = await engine.getLyrics('peLhDdjKUWU');

    expect(lyrics).not.toBeNull();
    expect(typeof lyrics).toBe('string');
    expect(lyrics).toContain('Samajavaragamana');
  });

  it('5. Fetches artist bio and top songs for YouTube Music artist', async () => {
    const artist = await engine.getArtistDetails('UCbRSywya_rl8YS15Lo9ttsA');

    expect(artist).not.toBeNull();
    expect(artist?.name).toBe('Sid Sriram');
    expect(Array.isArray(artist?.bio)).toBe(true);
    expect(artist?.bio[0]?.text).toContain('Sid Sriram');
    expect(Array.isArray(artist?.topSongs)).toBe(true);
    expect(artist?.topSongs.length).toBeGreaterThan(0);
  });
});
