"use client";

import React, { useState } from "react";
import { X, Copy, Check, Users, Radio, Share2, Lock, Smartphone } from "lucide-react";
import { getJamInviteUrl } from "@/lib/jam/JamSessionManager";
import { usePlayerStore } from "@/context/usePlayerStore";

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
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [shared, setShared] = useState(false);

  if (!isOpen || !roomPin) return null;

  // Always derive official, non-localhost production URL
  const effectiveInviteUrl = roomPin ? getJamInviteUrl(roomPin) : (inviteUrl || "https://raaga.me");

  // Format PIN as "123 456" for instant readability
  const formattedPin = roomPin.length === 6 ? `${roomPin.slice(0, 3)} ${roomPin.slice(3)}` : roomPin;

  const fullShareText = `Join my Jam on RaagaX! 🎧\nListen together and queue tracks in real-time.\n\n🔑 Jam Code: ${formattedPin}\n🔗 Link: ${effectiveInviteUrl}`;

  // Native share sheet (WhatsApp, Telegram, etc.) with clipboard fallback
  const handleShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join my Jam on RaagaX 🎧",
          text: fullShareText,
          url: effectiveInviteUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2200);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return; // User closed native share sheet
      }
    }

    // Fallback: Copy full formatted invite to clipboard
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullShareText);
      setShared(true);
      usePlayerStore.getState().setToastMessage("Jam invite link & code copied! 📋");
      setTimeout(() => setShared(false), 2200);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveInviteUrl);
      setCopiedLink(true);
      usePlayerStore.getState().setToastMessage("Invite link copied to clipboard! 🔗");
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(roomPin);
      setCopiedCode(true);
      usePlayerStore.getState().setToastMessage(`Jam code ${formattedPin} copied! 🔑`);
      setTimeout(() => setCopiedCode(false), 2200);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#181818] border border-white/10 shadow-2xl p-6 text-white text-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Pulse Jam Icon */}
        <div className="mx-auto w-14 h-14 rounded-full bg-[#1ed760]/15 border border-[#1ed760]/30 flex items-center justify-center mb-4">
          <Radio size={28} className="text-[#1ed760] animate-pulse" />
        </div>

        <h3 className="text-xl font-bold tracking-tight mb-1">
          {isHost ? "You're in a Jam" : "Listening in Jam"}
        </h3>
        <p className="text-xs text-zinc-400 mb-5">
          Share this PIN or link with friends to listen together and control the queue in real-time.
        </p>

        {/* PIN Code Display (Click to Copy) */}
        <div 
          onClick={handleCopyCode}
          className="bg-[#121212] border border-white/10 hover:border-[#1ed760]/50 rounded-xl py-3 px-4 mb-4 cursor-pointer transition-all group relative"
          title="Click to copy code"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Jam Room Code
            </span>
            <span className="text-[10px] text-zinc-500 group-hover:text-[#1ed760] transition-colors flex items-center gap-1 font-medium">
              {copiedCode ? <Check size={11} className="text-[#1ed760]" /> : <Copy size={11} />}
              {copiedCode ? "Copied!" : "Copy code"}
            </span>
          </div>
          <div className="text-3xl font-extrabold tracking-widest text-[#1ed760] font-mono">
            {formattedPin}
          </div>
        </div>

        {/* Live Participant Count */}
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-300 mb-4">
          <Users size={14} className="text-[#1ed760]" />
          <span>
            <strong>{participantCount}</strong> {participantCount === 1 ? "person" : "people"} listening together
          </span>
        </div>

        {/* Playback Control Permission Mode (Spotify Jam Style) */}
        {isHost ? (
          <div className="bg-[#121212] border border-white/10 rounded-xl p-3 mb-4 text-left flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Let others control what's playing</p>
              <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">When off, only you can play, pause, or skip tracks.</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleGuestControl && onToggleGuestControl(!allowGuestControl)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 ${
                allowGuestControl ? 'bg-[#1ed760]' : 'bg-zinc-700'
              }`}
              title="Toggle group playback control"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  allowGuestControl ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ) : (
          <div className="bg-[#121212] border border-white/10 rounded-xl py-2 px-3 mb-4 flex items-center justify-between text-left">
            <div className="flex items-center gap-1.5">
              {allowGuestControl ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                  <span className="text-[11px] font-semibold text-[#1ed760]">Group Playback Control</span>
                </>
              ) : (
                <>
                  <Lock size={12} className="text-zinc-400" />
                  <span className="text-[11px] font-semibold text-zinc-400">Host-Only Playback Control</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">Shared Queue Active</span>
          </div>
        )}

        {/* Share Action Buttons */}
        <div className="flex flex-col gap-2 mb-3">
          {/* Primary: Share via Native Share Sheet (WhatsApp, Telegram, etc.) */}
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] active:scale-[0.98] text-black font-bold text-sm transition-all shadow-lg shadow-[#1ed760]/20 cursor-pointer"
          >
            {shared ? (
              <>
                <Check size={16} />
                <span>Invite Shared / Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={16} />
                <span>Share via Apps (WhatsApp/Telegram)</span>
              </>
            )}
          </button>

          {/* Secondary: Copy Link Only */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-white/10 hover:bg-white/15 active:scale-[0.98] text-zinc-200 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check size={14} className="text-[#1ed760]" />
                <span className="text-[#1ed760]">Link Copied: {effectiveInviteUrl}</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="truncate">Copy Link: {effectiveInviteUrl}</span>
              </>
            )}
          </button>
        </div>

        {/* Leave Jam Button */}
        <button
          onClick={() => {
            onLeaveJam();
            onClose();
          }}
          className="w-full py-2.5 px-4 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
        >
          {isHost ? "End Jam Session" : "Leave Jam"}
        </button>
      </div>
    </div>
  );
};
