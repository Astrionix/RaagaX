"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";
import { useSettingsStore } from "@/stores/settings-store";

export default function ClientInit() {
  const { initAuth } = useAuthStore();
  const liquidGlassMode = useSettingsStore((s) => s.liquidGlassMode);
  const {
    togglePlay,
    seek,
    currentTime,
    duration,
    next,
    prev,
    toggleMute,
    volume,
    setVolume,
    setLyricsOpen,
    isLyricsOpen,
    setQueueOpen,
    isQueueOpen,
    setNowPlayingOpen,
    isNowPlayingOpen,
  } = usePlayerStore();

  useEffect(() => {
    initAuth();
  }, []);

  // Synchronize liquid glass mode attribute to root element
  useEffect(() => {
    const mode = liquidGlassMode || "dark";
    document.documentElement.setAttribute("data-glass-mode", mode);
  }, [liquidGlassMode]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(Math.max(0, currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(Math.min(duration, currentTime + 5));
          break;
        case "KeyN":
          e.preventDefault();
          next();
          break;
        case "KeyP":
          e.preventDefault();
          prev();
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyL":
          e.preventDefault();
          setLyricsOpen(!isLyricsOpen);
          break;
        case "KeyQ":
          e.preventDefault();
          setQueueOpen(!isQueueOpen);
          break;
        case "KeyF":
          e.preventDefault();
          setNowPlayingOpen(!isNowPlayingOpen);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentTime,
    duration,
    isLyricsOpen,
    isQueueOpen,
    isNowPlayingOpen,
    togglePlay,
    seek,
    next,
    prev,
    toggleMute,
    setLyricsOpen,
    setQueueOpen,
    setNowPlayingOpen,
  ]);

  return null;
}
