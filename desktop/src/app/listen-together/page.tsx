"use client";

import { useState, useEffect } from "react";
import {
  Radio,
  Share2,
  Check,
  Users,
  Play,
  Pause,
  Sparkles,
  Music2,
  Copy,
  Plus,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { syncClient } from "@/services/connect/raaga-sync-client";
import { getOptimalArtwork } from "@/lib/utils";

export default function ListenTogetherPage() {
  const { currentSong, isPlaying, togglePlay } = usePlayerStore();
  const [roomId, setRoomId] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = syncClient.subscribe((event) => {
      if (event.type === "PARTICIPANT_JOINED" || event.type === "PARTICIPANT_LEFT") {
        if (event.payload?.count) {
          setParticipantCount(event.payload.count);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(code);
    syncClient.joinJamRoom(code, true);
  };

  const handleJoinRoom = () => {
    if (!inputCode.trim()) return;
    const clean = inputCode.trim().toUpperCase();
    setRoomId(clean);
    syncClient.joinJamRoom(clean, false);
  };

  const handleLeave = () => {
    if (roomId) {
      syncClient.leaveJamRoom(roomId);
      setRoomId("");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 select-none pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-black text-3xl sm:text-4xl text-white tracking-tight">
            Listen Together
          </h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Jam Session
          </span>
        </div>
        <p className="text-sm text-neutral-400 font-medium mt-1">
          Synchronize music playback in real-time with friends across Android phones, Macs, and PCs
        </p>
      </div>

      {roomId ? (
        /* Active Jam Room View */
        <div className="space-y-6">
          {/* Room Banner */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-900 via-purple-950 to-black border border-purple-500/20 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">
                  Active Jam Room
                </span>
                <div className="flex items-center gap-3">
                  <h2 className="font-mono font-black text-3xl sm:text-4xl text-white tracking-widest">
                    {roomId}
                  </h2>
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-bold"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-raaga-cyan" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? "Copied" : "Copy Code"}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 text-white text-xs font-bold">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>{participantCount} Participant{participantCount !== 1 ? "s" : ""}</span>
                </div>

                <button
                  onClick={handleLeave}
                  className="px-4 py-2 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold transition"
                >
                  Leave Room
                </button>
              </div>
            </div>

            {/* Now Synchronizing Track */}
            {currentSong && (
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getOptimalArtwork(currentSong.thumbnailUrl, 160)}
                    alt={currentSong.title}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-lg"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-purple-400">
                      Synchronized Track
                    </span>
                    <h4 className="font-bold text-base text-white truncate">
                      {currentSong.title}
                    </h4>
                    <p className="text-xs text-neutral-400 truncate">
                      {currentSong.artist}
                    </p>
                  </div>
                </div>

                <button
                  onClick={togglePlay}
                  className="p-3 rounded-full bg-white text-black shadow-lg hover:scale-105 transition"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Create or Join Jam Room */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Host Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-950 to-[#161618] border border-purple-500/20 shadow-2xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 w-fit">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="font-black text-2xl text-white">Host a Jam Room</h3>
              <p className="text-xs text-neutral-300">
                Start a live listening room. Friends who join with your code will automatically hear the same song in real-time.
              </p>
            </div>

            <button
              onClick={handleCreateRoom}
              className="w-full py-3.5 rounded-2xl bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-sm shadow-glow hover:scale-[1.01] transition"
            >
              Start New Jam
            </button>
          </div>

          {/* Join Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#161618] border border-white/10 shadow-2xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-white/5 text-neutral-300 w-fit">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-black text-2xl text-white">Join a Jam Room</h3>
              <p className="text-xs text-neutral-400">
                Enter the 6-character room PIN shared by your host or friend.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-char room code..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white font-mono uppercase text-center text-lg tracking-widest focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleJoinRoom}
                disabled={!inputCode.trim()}
                className="w-full py-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-lg hover:scale-[1.01] transition disabled:opacity-40"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
