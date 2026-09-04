"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Users,
  Radio,
  Share2,
  Speaker,
  Headphones,
  Volume2,
  LogOut,
} from "lucide-react";
import { getJamInviteUrl, JamAudioMode } from "@/lib/jam/JamSessionManager";
import { usePlayerStore } from "@/context/usePlayerStore";
import { useJam } from "@/hooks/useJam";
import { syncEngine } from "@/services/PrecisionSyncEngine";

interface JamInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomPin: string | null;
  inviteUrl: string;
  participantCount: number;
  onLeaveJam: () => void;
  isHost: boolean;
  allowGuestControl?: boolean;
  onToggleGuestControl?: (allowed: boolean) => void;
  audioMode?: JamAudioMode;
  onSetAudioMode?: (mode: JamAudioMode) => void;
  isLocalAudioOutput?: boolean;
  onSetLocalAudioOutput?: (enabled: boolean) => void;
}

export const JamInviteModal: React.FC<JamInviteModalProps> = ({
  isOpen,
  onClose,
  roomPin,
  inviteUrl,
  participantCount,
  onLeaveJam,
  isHost,
  allowGuestControl = true,
  onToggleGuestControl,
  audioMode: propAudioMode,
  onSetAudioMode,
  isLocalAudioOutput: propIsLocalOutput,
  onSetLocalAudioOutput,
}) => {
  const jam = useJam();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [shared, setShared] = useState(false);

  if (!isOpen || !roomPin) return null;

  const activeMode: JamAudioMode = propAudioMode || jam.audioMode || "IN_PERSON";
  const isLocalOutput = propIsLocalOutput !== undefined ? propIsLocalOutput : jam.isLocalAudioOutput;

  const handleModeSelect = async (mode: JamAudioMode) => {
    await syncEngine.unlockAudio();
    if (onSetAudioMode) {
      onSetAudioMode(mode);
    } else {
      jam.setAudioMode(mode);
    }
  };

  const handleToggleLocalOutput = async (enabled: boolean) => {
    await syncEngine.unlockAudio();
    if (onSetLocalAudioOutput) {
      onSetLocalAudioOutput(enabled);
    } else {
      jam.setLocalAudioOutput(enabled);
    }
  };

  const effectiveInviteUrl = roomPin ? getJamInviteUrl(roomPin) : inviteUrl || "https://raaga.me";
  const formattedPin = roomPin.length === 6 ? `${roomPin.slice(0, 3)} ${roomPin.slice(3)}` : roomPin;
  const fullShareText = `Join my Jam on RaagaX! 🎧\nListen together and queue tracks in real-time.\n\n🔑 Jam Code: ${formattedPin}\n🔗 Link: ${effectiveInviteUrl}`;

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join my Jam on RaagaX 🎧",
          text: fullShareText,
          url: effectiveInviteUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullShareText);
      setShared(true);
      usePlayerStore.getState().setToastMessage("Jam invite link & code copied! 📋");
      setTimeout(() => setShared(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveInviteUrl);
      setCopiedLink(true);
      usePlayerStore.getState().setToastMessage("Link copied! 🔗");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(roomPin);
      setCopiedCode(true);
      usePlayerStore.getState().setToastMessage(`Code ${formattedPin} copied! 🔑`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#181818] border border-white/10 shadow-2xl p-5 text-white select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Compact Header Pill */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1ed760]/15 border border-[#1ed760]/30 text-[#1ed760] text-[11px] font-bold">
            <Radio size={12} className="animate-pulse" />
            <span>{isHost ? "Hosting Jam" : "In Jam"}</span>
            <span className="text-white/60 font-normal">•</span>
            <span className="flex items-center gap-1 text-white/90">
              <Users size={11} /> {participantCount}
            </span>
          </div>
        </div>

        {/* PIN Code Box (Tap to Copy) */}
        <div
          onClick={handleCopyCode}
          className="bg-black/40 hover:bg-black/60 border border-white/10 hover:border-[#1ed760]/50 rounded-xl py-2 px-3 text-center cursor-pointer transition-all mb-3 group"
          title="Click to copy room code"
        >
          <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-1">
            <span>JAM CODE</span>
            <span className="text-zinc-500 group-hover:text-[#1ed760] font-medium flex items-center gap-0.5 ml-1">
              {copiedCode ? <Check size={10} className="text-[#1ed760]" /> : <Copy size={10} />}
              {copiedCode ? "Copied" : "Copy"}
            </span>
          </div>
          <div className="text-2xl font-extrabold tracking-widest text-[#1ed760] font-mono leading-tight">
            {formattedPin}
          </div>
        </div>

        {/* ── SIMPLE 3-MODE SEGMENTED TABS (HOST) ────────────────────────── */}
        {isHost ? (
          <div className="mb-3">
            <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1.5 px-0.5">
              Listening Mode
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => handleModeSelect("IN_PERSON")}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                  activeMode === "IN_PERSON"
                    ? "bg-[#1ed760] text-black font-bold shadow-md"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Speaker size={16} />
                <span className="text-[11px] mt-1 leading-none">Speaker</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect("REMOTE_LISTEN")}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                  activeMode === "REMOTE_LISTEN"
                    ? "bg-[#1ed760] text-black font-bold shadow-md"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Headphones size={16} />
                <span className="text-[11px] mt-1 leading-none">Remote</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect("MULTI_SPEAKER")}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                  activeMode === "MULTI_SPEAKER"
                    ? "bg-[#1ed760] text-black font-bold shadow-md"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Volume2 size={16} />
                <span className="text-[11px] mt-1 leading-none">Party</span>
              </button>
            </div>

            {/* 1-Line Dynamic Caption */}
            <p className="text-[10px] text-zinc-400 text-center mt-1.5 leading-tight px-1">
              {activeMode === "IN_PERSON" && "📻 Sound plays on Host speaker only. Guests control queue."}
              {activeMode === "REMOTE_LISTEN" && "🎧 Friends listen in headphones over the cloud."}
              {activeMode === "MULTI_SPEAKER" && "🔊 All phone speakers blast simultaneously in sync."}
            </p>
          </div>
        ) : (
          /* ── SIMPLE GUEST SOUND OUTPUT SWITCHER ────────────────────────── */
          <div className="mb-3">
            <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1.5 px-0.5">
              Audio Destination
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => handleToggleLocalOutput(false)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all cursor-pointer ${
                  !isLocalOutput
                    ? "bg-[#1ed760] text-black font-bold shadow-md"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Speaker size={14} />
                <span className="text-xs">Host's Speaker</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleLocalOutput(true)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition-all cursor-pointer ${
                  isLocalOutput
                    ? "bg-[#1ed760] text-black font-bold shadow-md"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Headphones size={14} />
                <span className="text-xs">This Phone</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 text-center mt-1.5 leading-tight px-1">
              {!isLocalOutput
                ? "📻 Silent remote controller (zero acoustic echo)."
                : "🎧 Playing audio through this device's speakers / headphones."}
            </p>
          </div>
        )}

        {/* ── SYNC SPEAKERS (JOIN PARTY) BUTTON FOR 20-30 MOBILES ── */}
        {activeMode === "MULTI_SPEAKER" && (
          <div className="mb-3">
            <button
              type="button"
              onClick={async () => {
                await syncEngine.unlockAudio();
                await syncEngine.syncClock(async () => Date.now());
                if (!isHost) {
                  handleToggleLocalOutput(true);
                }
                usePlayerStore.getState().setToastMessage("Speakers synced! Ready for 0ms party audio 🔊");
              }}
              className="w-full py-2.5 px-3 bg-[#1ed760] hover:bg-[#1fdf64] active:scale-[0.98] text-black font-extrabold rounded-xl shadow-lg shadow-[#1ed760]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Volume2 size={16} className="animate-pulse" />
              <span className="text-xs uppercase tracking-wider">Sync Speakers (Join Party)</span>
            </button>
            <p className="text-[10px] text-[#1ed760]/80 text-center mt-1 font-medium">
              ⚡ 20–30 phones synchronized with zero echo
            </p>
          </div>
        )}

        {/* Let Others Control Toggle (Host Only) */}
        {isHost && (
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-black/30 border border-white/5 mb-3">
            <span className="text-xs text-zinc-200">Guest playback control</span>
            <button
              type="button"
              onClick={() => {
                if (onToggleGuestControl) {
                  onToggleGuestControl(!allowGuestControl);
                } else {
                  jam.setAllowGuestControl(!allowGuestControl);
                }
              }}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                allowGuestControl ? "bg-[#1ed760]" : "bg-zinc-700"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  allowGuestControl ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {/* Primary Share Button */}
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] active:scale-[0.98] text-black font-bold text-xs transition-all shadow-md cursor-pointer mb-2"
        >
          {shared ? <Check size={14} /> : <Share2 size={14} />}
          <span>{shared ? "Invite Shared / Copied!" : "Share Jam Invite"}</span>
        </button>

        {/* Secondary Action Row: Copy Link & Leave */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <button
            onClick={handleCopyLink}
            className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check size={12} className="text-[#1ed760]" /> : <Copy size={12} />}
            <span>{copiedLink ? "Link Copied" : "Copy Link"}</span>
          </button>

          <button
            onClick={() => {
              onLeaveJam();
              onClose();
            }}
            className="py-1.5 px-3 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
          >
            <LogOut size={12} />
            <span>{isHost ? "End" : "Leave"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
