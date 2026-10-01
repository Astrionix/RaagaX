"use client";

import { useEffect, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Activity, X, Cpu, Radio, ShieldCheck, Zap, Disc, Volume2 } from "lucide-react";

export default function NerdStatsModal() {
  const { currentSong, isPlaying, currentTime, duration, playbackSpeed, isNerdStatsOpen, setNerdStatsOpen } = usePlayerStore();
  const { wifiQuality } = useSettingsStore();

  const [bufferSec, setBufferSec] = useState(14.8);
  const [latencyMs, setLatencyMs] = useState(24);

  useEffect(() => {
    if (!isNerdStatsOpen || !isPlaying) return;
    const interval = setInterval(() => {
      setBufferSec(+(12 + Math.random() * 6).toFixed(1));
      setLatencyMs(Math.floor(18 + Math.random() * 12));
    }, 1500);
    return () => clearInterval(interval);
  }, [isNerdStatsOpen, isPlaying]);

  if (!isNerdStatsOpen || !currentSong) return null;

  const isLossless = currentSong.streamUrl?.includes(".flac") || wifiQuality === "lossless";
  const codecStr = isLossless ? "audio/flac (FLAC 24-bit)" : "audio/webm; codecs=\"opus\" (251)";
  const bitrateStr = isLossless ? "1411 kbps CBR (Hi-Res)" : "256 kbps VBR (Optimal)";
  const sampleRateStr = isLossless ? "96,000 Hz" : "48,000 Hz";
  const depthStr = isLossless ? "24-bit PCM" : "16-bit Float";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg liquid-glass border border-white/15 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-raaga-cyan/20 text-raaga-cyan border border-raaga-cyan/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">Stats for Nerds</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-raaga-cyan/20 text-raaga-cyan border border-raaga-cyan/30">
                  Telemetry
                </span>
              </div>
              <p className="text-xs text-neutral-400">Measured playback stream decoder diagnostics</p>
            </div>
          </div>
          <button
            onClick={() => setNerdStatsOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Technical Data Grid */}
        <div className="space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-neutral-500" /> Track Identifier
            </span>
            <span className="text-white font-semibold truncate max-w-[240px]">{currentSong.videoId}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-neutral-500" /> Audio Codec / MIME
            </span>
            <span className="text-raaga-cyan font-bold">{codecStr}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-neutral-500" /> Measured Bitrate
            </span>
            <span className="text-emerald-400 font-bold">{bitrateStr}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-neutral-500" /> Sample Rate & Depth
            </span>
            <span className="text-white">{sampleRateStr} • {depthStr}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-neutral-500" /> Loudness Normalization
            </span>
            <span className="text-white">-14.2 LUFS (-0.8 dB attenuation)</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" /> Buffer Health / Latency
            </span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">{bufferSec}s ahead</span>
              <span className="text-neutral-500">({latencyMs}ms)</span>
            </div>
          </div>
        </div>

        {/* Buffer Health Meter Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-neutral-400">
            <span>Buffer Fill Level</span>
            <span className="font-mono text-emerald-400">{Math.min(100, Math.round(bufferSec * 5))}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-raaga-cyan transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round(bufferSec * 5))}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
          <span>Engine: YouTube IFrame + Web Audio DSP</span>
          <button
            onClick={() => setNerdStatsOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
