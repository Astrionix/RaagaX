'use client';

import React, { useState, useMemo } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { BlendEngine, BlendResult } from '@/lib/social/BlendEngine';
import { X, Sparkles, Play, Share2, Users, Check, Copy, Fingerprint, Search, Loader2 } from 'lucide-react';
import { haptics } from '@/lib/haptics/HapticEngine';

export function BlendModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const { likedSongs, playSong, activeBlend, leaveActiveBlend, setActiveBlend } = usePlayerStore();
  const [friendInput, setFriendInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Generate deterministic Unique Blend ID for logged in user
  const myName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'You';
  const myUniqueId = useMemo(() => BlendEngine.getUniqueBlendId(user?.id || myName), [user?.id, myName]);

  const parsedInput = useMemo(() => {
    if (!friendInput.trim()) return null;
    return BlendEngine.parseBlendInput(friendInput);
  }, [friendInput]);

  if (!isOpen) return null;

  const handleGenerateBlend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;

    haptics.mediumImpact();
    setIsAnalyzing(true);

    // Smooth loading transition delay for realistic music DNA analysis feel
    setTimeout(() => {
      const result = BlendEngine.createBlend(myName, myUniqueId, friendInput, likedSongs as any[], likedSongs as any[]);
      setBlendResult(result);
      setIsAnalyzing(false);
    }, 1100);
  };

  const handleCopyMyId = () => {
    haptics.lightImpact();
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(myUniqueId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const handleCopyInviteLink = () => {
    haptics.lightImpact();
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(`https://raagax.app/blend?id=${myUniqueId}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handlePlayBlend = () => {
    if (!blendResult || blendResult.songs.length === 0) return;
    haptics.mediumImpact();
    // Enforce single-blend rule: leave any existing blend before connecting to a new one
    if (activeBlend) leaveActiveBlend();
    setActiveBlend(blendResult);
    playSong(blendResult.songs[0], blendResult.songs, {
      type: 'made_for_you',
      id: blendResult.id,
      title: blendResult.playlistTitle,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300 select-none">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#161B26] via-[#0F131C] to-[#0A0D14] border border-white/15 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden space-y-5">
        
        {/* Subtle Background Accent Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#FA233B]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FA233B] to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Raaga Blend</h3>
              <p className="text-[10px] text-slate-400 font-medium">Shared music compatibility & joint playlist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── STEP 1: ANALYZING SPINNER ── */}
        {isAnalyzing ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#FA233B]/20 border-t-[#FA233B] animate-spin" />
              <Sparkles className="w-6 h-6 text-[#FA233B] animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">Analyzing Shared Music DNA...</h4>
              <p className="text-xs text-slate-400 mt-1">Comparing top artists, genres & vibe scores</p>
            </div>
          </div>
        ) : !blendResult ? (
          /* ── STEP 2: SEARCH BY UNIQUE ID OR NAME ── */
          <div className="space-y-4 relative z-10">

            {/* ── ACTIVE BLEND WARNING BANNER ── */}
            {activeBlend && (
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in duration-300">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-amber-300">Active Blend: {activeBlend.userB}</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">
                    You&apos;re currently blended with <span className="font-bold">{activeBlend.userB}</span>. Generating a new blend will end this connection.
                  </p>
                  <button
                    onClick={() => { leaveActiveBlend(); haptics.lightImpact(); }}
                    className="mt-1.5 text-[10px] font-bold text-amber-300 hover:text-white underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    Leave current blend
                  </button>
                </div>
              </div>
            )}

            {/* My Unique Blend Tag Badge */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Fingerprint className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Your Unique Blend Tag</p>
                  <p className="text-xs font-mono font-black text-white tracking-wider truncate">{myUniqueId}</p>
                </div>
              </div>
              <button
                onClick={handleCopyMyId}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId ? 'Copied!' : 'Copy Tag'}</span>
              </button>
            </div>

            {/* Search Input Form */}
            <form onSubmit={handleGenerateBlend} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200">
                    Search Friend by Unique Tag or Name:
                  </label>
                  {parsedInput?.isUniqueId && (
                    <span className="text-[9.5px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ✓ Unique Tag
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Unique Tag (e.g. RGX-8A4F) or Name"
                    value={friendInput}
                    onChange={(e) => setFriendInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FA233B]/60 focus:bg-white/[0.08] transition-all font-mono font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!friendInput.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FA233B] to-rose-600 hover:from-rose-600 hover:to-[#FA233B] text-white font-black text-xs shadow-lg shadow-red-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Generate Raaga Blend
              </button>
            </form>

            {/* Quick Share Link */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Or share direct blend invite:</span>
              <button
                onClick={handleCopyInviteLink}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── STEP 3: SMOOTH BLEND RESULT CARD ── */
          <div className="space-y-5 animate-in zoom-in-95 duration-300 relative z-10">
            <div className="relative p-6 rounded-3xl bg-gradient-to-br from-[#FA233B]/25 via-rose-950/40 to-indigo-950/70 border border-[#FA233B]/40 text-center space-y-4 shadow-2xl overflow-hidden">
              
              {/* Overlapping Avatars */}
              <div className="flex items-center justify-center gap-1">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#FA233B] to-rose-500 text-white font-black text-xl flex items-center justify-center border-2 border-white shadow-xl -mr-2 relative z-10">
                  {blendResult.userA.charAt(0).toUpperCase()}
                </div>
                <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md text-white font-bold text-xs flex items-center justify-center border border-white/30 relative z-20 shadow-md">
                  +
                </div>
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-black text-xl flex items-center justify-center border-2 border-white shadow-xl -ml-2 relative z-10">
                  {blendResult.userB.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Compatibility Match Score Ring */}
              <div className="space-y-1">
                <span className="text-4xl font-black text-white tracking-tight drop-shadow-md">
                  {blendResult.matchScore}%
                </span>
                <span className="text-[10px] font-mono font-black text-rose-300 block uppercase tracking-wider">
                  Music Compatibility Match
                </span>
              </div>

              <p className="text-xs text-slate-200 font-medium max-w-xs mx-auto leading-relaxed">
                {blendResult.description}
              </p>

              <div className="pt-2 flex items-center justify-center gap-2 text-[10px] font-mono text-slate-300">
                <span className="px-2 py-0.5 rounded bg-white/10">{blendResult.userAId}</span>
                <span>⚡</span>
                <span className="px-2 py-0.5 rounded bg-white/10">{blendResult.userBId}</span>
              </div>
            </div>

            {/* Play & Reset Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayBlend}
                className="flex-1 py-3.5 rounded-2xl bg-white hover:bg-[#FA233B] text-black hover:text-white font-black text-xs transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" /> PLAY BLEND PLAYLIST
              </button>
              <button
                onClick={() => {
                  setBlendResult(null);
                  setFriendInput('');
                }}
                className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                New Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
