"use client";

import { useState } from "react";
import { Heart, Play, Shuffle, Search } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";
import SongRow from "@/components/common/SongRow";

export default function LikedSongsPage() {
  const { likedSongs } = useAuthStore();
  const { playSong } = usePlayerStore();
  const [filterText, setFilterText] = useState("");

  const filteredSongs = likedSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(filterText.toLowerCase()) ||
      s.artist.toLowerCase().includes(filterText.toLowerCase())
  );

  const handlePlayAll = (shuffle: boolean = false) => {
    if (filteredSongs.length === 0) return;
    let list = [...filteredSongs];
    if (shuffle) {
      list = list.sort(() => Math.random() - 0.5);
    }
    playSong(list[0], list, "Liked Songs");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 select-none">
      {/* Hero Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-raaga-red via-purple-900 to-black border border-white/10 shadow-2xl">
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-gradient-to-tr from-raaga-red to-pink-500 shadow-2xl flex items-center justify-center text-white shrink-0">
          <Heart className="w-16 h-16 fill-white drop-shadow-lg" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-raaga-red">
            Playlist
          </span>
          <h1 className="font-black text-3xl sm:text-5xl text-white tracking-tight">
            Liked Songs
          </h1>
          <p className="text-sm text-neutral-300 font-medium">
            Auto-saved favorite tracks • {likedSongs.length} songs
          </p>

          {/* Play & Shuffle Buttons */}
          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={() => handlePlayAll(false)}
              disabled={likedSongs.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-sm shadow-glow hover:scale-105 transition disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              disabled={likedSongs.length === 0}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
              title="Shuffle Liked Songs"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter / Search within Liked Songs */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Filter in Liked Songs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#161618] border border-white/10 text-white text-xs focus:outline-none focus:border-raaga-red"
          />
        </div>
      </div>

      {/* Liked Songs List */}
      {likedSongs.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-[#161618] border border-white/5 space-y-3">
          <Heart className="w-12 h-12 text-neutral-600 mx-auto" />
          <p className="text-base font-bold text-neutral-300">
            No liked songs yet
          </p>
          <p className="text-xs text-neutral-500">
            Tap the heart icon on any song to save it to your library.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {filteredSongs.map((song, idx) => (
            <SongRow
              key={song.videoId}
              song={song}
              index={idx}
              contextQueue={filteredSongs}
              sourceLabel="Liked Songs"
            />
          ))}
        </div>
      )}
    </div>
  );
}
