"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Music } from "lucide-react";
import { DetailPage, HomeShelf } from "@/types/music";
import ShelfCarousel from "@/components/common/ShelfCarousel";
import SongRow from "@/components/common/SongRow";

export default function MoodCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const title = searchParams.get("title") || "Mood & Genre";

  const [data, setData] = useState<DetailPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/music/album?id=${encodeURIComponent(resolvedParams.id)}`)
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch((err) => console.error("Mood category fetch error:", err))
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 select-none">
      {/* Header */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-raaga-red/40 via-purple-900/40 to-black border border-white/10 shadow-2xl">
        <span className="text-xs font-bold uppercase tracking-widest text-raaga-red">
          Mood & Category
        </span>
        <h1 className="font-black text-3xl sm:text-5xl text-white tracking-tight mt-1">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-300 mt-2">
          Curated playlists, stations, and top tracks tailored for {title}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {data?.sections?.map((shelf, idx) => (
            <ShelfCarousel key={idx} shelf={shelf} />
          ))}

          {data?.songs && data.songs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-extrabold text-xl text-white">Featured Tracks</h3>
              <div className="divide-y divide-white/5">
                {data.songs.map((song, idx) => (
                  <SongRow
                    key={`${song.videoId}_${idx}`}
                    song={song}
                    index={idx}
                    contextQueue={data.songs}
                    sourceLabel={title}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
