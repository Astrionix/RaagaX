"use client";

import { usePlayerStore, EqualizerSettings } from "@/stores/player-store";
import { X, Sliders, Check } from "lucide-react";

const PRESETS: Array<{ name: EqualizerSettings["preset"]; bass: number; mid: number; treble: number }> = [
  { name: "Flat", bass: 0, mid: 0, treble: 0 },
  { name: "Bass Boost", bass: 7, mid: 1, treble: -2 },
  { name: "Vocal Boost", bass: -2, mid: 6, treble: 3 },
  { name: "Treble Boost", bass: -3, mid: 2, treble: 7 },
  { name: "Rock", bass: 5, mid: -1, treble: 4 },
  { name: "Pop", bass: 3, mid: 4, treble: 2 },
];

export default function EqualizerModal() {
  const { equalizer, setEqualizer, isEqualizerOpen, setEqualizerOpen } = usePlayerStore();

  if (!isEqualizerOpen) return null;

  const handlePresetSelect = (preset: (typeof PRESETS)[0]) => {
    setEqualizer({
      preset: preset.name,
      bass: preset.bass,
      mid: preset.mid,
      treble: preset.treble,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-raaga-red/20 text-raaga-red">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Audio Equalizer</h3>
              <p className="text-xs text-neutral-400">Enhance acoustic dynamics</p>
            </div>
          </div>
          <button
            onClick={() => setEqualizerOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Enable Equalizer Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
          <div>
            <span className="font-semibold text-sm text-white">Enable Equalizer</span>
            <p className="text-xs text-neutral-400">Apply custom frequency bands</p>
          </div>
          <button
            onClick={() => setEqualizer({ enabled: !equalizer.enabled })}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              equalizer.enabled ? "bg-raaga-red" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                equalizer.enabled ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>

        {/* Sliders (Bass, Mid, Treble) */}
        <div className={`space-y-4 transition-opacity ${equalizer.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          {/* Bass */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-neutral-300">Bass (Low Frequencies)</span>
              <span className="text-raaga-red font-mono">{equalizer.bass > 0 ? `+${equalizer.bass}` : equalizer.bass} dB</span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={equalizer.bass}
              onChange={(e) => setEqualizer({ bass: parseInt(e.target.value, 10), preset: "Custom" })}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-raaga-red"
            />
          </div>

          {/* Mid */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-neutral-300">Mid (Vocals & Instruments)</span>
              <span className="text-raaga-red font-mono">{equalizer.mid > 0 ? `+${equalizer.mid}` : equalizer.mid} dB</span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={equalizer.mid}
              onChange={(e) => setEqualizer({ mid: parseInt(e.target.value, 10), preset: "Custom" })}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-raaga-red"
            />
          </div>

          {/* Treble */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-neutral-300">Treble (High Clarity)</span>
              <span className="text-raaga-red font-mono">{equalizer.treble > 0 ? `+${equalizer.treble}` : equalizer.treble} dB</span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={equalizer.treble}
              onChange={(e) => setEqualizer({ treble: parseInt(e.target.value, 10), preset: "Custom" })}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-raaga-red"
            />
          </div>
        </div>

        {/* Preset Chips */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Presets</span>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const isSelected = equalizer.preset === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => handlePresetSelect(p)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition border ${
                    isSelected
                      ? "bg-raaga-red text-white border-raaga-red shadow-glow"
                      : "bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={() => setEqualizerOpen(false)}
          className="w-full py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black font-bold text-sm shadow-lg transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
