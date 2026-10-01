"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Heart,
  History as HistoryIcon,
  ListMusic,
  Plus,
  Trash2,
  Disc,
  Users2,
  LogIn,
  Play,
  Shuffle,
  Music2,
  Sparkles,
  Clock,
  FolderOpen,
  Upload,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";
import { useLocalMediaStore } from "@/stores/local-media-store";
import SongRow from "@/components/common/SongRow";
import CreatePlaylistModal from "@/components/playlist/CreatePlaylistModal";

function LibraryContent() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "playlists";

  const {
    playlists,
    likedSongIds,
    likedSongs,
    history,
    clearHistory,
    deletePlaylist,
    user,
  } = useAuthStore();
  const { setAuthModalOpen, playSong, queue } = usePlayerStore();
  const { localSongs, addLocalFiles, clearLocalSongs, isScanning } = useLocalMediaStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const tabs = [
    { id: "playlists", label: "Playlists", count: playlists.length, icon: ListMusic },
    { id: "songs", label: "Liked Songs", count: likedSongs.length, icon: Heart },
    { id: "local", label: "Local Audio", count: localSongs.length, icon: FolderOpen },
    { id: "albums", label: "Albums", count: 0, icon: Disc },
    { id: "artists", label: "Artists", count: 0, icon: Users2 },
    { id: "history", label: "History", count: history.length, icon: HistoryIcon },
  ];

  const handlePlayLikedSongs = (shuffle: boolean = false) => {
    if (likedSongs.length === 0) return;
    const songsToPlay = shuffle
      ? [...likedSongs].sort(() => Math.random() - 0.5)
      : likedSongs;
    playSong(songsToPlay[0], songsToPlay);
  };

  const handlePlayHistory = (shuffle: boolean = false) => {
    if (history.length === 0) return;
    const songsToPlay = shuffle
      ? [...history].sort(() => Math.random() - 0.5)
      : history;
    playSong(songsToPlay[0], songsToPlay);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none animate-in fade-in duration-200 pb-20">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-raaga-red/15 text-raaga-red border border-raaga-red/25">
              Personal Catalog
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Library
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Organize your playlists, favorite tracks, saved albums, and playback history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-raaga-red to-raaga-pink hover:opacity-90 text-white text-xs font-semibold shadow-[0_2px_16px_rgba(250,45,72,0.3)] transition hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Playlist</span>
          </button>
        </div>
      </div>

      {/* Guest Mode Banner (Sync with Google) */}
      {user?.isGuest !== false && (
        <div className="flex items-center justify-between p-4 rounded-2xl liquid-glass border border-white/10 shadow-lg">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-raaga-red" />
              Public Library Mode
            </h4>
            <p className="text-[11px] text-neutral-400">
              Sign in with your Google account to sync YouTube playlists, liked videos, and private history across all your devices.
            </p>
          </div>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition shrink-0 ml-4 hover:scale-[1.02] active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In with Google</span>
          </button>
        </div>
      )}

      {/* Tab Navigation Chips (Liquid Glass) */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={`/library?tab=${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 shrink-0 ${
                isActive
                  ? "liquid-glass-nav-active font-semibold shadow-md text-white border border-white/20"
                  : "liquid-glass hover:bg-white/[0.08] text-neutral-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? "bg-white/20 text-white font-bold"
                      : "bg-white/10 text-neutral-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Tab 1: Playlists */}
      {currentTab === "playlists" && (
        <div className="space-y-4">
          {playlists.length === 0 ? (
            /* Clean prominent 'Create Playlist' action requirement */
            <div className="p-12 text-center rounded-[24px] liquid-glass border border-white/10 space-y-4 max-w-lg mx-auto shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-raaga-red/20 to-purple-600/20 border border-white/10 flex items-center justify-center mx-auto text-raaga-red shadow-inner">
                <ListMusic className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  No playlists created yet
                </h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  Build custom collections, mix your favorite YouTube tracks, and organize your listening sessions.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-raaga-red to-raaga-pink text-white text-xs font-semibold shadow-[0_2px_16px_rgba(250,45,72,0.4)] hover:scale-105 active:scale-95 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Playlist</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* "+ Create Playlist" Card */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="group relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-white/15 hover:border-raaga-red/50 hover:bg-white/[0.04] transition-all duration-200 text-center min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] group-hover:bg-raaga-red/20 flex items-center justify-center text-neutral-400 group-hover:text-raaga-red transition-all duration-200 group-hover:scale-110 mb-3 shadow-inner">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold text-xs text-white group-hover:text-raaga-red transition">
                  Create Playlist
                </span>
                <span className="text-[11px] text-neutral-500 mt-1">
                  New collection
                </span>
              </button>

              {/* Dynamic User Playlists */}
              {playlists.map((pl) => {
                const firstSongArt = pl.songs?.[0]?.thumbnailUrl;
                return (
                  <div
                    key={pl.id}
                    className="group relative flex flex-col p-3 rounded-2xl liquid-glass-card border border-white/[0.08] hover:border-white/20 transition-all duration-200"
                  >
                    <Link
                      href={`/playlist/${pl.id}`}
                      className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-900/60 mb-2.5 flex items-center justify-center shadow-md group"
                    >
                      {firstSongArt ? (
                        <img
                          src={firstSongArt}
                          alt={pl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-neutral-500 group-hover:text-raaga-red transition">
                          <ListMusic className="w-10 h-10" />
                        </div>
                      )}

                      {/* Play Button Overlay on Hover */}
                      {pl.songs && pl.songs.length > 0 && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-raaga-red text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </Link>

                    <div className="flex items-start justify-between min-w-0">
                      <Link href={`/playlist/${pl.id}`} className="min-w-0 flex-1">
                        <h4 className="font-semibold text-xs text-white truncate group-hover:text-raaga-red transition">
                          {pl.name}
                        </h4>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {pl.songs?.length || 0} {pl.songs?.length === 1 ? "track" : "tracks"}
                        </p>
                      </Link>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deletePlaylist(pl.id);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition"
                        title="Delete Playlist"
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
      )}

      {/* Tab 2: Liked Songs */}
      {currentTab === "songs" && (
        <div className="space-y-4">
          {likedSongs.length === 0 ? (
            <div className="p-12 text-center rounded-[24px] liquid-glass border border-white/10 space-y-4 max-w-lg mx-auto shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-raaga-red/20 to-purple-600/20 border border-white/10 flex items-center justify-center mx-auto text-raaga-red shadow-inner">
                <Heart className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  No liked songs yet
                </h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  Click the heart icon on any song or player to save it to your personal favorites.
                </p>
              </div>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition hover:scale-105 active:scale-95"
              >
                <span>Find Songs</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Liked Songs Action Header */}
              <div className="flex items-center justify-between p-4 rounded-2xl liquid-glass border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-raaga-red to-purple-600 flex items-center justify-center shadow-lg text-white">
                    <Heart className="w-6 h-6 fill-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Your Liked Tracks
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {likedSongs.length} {likedSongs.length === 1 ? "track" : "tracks"} saved
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayLikedSongs(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold shadow transition hover:scale-105 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Play All</span>
                  </button>
                  <button
                    onClick={() => handlePlayLikedSongs(true)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition hover:scale-105 active:scale-95"
                    title="Shuffle"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tracks List */}
              <div className="rounded-2xl liquid-glass border border-white/10 overflow-hidden divide-y divide-white/[0.04]">
                {likedSongs.map((song, idx) => (
                  <SongRow
                    key={song.videoId}
                    song={song}
                    index={idx}
                    contextQueue={likedSongs}
                    sourceLabel="Liked Songs"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Albums */}
      {currentTab === "albums" && (
        <div className="p-12 text-center rounded-[24px] liquid-glass border border-white/10 space-y-4 max-w-lg mx-auto shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
            <Disc className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              No saved albums
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
              Explore full albums, EPs, and OSTs on YouTube and save them to your library.
            </p>
          </div>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-raaga-red to-raaga-pink text-white text-xs font-semibold shadow-[0_2px_16px_rgba(250,45,72,0.3)] transition hover:scale-105 active:scale-95"
          >
            <span>Explore New Albums</span>
          </Link>
        </div>
      )}

      {/* Tab 4: Artists */}
      {currentTab === "artists" && (
        <div className="p-12 text-center rounded-[24px] liquid-glass border border-white/10 space-y-4 max-w-lg mx-auto shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
            <Users2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              No subscribed artists
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
              Follow official YouTube Music artist channels to track their newest drops and concerts.
            </p>
          </div>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition hover:scale-105 active:scale-95"
          >
            <span>Discover Artists</span>
          </Link>
        </div>
      )}

      {/* Tab 5: History */}
      {currentTab === "history" && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="p-12 text-center rounded-[24px] liquid-glass border border-white/10 space-y-4 max-w-lg mx-auto shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  No listening history yet
                </h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  Songs you listen to will automatically appear here so you can jump back in at any time.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-raaga-red to-raaga-pink text-white text-xs font-semibold shadow-[0_2px_16px_rgba(250,45,72,0.3)] transition hover:scale-105 active:scale-95"
              >
                <span>Listen Now</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* History Header */}
              <div className="flex items-center justify-between p-4 rounded-2xl liquid-glass border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center text-white shadow-inner">
                    <HistoryIcon className="w-6 h-6 text-neutral-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Listening History
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {history.length} recently played tracks
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayHistory(false)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold shadow transition hover:scale-105 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Play All</span>
                  </button>
                  <button
                    onClick={clearHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 text-neutral-300 hover:text-red-400 text-xs font-medium border border-white/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* History Song Rows */}
              <div className="rounded-2xl liquid-glass border border-white/10 overflow-hidden divide-y divide-white/[0.04]">
                {history.map((song, idx) => (
                  <SongRow
                    key={`${song.videoId}-${idx}`}
                    song={song}
                    index={idx}
                    contextQueue={history}
                    sourceLabel="History"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 7. TAB: LOCAL AUDIO ================= */}
      {currentTab === "local" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-black border border-white/10 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-raaga-cyan/15 text-raaga-cyan flex items-center justify-center border border-raaga-cyan/25 shrink-0 shadow-lg">
                <FolderOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Local & Offline Tracks</h3>
                <p className="text-xs text-neutral-400">
                  {localSongs.length} audio files imported from your device
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-raaga-cyan/20 hover:bg-raaga-cyan/30 text-raaga-cyan border border-raaga-cyan/40 text-xs font-bold transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Import Audio Files</span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.flac,.wav,.m4a,.ogg,.aac,.opus"
                  onChange={(e) => {
                    if (e.target.files) addLocalFiles(e.target.files);
                  }}
                  className="hidden"
                />
              </label>

              {localSongs.length > 0 && (
                <>
                  <button
                    onClick={() => playSong(localSongs[0], localSongs, "Local Audio")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Play All</span>
                  </button>

                  <button
                    onClick={clearLocalSongs}
                    className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-white/10 transition"
                    title="Clear imported local tracks"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {localSongs.length === 0 ? (
            <div className="py-20 text-center space-y-4 liquid-glass border border-white/10 rounded-3xl p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-neutral-500">
                <Music2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">No Local Audio Files</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Import your personal MP3, FLAC, WAV, and M4A audio files to play them with high-fidelity Web Audio DSP and equalizer
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-raaga-red to-raaga-pink text-white text-xs font-bold shadow-glow hover:scale-105 transition">
                <Upload className="w-4 h-4" />
                <span>Select Files to Play</span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.flac,.wav,.m4a,.ogg,.aac,.opus"
                  onChange={(e) => {
                    if (e.target.files) addLocalFiles(e.target.files);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="rounded-2xl liquid-glass border border-white/10 overflow-hidden divide-y divide-white/[0.04]">
              {localSongs.map((song, idx) => (
                <SongRow
                  key={song.videoId}
                  song={song}
                  index={idx}
                  contextQueue={localSongs}
                  sourceLabel="Local"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reusable Create Playlist Liquid Glass Modal */}
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-400">Loading library...</div>}>
      <LibraryContent />
    </Suspense>
  );
}

