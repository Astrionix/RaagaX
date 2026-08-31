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
  Trash2,
  Crown,
  Sparkles,
  LogOut,
  ChevronUp,
  ChevronDown,
  QrCode,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Wifi,
  Camera,
  Activity,
  Music2,
  Sliders,
} from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';
import { usePlayerStore } from '@/context/usePlayerStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { JamSyncBadge } from './JamSyncBadge';
import { JamCameraScanner } from './JamCameraScanner';

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
    sendRemoveTrack,
    sendReorderQueue,
    sendUpdatePermissions,
    sendTransferHost,
    sendKickParticipant,
    sendRequestHandoff,
    sendEndSession,
    isLoading,
  } = useJamStore();

  const { currentSong } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<'queue' | 'participants' | 'settings'>('queue');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [jamNameInput, setJamNameInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  const handleScanSuccess = async (scannedValue: string) => {
    setIsScannerOpen(false);
    if (!scannedValue) return;

    if (scannedValue.length <= 6 && !scannedValue.startsWith('JAM_')) {
      await useJamStore.getState().joinByCode(scannedValue.toUpperCase());
    } else {
      await joinJam(scannedValue);
    }
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

  const handleCopyCode = () => {
    if (!session?.joinCode) return;
    navigator.clipboard.writeText(session.joinCode);
    setCopiedCode(true);
    usePlayerStore.getState().setToastMessage(`Join Code ${session.joinCode} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const activeTrack = session?.currentSong || currentSong;

  return (
    <div className="fixed inset-0 z-[140] flex items-end md:items-center justify-center md:p-6 select-none animate-in fade-in duration-200">
      {/* Dynamic Ambient Backdrop */}
      <div
        onClick={() => toggleJamModal(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity"
      />

      {/* Main Container */}
      <div className="relative z-10 w-full md:w-[580px] h-[92vh] md:h-[640px] max-h-[92vh] bg-[#0A0B10]/95 border-t md:border border-white/15 rounded-t-[32px] md:rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.9)] overflow-hidden text-white flex flex-col animate-in slide-in-from-bottom-6 duration-250">
        {/* Glow accents */}
        <div className="absolute -top-28 -right-28 w-64 h-64 bg-[#FA233B]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-28 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Mobile Pull Handle */}
        <div className="md:hidden w-full flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 relative z-10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FA233B] to-rose-500 flex items-center justify-center text-white shadow-[0_4px_16px_rgba(250,35,59,0.35)] flex-shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white truncate">
                  {session ? session.name : 'RaagaX Jam'}
                </h3>
                {session && <JamSyncBadge />}
              </div>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                {session ? (
                  <>
                    <span className="text-slate-300 font-medium">Host: {session.hostName}</span>
                    <span>•</span>
                    <span>{participantsList.length} listening in sync</span>
                  </>
                ) : (
                  'Real-time synchronized listening'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {session && (
              <button
                onClick={() => toggleShareModal(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Share Jam / QR Code"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}

            <button
              onClick={() => toggleJamModal(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Not in Jam: Welcome & Join Options */}
        {!isInJam || !session ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center overflow-y-auto relative z-10">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#FA233B] via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-[0_12px_40px_rgba(250,35,59,0.45)]">
                <Radio className="w-10 h-10 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border-2 border-[#0A0B10]">
                <Sparkles className="w-3 h-3 text-black fill-black" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">Sync Music with Friends</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
              Listen to the exact same track at the exact same millisecond. Share queue controls, discover nearby devices, and experience music together.
            </p>

            <div className="w-full max-w-xs mt-6 space-y-2.5">
              <button
                onClick={handleCreateJam}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#FA233B] to-rose-600 hover:from-[#ff334c] hover:to-rose-500 text-sm font-black text-white shadow-[0_8px_28px_rgba(250,35,59,0.4)] transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                <span>{isLoading ? 'Starting Jam...' : 'Start a Jam Party'}</span>
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">or join friends</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              {/* Camera Scanner Quick Trigger */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="w-full py-3 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#FA233B]/40 text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-98"
              >
                <Camera className="w-4 h-4 text-[#FA233B]" />
                <span>Scan Host QR Code</span>
              </button>

              <button
                onClick={() => {
                  toggleJamModal(false);
                  useJamStore.getState().toggleJoinModal(true);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Wifi className="w-4 h-4 text-[#FA233B]" />
                <span>Nearby Radar / Enter Code</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Jam Session */
          <div className="flex-1 flex flex-col min-h-0 relative z-10">
            {/* Tab Navigation Pill Bar */}
            <div className="flex items-center px-4 pt-3 pb-2 border-b border-white/10 gap-2 flex-shrink-0 bg-white/[0.01]">
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'queue'
                    ? 'bg-[#FA233B] text-white shadow-[0_2px_12px_rgba(250,35,59,0.35)]'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Shared Queue</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'queue' ? 'bg-black/20 text-white' : 'bg-white/10 text-slate-300'}`}>
                  {session.queue.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('participants')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'participants'
                    ? 'bg-[#FA233B] text-white shadow-[0_2px_12px_rgba(250,35,59,0.35)]'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Listeners</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'participants' ? 'bg-black/20 text-white' : 'bg-white/10 text-slate-300'}`}>
                  {participantsList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'bg-[#FA233B] text-white shadow-[0_2px_12px_rgba(250,35,59,0.35)]'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
                title="Room Settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TAB 1: SHARED QUEUE */}
            {activeTab === 'queue' && (
              <div className="flex-1 p-4 flex flex-col min-h-0">
                {/* Now Playing in Jam Glass Banner */}
                {activeTrack ? (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-[#FA233B]/15 via-white/[0.03] to-transparent border border-[#FA233B]/30 flex items-center justify-between gap-3 mb-3 flex-shrink-0 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-white/15">
                        <OptimizedImage
                          src={activeTrack.coverUrl}
                          alt={activeTrack.title}
                          className="w-full h-full object-cover"
                          fallbackSrc="/app-icon.png"
                        />
                        {session.state === 'PLAYING' && (
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                            <div className="flex items-end gap-0.5 h-4">
                              <span className="w-0.5 bg-[#FA233B] rounded-full animate-[bounce_1s_infinite_100ms] h-4" />
                              <span className="w-0.5 bg-[#FA233B] rounded-full animate-[bounce_1s_infinite_300ms] h-2.5" />
                              <span className="w-0.5 bg-[#FA233B] rounded-full animate-[bounce_1s_infinite_200ms] h-3.5" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#FA233B] bg-[#FA233B]/15 px-1.5 py-0.2 rounded-md">
                            Now Playing
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-white truncate mt-0.5">
                          {SongFormatter.cleanSongTitle(activeTrack.title)}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {SongFormatter.decodeHtml(activeTrack.artist) || activeTrack.artist}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3 mb-3 flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                      <Music2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">No Track Playing</h4>
                      <p className="text-[10px] text-slate-400">Add a song below to start synchronized playback</p>
                    </div>
                  </div>
                )}

                {/* Queue Section Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-bold">Up Next</span>
                    <span className="text-[10px] text-slate-500 font-mono">({session.queue.length} songs)</span>
                  </div>
                  <button
                    onClick={() => toggleAddToJamModal(true)}
                    disabled={!isHost && !permissions?.canAddSongs}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FA233B] hover:bg-[#ff3b53] disabled:opacity-40 text-xs font-black text-white shadow-[0_2px_10px_rgba(250,35,59,0.3)] transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Songs</span>
                  </button>
                </div>

                {/* Queue Items List */}
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
                                title="Move up"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveQueueItem(idx, 'down')}
                                disabled={idx === session.queue.length - 1}
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                                title="Move down"
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
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2.5 text-center py-12">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-500">
                        <ListMusic className="w-6 h-6 opacity-60" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-300">Shared Queue is Empty</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Add songs to play with all participants</p>
                      </div>
                      <button
                        onClick={() => toggleAddToJamModal(true)}
                        className="mt-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#FA233B]" />
                        <span>Add Songs to Queue</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Participants Footer Bar */}
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center -space-x-2 overflow-hidden">
                    {participantsList.slice(0, 6).map((p) => (
                      <div
                        key={p.userId}
                        className="relative w-7 h-7 rounded-full border-2 border-[#0A0B10] bg-white/10 flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm"
                        title={`${p.displayName} ${p.isHost ? '(Host)' : ''}`}
                      >
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{p.displayName[0]?.toUpperCase() || '👤'}</span>
                        )}
                        {p.isHost && (
                          <div className="absolute bottom-0 right-0 p-0.5 bg-amber-500 rounded-full">
                            <Crown className="w-1.5 h-1.5 text-black fill-black" />
                          </div>
                        )}
                      </div>
                    ))}
                    {participantsList.length > 6 && (
                      <div className="w-7 h-7 rounded-full border-2 border-[#0A0B10] bg-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                        +{participantsList.length - 6}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleShareModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-[#FA233B]" />
                      <span>Invite</span>
                    </button>
                    <button
                      onClick={() => leaveJam()}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Leave Jam"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PARTICIPANTS & DEVICES */}
            {activeTab === 'participants' && (
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto space-y-3 custom-scrollbar">
                {/* Join Code Quick Card */}
                {session?.joinCode && (
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Party Join Code</span>
                      <span className="text-base font-black font-mono tracking-widest text-[#FA233B]">
                        {session.joinCode}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                )}

                {/* Connected Listeners List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-2">Connected Listeners ({participantsList.length})</h4>
                  <div className="space-y-1.5">
                    {participantsList.map((p) => (
                      <div
                        key={p.userId}
                        className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:bg-white/[0.05] transition-all"
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

                        {/* Action controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => sendRequestHandoff(p.userId)}
                            className="px-2.5 py-1 rounded-lg bg-[#FA233B]/15 hover:bg-[#FA233B]/25 text-[10px] font-bold text-[#FA233B] border border-[#FA233B]/30 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Handoff Playback to this Device"
                          >
                            <Radio className="w-2.5 h-2.5" />
                            <span>Handoff</span>
                          </button>

                          {isHost && !p.isHost && (
                            <>
                              <button
                                onClick={() => sendTransferHost(p.userId)}
                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 transition-colors cursor-pointer"
                                title="Make Host"
                              >
                                Make Host
                              </button>
                              <button
                                onClick={() => sendKickParticipant(p.userId)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remove participant"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ROOM SETTINGS & PERMISSIONS */}
            {activeTab === 'settings' && (
              <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
                {/* Host Permissions Section */}
                {isHost && permissions ? (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FA233B]" />
                      <span>Participant Permissions</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
                        <div>
                          <span className="font-bold text-white block">Allow adding songs</span>
                          <span className="text-[10px] text-slate-400">Listeners can search & add tracks to queue</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={permissions.canAddSongs}
                          onChange={(e) => sendUpdatePermissions({ canAddSongs: e.target.checked })}
                          className="accent-[#FA233B] w-4 h-4 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
                        <div>
                          <span className="font-bold text-white block">Allow reordering & removing songs</span>
                          <span className="text-[10px] text-slate-400">Listeners can reorder or remove queue items</span>
                        </div>
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

                      <label className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
                        <div>
                          <span className="font-bold text-white block">Allow playback controls</span>
                          <span className="text-[10px] text-slate-400">Listeners can pause, play, and seek tracks</span>
                        </div>
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
                ) : (
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <span className="text-xs font-bold text-slate-300 block">Host Controlled Room</span>
                    <span className="text-[10px] text-slate-500">Only the room host can modify permissions and room settings.</span>
                  </div>
                )}

                {/* Session Actions */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <button
                    onClick={() => leaveJam()}
                    className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Leave Jam</span>
                  </button>

                  {isHost && (
                    <button
                      onClick={() => sendEndSession()}
                      className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-400 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>End Jam Party for All</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Camera QR Scanner Overlay */}
      <JamCameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
