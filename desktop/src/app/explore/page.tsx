"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Compass, Music, Radio, Sparkles, TrendingUp } from "lucide-react";
import { NewFeedData } from "@/types/music";
import ShelfCarousel from "@/components/common/ShelfCarousel";

export default function ExplorePage() {
  const [data, setData] = useState<NewFeedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/music/explore")
      .then((res) => res.json())
      .then((resData) => setData(resData))
      .catch((err) => console.error("Explore fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 select-none">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-black text-3xl sm:text-4xl text-white tracking-tight">
            Explore
          </h1>
          <span className="p-1 rounded-full bg-raaga-red/20 text-raaga-red">
            <Flame className="w-5 h-5 fill-current" />
          </span>
        </div>
        <p className="text-sm text-neutral-400 font-medium mt-1">
          New releases, top charts, and curated moods & genres
        </p>
      </div>

      {/* Moods & Genres Section */}
      {data?.moodGenres && data.moodGenres.length > 0 && (
        <div className="space-y-6">
          {data.moodGenres.map((section, sIdx) => (
            <div key={sIdx} className="space-y-3">
              <h3 className="font-extrabold text-xl text-white tracking-tight">
                {section.title}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
                {section.items.map((item, iIdx) => (
                  <Link
                    key={iIdx}
                    href={`/mood/${item.browseId}?title=${encodeURIComponent(item.title)}`}
                    className="relative overflow-hidden h-24 sm:h-28 rounded-2xl p-4 flex flex-col justify-between group transition-transform hover:scale-[1.02] shadow-card border border-white/5 cursor-pointer"
                    style={{
                      background: `linear-gradient(135deg, ${item.color || "#FA2D48"}cc 0%, #0D0D0F 100%)`,
                    }}
                  >
                    <span className="font-black text-base sm:text-lg text-white leading-tight drop-shadow">
                      {item.title}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
                        Explore
                      </span>
                      <Music className="w-5 h-5 text-white/40 group-hover:text-white transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-8">
          {[1, 2].map((n) => (
            <div key={n} className="space-y-3">
              <div className="h-6 w-48 bg-white/10 rounded-lg animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4].map((m) => (
                  <div
                    key={m}
                    className="w-48 h-60 rounded-2xl bg-white/5 animate-pulse shrink-0"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* New Releases Shelves */}
          {data?.newReleases.map((shelf, idx) => (
            <ShelfCarousel key={`new_${idx}`} shelf={shelf} />
          ))}

          {/* Top Charts Shelves */}
          {data?.charts.map((shelf, idx) => (
            <ShelfCarousel key={`chart_${idx}`} shelf={shelf} />
          ))}

          {/* Explore Shelves */}
          {data?.exploreShelves.map((shelf, idx) => (
            <ShelfCarousel key={`exp_${idx}`} shelf={shelf} />
          ))}
        </>
      )}
    </div>
  );
}
