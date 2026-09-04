"use client";

import React, { useState } from "react";
import { X, Copy, Check, Users, Radio, Share2, Lock } from "lucide-react";

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
  const [copied, setCopied] = useState(false);

  if (!isOpen || !roomPin) return null;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Format PIN as "123 456" for instant readability
  const formattedPin = roomPin.length === 6 ? `${roomPin.slice(0, 3)} ${roomPin.slice(3)}` : roomPin;

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

        {/* PIN Code Display */}
        <div className="bg-[#121212] border border-white/10 rounded-xl py-3 px-4 mb-4">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Jam Room Code
          </p>
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

        {/* Copy Invite Link Button */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] active:scale-[0.98] text-black font-bold text-sm transition-all shadow-lg shadow-[#1ed760]/20 mb-3 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={16} />
              <span>Invite Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 size={16} />
              <span>Share Invite Link</span>
            </>
          )}
        </button>

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
