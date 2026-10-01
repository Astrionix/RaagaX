"use client";

import { useState } from "react";
import { X, Plus, Check, ListMusic } from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { useAuthStore } from "@/stores/auth-store";

export default function PlaylistPickerModal() {
  const { isPlaylistPickerOpen, closePlaylistPicker, playlistPickerTarget } = usePlayerStore();
  const { playlists, addSongToPlaylist, createPlaylist } = useAuthStore();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  if (!isPlaylistPickerOpen || !playlistPickerTarget) return null;

  const handleSelect = async (playlistId: string) => {
    await addSongToPlaylist(playlistId, playlistPickerTarget);
    setAddedMap((prev) => ({ ...prev, [playlistId]: true }));
    setTimeout(() => {
      closePlaylistPicker();
      setAddedMap({});
    }, 600);
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    const pl = await createPlaylist(newPlaylistName.trim());
    if (pl) {
      await addSongToPlaylist(pl.id, playlistPickerTarget);
      setNewPlaylistName("");
      setIsCreating(false);
      closePlaylistPicker();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-white">Add to Playlist</h3>
            <p className="text-xs text-neutral-400 truncate max-w-xs">
              {playlistPickerTarget.title} • {playlistPickerTarget.artist}
            </p>
          </div>
          <button
            onClick={closePlaylistPicker}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create New Playlist Inline */}
        {isCreating ? (
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/5 border border-white/10">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-transparent text-sm text-white focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleCreateAndAdd}
              className="px-3 py-1.5 rounded-xl bg-raaga-red text-white text-xs font-bold transition shadow-glow"
            >
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="p-1.5 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-sm font-semibold transition"
          >
            <div className="p-2 rounded-xl bg-raaga-red/20 text-raaga-red">
              <Plus className="w-4 h-4" />
            </div>
            <span>New Playlist</span>
          </button>
        )}

        {/* Existing Playlists List */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 no-scrollbar">
          {playlists.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-4">
              No playlists found. Create one above!
            </p>
          ) : (
            playlists.map((pl) => {
              const isAdded = addedMap[pl.id];
              return (
                <button
                  key={pl.id}
                  onClick={() => handleSelect(pl.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/5 text-left transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-white/5 text-neutral-400">
                      <ListMusic className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">
                        {pl.name}
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        {pl.songCount || pl.songs?.length || 0} songs
                      </p>
                    </div>
                  </div>

                  {isAdded && (
                    <span className="flex items-center gap-1 text-xs font-bold text-raaga-cyan">
                      <Check className="w-4 h-4" /> Added
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
