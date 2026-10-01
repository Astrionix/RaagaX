"use client";

import { usePlayerStore } from "@/stores/player-store";
import {
  Trash2,
  Play,
  GripVertical,
  X,
  Sparkles,
  ListPlus,
  Music2,
} from "lucide-react";
import { formatTime, getOptimalArtwork } from "@/lib/utils";

export default function QueueDrawer() {
  const {
    queue,
    currentIndex,
    currentSong,
    playSong,
    removeFromQueue,
    clearQueue,
    setQueueOpen,
    openPlaylistPicker,
  } = usePlayerStore();

  const currentTrack = queue[currentIndex] || currentSong;
  const upNextTracks = queue.slice(currentIndex + 1);
  const previousTracks = queue.slice(0, currentIndex);

  return (
    <div className="flex flex-col h-full bg-[#0D0D0F] select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h3 className="font-extrabold text-base text-white">Playing Queue</h3>
          <p className="text-xs text-neutral-400">
            {queue.length} track{queue.length !== 1 ? "s" : ""} in queue
          </p>
        </div>

        <div className="flex items-center gap-2">
          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-neutral-300 transition"
              title="Clear Queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={() => setQueueOpen(false)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6 no-scrollbar">
        {/* Now Playing Section */}
        {currentTrack && (
          <div>
            <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-raaga-red flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-raaga-red animate-pulse" />
              <span>Now Playing</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/10 border border-white/10 shadow-glow">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={getOptimalArtwork(currentTrack.thumbnailUrl, 160)}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-white truncate">
                    {currentTrack.title}
                  </h4>
                  <p className="text-xs text-neutral-300 truncate">
                    {currentTrack.artist}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openPlaylistPicker(currentTrack)}
                  className="p-2 text-neutral-300 hover:text-white transition"
                  title="Add to Playlist"
                >
                  <ListPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div>
          <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
            <span>Up Next ({upNextTracks.length})</span>
            {currentTrack?.playbackSource && (
              <span className="text-[10px] text-neutral-500 lowercase">
                from {currentTrack.playbackSource}
              </span>
            )}
          </div>

          {upNextTracks.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <Sparkles className="w-6 h-6 text-neutral-500 mx-auto opacity-40" />
              <p>Queue is empty.</p>
              <p className="text-[11px] text-neutral-600">
                Radio recommendations will automatically append when tracks finish.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upNextTracks.map((song, idx) => {
                const realIndex = currentIndex + 1 + idx;
                const isAutoplay = song.queueTier === "AUTOPLAY";

                return (
                  <div
                    key={`${song.videoId}_${realIndex}`}
                    className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => playSong(song, queue)}
                    >
                      <span className="text-xs text-neutral-500 font-mono w-4 text-center">
                        {idx + 1}
                      </span>
                      <img
                        src={getOptimalArtwork(song.thumbnailUrl, 160)}
                        alt={song.title}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-semibold text-xs text-neutral-200 group-hover:text-white truncate">
                            {song.title}
                          </h5>
                          {isAutoplay && (
                            <span className="text-[8px] uppercase font-extrabold px-1 rounded bg-purple-500/20 text-purple-400">
                              Radio
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {song.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {song.durationText && (
                        <span className="text-xs font-mono text-neutral-500 mr-2">
                          {song.durationText}
                        </span>
                      )}
                      <button
                        onClick={() => removeFromQueue(realIndex)}
                        className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
