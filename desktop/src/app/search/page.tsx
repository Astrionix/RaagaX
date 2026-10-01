"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  X,
  Play,
  Pause,
  Heart,
  Clock,
  MoreVertical,
  ListPlus,
  Share2,
  ExternalLink,
  Flame,
  BarChart3,
  Layers,
  Compass,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { SearchResultGroup, SearchFilter, Song, BrowseItem, NewFeedData } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";
import MusicCard from "@/components/common/MusicCard";
import ArtistCard from "@/components/common/ArtistCard";
import ShelfCarousel from "@/components/common/ShelfCarousel";
import { getOptimalArtwork } from "@/lib/utils";

const FILTERS: SearchFilter[] = [
  "All",
  "Songs",
  "Videos",
  "Albums",
  "Artists",
  "Playlists",
];

const DISCOVERY_GENRES = [
  { name: "Trending Hits", query: "Trending Music 2026", color: "from-raaga-red/30 to-purple-600/30" },
  { name: "Bollywood", query: "Bollywood Hits", color: "from-amber-500/30 to-rose-600/30" },
  { name: "Telugu Top 50", query: "Telugu Top Songs", color: "from-blue-600/30 to-indigo-600/30" },
  { name: "Tamil Hits", query: "Tamil Hits", color: "from-emerald-500/30 to-teal-600/30" },
  { name: "Chill & Lo-Fi", query: "Lofi Hip Hop Chill Beats", color: "from-purple-500/30 to-blue-500/30" },
  { name: "Workout & Phonk", query: "Gym Workout Motivation Music", color: "from-red-600/30 to-orange-600/30" },
  { name: "Indie Pop", query: "Indie Pop Music", color: "from-pink-500/30 to-rose-500/30" },
  { name: "Deep Focus", query: "Focus Study Instrumental", color: "from-cyan-500/30 to-blue-600/30" },
  { name: "EDM & Dance", query: "EDM Festival Hits", color: "from-violet-600/30 to-fuchsia-600/30" },
  { name: "Acoustic & Soft", query: "Acoustic Pop Chill", color: "from-yellow-600/30 to-amber-700/30" },
  { name: "Hip-Hop & Rap", query: "Top Hip Hop Songs", color: "from-zinc-700/50 to-neutral-800/50" },
  { name: "Romance & Melodies", query: "Romantic Love Songs", color: "from-pink-600/30 to-purple-600/30" },
];

const POPULAR_SEARCHES = [
  "A.R. Rahman",
  "Anirudh Ravichander",
  "Sid Sriram",
  "Arijit Singh",
  "Taylor Swift",
  "The Weeknd",
  "Dua Lipa",
  "Coldplay",
  "Lofi Chill",
  "Telugu 2026",
];

function SearchContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(urlQuery);
  const [filter, setFilter] = useState<SearchFilter>("All");
  const [results, setResults] = useState<SearchResultGroup | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [exploreData, setExploreData] = useState<NewFeedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [activeMenuSongId, setActiveMenuSongId] = useState<string | null>(null);

  const { playSong, currentSong, isPlaying, playNext, addToQueue, openPlaylistPicker } = usePlayerStore();
  const { isLiked, toggleLike } = useAuthStore();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("raaga_search_history");
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {}
    }

    // Fetch Explore & Discovery data
    fetch("/api/music/explore")
      .then((res) => res.json())
      .then((data) => setExploreData(data))
      .catch((err) => console.error("Search explore fetch error:", err));
  }, []);

  // When urlQuery changes, execute search
  useEffect(() => {
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
      performSearch(urlQuery, filter);
    }
  }, [urlQuery]);

  // Suggestions debounced
  useEffect(() => {
    if (!query.trim() || query === urlQuery) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/music/suggestions?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data.suggestions || []))
        .catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (searchTerm: string, activeFilter: SearchFilter = filter) => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSuggestions([]);

    const updated = [searchTerm, ...searchHistory.filter((s) => s !== searchTerm)].slice(0, 10);
    setSearchHistory(updated);
    localStorage.setItem("raaga_search_history", JSON.stringify(updated));

    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(searchTerm)}&filter=${activeFilter}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      performSearch(query);
    }
  };

  const handleFilterChange = (f: SearchFilter) => {
    setFilter(f);
    if (query.trim()) {
      performSearch(query, f);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none animate-in fade-in duration-200">
      {/* Search Input Field */}
      <div className="relative max-w-2xl">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search songs, artists, albums, playlists, or videos on YouTube..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-12 pl-11 pr-10 rounded-xl bg-[#18181D] hover:bg-[#202026] focus:bg-[#202026] border border-white/[0.08] focus:border-white/20 text-sm font-medium text-white placeholder-neutral-500 focus:outline-none transition-colors shadow-sm"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults(null);
                setSuggestions([]);
              }}
              className="absolute right-3 p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live suggestions */}
        {suggestions.length > 0 && (
          <div className="absolute top-14 left-0 right-0 z-30 bg-[#1A1A20] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 divide-y divide-white/5">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(s);
                  performSearch(s);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-left text-xs font-medium text-neutral-300 hover:text-white transition"
              >
                <Search className="w-3.5 h-3.5 text-neutral-500" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((f) => {
          const isSelected = filter === f;
          return (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                isSelected
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "bg-[#18181D] text-neutral-400 hover:text-white hover:bg-[#202026] border border-white/[0.06]"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Recent Searches */}
      {!results && searchHistory.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Recent Searches
            </span>
            <button
              onClick={() => {
                setSearchHistory([]);
                localStorage.removeItem("raaga_search_history");
              }}
              className="text-xs text-neutral-500 hover:text-white"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(item);
                  performSearch(item);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#202026] border border-white/[0.06] text-xs font-medium text-neutral-300 hover:text-white transition"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2 py-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-14 rounded-xl bg-white/[0.04] animate-pulse border border-white/5" />
          ))}
        </div>
      )}

      {/* ================= Explore & Discovery State (When not searching) ================= */}
      {!results && !loading && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Popular Searches Pills */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-raaga-red" />
              <span>Trending Searches</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(item);
                    performSearch(item);
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 text-xs font-medium text-neutral-200 hover:text-white transition shadow-sm"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Genres & Moods Grid */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-raaga-red" />
                <span>Explore Genres & Moods</span>
              </h3>
              <span className="text-xs text-neutral-400">Curated YouTube Music categories</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {DISCOVERY_GENRES.map((genre, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(genre.query);
                    performSearch(genre.query);
                  }}
                  className={`p-4 rounded-[18px] bg-gradient-to-br ${genre.color} liquid-glass-card border border-white/10 hover:border-white/25 text-left transition-all hover:scale-[1.02] shadow-md group`}
                >
                  <h4 className="font-extrabold text-sm text-white group-hover:text-raaga-pink transition">
                    {genre.name}
                  </h4>
                  <span className="text-[10px] text-neutral-300 font-medium mt-1 block">
                    Explore →
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Trending Discovery Shelves */}
          {exploreData?.charts &&
            exploreData.charts.map((shelf, idx) => (
              <ShelfCarousel key={`chart_${idx}`} shelf={shelf} />
            ))}

          {exploreData?.exploreShelves?.map((shelf, idx) => (
            <ShelfCarousel key={`explore_${idx}`} shelf={shelf} />
          ))}
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Top Result + Songs Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Result Card */}
            {results.topResult && (
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">Top Result</h3>
                {"videoId" in results.topResult ? (
                  <div
                    onClick={() =>
                      playSong(
                        results.topResult as Song,
                        results.songs,
                        `Search: ${query}`
                      )
                    }
                    className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#18181D] hover:bg-[#202026] border border-white/[0.08] hover:border-white/20 cursor-pointer transition shadow-md"
                  >
                    <div className="space-y-4">
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-neutral-900 shadow">
                        <img
                          src={getOptimalArtwork(results.topResult.thumbnailUrl, 360)}
                          alt={results.topResult.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-raaga-red text-white">
                          Song
                        </span>
                        <h4 className="text-lg font-bold text-white mt-2 truncate">
                          {results.topResult.title}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {results.topResult.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end mt-4">
                      <div className="w-11 h-11 rounded-full bg-raaga-red text-white flex items-center justify-center shadow-md group-hover:scale-105 transition">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-[#18181D] border border-white/[0.08] space-y-3">
                    <img
                      src={getOptimalArtwork(results.topResult.thumbnailUrl, 360)}
                      alt={results.topResult.title}
                      className="w-24 h-24 rounded-xl object-cover"
                    />
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                        {results.topResult.type}
                      </span>
                      <h4 className="text-base font-bold text-white mt-1 truncate">
                        {results.topResult.title}
                      </h4>
                      <p className="text-xs text-neutral-400 truncate">
                        {results.topResult.subtitle}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compact Desktop Songs Table / List */}
            {results.songs.length > 0 && (
              <div
                className={`space-y-2 ${
                  results.topResult ? "lg:col-span-2" : "lg:col-span-3"
                }`}
              >
                <h3 className="text-base font-bold text-white">Songs</h3>

                {/* Table Header */}
                <div className="grid grid-cols-[36px_44px_1fr_120px_40px] items-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-white/[0.06]">
                  <span>#</span>
                  <span></span>
                  <span>Title</span>
                  <span className="text-right">Duration</span>
                  <span></span>
                </div>

                {/* Table Rows (Row Height 56px-64px, Double-click to Play) */}
                <div className="divide-y divide-white/[0.04]">
                  {results.songs.slice(0, 10).map((song, idx) => {
                    const isCurrent = currentSong?.videoId === song.videoId;
                    const isSelected = selectedSongId === song.videoId;
                    const liked = isLiked(song.videoId);

                    return (
                      <div
                        key={song.videoId}
                        onClick={() => setSelectedSongId(song.videoId)}
                        onDoubleClick={() => playSong(song, results.songs, `Search: ${query}`)}
                        className={`grid grid-cols-[36px_44px_1fr_120px_40px] items-center px-3 h-[58px] rounded-lg transition-colors cursor-pointer group ${
                          isCurrent
                            ? "bg-white/[0.12] text-white"
                            : isSelected
                            ? "bg-white/[0.07] text-white"
                            : "hover:bg-white/[0.04] text-neutral-300"
                        }`}
                      >
                        {/* Index / Play */}
                        <div className="text-xs font-mono text-neutral-500">
                          <span className="group-hover:hidden">
                            {isCurrent && isPlaying ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-raaga-red inline-block animate-pulse" />
                            ) : (
                              idx + 1
                            )}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playSong(song, results.songs, `Search: ${query}`);
                            }}
                            className="hidden group-hover:inline-flex text-white"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4 fill-white" />
                            ) : (
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Thumbnail */}
                        <div className="w-9 h-9 rounded-md overflow-hidden bg-neutral-900 shrink-0">
                          <img
                            src={getOptimalArtwork(song.thumbnailUrl, 160)}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0 pr-4">
                          <h4
                            className={`text-sm font-medium truncate ${
                              isCurrent ? "text-raaga-red font-semibold" : "text-neutral-100 group-hover:text-white"
                            }`}
                          >
                            {song.title}
                          </h4>
                          <p className="text-xs text-neutral-400 truncate">
                            {song.artist}
                          </p>
                        </div>

                        {/* Duration */}
                        <div className="text-right text-xs font-mono text-neutral-400">
                          {song.durationText || "--:--"}
                        </div>

                        {/* Context Menu ⋮ */}
                        <div className="relative text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuSongId(
                                activeMenuSongId === song.videoId ? null : song.videoId
                              );
                            }}
                            className="p-1 text-neutral-400 hover:text-white rounded transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuSongId === song.videoId && (
                            <div
                              className="absolute right-0 top-full mt-1 z-40 w-44 bg-[#1C1C22] border border-white/10 rounded-xl shadow-2xl p-1 space-y-0.5 text-xs text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  playNext(song);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Play Next</span>
                              </button>

                              <button
                                onClick={() => {
                                  addToQueue(song);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
                              >
                                <ListPlus className="w-3.5 h-3.5" />
                                <span>Add to Queue</span>
                              </button>

                              <button
                                onClick={() => {
                                  openPlaylistPicker(song);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
                              >
                                <ListPlus className="w-3.5 h-3.5" />
                                <span>Add to Playlist</span>
                              </button>

                              <button
                                onClick={() => {
                                  toggleLike(song);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
                              >
                                <Heart className={`w-3.5 h-3.5 ${liked ? "text-raaga-red fill-raaga-red" : ""}`} />
                                <span>{liked ? "Unlike" : "Like"}</span>
                              </button>

                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${song.videoId}`);
                                  setActiveMenuSongId(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </button>

                              <a
                                href={`https://www.youtube.com/watch?v=${song.videoId}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setActiveMenuSongId(null)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open on YouTube</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Albums (Grid) */}
          {results.albums.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Albums</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {results.albums.map((album) => (
                  <MusicCard
                    key={album.browseId}
                    item={{
                      title: album.title,
                      subtitle: album.subtitle,
                      thumbnailUrl: album.thumbnailUrl,
                      browseId: album.browseId,
                      type: "ALBUM",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Artists (Circular Cards) */}
          {results.artists.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Artists</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {results.artists.map((artist) => (
                  <ArtistCard
                    key={artist.browseId}
                    item={{
                      title: artist.title,
                      subtitle: artist.subtitle,
                      thumbnailUrl: artist.thumbnailUrl,
                      browseId: artist.browseId,
                      type: "ARTIST",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Playlists (Grid) */}
          {results.playlists.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Playlists</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {results.playlists.map((pl) => (
                  <MusicCard
                    key={pl.browseId}
                    item={{
                      title: pl.title,
                      subtitle: pl.subtitle,
                      thumbnailUrl: pl.thumbnailUrl,
                      browseId: pl.browseId,
                      type: "PLAYLIST",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Videos (16:9 Aspect Ratio Grid) */}
          {results.videos && results.videos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">Videos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.videos.map((vid) => (
                  <MusicCard
                    key={vid.videoId}
                    item={{
                      title: vid.title,
                      subtitle: vid.artist,
                      thumbnailUrl: vid.thumbnailUrl,
                      videoId: vid.videoId,
                      type: "PLAYLIST",
                    }}
                    aspect="video"
                    shelfTitle="Search Videos"
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
