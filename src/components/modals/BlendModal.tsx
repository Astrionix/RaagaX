'use client';

import React, { useState } from 'react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { BlendEngine, BlendResult } from '@/lib/social/BlendEngine';
import { X, Sparkles, Play, Share2, Users, Check, Heart } from 'lucide-react';
import { haptics } from '@/lib/haptics/HapticEngine';

export function BlendModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuthStore();
  const { likedSongs, playSong } = usePlayerStore();
  const [friendName, setFriendName] = useState('');
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const myName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'You';

  const handleGenerateBlend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;

    haptics.mediumImpact();
    const friend = friendName.trim();
    // Simulate seed songs for friend blended with user's liked songs
    const result = BlendEngine.createBlend(myName, friend, likedSongs as any[], likedSongs as any[]);
    setBlendResult(result);
  };

  const handleCopyInvite = () => {
    haptics.lightImpact();
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(`https://raagax.app/blend?user=${encodeURIComponent(myName)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePlayBlend = () => {
    if (!blendResult || blendResult.songs.length === 0) return;
    haptics.mediumImpact();
    playSong(blendResult.songs[0], blendResult.songs, {
      type: 'made_for_you',
      id: blendResult.id,
      title: blendResult.playlistTitle,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#0F131C] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FA233B] to-rose-500 flex items-center justify-center text-white shadow-md">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Raaga Blend</h3>
              <p className="text-[10px] text-slate-400">Shared music compatibility score</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!blendResult ? (
          /* Step 1: Input Friend's Name or Share Link */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FA233B]/15 via-rose-950/10 to-transparent border border-[#FA233B]/20 space-y-2">
              <div className="flex items-center gap-2 text-[#FA233B]">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-wider">Taste Match</span>
              </div>
              <p className="text-xs text-slate-300">
                Blend merges your listening habits with a friend&apos;s taste into a daily updated joint playlist with a compatibility score!
              </p>
            </div>

            <form onSubmit={handleGenerateBlend} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Enter Friend&apos;s Name or Username:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul, Priya, Alex"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FA233B]/60 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FA233B] to-rose-600 text-white font-bold text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Create Raaga Blend
              </button>
            </form>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">Or invite a friend via link:</span>
              <button
                onClick={handleCopyInvite}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Display Blend Compatibility Card */
          <div className="space-y-5 animate-in zoom-in-95 duration-300">
            <div className="relative p-6 rounded-3xl bg-gradient-to-br from-[#FA233B]/30 via-rose-950/40 to-indigo-950/60 border border-[#FA233B]/40 text-center space-y-3 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#FA233B] to-rose-500 text-white font-black text-lg flex items-center justify-center border-2 border-white shadow-md">
                  {blendResult.userA.charAt(0).toUpperCase()}
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white font-bold text-xs flex items-center justify-center border border-white/20">
                  +
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-black text-lg flex items-center justify-center border-2 border-white shadow-md">
                  {blendResult.userB.charAt(0).toUpperCase()}
                </div>
              </div>

              <div>
                <span className="text-3xl font-black text-white tracking-tight drop-shadow-lg">
                  {blendResult.matchScore}%
                </span>
                <span className="text-xs font-mono font-bold text-rose-300 block uppercase tracking-wider mt-0.5">
                  Music Compatibility Match
                </span>
              </div>

              <p className="text-xs text-slate-200/90 font-medium max-w-xs mx-auto leading-relaxed">
                {blendResult.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayBlend}
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-[#FA233B] hover:text-white transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" /> Play Blend Playlist
              </button>
              <button
                onClick={() => setBlendResult(null)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                New Blend
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
