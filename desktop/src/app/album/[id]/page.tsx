"use client";

import { useEffect, useState, use } from "react";
import { Play, Shuffle, Disc3, Clock, Sparkles } from "lucide-react";
import { DetailPage, Song } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import SongRow from "@/components/common/SongRow";
import { getOptimalArtwork } from "@/lib/utils";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [data, setData] = useState<DetailPage | null>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayerStore();

  useEffect(() => {
    fetch(`/api/music/album?id=${encodeURIComponent(resolvedParams.id)}`)
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch((err) => console.error("Album fetch error:", err))
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="space-y-6 py-12 animate-pulse">
        <div className="flex gap-6 items-end">
          <div className="w-48 h-48 rounded-3xl bg-white/5" />
          <div className="space-y-3 flex-1">
            <div className="w-24 h-4 bg-white/10 rounded" />
            <div className="w-64 h-8 bg-white/10 rounded" />
            <div className="w-40 h-4 bg-white/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-16 text-center text-neutral-400">
        <p>Album not found.</p>
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
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border border-white/10 shadow-2xl">
        <img
          src={getOptimalArtwork(data.thumbnailUrl, 720)}
          alt={data.title}
          className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl object-cover shadow-[0_16px_40px_rgba(0,0,0,0.8)] shrink-0"
        />

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-raaga-red">
            Album
          </span>
          <h1 className="font-black text-3xl sm:text-5xl text-white tracking-tight">
            {data.title}
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 font-medium">
            {data.subtitle} • {data.songs.length} tracks {data.year ? `• ${data.year}` : ""}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={() => handlePlayAll(false)}
              disabled={data.songs.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-sm shadow-glow hover:scale-105 transition disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
              <span>Play Album</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              disabled={data.songs.length === 0}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
              title="Shuffle Album"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Description / Editorial blurb if available */}
      {data.description && (
        <p className="text-xs sm:text-sm text-neutral-400 max-w-3xl leading-relaxed px-1">
          {data.description}
        </p>
      )}

      {/* Track List */}
      <div className="space-y-2">
        <h3 className="font-extrabold text-xl text-white px-1">Tracklist</h3>
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
    </div>
  );
}
