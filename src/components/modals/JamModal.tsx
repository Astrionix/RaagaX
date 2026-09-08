'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Users,
  Copy,
  Check,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Shield,
  LogOut,
  Music2,
  Sparkles,
  ChevronRight,
  Zap,
  UserCheck,
  Plus,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { JamSessionManager } from '@/lib/connect/jam/JamSessionManager';
import { JamSessionState, JamQueueItem } from '@/lib/connect/jam/JamTypes';
import { DeviceKeyManager } from '@/lib/connect/auth/DeviceKeyManager';
import { haptics } from '@/lib/haptics/HapticEngine';
import { OptimizedImage } from '@/components/common/OptimizedImage';

export function JamModal() {
  const { isJamModalOpen, toggleJamModal, setToastMessage, currentSong } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<'session' | 'join'>('session');
  const [jamState, setJamState] = useState<JamSessionState | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);


  useEffect(() => {
    const jamMgr = JamSessionManager.getInstance();
    const unsub = jamMgr.onStateChanged((state) => {
      setJamState(state);
    });
    return unsub;
  }, []);

  if (!isJamModalOpen) return null;

  const handleCreateJam = async () => {
    setIsCreating(true);
    haptics.mediumImpact();
    import('@/lib/playback/AudioUnlocker').then(({ activatePlayer }) => activatePlayer()).catch(() => {});
    try {
      const jamMgr = JamSessionManager.getInstance();
      await jamMgr.createJamRoom();
    } catch {
      setToastMessage('Failed to create Jam session');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinJam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsJoining(true);
    haptics.mediumImpact();
    import('@/lib/playback/AudioUnlocker').then(({ activatePlayer }) => activatePlayer()).catch(() => {});
    try {
      const jamMgr = JamSessionManager.getInstance();
      const success = await jamMgr.joinJamRoom(joinCodeInput);
      if (success) {
        setJoinCodeInput('');
        setActiveTab('session');
      }
    } catch {
      setToastMessage('Failed to join Jam room');
    } finally {
      setIsJoining(false);
    }
  };


  const handleCopyCode = () => {
    if (!jamState?.roomCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { navigator.clipboard.writeText(jamState.roomCode); } catch {}
    }
    setCopied(true);
    haptics.lightImpact();
    setToastMessage('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    if (!jamState?.roomCode) return;
    const shareText = `🎵 Join my Raaga Jam live session!\nCode: ${jamState.roomCode}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Raaga Jam', text: shareText });
        return;
      } catch {}
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { await navigator.clipboard.writeText(shareText); } catch {}
    }
    setToastMessage('Invite link copied to clipboard!');
    haptics.lightImpact();
  };

  const handleLeaveJam = () => {
    haptics.mediumImpact();
    JamSessionManager.getInstance().leaveJamRoom();
  };

  const handleUpvote = (queueItemId: string) => {
    haptics.lightImpact();
    JamSessionManager.getInstance().voteSongInQueue(queueItemId, 'upvote');
  };

  const handleDownvote = (queueItemId: string) => {
    haptics.lightImpact();
    JamSessionManager.getInstance().voteSongInQueue(queueItemId, 'downvote');
  };

  const isHost = JamSessionManager.getInstance().isHost();

  return (
    <div className="fixed inset-0 z-[160] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Backdrop overlay dismiss */}
      <div className="absolute inset-0" onClick={() => toggleJamModal(false)} />

      {/* Spotify Signature Jam Modal Container */}
      <div className="relative z-10 w-full md:w-[420px] bg-[#121212] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.9)] overflow-hidden rounded-t-[28px] md:rounded-3xl max-h-[85vh] md:max-h-[620px] flex flex-col md:fixed md:bottom-[76px] md:right-8 text-white transition-all duration-300">
        
        {/* Mobile Drag Pill */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Spotify Minimal Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-[#181818] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1DB954] flex items-center justify-center text-black shadow-md shadow-[#1DB954]/20">
              <Radio className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                Raaga Jam
                {jamState && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] mr-1.5 animate-ping" />
                    LIVE
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#b3b3b3]">Listen together in real time</p>
            </div>
          </div>
          <button
            onClick={() => toggleJamModal(false)}
            className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean Segmented Tab Bar */}
        <div className="px-5 pt-3 bg-[#121212] flex-shrink-0">
          <div className="flex p-1 rounded-xl bg-[#181818] border border-white/5">
            <button
              onClick={() => setActiveTab('session')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'session'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              {jamState ? 'Active Jam' : 'Start Jam'}
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'join'
                  ? 'bg-[#282828] text-white shadow-sm'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              Join Code
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {activeTab === 'session' ? (
            !jamState ? (
              /* Spotify Clean Start Jam Hero */
              <div className="flex flex-col items-center text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/30 flex items-center justify-center text-[#1DB954]">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white tracking-tight">Host a Raaga Jam</h3>
                  <p className="text-xs text-[#b3b3b3] max-w-xs leading-relaxed">
                    Sync playback with friends on any phone or desktop. Zero audio data cost, 100% full HD quality!
                  </p>
                </div>

                <button
                  onClick={handleCreateJam}
                  disabled={isCreating}
                  className="w-full py-3.5 px-6 rounded-full bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black font-extrabold shadow-lg shadow-[#1DB954]/25 transition-all flex items-center justify-center gap-2 text-sm tracking-wide cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-black" />
                  {isCreating ? 'Creating Room...' : 'Start Jam'}
                </button>
              </div>
            ) : (
              /* Spotify Signature Ultra-Clean Active Jam Room UI */
              <div className="space-y-4">
                {/* 1. Room Join Code Display & Instant Actions */}
                <div className="p-4 rounded-2xl bg-[#181818] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#b3b3b3] font-bold uppercase tracking-wider block">
                        Room Join Code
                      </span>
                      <div className="text-3xl font-black text-[#1DB954] tracking-widest font-mono drop-shadow-[0_2px_8px_rgba(29,185,84,0.3)]">
                        {jamState.roomCode || 'JAM-ROOM'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyCode}
                        className="p-2.5 rounded-full bg-[#282828] hover:bg-[#333333] text-xs font-semibold text-white transition-all cursor-pointer border border-white/10 active:scale-95"
                        title="Copy Code"
                      >
                        {copied ? <Check className="w-4 h-4 text-[#1DB954]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleShareInvite}
                        className="flex items-center gap-1.5 py-2 px-4 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-xs font-extrabold text-black shadow-md shadow-[#1DB954]/20 transition-all cursor-pointer active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5 text-black" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>

                  {/* Host Settings Toggle Header */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
                      <span className="text-xs font-bold text-white">Live Sync Active</span>
                    </div>
                    <button
                      onClick={() => setShowHostSettings(!showHostSettings)}
                      className="px-2.5 py-1 rounded-full bg-[#282828] hover:bg-white/10 text-[11px] font-bold text-[#1DB954] border border-[#1DB954]/30 flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3 text-[#1DB954]" />
                      <span>Host Controls</span>
                    </button>
                  </div>

                  {/* Host & Room Settings Dropdown Panel */}
                  {showHostSettings && (
                    <div className="p-3 rounded-xl bg-black/60 border border-[#1DB954]/40 space-y-2.5 animate-in fade-in text-xs">
                      <div className="flex items-center justify-between pb-1 border-b border-white/10">
                        <span className="font-extrabold text-white flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-[#1DB954]" /> Room Settings
                        </span>
                        <button
                          onClick={() => setShowHostSettings(false)}
                          className="text-[10px] text-[#b3b3b3] hover:text-white cursor-pointer"
                        >
                          Close
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <div>
                          <p className="font-bold text-white text-[11px]">Guest Controls</p>
                          <p className="text-[9px] text-[#b3b3b3]">Allow guests to Play / Pause / Skip</p>
                        </div>
                        {isHost ? (
                          <button
                            onClick={() => {
                              const next = !jamState.isGuestControlAllowed;
                              JamSessionManager.getInstance().setGuestControlAllowed(next);
                            }}
                            className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                              jamState.isGuestControlAllowed ? 'bg-[#1DB954]' : 'bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                                jamState.isGuestControlAllowed ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#1DB954] font-bold">
                            {jamState.isGuestControlAllowed ? 'Allowed' : 'Host Only'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Compact Now Playing Track */}
                {jamState.currentSong && (
                  <div className="p-3 rounded-2xl bg-[#181818] border border-white/5 flex items-center gap-3">
                    <img
                      src={jamState.currentSong.coverUrl || '/app-icon.png'}
                      alt={jamState.currentSong.title}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                      className="w-12 h-12 rounded-xl object-cover shadow-md flex-shrink-0 bg-slate-800"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-ping" />
                        <span className="text-[10px] text-[#1DB954] font-bold uppercase tracking-wider">Jam Playing</span>
                      </div>
                      <p className="text-xs font-bold text-white truncate">{jamState.currentSong.title}</p>
                      <p className="text-[11px] text-[#b3b3b3] truncate">{jamState.currentSong.artist}</p>
                    </div>
                  </div>
                )}

                {/* 3. Connected Friends List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#1DB954]" />
                      Connected ({jamState.members.length})
                    </span>
                    {isHost && (
                      <span className="text-[10px] text-[#1DB954] font-bold">
                        ★ You are Host
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {jamState.members.map((member) => (
                      <div
                        key={member.deviceId}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181818] border border-white/10 text-xs text-white"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#1DB954]" />
                        <span className="font-semibold text-xs">{member.displayName}</span>
                        {member.isHost && (
                          <span className="text-[9px] bg-[#1DB954]/20 text-[#1DB954] font-black px-1.5 py-0.2 rounded-full">HOST</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Collaborative Jam Queue */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5 text-[#1DB954]" />
                      Queue ({jamState.queue.length})
                    </span>
                    {currentSong && (
                      <button
                        onClick={() => JamSessionManager.getInstance().addToJamQueue(currentSong)}
                        className="text-[10px] bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-3 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3 h-3 text-black" /> Add Playing Track
                      </button>
                    )}
                  </div>

                  {jamState.queue.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#181818] border border-white/5 text-center text-xs text-[#b3b3b3] space-y-1">
                      <p className="font-semibold text-white">Queue is empty</p>
                      <p className="text-[11px] text-[#727272]">Tap 3-dots (⋮) on any song or playlist & choose "Add to Jam Queue"</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {jamState.queue.map((item) => {
                        const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
                        const upCount = item.upvotes?.length || 0;
                        const downCount = item.downvotes?.length || 0;
                        const hasUpvoted = item.upvotes?.includes(myDeviceId);
                        const hasDownvoted = item.downvotes?.includes(myDeviceId);

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-white/5 hover:bg-[#282828] transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <img
                                src={item.song.coverUrl || '/app-icon.png'}
                                alt={item.song.title}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-800"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{item.song.title}</p>
                                <p className="text-[10px] text-[#b3b3b3] truncate">
                                  Added by {item.addedByMemberName}
                                </p>
                              </div>
                            </div>

                            {/* Upvote & Downvote Buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleUpvote(item.id)}
                                className={`py-1 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border active:scale-95 ${
                                  hasUpvoted
                                    ? 'bg-[#1DB954]/25 text-[#1DB954] border-[#1DB954]/50'
                                    : 'bg-[#282828] text-white/70 hover:text-white hover:bg-[#333333] border-white/5'
                                }`}
                                title="Upvote / Like song"
                              >
                                <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-[#1DB954]' : ''}`} />
                                <span>{upCount}</span>
                              </button>

                              <button
                                onClick={() => handleDownvote(item.id)}
                                className={`py-1 px-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border active:scale-95 ${
                                  hasDownvoted
                                    ? 'bg-red-500/25 text-red-400 border-red-500/50'
                                    : 'bg-[#282828] text-white/70 hover:text-white hover:bg-[#333333] border-white/5'
                                }`}
                                title="Downvote / Dislike song"
                              >
                                <ThumbsDown className={`w-3.5 h-3.5 ${hasDownvoted ? 'fill-red-400' : ''}`} />
                                <span>{downCount}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. Minimal Leave Room Link */}
                <button
                  onClick={handleLeaveJam}
                  className="w-full py-2.5 px-4 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Leave Room
                </button>
              </div>
            )
          ) : (
            /* Join Room Code Form */
            <form onSubmit={handleJoinJam} className="py-4 space-y-5">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Enter 4-Digit Room Code</h3>
                <p className="text-xs text-[#b3b3b3]">Ask your friend for their 4-character Jam code (e.g. RAAG)</p>
              </div>

              <div className="relative max-w-xs mx-auto">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="RAAG"
                  maxLength={8}
                  className="w-full text-center text-4xl font-mono tracking-widest font-black py-3.5 px-4 rounded-2xl bg-black border border-[#1DB954]/40 text-[#1DB954] focus:outline-none focus:border-[#1DB954]"
                />
              </div>

              <button
                type="submit"
                disabled={!joinCodeInput.trim() || isJoining}
                className="w-full py-3.5 px-6 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-extrabold shadow-lg shadow-[#1DB954]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <Zap className="w-4 h-4 text-black fill-current" />
                {isJoining ? 'Joining Room...' : 'Join Jam'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
