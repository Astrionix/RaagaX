"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { LyricsSource, LyricsSyncType } from "@/types/lyrics";
import {
  Mic2,
  Clock,
  Loader2,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  ChevronDown,
  Layers,
  Music2,
  Zap,
} from "lucide-react";

export default function SyncedLyricsView() {
  const {
    lyrics,
    lyricsLoading,
    activeLyricIndex,
    currentTime,
    seek,
    lyricsOffsetMs,
    setLyricsOffset,
    selectedLyricsProvider,
    setLyricsProvider,
  } = usePlayerStore();

  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"synced" | "plain">("synced");
  const [showOffsetControls, setShowOffsetControls] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Precise current millisecond position with user sync offset applied
  const currentMs = currentTime * 1000 + lyricsOffsetMs;

  // Smooth auto-scroll to the active lyric line
  useEffect(() => {
    if (mode === "synced" && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLyricIndex, mode]);

  const handleCopy = () => {
    if (!lyrics) return;
    const textToCopy =
      lyrics.plainText ||
      lyrics.lines
        .filter((l) => !l.isGap && l.text)
        .map((l) => l.text)
        .join("\n");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSyncBadge = (type?: LyricsSyncType) => {
    switch (type) {
      case "syllable-synced":
        return { label: "Syllable", color: "text-amber-400 bg-amber-400/15 border-amber-400/30" };
      case "word-synced":
        return { label: "Word", color: "text-emerald-400 bg-emerald-400/15 border-emerald-400/30" };
      case "line-synced":
        return { label: "Line", color: "text-sky-400 bg-sky-400/15 border-sky-400/30" };
      default:
        return { label: "Plain", color: "text-neutral-400 bg-white/10 border-white/15" };
    }
  };

  if (lyricsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-raaga-red" />
        <p className="text-sm font-medium">Fetching multi-provider lyrics...</p>
        <p className="text-xs text-neutral-500">Checking syllable & word timing databases</p>
      </div>
    );
  }

  // Graceful handling when a user explicitly selected a provider that doesn't have lyrics for this song
  if (lyrics?.notFoundOnProvider) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-12 px-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-neutral-300">
          <Mic2 className="w-6 h-6 opacity-60 text-raaga-red" />
        </div>
        <div>
          <p className="text-base font-bold text-white">
            No lyrics found on {lyrics.provider || "selected provider"}
          </p>
          <p className="text-xs text-neutral-400 max-w-sm mt-1 leading-relaxed">
            This database does not have synchronized lyrics for this song. You can switch back to Auto (Best Match) or pick a different source.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setLyricsProvider("AUTO")}
            className="px-4 py-2 rounded-xl bg-raaga-red text-white text-xs font-bold hover:bg-raaga-red/90 transition shadow-lg shadow-raaga-red/25 flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Switch to Auto (Best Available)</span>
          </button>
          <button
            onClick={() => setShowProviderModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-200 text-xs font-semibold transition border border-white/10"
          >
            Try Another Source
          </button>
        </div>

        {/* Provider Modal Overlay */}
        {showProviderModal && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-xl p-6 overflow-y-auto no-scrollbar animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-raaga-red" />
                <h3 className="font-bold text-sm text-white">Lyrics Sources</h3>
              </div>
              <button
                onClick={() => setShowProviderModal(false)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 mt-4">
              {lyrics.availableProviders?.map((prov) => {
                const isCurrent = selectedLyricsProvider === prov.id;
                const pBadge = getSyncBadge(prov.syncType);
                return (
                  <button
                    key={prov.id}
                    onClick={() => {
                      setLyricsProvider(prov.id);
                      setShowProviderModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition ${
                      isCurrent
                        ? "bg-raaga-red/15 border-raaga-red/40 text-white shadow-lg"
                        : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-neutral-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{prov.label}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${pBadge.color}`}
                        >
                          {pBadge.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-raaga-red flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{prov.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!lyrics || (!lyrics.lines.length && !lyrics.plainText)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 py-16 space-y-3">
        <Mic2 className="w-10 h-10 stroke-1 opacity-50" />
        <p className="text-base font-semibold text-neutral-300">No Lyrics Available</p>
        <p className="text-xs text-neutral-500 max-w-xs text-center">
          None of our synced providers found lyrics for this upload. Enjoy the instrumentation!
        </p>
        {lyrics?.availableProviders && lyrics.availableProviders.length > 0 && (
          <button
            onClick={() => setShowProviderModal(true)}
            className="mt-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 transition"
          >
            <Layers className="w-3.5 h-3.5 text-raaga-red" />
            <span>Check Sources</span>
          </button>
        )}

        {/* Provider Modal Overlay */}
        {showProviderModal && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-xl p-6 overflow-y-auto no-scrollbar animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-raaga-red" />
                <h3 className="font-bold text-sm text-white">Lyrics Sources</h3>
              </div>
              <button
                onClick={() => setShowProviderModal(false)}
                className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 mt-4">
              {lyrics?.availableProviders?.map((prov) => {
                const isCurrent =
                  selectedLyricsProvider === prov.id ||
                  (!selectedLyricsProvider && prov.id === "AUTO");
                const pBadge = getSyncBadge(prov.syncType);
                return (
                  <button
                    key={prov.id}
                    onClick={() => {
                      setLyricsProvider(prov.id);
                      setShowProviderModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition ${
                      isCurrent
                        ? "bg-raaga-red/15 border-raaga-red/40 text-white shadow-lg"
                        : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-neutral-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{prov.label}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${pBadge.color}`}
                        >
                          {pBadge.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-raaga-red flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{prov.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const badge = getSyncBadge(lyrics.syncType);

  return (
    <div className="flex flex-col h-full select-none relative">
      {/* Top Header / Timing Offset & Provider Controls */}
      <div className="px-6 py-3 border-b border-white/10 text-xs text-neutral-400 bg-black/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2">
          {/* Provider Dropdown Button */}
          <button
            onClick={() => setShowProviderModal(!showProviderModal)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/15 transition group"
            title="Switch Lyrics Provider"
          >
            <Sparkles className="w-3 h-3 text-raaga-red" />
            <span className="font-semibold text-xs">{lyrics.provider || "LRCLIB"}</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badge.color}`}
            >
              {badge.label}
            </span>
            <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-white transition" />
          </button>

          {/* Mode Switcher: Karaoke / Plain */}
          <div className="flex items-center rounded-lg bg-white/10 p-0.5 text-[11px] font-semibold">
            <button
              onClick={() => setMode("synced")}
              className={`px-2.5 py-0.5 rounded-md transition ${
                mode === "synced"
                  ? "bg-white text-black shadow-sm font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Karaoke
            </button>
            <button
              onClick={() => setMode("plain")}
              className={`px-2.5 py-0.5 rounded-md transition ${
                mode === "plain"
                  ? "bg-white text-black shadow-sm font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Plain Text
            </button>
          </div>
        </div>

        {/* Right Tools: Offset Toggle & Copy Button */}
        <div className="flex items-center gap-2">
          {lyrics.synced && (
            <button
              onClick={() => setShowOffsetControls(!showOffsetControls)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                showOffsetControls || lyricsOffsetMs !== 0
                  ? "bg-raaga-red/20 text-raaga-red border border-raaga-red/30"
                  : "bg-white/5 hover:bg-white/10 text-neutral-300"
              }`}
              title="Calibrate Lyric Timing Offset"
            >
              <Clock className="w-3 h-3" />
              <span>
                {lyricsOffsetMs !== 0
                  ? `${lyricsOffsetMs > 0 ? "+" : ""}${lyricsOffsetMs}ms`
                  : "Sync Offset"}
              </span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 transition"
            title="Copy all lyrics"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Latency Offset Calibration Drawer */}
      {showOffsetControls && lyrics.synced && (
        <div className="px-6 py-2.5 bg-black/70 border-b border-white/10 flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-150 shrink-0 z-20">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <span className="font-semibold text-white">Sync Offset:</span>
            <span className="font-mono text-raaga-red font-bold">
              {lyricsOffsetMs > 0 ? `+${lyricsOffsetMs}` : lyricsOffsetMs}ms
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLyricsOffset(lyricsOffsetMs - 500)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition"
              title="500ms earlier"
            >
              -500ms
            </button>
            <button
              onClick={() => setLyricsOffset(lyricsOffsetMs - 100)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition"
              title="100ms earlier"
            >
              -100ms
            </button>
            <button
              onClick={() => setLyricsOffset(0)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-neutral-300 font-mono text-[11px] transition flex items-center gap-1"
              title="Reset offset to 0"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={() => setLyricsOffset(lyricsOffsetMs + 100)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition"
              title="100ms later"
            >
              +100ms
            </button>
            <button
              onClick={() => setLyricsOffset(lyricsOffsetMs + 500)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition"
              title="500ms later"
            >
              +500ms
            </button>
          </div>
        </div>
      )}

      {/* Provider Selector Modal / Sheet */}
      {showProviderModal && (
        <div className="absolute inset-x-0 top-12 bottom-0 z-30 bg-black/80 backdrop-blur-xl p-6 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-raaga-red" />
              <h3 className="font-bold text-sm text-white">Lyrics Sources</h3>
            </div>
            <button
              onClick={() => setShowProviderModal(false)}
              className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg bg-white/10"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-neutral-400 mt-2 mb-4 leading-relaxed">
            Raaga queries databases concurrently and automatically selects the highest fidelity
            word/syllable-synced stream. You can also manually choose your preferred provider below.
          </p>

          <div className="space-y-2">
            {lyrics.availableProviders?.map((prov) => {
              const isCurrent =
                selectedLyricsProvider === prov.id ||
                (!selectedLyricsProvider && prov.id === "AUTO") ||
                lyrics.providerId === prov.id;
              const pBadge = getSyncBadge(prov.syncType);

              return (
                <button
                  key={prov.id}
                  onClick={() => {
                    setLyricsProvider(prov.id);
                    setShowProviderModal(false);
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition ${
                    isCurrent
                      ? "bg-raaga-red/15 border-raaga-red/40 text-white shadow-lg"
                      : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-neutral-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{prov.label}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${pBadge.color}`}
                      >
                        {pBadge.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-raaga-red flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{prov.detail}</p>
                  </div>

                  <Zap
                    className={`w-4 h-4 shrink-0 transition ${
                      isCurrent ? "text-raaga-red" : "text-neutral-500 opacity-60"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lyrics Scrollable Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-12 space-y-7 no-scrollbar scroll-smooth"
      >
        {mode === "synced" && lyrics.lines.length > 0 ? (
          lyrics.lines.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            const isPassed = idx < activeLyricIndex;

            // Instrumental Break
            if (line.isGap) {
              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.startTimeMs / 1000)}
                  className={`flex items-center gap-2 cursor-pointer transition-all duration-300 ${
                    isActive ? "opacity-100 scale-105" : "opacity-30 hover:opacity-60"
                  }`}
                  title="Instrumental break (Click to seek)"
                >
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-neutral-300">
                    <Music2 className="w-3.5 h-3.5 text-raaga-red animate-pulse" />
                    <span className="text-xs font-mono tracking-widest uppercase">Instrumental</span>
                  </div>
                </div>
              );
            }

            const hasWordSync = Boolean(line.words && line.words.length > 0);
            const isDuetEnd = line.alignment === "End";

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.startTimeMs / 1000)}
                className={`cursor-pointer transition-all duration-300 ${
                  isDuetEnd ? "text-right items-end pr-2" : "text-left"
                }`}
                title="Click line to seek"
              >
                {/* Main Vocal Line */}
                <div
                  className={`font-bold transition-all duration-300 leading-snug ${
                    isActive
                      ? "text-white text-2xl md:text-3xl scale-[1.03] filter drop-shadow-[0_0_24px_rgba(255,255,255,0.35)] opacity-100"
                      : isPassed
                      ? "text-neutral-500 text-xl md:text-2xl hover:text-neutral-300 opacity-60"
                      : "text-neutral-600 text-xl md:text-2xl hover:text-neutral-400 opacity-40"
                  }`}
                >
                  {/* Word-by-word / Syllable sweep highlight */}
                  {isActive && hasWordSync && line.words ? (
                    <span className="inline-flex flex-wrap gap-x-1.5 items-baseline">
                      {line.words.map((w, wIdx) => {
                        const isWordActive = currentMs >= w.startMs && currentMs < w.endMs;
                        const isWordPassed = currentMs >= w.endMs;

                        return (
                          <span
                            key={wIdx}
                            className={`transition-all duration-150 ${
                              isWordActive
                                ? "text-white font-black scale-105 filter drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] inline-block transform"
                                : isWordPassed
                                ? "text-white opacity-100 font-bold"
                                : "text-neutral-400 opacity-50"
                            }`}
                          >
                            {w.text}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span>{line.text}</span>
                  )}
                </div>

                {/* Answering Background Vocals (x-bg) */}
                {line.background && (
                  <div
                    className={`text-sm md:text-base italic font-medium mt-1.5 transition-all duration-300 ${
                      isActive && currentMs >= line.background.startTimeMs
                        ? "text-raaga-pink drop-shadow-[0_0_10px_rgba(250,45,72,0.4)] opacity-100"
                        : "text-neutral-500 opacity-50"
                    }`}
                  >
                    ({line.background.text})
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-left text-neutral-300 text-base md:text-lg whitespace-pre-line leading-relaxed font-medium">
            {lyrics.plainText ||
              lyrics.lines
                .filter((l) => !l.isGap && l.text)
                .map((l) => l.text)
                .join("\n")}
          </div>
        )}
      </div>
    </div>
  );
}
