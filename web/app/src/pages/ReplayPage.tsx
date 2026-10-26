import { useState } from 'react';
import { ArrowLeft, Award, Check, Disc, Headphones, Play, Share2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { playList, playTrack } from '@/components/music/play';
import { useReplayData } from '@/data/stats/useReplayData';
import type { Track } from '@/data/music/types';
import { ReplayCard } from '@/components/replay/ReplayCard';

type Period = 'this_year' | 'this_month' | 'all_time';

export default function ReplayPage() {
  const navigate = useNavigate();
  const { cards, holder, memberSince, totalMinutes, totalPlays, topSongs, topArtists } = useReplayData();
  const [period, setPeriod] = useState<Period>('this_year');
  const [copied, setCopied] = useState(false);

  const currentYear = new Date().getFullYear();

  // Prepare songs for queue playback
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
    playList(tracks, 0, { source: { title: `Replay ${currentYear}`, type: 'other' } });
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
    const text = `🎵 My Raaga Replay ${currentYear}
⏱️ ${totalMinutes.toLocaleString()} minutes streamed (${totalPlays} plays)
🏆 Top Song: ${topSong ? `${topSong.title} - ${topSong.artist}` : 'N/A'}
👑 Top Artist: ${topArtist ? topArtist.name : 'N/A'}
🎧 Enjoying Hi-Res Lossless on Raaga!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Raaga Replay ${currentYear}`, text });
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
    <div className="min-h-full pb-28 pt-4 px-4 sm:px-8 max-w-6xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid size-9 place-items-center rounded-full bg-quinary/70 hover:bg-quinary text-secondary hover:text-primary transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-purple-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
                Replay {currentYear}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-secondary">Your listening experience</p>
          </div>
        </div>

        {/* Period Chips */}
        <div className="flex items-center rounded-full bg-quinary/60 p-1 border border-white/5">
          {(
            [
              ['this_month', 'This Month'],
              ['this_year', 'This Year'],
              ['all_time', 'All Time'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                period === key
                  ? 'bg-key text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Cards Carousel */}
      <div className="mb-10">
        <div
          className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {cards.map((card) => (
            <div key={card.id} className="w-[300px] sm:w-[340px] flex-none snap-start">
              <ReplayCard card={card} holder={holder} memberSince={memberSince} />
            </div>
          ))}
        </div>
      </div>

      {/* Actions: Play Replay & Share */}
      <div className="flex flex-wrap items-center gap-3 mb-10">
        <button
          onClick={handlePlayReplay}
          className="flex items-center gap-2 rounded-full bg-key px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
        >
          <Play size={18} fill="currentColor" />
          Play your Replay
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-full bg-quinary/80 hover:bg-quinary px-4 py-2.5 text-sm font-semibold text-primary border border-white/10 active:scale-95 transition-all"
        >
          {copied ? (
            <>
              <Check size={16} className="text-emerald-400" />
              Copied to clipboard!
            </>
          ) : (
            <>
              <Share2 size={16} />
              Share my Replay
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Top Songs and Top Artists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Songs (2 columns on lg) */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Headphones className="size-5 text-pink-400" />
            <h2 className="text-xl font-bold text-primary">Top Songs</h2>
          </div>

          <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            {topSongs.length === 0 ? (
              <div className="p-8 text-center text-secondary text-sm">
                No songs recorded for this period yet. Start playing music to see your charts!
              </div>
            ) : (
              topSongs.map((song, i) => (
                <div
                  key={song.videoId}
                  onClick={() => handlePlaySingle(song)}
                  className="group flex items-center gap-3.5 p-3 hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <span
                    className={`w-6 text-center font-extrabold text-sm ${
                      i === 0
                        ? 'text-amber-400'
                        : i === 1
                        ? 'text-cyan-400'
                        : i === 2
                        ? 'text-purple-400'
                        : 'text-tertiary'
                    }`}
                  >
                    {i + 1}
                  </span>

                  <div className="relative size-11 flex-none rounded-lg overflow-hidden bg-white/5">
                    {song.artworkUrl ? (
                      <img
                        src={song.artworkUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full grid place-items-center">
                        <Disc size={20} className="text-secondary" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                      <Play size={16} fill="white" className="text-white" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm text-primary group-hover:text-key transition-colors">
                      {song.title}
                    </p>
                    <p className="truncate text-xs text-secondary">{song.artist}</p>
                  </div>

                  <div className="flex-none text-right">
                    <span className="text-xs font-semibold text-secondary">
                      {song.plays} {song.plays === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Artists (1 column on lg) */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Award className="size-5 text-amber-400" />
            <h2 className="text-xl font-bold text-primary">Top Artists</h2>
          </div>

          <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            {topArtists.length === 0 ? (
              <div className="p-8 text-center text-secondary text-sm">
                No artist stats yet.
              </div>
            ) : (
              topArtists.map((artist, i) => (
                <div
                  key={artist.name}
                  className="flex items-center gap-3.5 p-3 hover:bg-white/[0.04] transition-colors"
                >
                  <span
                    className={`w-6 text-center font-extrabold text-sm ${
                      i === 0 ? 'text-amber-400' : 'text-tertiary'
                    }`}
                  >
                    {i + 1}
                  </span>

                  <div className="size-11 flex-none rounded-full overflow-hidden bg-white/5 border border-white/10">
                    {artist.artworkUrl ? (
                      <img src={artist.artworkUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full grid place-items-center text-secondary font-bold text-xs">
                        {artist.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm text-primary">{artist.name}</p>
                    <p className="truncate text-xs text-secondary">
                      {Math.max(1, Math.round(artist.totalSeconds / 60))} mins listened
                    </p>
                  </div>

                  <div className="flex-none text-right">
                    <span className="text-xs font-semibold text-secondary">
                      {artist.plays} {artist.plays === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
