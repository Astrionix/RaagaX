"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, Flame, Disc, Film, Music2, Clock } from "lucide-react";
import { HomeShelf, Song, ShelfItem, NewFeedData } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import ShelfCarousel from "@/components/common/ShelfCarousel";
import MusicCard from "@/components/common/MusicCard";
import HeroCard from "@/components/common/HeroCard";
import SongRow from "@/components/common/SongRow";

export default function NewReleasesPage() {
  const [feed, setFeed] = useState<NewFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { playSong } = usePlayerStore();

  const fetchNewData = async () => {
    try {
      const res = await fetch("/api/music/explore");
      if (res.ok) {
        const data = await res.json();
        setFeed(data);
      }
    } catch (err) {
      console.error("Failed to fetch new releases:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNewData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNewData();
  };

  const allNewItems: ShelfItem[] = feed?.newReleases?.flatMap((s) => s.items) || [];
  const heroItem = allNewItems[0];
  const newSongs = allNewItems.slice(1, 13);
  const exploreShelves = feed?.exploreShelves || [];

  // Categorize shelves
  const albumShelves = exploreShelves.filter(
    (s) => s.title.toLowerCase().includes("album") || s.title.toLowerCase().includes("ep")
  );
  const videoShelves = exploreShelves.filter(
    (s) => s.title.toLowerCase().includes("video") || s.items.some((i) => i.isVideo)
  );
  const otherNewShelves = exploreShelves.filter(
    (s) => !albumShelves.includes(s) && !videoShelves.includes(s)
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-raaga-red/20 text-raaga-red border border-raaga-red/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              New Releases
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Fresh drops, new singles, newly published music videos, and current charts from YouTube Music
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white text-xs font-semibold border border-white/[0.08] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hero Featured New Release */}
      {heroItem && <HeroCard item={heroItem} />}

      {/* Fresh New Songs Grid */}
      {newSongs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-raaga-red" />
              <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight">
                New Songs
              </h3>
            </div>
            <span className="text-xs text-neutral-400">Fresh YouTube singles</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {newSongs.map((item, idx) => (
              <MusicCard
                key={`${item.videoId || item.browseId}_${idx}`}
                item={item}
                contextQueue={newSongs.map((s) => ({
                  videoId: s.videoId || "",
                  title: s.title,
                  artist: s.subtitle || "Unknown Artist",
                  thumbnailUrl: s.thumbnailUrl,
                  playbackSource: "New Releases",
                }))}
                shelfTitle="New Releases"
              />
            ))}
          </div>
        </section>
      )}

      {/* New Music Videos */}
      {videoShelves.length > 0 &&
        videoShelves.map((shelf, idx) => (
          <ShelfCarousel
            key={`video_${idx}`}
            shelf={shelf}
            variant="landscape"
          />
        ))}

      {/* New Albums & EPs */}
      {albumShelves.length > 0 &&
        albumShelves.map((shelf, idx) => (
          <ShelfCarousel
            key={`album_${idx}`}
            shelf={shelf}
            variant="square"
          />
        ))}

      {/* Other Fresh Curated Shelves */}
      {otherNewShelves.map((shelf, idx) => (
        <ShelfCarousel
          key={`other_${idx}`}
          shelf={shelf}
          variant="square"
        />
      ))}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-8 py-4">
          <div className="h-44 w-full rounded-[22px] liquid-glass-card animate-pulse border border-white/5" />
          <div className="space-y-3">
            <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="p-3 rounded-[18px] liquid-glass-card space-y-3 animate-pulse border border-white/5"
                >
                  <div className="aspect-square w-full rounded-xl bg-white/5" />
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
