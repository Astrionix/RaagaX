"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/stores/player-store";
import QueueDrawer from "./QueueDrawer";
import SyncedLyricsView from "./SyncedLyricsView";
import { X, Mic2 } from "lucide-react";

export default function DesktopRightPanels() {
  const { isQueueOpen, setQueueOpen, isLyricsOpen, setLyricsOpen } = usePlayerStore();

  // Esc key closes drawers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isQueueOpen) setQueueOpen(false);
        if (isLyricsOpen) setLyricsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQueueOpen, isLyricsOpen, setQueueOpen, setLyricsOpen]);

  return (
    <>
      {/* Queue Drawer Panel */}
      {isQueueOpen && (
        <aside className="fixed top-0 right-0 bottom-[78px] w-[360px] bg-[#121216]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
          <QueueDrawer />
        </aside>
      )}

      {/* Lyrics Drawer Panel */}
      {isLyricsOpen && (
        <aside className="fixed top-0 right-0 bottom-[78px] w-[380px] bg-[#121216]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#0E0E12]">
            <div className="flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-raaga-red" />
              <h3 className="font-bold text-sm text-white">Lyrics</h3>
            </div>
            <button
              onClick={() => setLyricsOpen(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
              title="Close Lyrics"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <SyncedLyricsView />
          </div>
        </aside>
      )}
    </>
  );
}
