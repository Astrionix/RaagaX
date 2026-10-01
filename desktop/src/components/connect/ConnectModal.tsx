"use client";

import { useState, useEffect } from "react";
import {
  X,
  Cast,
  Smartphone,
  Laptop,
  Tv,
  Speaker,
  Radio,
  Share2,
  Check,
  RefreshCw,
  Play,
  Pause,
  Volume2,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { syncClient } from "@/services/connect/raaga-sync-client";
import { ConnectDevice } from "@/types/music";

export default function ConnectModal() {
  const {
    isConnectModalOpen,
    setConnectModalOpen,
    currentSong,
    currentTime,
    isPlaying,
    volume,
  } = usePlayerStore();

  const [devices, setDevices] = useState<ConnectDevice[]>([]);
  const [jamRoomCode, setJamRoomCode] = useState("");
  const [activeJamRoom, setActiveJamRoom] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isConnectModalOpen) return;

    const unsubscribe = syncClient.subscribe((event) => {
      if (event.type === "DEVICE_LIST_UPDATED" && event.devices) {
        setDevices(event.devices);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnectModalOpen]);

  if (!isConnectModalOpen) return null;

  const handleHandoff = (targetDevice: ConnectDevice) => {
    if (!currentSong) return;

    // Send playback transfer command to target Android or PC device
    syncClient.sendRemoteCommand(targetDevice.deviceId, {
      type: "SwitchPlayback",
      videoId: currentSong.videoId,
      title: currentSong.title,
      artist: currentSong.artist,
      thumbnailUrl: currentSong.thumbnailUrl,
      positionMs: currentTime * 1000,
      isPlaying: true,
    });
  };

  const handleRemoteControl = (targetDeviceId: string, cmd: string, val?: any) => {
    syncClient.sendRemoteCommand(targetDeviceId, {
      type: cmd,
      ...(val !== undefined ? val : {}),
    });
  };

  const handleCreateJam = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setActiveJamRoom(code);
    syncClient.joinJamRoom(code, true);
  };

  const handleJoinJam = () => {
    if (!jamRoomCode.trim()) return;
    const clean = jamRoomCode.trim().toUpperCase();
    setActiveJamRoom(clean);
    syncClient.joinJamRoom(clean, false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#161618] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-raaga-cyan/20 text-raaga-cyan">
              <Cast className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">Raaga Connect</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-raaga-cyan/20 text-raaga-cyan border border-raaga-cyan/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-raaga-cyan animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Seamless playback handoff with Raaga Android app
              </p>
            </div>
          </div>

          <button
            onClick={() => setConnectModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Device Section */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Laptop className="w-6 h-6 text-white" />
            <div>
              <span className="text-xs font-bold uppercase text-raaga-red">Current Device</span>
              <h4 className="text-sm font-bold text-white">{syncClient.deviceName}</h4>
            </div>
          </div>
          <span className="text-xs font-bold text-neutral-400 font-mono">
            {syncClient.deviceId.substring(0, 8)}
          </span>
        </div>

        {/* Discovered Nearby / Account Devices */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Select Device to Handoff
            </span>
            <button
              onClick={() => {
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 800);
              }}
              className="p-1 text-neutral-400 hover:text-white transition"
              title="Refresh devices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 text-center space-y-2">
              <Smartphone className="w-8 h-8 text-neutral-500 mx-auto opacity-50" />
              <p className="text-sm font-semibold text-neutral-300">
                Waiting for Raaga Android App...
              </p>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                Open Raaga on your phone on the same Wi-Fi network or sign in with the same account to continue listening.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((dev) => (
                <div
                  key={dev.deviceId}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Smartphone className="w-6 h-6 text-raaga-cyan shrink-0" />
                    <div className="min-w-0">
                      <h5 className="font-bold text-sm text-white truncate">
                        {dev.deviceName}
                      </h5>
                      <span className="text-[11px] text-neutral-400">
                        {dev.platform} • Ready for transfer
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleHandoff(dev)}
                      className="px-3.5 py-1.5 rounded-xl bg-raaga-cyan text-black font-bold text-xs hover:scale-105 transition shadow"
                    >
                      Handoff
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Listen Together / Jam Session Section */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-raaga-red/20 border border-purple-500/20 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold text-white">Listen Together (Jam)</h4>
          </div>

          {activeJamRoom ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/60 border border-white/10">
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase">Room Code</span>
                <p className="text-lg font-mono font-extrabold text-white tracking-widest">
                  {activeJamRoom}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeJamRoom);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold flex items-center gap-1"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-raaga-cyan" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{isCopied ? "Copied" : "Share"}</span>
                </button>
                <button
                  onClick={() => {
                    syncClient.leaveJamRoom(activeJamRoom);
                    setActiveJamRoom(null);
                  }}
                  className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold transition"
                >
                  Leave
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-char PIN"
                value={jamRoomCode}
                onChange={(e) => setJamRoomCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleJoinJam}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition"
              >
                Join
              </button>
              <button
                onClick={handleCreateJam}
                className="px-3.5 py-2 rounded-xl bg-raaga-red hover:bg-raaga-redDark text-white font-bold text-xs transition shadow-glow"
              >
                Host Jam
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
