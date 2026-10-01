"use client";

import { History, Play, Trash2, Clock } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";
import SongRow from "@/components/common/SongRow";

export default function HistoryPage() {
  const { history, clearHistory } = useAuthStore();
  const { playSong } = usePlayerStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-300 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-black text-3xl sm:text-4xl text-white tracking-tight">
              Playback History
            </h1>
            <span className="p-1 rounded-full bg-raaga-red/20 text-raaga-red">
              <History className="w-5 h-5" />
            </span>
          </div>
          <p className="text-sm text-neutral-400 font-medium mt-1">
            Tracks you recently listened to on Raaga
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* History Track List */}
      {history.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-[#161618] border border-white/5 space-y-3">
          <History className="w-12 h-12 text-neutral-600 mx-auto" />
          <p className="text-base font-bold text-neutral-300">
            No playback history recorded
          </p>
          <p className="text-xs text-neutral-500">
            Start playing songs and your history will be logged here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {history.map((song, idx) => (
            <SongRow
              key={`${song.videoId}_${idx}`}
              song={song}
              index={idx}
              contextQueue={history}
              sourceLabel="History"
            />
          ))}
        </div>
      )}
    </div>
  );
}
