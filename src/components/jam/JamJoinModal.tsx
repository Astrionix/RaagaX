"use client";

import React, { useState } from "react";
import { X, Radio, ArrowRight, AlertCircle } from "lucide-react";

interface JamJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (pin: string) => Promise<boolean>;
}

export const JamJoinModal: React.FC<JamJoinModalProps> = ({
  isOpen,
  onClose,
  onJoin,
}) => {
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let cleanPin = pin.trim().replace(/\s+/g, "");

    // Extract PIN if full invite URL is pasted
    if (cleanPin.includes("jam=")) {
      const match = cleanPin.match(/jam=([a-zA-Z0-9]+)/);
      if (match) cleanPin = match[1];
    } else if (cleanPin.startsWith("jam_")) {
      cleanPin = cleanPin.replace(/^jam_/i, "");
    }

    if (cleanPin.length < 4) {
      setError("Please enter a valid 6-digit Jam code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ok = await onJoin(cleanPin);
      if (ok) {
        onClose();
        setPin("");
      } else {
        setError("Could not join Jam room. Check the code and try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to join Jam room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
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

        {/* Radio Pulse Icon */}
        <div className="mx-auto w-14 h-14 rounded-full bg-[#1ed760]/15 border border-[#1ed760]/30 flex items-center justify-center mb-4">
          <Radio size={26} className="text-[#1ed760] animate-pulse" />
        </div>

        <h3 className="text-xl font-bold tracking-tight mb-1">
          Join a Jam
        </h3>
        <p className="text-xs text-zinc-400 mb-5">
          Enter the 6-digit code shared by your friend to join the session.
        </p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <input
              type="text"
              inputMode="text"
              autoFocus
              placeholder="e.g. 839 214 or invite link"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-[#121212] border border-white/15 focus:border-[#1ed760] rounded-xl py-3 px-4 text-xl font-bold text-center tracking-wider text-[#1ed760] font-mono placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 animate-in fade-in">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || pin.trim().length < 4}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] text-black font-bold text-sm transition-all shadow-lg shadow-[#1ed760]/20 cursor-pointer"
          >
            <span>{isLoading ? "Connecting..." : "Join Jam"}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
