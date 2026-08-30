'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Share2, Users, Radio, Sparkles, QrCode } from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';
import { JamQRCode } from './JamQRCode';

export function JamShareModal() {
  const { session, isShareModalOpen, toggleShareModal } = useJamStore();
  const [copied, setCopied] = useState(false);

  if (!isShareModalOpen || !session) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${origin}?jam=${session.jamId}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${session.name} on RaagaX`,
          text: `Listen along with me in real-time on RaagaX Jam!`,
          url: inviteUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={() => toggleShareModal(false)}
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-sm bg-[#12131a]/95 border border-white/15 rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden text-white p-5 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={() => toggleShareModal(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Jam Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FA233B]/15 border border-[#FA233B]/30 text-[#FA233B] text-xs font-bold mb-3 shadow-[0_0_15px_rgba(250,35,59,0.2)]">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Remote Jam Party</span>
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">Invite to Jam</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
          Friends can scan this QR code or use the link to experience synchronized listening.
        </p>

        {/* QR Code Frame */}
        <div className="my-5 p-2 bg-white/5 rounded-3xl border border-white/10 shadow-inner flex items-center justify-center">
          <JamQRCode value={inviteUrl} size={180} />
        </div>

        {/* 5-Character Join Code */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-2.5 mb-3 flex items-center justify-between">
          <div className="text-left pl-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Join Code</span>
            <span className="text-base font-black font-mono tracking-widest text-[#FA233B]">
              {session.joinCode || session.jamId}
            </span>
          </div>
          <button
            onClick={() => {
              const codeToCopy = session.joinCode || session.jamId;
              navigator.clipboard.writeText(codeToCopy);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2">
          <button
            onClick={handleCopyLink}
            className="w-full py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Copy className="w-4 h-4 text-slate-300" />
            <span>Copy Link</span>
          </button>

          <button
            onClick={handleNativeShare}
            className="w-full py-2.5 px-3 rounded-2xl bg-[#FA233B] hover:bg-[#ff3b53] text-xs font-black text-white flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(250,35,59,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}
