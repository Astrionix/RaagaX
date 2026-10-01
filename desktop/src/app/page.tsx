"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Shuffle, Sparkles, RefreshCw, Flame, Users2, RotateCcw } from "lucide-react";
import { HomeShelf, Song } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import ShelfCarousel from "@/components/common/ShelfCarousel";
import MusicCard from "@/components/common/MusicCard";
import ArtistCard from "@/components/common/ArtistCard";
import HeroCard from "@/components/common/HeroCard";
import { getOptimalArtwork } from "@/lib/utils";

export default function HomePage() {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { playSong } = usePlayerStore();
  const { user, history } = useAuthStore();

  const fetchHomeData = async () => {
    try {
      const res = await fetch("/api/music/home");
      if (res.ok) {
        const data = await res.json();
        setShelves(data.shelves || []);
      }
    } catch (err) {
      console.error("Home feed fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHomeData();
  };

  // Compute greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Categorize shelves
  const quickPicksShelf = shelves.find(
    (s) => s.title.toLowerCase().includes("quick picks")
  );
  const trendingShelf = shelves.find(
    (s) => s.title.toLowerCase().includes("trending on youtube") || s.title.toLowerCase().includes("trending")
  );
  const topArtistsShelf = shelves.find(
    (s) => s.title.toLowerCase().includes("artist")
  );
  const otherShelves = shelves.filter(
    (s) =>
      s !== quickPicksShelf &&
      s !== trendingShelf &&
      s !== topArtistsShelf
  );

  const quickPicks = quickPicksShelf?.items || [];
  const spotlightItem = quickPicks[0] || trendingShelf?.items?.[0];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto select-none animate-in fade-in duration-200 pb-20 pt-2">
      {/* Featured / Hero Section (Liquid Glass HeroCard) */}
      {spotlightItem && (
        <HeroCard item={spotlightItem} />
      )}

      {/* Listen Again (if user has listening history) */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-raaga-red" />
              <span>Listen Again</span>
            </h3>
            <Link
              href="/library?tab=history"
              className="text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              See all
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {history.slice(0, 6).map((song, idx) => (
              <MusicCard
                key={`listen_again_${song.videoId}_${idx}`}
                item={{
                  title: song.title,
                  subtitle: song.artist,
                  thumbnailUrl: song.thumbnailUrl,
                  videoId: song.videoId,
                  type: "PLAYLIST",
                }}
                contextQueue={history}
                shelfTitle="Listen Again"
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick Picks (High Density Grid of Playable Songs) */}
      {quickPicks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight">
              Quick Picks
            </h3>
            <span className="text-xs text-neutral-400">Playable from YouTube Charts</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {quickPicks.slice(0, 6).map((item, idx) => (
              <MusicCard
                key={`${item.videoId || item.browseId}_${idx}`}
                item={item}
                contextQueue={quickPicks.map((q) => ({
                  videoId: q.videoId || "",
                  title: q.title,
                  artist: q.subtitle,
                  thumbnailUrl: q.thumbnailUrl,
                  playbackSource: "Quick Picks",
                }))}
                shelfTitle="Quick Picks"
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending on YouTube */}
      {trendingShelf && trendingShelf.items.length > 0 && (
        <ShelfCarousel
          shelf={trendingShelf}
          seeAllHref="/explore?tab=trending"
        />
      )}

      {/* Popular Artists (Circular Cards) */}
      {topArtistsShelf && topArtistsShelf.items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight flex items-center gap-2">
              <Users2 className="w-5 h-5 text-neutral-400" />
              <span>Popular Artists</span>
            </h3>
            <span className="text-xs text-neutral-400">Top YouTube Music Channels</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {topArtistsShelf.items.slice(0, 8).map((artist, idx) => (
              <ArtistCard
                key={`${artist.browseId}_${idx}`}
                item={artist}
              />
            ))}
          </div>
        </section>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-8">
          {[1, 2].map((n) => (
            <div key={n} className="space-y-3">
              <div className="h-5 w-44 bg-white/[0.08] rounded animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <div
                    key={m}
                    className="p-3 rounded-[18px] liquid-glass-card space-y-3 animate-pulse border border-white/[0.06]"
                  >
                    <div className="aspect-square w-full rounded-xl bg-white/5" />
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Other YouTube Shelves (Playlists, Mixes, Charts) */
        otherShelves.map((shelf, idx) => (
          <ShelfCarousel
            key={`${shelf.title}_${idx}`}
            shelf={shelf}
            seeAllHref="/explore"
          />
        ))
      )}
    </div>
  );
}
