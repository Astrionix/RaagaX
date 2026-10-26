import React, { useState } from 'react';
import { Clock, Play, Share2, Check } from 'lucide-react';
import { playList, playTrack } from '@/components/music/play';
import { useReplayData } from '@/data/stats/useReplayData';
import type { Track } from '@/data/music/types';
import { ReplayCard } from '@/components/replay/ReplayCard';

type ReplayPeriod = 'this_month' | 'this_year' | 'all_time';

function formatListening(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return minutes === 1 ? '1 min' : `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours.toLocaleString()} hr` : `${hours.toLocaleString()} hr ${rest} min`;
}

function stringColor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export default function ReplayPage() {
  const { cards, holder, memberSince, totalMinutes, totalPlays, topSongs, topArtists, hasListeningData } =
    useReplayData();
  const [period, setPeriod] = useState<ReplayPeriod>('this_year');
  const [copied, setCopied] = useState(false);

  const currentYear = new Date().getFullYear();
  const periodLabel =
    period === 'this_month'
      ? new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : period === 'this_year'
      ? String(currentYear)
      : 'All Time';

  const handlePlayReplay = () => {
    if (topSongs.length === 0) return;
    const tracks: Track[] = topSongs.map((s) => ({
      videoId: s.videoId,
      title: s.title,
      artists: [{ name: s.artist, id: null }],
      album: null,
      durationSec: s.durationSec,
      explicit: false,
      thumbnail: s.artworkUrl,
      index: null,
      plays: `${s.plays} plays`,
    }));
    playList(tracks, 0, { source: { title: `Replay ${periodLabel}`, type: 'other' } });
  };

  const handlePlaySingle = (song: (typeof topSongs)[0]) => {
    const track: Track = {
      videoId: song.videoId,
      title: song.title,
      artists: [{ name: song.artist, id: null }],
      album: null,
      durationSec: song.durationSec,
      explicit: false,
      thumbnail: song.artworkUrl,
      index: null,
      plays: `${song.plays} plays`,
    };
    playTrack(track);
  };

  const handleShare = async () => {
    const topSong = topSongs[0];
    const topArtist = topArtists[0];
    const text = `🎵 My Raaga Replay (${periodLabel})
⏱️ ${totalMinutes.toLocaleString()} minutes listened (${totalPlays.toLocaleString()} plays)
🏆 Top Song: ${topSong ? `${topSong.title} · ${topSong.artist}` : 'N/A'}
👑 Top Artist: ${topArtist ? topArtist.name : 'N/A'}
🎧 Enjoying Hi-Res Lossless on Raaga!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Raaga Replay ${periodLabel}`, text });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="mx-(--body-gutter) min-h-full pb-36 pt-6">
      {/* Heading (matches Desktop DesktopReplayUi.kt lines 90-108) */}
      <div className="mb-6">
        <h1 className="type-header-emphasized text-primary">Replay</h1>
        <p className="type-callout-emphasized text-secondary mt-0.5">{periodLabel}</p>

        {/* Period Picker - Plain text links */}
        <div className="flex items-center gap-6 mt-3">
          {(
            [
              ['this_month', 'This Month'],
              ['this_year', 'This Year'],
              ['all_time', 'All Time'],
            ] as const
          ).map(([key, label]) => {
            const active = period === key;
            return (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`text-sm font-bold transition-colors ${
                  active ? 'text-primary' : 'text-secondary hover:text-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State when no listening data has been recorded yet */}
      {!hasListeningData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="size-11 text-secondary/50 mb-4" strokeWidth={1.5} />
          <h2 className="text-xl font-bold text-primary mb-2">Not enough listening yet</h2>
          <p className="text-sm text-secondary max-w-sm">
            {period === 'this_month'
              ? 'Nothing this month. Play some music and it will fill up.'
              : 'Play some music and your Replay will build itself.'}
          </p>
        </div>
      ) : (
        <>
          {/* Hero Cards Carousel (Desktop DesktopScrollableRow with ReplayCreditCard) */}
          <div className="mb-8">
            <div
              className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {cards.map((card) => (
                <div key={card.id} className="w-[300px] flex-none snap-start">
                  <ReplayCard card={card} holder={holder} memberSince={memberSince} />
                </div>
              ))}
            </div>
          </div>

          {/* Action Row - Plain text buttons */}
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={handlePlayReplay}
              className="inline-flex items-center gap-2 text-sm md:text-base font-bold text-key hover:opacity-85 active:scale-95 transition-all"
            >
              <Play size={16} fill="currentColor" />
              <span>Play your Replay</span>
            </button>

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 text-sm md:text-base font-bold text-primary hover:text-key active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>

          {/* Charts Row: Top Songs & Top Artists side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-10 max-w-5xl">
            {/* Top Songs Chart */}
            <section>
              <h2 className="type-title-1-emphasized text-primary mb-3">Top Songs</h2>
              <div className="flex flex-col">
                {topSongs.slice(0, 5).map((song, i) => (
                  <div
                    key={song.videoId}
                    onClick={() => handlePlaySingle(song)}
                    className="group flex items-center py-2 px-2 -mx-2 rounded-lg hover:bg-quinary/60 transition-colors cursor-pointer"
                  >
                    {/* Rank Badge: #1 in key accent (#fa2d48), others quiet */}
                    <span
                      className={`w-7 text-left font-extrabold text-base flex-none ${
                        i === 0 ? 'text-key' : 'text-tertiary'
                      }`}
                    >
                      {i + 1}
                    </span>

                    {/* 48px square artwork (rounded 6px) */}
                    <div className="relative size-12 flex-none rounded-[6px] overflow-hidden bg-quinary mr-3">
                      {song.artworkUrl ? (
                        <img src={song.artworkUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div
                          className="size-full grid place-items-center text-white font-extrabold text-base"
                          style={{ background: stringColor(song.title) }}
                        >
                          {song.title[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                        <Play size={16} fill="white" className="text-white" />
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="type-body-emphasized text-primary truncate group-hover:text-key transition-colors">
                        {song.title}
                      </p>
                      <p className="type-caption-1 text-secondary truncate mt-0.5">
                        {song.artist} · {formatListening(song.totalSeconds * 1000)}
                      </p>
                    </div>

                    {/* Play count */}
                    {song.plays > 0 && (
                      <span className="type-caption-1 text-tertiary flex-none font-medium">
                        {song.plays}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Top Artists Chart */}
            <section>
              <h2 className="type-title-1-emphasized text-primary mb-3">Top Artists</h2>
              <div className="flex flex-col">
                {topArtists.slice(0, 5).map((artist, i) => (
                  <div
                    key={artist.name}
                    className="flex items-center py-2 px-2 -mx-2 rounded-lg hover:bg-quinary/40 transition-colors"
                  >
                    {/* Rank Badge */}
                    <span
                      className={`w-7 text-left font-extrabold text-base flex-none ${
                        i === 0 ? 'text-key' : 'text-tertiary'
                      }`}
                    >
                      {i + 1}
                    </span>

                    {/* 48px circular avatar */}
                    <div className="size-12 flex-none rounded-full overflow-hidden bg-quinary mr-3">
                      {artist.artworkUrl ? (
                        <img src={artist.artworkUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div
                          className="size-full grid place-items-center text-white font-extrabold text-base"
                          style={{ background: stringColor(artist.name) }}
                        >
                          {artist.name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Title & Subtitle */}
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="type-body-emphasized text-primary truncate">{artist.name}</p>
                      <p className="type-caption-1 text-secondary truncate mt-0.5">
                        {formatListening(artist.totalSeconds * 1000)}
                      </p>
                    </div>

                    {/* Play count */}
                    {artist.plays > 0 && (
                      <span className="type-caption-1 text-tertiary flex-none font-medium">
                        {artist.plays}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Listening shape (Desktop Habits: SONGS, ARTISTS, ALBUMS tiles) */}
          <section className="mb-8 max-w-3xl">
            <h2 className="type-title-1-emphasized text-primary mb-3">Listening shape</h2>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <div className="rounded-[14px] bg-quinary py-4 px-3 text-center border border-primary/5">
                <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                  {topSongs.length}
                </div>
                <div className="text-[11px] font-bold tracking-wider text-secondary uppercase mt-1">
                  Songs
                </div>
              </div>

              <div className="rounded-[14px] bg-quinary py-4 px-3 text-center border border-primary/5">
                <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                  {topArtists.length}
                </div>
                <div className="text-[11px] font-bold tracking-wider text-secondary uppercase mt-1">
                  Artists
                </div>
              </div>

              <div className="rounded-[14px] bg-quinary py-4 px-3 text-center border border-primary/5">
                <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                  {Math.max(1, Math.round(topSongs.length * 0.75))}
                </div>
                <div className="text-[11px] font-bold tracking-wider text-secondary uppercase mt-1">
                  Albums
                </div>
              </div>
            </div>

            <p className="type-caption-1 text-secondary">
              You listen most around the evening · {totalMinutes.toLocaleString()} minutes streamed on Raaga.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
