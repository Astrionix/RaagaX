'use client';

import React, { useState } from 'react';
import { QrCode, Copy, Check, X, Users, Share2 } from 'lucide-react';

interface JamInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  activeMembersCount: number;
}

export const JamInviteModal: React.FC<JamInviteModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  activeMembersCount,
}) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const inviteUrl = `https://raaga.me/jam?id=${sessionId}`;
  // Standard dynamic QR generator API (No heavy client library needed)
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    inviteUrl
  )}&bgcolor=09090b&color=10b981&margin=10`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 flex flex-col items-center gap-5 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Invite to Jam</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Glowing QR Code Card */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col items-center gap-2">
          <img
            src={qrApiUrl}
            alt="Scan to join Jam"
            className="w-48 h-48 rounded-xl object-contain"
          />
          <span className="text-[11px] font-medium text-emerald-400 tracking-wide uppercase">
            Scan to join instantly
          </span>
        </div>

        {/* Active listeners badge */}
        <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          {activeMembersCount} {activeMembersCount === 1 ? 'Person' : 'People'} in Jam
        </div>

        {/* Copy Link Input Bar */}
        <div className="w-full flex items-center gap-2 p-1.5 rounded-xl bg-white/[0.04] border border-white/10">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="w-full bg-transparent px-2.5 text-xs text-zinc-300 font-mono focus:outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

      </div>
    </div>
  );
};
