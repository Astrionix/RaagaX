"use client";

import React, { useState } from "react";
import { KeyRound, ShieldCheck, Check, Copy, AlertCircle, UserCheck, X } from "lucide-react";
import { PairingRequest } from "@/lib/connect/types";

interface Props {
  activePairingPin: string | null;
  incomingRequest: PairingRequest | null;
  onGeneratePin: () => string;
  onSubmitPin: (pin: string) => Promise<{ success: boolean; reason?: string }>;
  onApprove: () => void;
  onReject: (reason?: string) => void;
}

export const PairingDialog: React.FC<Props> = ({
  activePairingPin,
  incomingRequest,
  onGeneratePin,
  onSubmitPin,
  onApprove,
  onReject,
}) => {
  const [pinInput, setPinInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const handleCopy = () => {
    if (!activePairingPin) return;
    try {
      navigator.clipboard.writeText(activePairingPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleConnectWithPin = async () => {
    if (pinInput.length !== 6) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    const res = await onSubmitPin(pinInput);
    setIsSubmitting(false);

    if (res.success) {
      setStatusMsg({ text: "Device paired successfully!", isError: false });
      setPinInput("");
    } else {
      setStatusMsg({ text: res.reason || "Failed to pair device", isError: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Incoming Pairing Request Prompt */}
      {incomingRequest && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <UserCheck className="text-amber-400 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-white">Connection Request</p>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  <span className="font-semibold text-white">{incomingRequest.guestDeviceName}</span> wants to connect and control playback.
                </p>
              </div>
            </div>
            <button onClick={() => onReject("Dismissed")} className="text-zinc-400 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={onApprove}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer"
            >
              Approve
            </button>
            <button
              onClick={() => onReject("User declined")}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs border border-white/10 transition cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* 1. Enter Pairing PIN */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1.5">
          <KeyRound size={14} className="text-[#1DB954]" /> Pair a Friend's Device
        </span>
        <p className="text-xs text-zinc-400">
          Enter the 6-digit pairing PIN shown on the device you want to control:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            placeholder="000000"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ""))}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-white focus:outline-none focus:border-[#1DB954]"
          />
          <button
            onClick={handleConnectWithPin}
            disabled={pinInput.length !== 6 || isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-40 text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer"
          >
            {isSubmitting ? "Pairing..." : "Pair"}
          </button>
        </div>
        {statusMsg && (
          <p className={`text-xs flex items-center gap-1.5 font-medium ${statusMsg.isError ? "text-red-400" : "text-emerald-400"}`}>
            {statusMsg.isError ? <AlertCircle size={14} /> : <Check size={14} />} {statusMsg.text}
          </p>
        )}
      </div>

      {/* 2. Show My Pairing PIN */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-blue-400" /> Allow Another Device to Control This Player
        </span>
        <p className="text-xs text-zinc-400">
          Generate a temporary 6-digit PIN code valid for 5 minutes:
        </p>

        {activePairingPin ? (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Your Pairing PIN</span>
              <span className="text-2xl font-mono font-black tracking-widest text-white">{activePairingPin}</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
            >
              {copied ? <Check size={14} className="text-[#1DB954]" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <button
            onClick={onGeneratePin}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition cursor-pointer"
          >
            Generate Pairing Code
          </button>
        )}
      </div>
    </div>
  );
};
