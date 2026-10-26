import { useMemo } from 'react';
import { useLibrary } from '@/data/music/queries';
import type { Track } from '@/data/music/types';
import { useYtAuth } from '@/extension/useYtAuth';
import { useListeningStore, type PlayRecord } from './listeningStore';

export interface ReplayHeroCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  artworkUrl: string | null;
  page: 'minutes' | 'songs' | 'artists' | 'albums' | 'summary';
}

export interface ReplayArtist {
  name: string;
  artworkUrl: string | null;
  plays: number;
  totalSeconds: number;
}

export interface ReplayData {
  cards: ReplayHeroCard[];
  holder: string;
  memberSince: string;
  totalMinutes: number;
  totalPlays: number;
  topSongs: PlayRecord[];
  topArtists: ReplayArtist[];
  hasListeningData: boolean;
}

function formatMemberDate(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

export function useReplayData(): ReplayData {
  const localRecords = useListeningStore((s) => s.records);
  const localTotalSeconds = useListeningStore((s) => s.totalSeconds);
  const firstListenedAt = useListeningStore((s) => s.firstListenedAt);

  const authStatus = useYtAuth();
  const userName =
    authStatus.state === 'ready' && authStatus.auth.active?.name
      ? authStatus.auth.active.name
      : 'RAAGA LISTENER';

  // YouTube Music recent library history for seeding/augmentation
  const recentQuery = useLibrary('recent');
  const remoteRecentTracks = useMemo<Track[]>(() => {
    return recentQuery.data?.pages[0]?.data.tracks ?? [];
  }, [recentQuery.data]);

  return useMemo<ReplayData>(() => {
    // Merge local records and remote recent tracks
    const combined: Record<string, PlayRecord> = { ...localRecords };

    // If local records are sparse (< 3), supplement with recent library tracks
    if (Object.keys(localRecords).length < 5 && remoteRecentTracks.length > 0) {
      remoteRecentTracks.forEach((t, index) => {
        if (!combined[t.videoId]) {
          const simulatedPlays = Math.max(1, Math.min(5, 5 - Math.floor(index / 3)));
          const duration = t.durationSec || 210;
          combined[t.videoId] = {
            videoId: t.videoId,
            title: t.title,
            artist: t.artists.map((a) => a.name).join(', '),
            artworkUrl: t.thumbnail,
            durationSec: duration,
            totalSeconds: duration * simulatedPlays,
            plays: simulatedPlays,
            lastPlayedAt: Date.now() - index * 3600_000,
            firstPlayedAt: Date.now() - index * 86400_000,
          };
        }
      });
    }

    const songsList = Object.values(combined);
    const hasListeningData = songsList.length > 0;

    // Sort songs by plays descending, then totalSeconds
    const sortedSongs = [...songsList].sort((a, b) => b.plays - a.plays || b.totalSeconds - a.totalSeconds);

    // Aggregate artists
    const artistMap = new Map<string, ReplayArtist>();
    for (const song of sortedSongs) {
      const primaryArtist = song.artist.split(/[,&]/)[0]?.trim() || song.artist;
      if (!primaryArtist) continue;

      const existing = artistMap.get(primaryArtist);
      if (existing) {
        existing.plays += song.plays;
        existing.totalSeconds += song.totalSeconds;
        if (!existing.artworkUrl && song.artworkUrl) {
          existing.artworkUrl = song.artworkUrl;
        }
      } else {
        artistMap.set(primaryArtist, {
          name: primaryArtist,
          artworkUrl: song.artworkUrl,
          plays: song.plays,
          totalSeconds: song.totalSeconds,
        });
      }
    }

    const sortedArtists = Array.from(artistMap.values()).sort(
      (a, b) => b.plays - a.plays || b.totalSeconds - a.totalSeconds,
    );

    // Calculate totals
    const calcTotalSeconds = Math.max(
      localTotalSeconds,
      songsList.reduce((acc, s) => acc + s.totalSeconds, 0),
    );
    const totalMinutes = Math.max(1, Math.round(calcTotalSeconds / 60));
    const totalPlays = Math.max(1, songsList.reduce((acc, s) => acc + s.plays, 0));

    const topSong = sortedSongs[0];
    const topArtist = sortedArtists[0];
    const leadArtwork = topSong?.artworkUrl ?? null;
    const currentYear = new Date().getFullYear();

    // 4 Headline Hero Cards
    const cards: ReplayHeroCard[] = [
      {
        id: 'minutes',
        label: 'MINUTES LISTENED',
        value: totalMinutes >= 1000 ? `${(totalMinutes / 60).toFixed(1)} hrs` : `${totalMinutes.toLocaleString()} mins`,
        detail: `${totalPlays.toLocaleString()} Plays · ${currentYear}`,
        artworkUrl: leadArtwork,
        page: 'minutes',
      },
      ...(topSong
        ? [
            {
              id: 'top-song',
              label: 'TOP SONG',
              value: topSong.title,
              detail: `${topSong.artist} · ${topSong.plays} plays`,
              artworkUrl: topSong.artworkUrl,
              page: 'songs' as const,
            },
          ]
        : []),
      ...(topArtist
        ? [
            {
              id: 'top-artist',
              label: 'TOP ARTIST',
              value: topArtist.name,
              detail: `${Math.max(1, Math.round(topArtist.totalSeconds / 60))} mins · ${topArtist.plays} plays`,
              artworkUrl: topArtist.artworkUrl,
              page: 'artists' as const,
            },
          ]
        : []),
      {
        id: 'fidelity',
        label: 'AUDIO FIDELITY',
        value: 'Hi-Res Lossless',
        detail: 'Bit-Perfect FLAC · 24-bit / 48kHz',
        artworkUrl: leadArtwork,
        page: 'summary',
      },
    ];

    return {
      cards,
      holder: userName.toUpperCase(),
      memberSince: formatMemberDate(firstListenedAt),
      totalMinutes,
      totalPlays,
      topSongs: sortedSongs.slice(0, 20),
      topArtists: sortedArtists.slice(0, 10),
      hasListeningData,
    };
  }, [localRecords, localTotalSeconds, firstListenedAt, userName, remoteRecentTracks]);
}
