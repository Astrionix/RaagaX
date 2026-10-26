import React, { useState } from 'react';
import { ArrowLeft, Check, Play, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router';
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
  const navigate = useNavigate();
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
        // Fallback
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-full pb-32 pt-4 px-4 sm:px-8 max-w-5xl mx-auto">
      {/* Navigation & Heading (matching Desktop DesktopReplayUi.kt) */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Replay
        </h1>
        <p className="text-base text-white/60 font-medium mt-1">
          {periodLabel}
        </p>

        {/* Period Picker Capsule (Desktop PeriodPicker) */}
        <div className="flex items-center rounded-[12px] bg-white/10 p-[3px] w-fit mt-4 border border-white/5">
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
                className={`rounded-[10px] px-3.5 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-white/95 text-black shadow-sm'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

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

      {/* Play Replay & Share Actions */}
      <div className="flex items-center gap-3 mb-10">
        <button
          onClick={handlePlayReplay}
          className="flex items-center gap-2 rounded-full bg-[#fa2d48] hover:bg-[#fa2d48]/90 px-5 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all"
        >
          <Play size={16} fill="currentColor" />
          Play your Replay
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-semibold text-white active:scale-95 transition-all"
        >
          {copied ? (
            <>
              <Check size={16} className="text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Share2 size={16} />
              Share
            </>
          )}
        </button>
      </div>

      {/* Top Songs Chart (Desktop chart("songs", "Top Songs")) */}
      <section className="mb-10">
        <h2 className="text-[22px] font-extrabold text-white mb-3">Top Songs</h2>
        <div className="flex flex-col">
          {topSongs.length === 0 ? (
            <p className="text-sm text-secondary py-4">No songs recorded yet.</p>
          ) : (
            topSongs.slice(0, 5).map((song, i) => (
              <div
                key={song.videoId}
                onClick={() => handlePlaySingle(song)}
                className="group flex items-center py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {/* Rank Badge: #1 in key accent (#fa2d48), others in white/45 */}
                <span
                  className={`w-7 text-left font-extrabold text-base flex-none ${
                    i === 0 ? 'text-[#fa2d48]' : 'text-white/45'
                  }`}
                >
                  {i + 1}
                </span>

                {/* 48px square artwork (rounded 6px) */}
                <div className="relative size-12 flex-none rounded-[6px] overflow-hidden bg-white/5 mr-3">
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
                  <p className="text-base font-semibold text-white truncate group-hover:text-[#fa2d48] transition-colors">
                    {song.title}
                  </p>
                  <p className="text-sm text-white/55 truncate">
                    {song.artist} · {formatListening(song.totalSeconds * 1000)}
                  </p>
                </div>

                {/* Play count */}
                {song.plays > 0 && (
                  <span className="text-sm text-white/45 flex-none font-medium">
                    {song.plays}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Top Artists Chart (Desktop chart("artists", "Top Artists", circular = true)) */}
      <section className="mb-10">
        <h2 className="text-[22px] font-extrabold text-white mb-3">Top Artists</h2>
        <div className="flex flex-col">
          {topArtists.length === 0 ? (
            <p className="text-sm text-secondary py-4">No artists recorded yet.</p>
          ) : (
            topArtists.slice(0, 5).map((artist, i) => (
              <div
                key={artist.name}
                className="flex items-center py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                {/* Rank Badge */}
                <span
                  className={`w-7 text-left font-extrabold text-base flex-none ${
                    i === 0 ? 'text-[#fa2d48]' : 'text-white/45'
                  }`}
                >
                  {i + 1}
                </span>

                {/* 48px circular artwork */}
                <div className="size-12 flex-none rounded-full overflow-hidden bg-white/5 mr-3">
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
                  <p className="text-base font-semibold text-white truncate">
                    {artist.name}
                  </p>
                  <p className="text-sm text-white/55 truncate">
                    {formatListening(artist.totalSeconds * 1000)}
                  </p>
                </div>

                {/* Play count */}
                {artist.plays > 0 && (
                  <span className="text-sm text-white/45 flex-none font-medium">
                    {artist.plays}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Listening shape (Desktop Habits: SONGS, ARTISTS, ALBUMS tiles) */}
      <section className="mb-8">
        <h2 className="text-[22px] font-extrabold text-white mb-3">Listening shape</h2>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="rounded-[14px] bg-white/[0.09] py-3.5 px-3 text-center">
            <div className="text-2xl font-extrabold text-white">
              {topSongs.length}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-white/55 uppercase mt-1">
              Songs
            </div>
          </div>

          <div className="rounded-[14px] bg-white/[0.09] py-3.5 px-3 text-center">
            <div className="text-2xl font-extrabold text-white">
              {topArtists.length}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-white/55 uppercase mt-1">
              Artists
            </div>
          </div>

          <div className="rounded-[14px] bg-white/[0.09] py-3.5 px-3 text-center">
            <div className="text-2xl font-extrabold text-white">
              {Math.max(1, Math.round(topSongs.length * 0.75))}
            </div>
            <div className="text-[11px] font-bold tracking-wider text-white/55 uppercase mt-1">
              Albums
            </div>
          </div>
        </div>

        <p className="text-sm text-white/60">
          You listen most around the evening · {totalMinutes.toLocaleString()} minutes streamed on Raaga.
        </p>
      </section>
    </div>
  );
}
