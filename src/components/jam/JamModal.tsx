'use client';

import React, { useState } from 'react';
import {
  Radio,
  X,
  Users,
  ListMusic,
  ShieldCheck,
  Share2,
  Plus,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Trash2,
  Crown,
  Sparkles,
  Volume2,
  LogOut,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  QrCode,
  Smartphone,
  Monitor,
  Globe,
  Copy,
  Bluetooth,
  Wifi,
} from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { JamSyncBadge } from './JamSyncBadge';
import { SeekBar } from '@/components/player/SeekBar';

export function JamModal() {
  const {
    session,
    isInJam,
    isHost,
    isJamModalOpen,
    toggleJamModal,
    toggleShareModal,
    toggleAddToJamModal,
    createJam,
    joinJam,
    leaveJam,
    sendPlay,
    sendPause,
    sendSeek,
    sendSkipNext,
    sendSkipPrev,
    sendRemoveTrack,
    sendReorderQueue,
    sendUpdatePermissions,
    sendTransferHost,
    sendKickParticipant,
    sendEndSession,
    isLoading,
  } = useJamStore();

  const { isPlaying, currentSong } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<'now_playing' | 'queue' | 'participants'>('now_playing');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [jamNameInput, setJamNameInput] = useState('');

  if (!isJamModalOpen) return null;

  const participantsList = session ? Object.values(session.participants) : [];
  const permissions = session?.permissions;

  const handleCreateJam = async () => {
    await createJam({ jamName: jamNameInput.trim() || undefined });
  };

  const handleJoinJam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    await joinJam(joinCodeInput);
  };

  const handleMoveQueueItem = async (index: number, direction: 'up' | 'down') => {
    if (!session) return;
    const queue = [...session.queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;

    const [moved] = queue.splice(index, 1);
    queue.splice(targetIndex, 0, moved);
    await sendReorderQueue(queue);
  };

  const activeTrack = session?.currentSong || currentSong;

  return (
    <div className="fixed inset-0 z-[140] flex items-end md:items-center justify-center md:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={() => toggleJamModal(false)}
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
      />

      {/* Main Jam Container */}
      <div className="relative z-10 w-full md:w-[600px] h-[90vh] md:h-[650px] max-h-[90vh] bg-[#0d0e14]/98 border-t md:border border-white/15 rounded-t-[32px] md:rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden text-white flex flex-col animate-in slide-in-from-bottom-6 duration-250">
        {/* Mobile Pull Handle */}
        <div className="md:hidden w-full flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#FA233B]/15 text-[#FA233B] border border-[#FA233B]/30 shadow-[0_0_15px_rgba(250,35,59,0.2)] flex-shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white truncate">
                  {session ? session.name : 'Remote Jam Party'}
                </h3>
                {session && <JamSyncBadge />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-slate-400 font-medium">
                  {session ? `${participantsList.length} listening in sync` : 'Listen together in real-time'}
                </p>
                {session?.joinCode && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(session.joinCode);
                      usePlayerStore.getState().setToastMessage(`Join Code ${session.joinCode} copied!`);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FA233B]/15 border border-[#FA233B]/30 text-[#FA233B] text-[10px] font-mono font-bold hover:bg-[#FA233B]/25 transition-all cursor-pointer"
                    title="Click to copy Join Code"
                  >
                    <span>Code:</span>
                    <span className="tracking-wider">{session.joinCode}</span>
                    <Copy className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isInJam && (
              <button
                onClick={() => toggleShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all cursor-pointer"
                title="Invite to Jam"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}
            <button
              onClick={() => toggleJamModal(false)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Session Content / Welcome Screen */}
        {!isInJam || !session ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#FA233B] to-rose-400 flex items-center justify-center text-white shadow-[0_8px_32px_rgba(250,35,59,0.4)] mb-4">
              <Radio className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">Sync Music with Friends</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
              Start a Jam party to share playback, metadata, and queue controls with friends anywhere in the world with millisecond synchronization.
            </p>

            <div className="w-full max-w-xs mt-6 space-y-3">
              <button
                onClick={handleCreateJam}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-[#FA233B] hover:bg-[#ff3b53] text-sm font-black text-white shadow-[0_8px_24px_rgba(250,35,59,0.4)] transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isLoading ? 'Creating Jam...' : 'Start a Jam Party'}</span>
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">or join existing</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              <button
                onClick={() => {
                  toggleJamModal(false);
                  useJamStore.getState().toggleJoinModal(true);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/10"
              >
                <div className="flex items-center gap-1 text-[#FA233B]">
                  <Bluetooth className="w-3.5 h-3.5" />
                  <Wifi className="w-3.5 h-3.5" />
                </div>
                <span>Nearby / Enter Join Code</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab Navigation */}
            <div className="flex items-center px-5 border-b border-white/10 gap-6 flex-shrink-0">
              <button
                onClick={() => setActiveTab('now_playing')}
                className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'now_playing'
                    ? 'border-[#FA233B] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Now Playing</span>
              </button>

              <button
                onClick={() => setActiveTab('queue')}
                className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'queue'
                    ? 'border-[#FA233B] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Shared Queue</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-slate-300">
                  {session.queue.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('participants')}
                className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'participants'
                    ? 'border-[#FA233B] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Participants</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-slate-300">
                  {participantsList.length}
                </span>
              </button>
            </div>

            {/* TAB 1: NOW PLAYING & PRESENCE */}
            {activeTab === 'now_playing' && (
              <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
                <div className="flex flex-col items-center text-center my-auto">
                  {/* Artwork */}
                  <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.8)] border border-white/10 mb-4 flex-shrink-0 group">
                    <OptimizedImage
                      src={activeTrack?.coverUrl || '/app-icon.png'}
                      alt={activeTrack?.title || 'Jam Track'}
                      className="w-full h-full object-cover"
                      fallbackSrc="/app-icon.png"
                    />
                    {session.state === 'PLAYING' && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="flex items-end gap-1 h-6">
                          <span className="w-1 bg-white/90 rounded-full animate-[bounce_1s_infinite_100ms] h-6" />
                          <span className="w-1 bg-white/90 rounded-full animate-[bounce_1s_infinite_300ms] h-4" />
                          <span className="w-1 bg-white/90 rounded-full animate-[bounce_1s_infinite_200ms] h-5" />
                          <span className="w-1 bg-white/90 rounded-full animate-[bounce_1s_infinite_400ms] h-3" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <h3 className="text-lg font-black text-white truncate max-w-xs">
                    {activeTrack ? SongFormatter.cleanSongTitle(activeTrack.title) : 'Select a track'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                    {activeTrack
                      ? SongFormatter.decodeHtml(activeTrack.artist) || activeTrack.artist
                      : 'Add a track to begin synchronized listening'}
                  </p>

                  {/* Synchronized Playback Controls */}
                  <div className="w-full max-w-sm mt-4 px-2">
                    <SeekBar className="w-full" />

                    <div className="flex items-center justify-center gap-6 mt-3">
                      <button
                        onClick={() => sendSkipPrev()}
                        disabled={!isHost && !permissions?.canSkip}
                        className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                        title="Previous Track"
                      >
                        <SkipBack className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => (session.state === 'PLAYING' ? sendPause() : sendPlay())}
                        disabled={!isHost && !permissions?.canControlPlayback}
                        className="w-12 h-12 rounded-full bg-[#FA233B] hover:bg-[#ff3b53] disabled:opacity-40 text-white flex items-center justify-center shadow-[0_4px_20px_rgba(250,35,59,0.4)] transition-all cursor-pointer active:scale-95"
                        title={session.state === 'PLAYING' ? 'Pause Jam' : 'Play Jam'}
                      >
                        {session.state === 'PLAYING' ? (
                          <Pause className="w-6 h-6 fill-white" />
                        ) : (
                          <Play className="w-6 h-6 fill-white ml-0.5" />
                        )}
                      </button>

                      <button
                        onClick={() => sendSkipNext()}
                        disabled={!isHost && !permissions?.canSkip}
                        className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                        title="Next Track"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Participants Avatars Footer */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center -space-x-2 overflow-hidden">
                    {participantsList.slice(0, 6).map((p) => (
                      <div
                        key={p.userId}
                        className="relative w-8 h-8 rounded-full border-2 border-[#0d0e14] bg-white/10 flex items-center justify-center text-xs font-bold overflow-hidden shadow-sm"
                        title={`${p.displayName} ${p.isHost ? '(Host)' : ''}`}
                      >
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{p.displayName[0]?.toUpperCase() || '👤'}</span>
                        )}
                        {p.isHost && (
                          <div className="absolute bottom-0 right-0 p-0.5 bg-amber-500 rounded-full">
                            <Crown className="w-2 h-2 text-black fill-black" />
                          </div>
                        )}
                      </div>
                    ))}
                    {participantsList.length > 6 && (
                      <div className="w-8 h-8 rounded-full border-2 border-[#0d0e14] bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                        +{participantsList.length - 6}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleShareModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Invite</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SHARED QUEUE */}
            {activeTab === 'queue' && (
              <div className="flex-1 p-4 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
                  <span className="text-xs text-slate-400 font-bold">Up Next in Jam</span>
                  <button
                    onClick={() => toggleAddToJamModal(true)}
                    disabled={!isHost && !permissions?.canAddSongs}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FA233B] hover:bg-[#ff3b53] disabled:opacity-40 text-xs font-black text-white shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Song</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 mt-3 pr-1 custom-scrollbar">
                  {session.queue.length > 0 ? (
                    session.queue.map((item, idx) => (
                      <div
                        key={item.queueItemId}
                        className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between gap-3 group transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-[11px] font-mono font-bold text-slate-500 w-4 text-center">
                            {idx + 1}
                          </span>
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-white/10">
                            <OptimizedImage
                              src={item.song.coverUrl}
                              alt={item.song.title}
                              className="w-full h-full object-cover"
                              fallbackSrc="/app-icon.png"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs text-white truncate">
                              {SongFormatter.cleanSongTitle(item.song.title)}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {SongFormatter.decodeHtml(item.song.artist) || item.song.artist}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#FA233B]/10 text-[#FA233B] border border-[#FA233B]/20 truncate">
                                Added by {item.addedByName}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(isHost || permissions?.canReorderQueue) && (
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleMoveQueueItem(idx, 'up')}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveQueueItem(idx, 'down')}
                                disabled={idx === session.queue.length - 1}
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {(isHost || permissions?.canRemoveSongs) && (
                            <button
                              onClick={() => sendRemoveTrack(item.queueItemId)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Remove track"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 text-center py-12">
                      <ListMusic className="w-8 h-8 opacity-40" />
                      <p>Queue is empty</p>
                      <p className="text-[10px] text-slate-600">Add songs to listen with participants</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PARTICIPANTS & PERMISSIONS */}
            {activeTab === 'participants' && (
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto space-y-4">
                {/* Participants List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-2">Connected Listeners ({participantsList.length})</h4>
                  <div className="space-y-1.5">
                    {participantsList.map((p) => (
                      <div
                        key={p.userId}
                        className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs overflow-hidden">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{p.displayName[0]?.toUpperCase() || '👤'}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white truncate">{p.displayName}</span>
                              {p.isHost && (
                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-bold flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5" /> Host
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span className="flex items-center gap-1">
                                {p.deviceType === 'mobile' ? (
                                  <Smartphone className="w-2.5 h-2.5" />
                                ) : (
                                  <Monitor className="w-2.5 h-2.5" />
                                )}
                                {p.deviceType}
                              </span>
                              <span>•</span>
                              <span>{p.rttMs}ms ping</span>
                            </div>
                          </div>
                        </div>

                        {/* Host action controls */}
                        {isHost && !p.isHost && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => sendTransferHost(p.userId)}
                              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 transition-colors"
                              title="Make Host"
                            >
                              Make Host
                            </button>
                            <button
                              onClick={() => sendKickParticipant(p.userId)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Remove participant"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Host Granular Permissions Config */}
                {isHost && permissions && (
                  <div className="pt-3 border-t border-white/10">
                    <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FA233B]" />
                      <span>Participant Permissions</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <span>Allow adding songs to queue</span>
                        <input
                          type="checkbox"
                          checked={permissions.canAddSongs}
                          onChange={(e) => sendUpdatePermissions({ canAddSongs: e.target.checked })}
                          className="accent-[#FA233B] w-4 h-4 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <span>Allow reordering & removing queue songs</span>
                        <input
                          type="checkbox"
                          checked={permissions.canReorderQueue}
                          onChange={(e) =>
                            sendUpdatePermissions({
                              canReorderQueue: e.target.checked,
                              canRemoveSongs: e.target.checked,
                            })
                          }
                          className="accent-[#FA233B] w-4 h-4 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
                        <span>Allow playback control (Play / Pause / Seek)</span>
                        <input
                          type="checkbox"
                          checked={permissions.canControlPlayback}
                          onChange={(e) =>
                            sendUpdatePermissions({
                              canControlPlayback: e.target.checked,
                              canSkip: e.target.checked,
                            })
                          }
                          className="accent-[#FA233B] w-4 h-4 rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Session Exit Controls */}
                <div className="pt-4 border-t border-white/10 flex gap-2">
                  <button
                    onClick={() => leaveJam()}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Leave Jam</span>
                  </button>

                  {isHost && (
                    <button
                      onClick={() => sendEndSession()}
                      className="py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-bold text-rose-400 transition-colors cursor-pointer"
                    >
                      End Jam for All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
