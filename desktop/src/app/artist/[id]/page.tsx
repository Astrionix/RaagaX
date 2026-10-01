"use client";

import { useEffect, useState, use } from "react";
import { Play, Shuffle, UserCheck, Sparkles, Disc } from "lucide-react";
import { DetailPage, Song } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import SongRow from "@/components/common/SongRow";
import ShelfCarousel from "@/components/common/ShelfCarousel";
import { getOptimalArtwork } from "@/lib/utils";

export default function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<DetailPage | null>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayerStore();

  useEffect(() => {
    fetch(`/api/music/album?id=${encodeURIComponent(resolvedParams.id)}`)
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch((err) => console.error("Artist fetch error:", err))
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="space-y-6 py-12 animate-pulse">
        <div className="flex gap-6 items-end">
          <div className="w-48 h-48 rounded-full bg-white/5" />
          <div className="space-y-3 flex-1">
            <div className="w-24 h-4 bg-white/10 rounded" />
            <div className="w-64 h-8 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-16 text-center text-neutral-400">
        <p>Artist not found.</p>
      </div>
    );
  }

  const handlePlayAll = (shuffle: boolean = false) => {
    if (!data.songs.length) return;
    let list = [...data.songs];
    if (shuffle) {
      list = list.sort(() => Math.random() - 0.5);
    }
    playSong(list[0], list, data.title);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 select-none">
      {/* Artist Hero Header */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-purple-950/80 via-neutral-900 to-black border border-white/10 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <img
            src={getOptimalArtwork(data.thumbnailUrl, 720)}
            alt={data.title}
            className="w-44 h-44 sm:w-56 sm:h-56 rounded-full object-cover shadow-[0_20px_50px_rgba(0,0,0,0.9)] border-2 border-white/10 shrink-0"
          />

          <div className="space-y-2 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-raaga-red">
              Artist
            </span>
            <h1 className="font-black text-3xl sm:text-5xl text-white tracking-tight">
              {data.title}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 font-medium">
              {data.subscriberCountText || data.monthlyListenerCount || "Verified Artist"}
            </p>

            {/* Play & Shuffle Buttons */}
            <div className="flex items-center justify-center sm:justify-start gap-3 pt-3">
              <button
                onClick={() => handlePlayAll(false)}
                disabled={data.songs.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-sm shadow-glow hover:scale-105 transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white ml-0.5" />
                <span>Play Top Songs</span>
              </button>

              <button
                onClick={() => handlePlayAll(true)}
                disabled={data.songs.length === 0}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
                title="Shuffle Songs"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Songs */}
      {data.songs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-extrabold text-xl text-white px-1">Top Songs</h3>
          <div className="divide-y divide-white/5">
            {data.songs.map((song, idx) => (
              <SongRow
                key={`${song.videoId}_${idx}`}
                song={song}
                index={idx}
                contextQueue={data.songs}
                sourceLabel={data.title}
              />
            ))}
          </div>
        </div>
      )}

      {/* Discography & Related Shelves */}
      {data.sections && data.sections.length > 0 && (
        <div className="space-y-8">
          {data.sections.map((sec, idx) => (
            <ShelfCarousel key={`${sec.title}_${idx}`} shelf={sec} />
          ))}
        </div>
      )}
    </div>
  );
}
