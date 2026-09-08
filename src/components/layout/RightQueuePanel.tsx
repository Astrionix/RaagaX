'use client';

import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Heart,
  X,
  ListMusic,
  Music2,
  MonitorSpeaker,
  Laptop,
  Smartphone,
  Speaker,
  Tv,
  Loader2,
  Volume2,
  VolumeX,
  MoreVertical,
  Wifi,
  ChevronRight,
  ExternalLink,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Radio,
  Users,
  Copy,
  Check,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Shield,
  UserX,
  SlidersHorizontal,
  LogOut,
  Sparkles,
  Zap,
  Plus,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { DeviceDiscoveryEngine } from '@/lib/connect/discovery/DeviceDiscoveryEngine';
import { PairingService } from '@/lib/connect/auth/PairingService';
import { ConnectSessionManager } from '@/lib/connect/session/ConnectSessionManager';
import { TransportManager } from '@/lib/connect/transport/TransportManager';
import { DiscoveredPeer, ConnectMetrics } from '@/lib/connect/types';
import { DeviceKeyManager } from '@/lib/connect/auth/DeviceKeyManager';
import { DeviceNameResolver } from '@/lib/connect/auth/DeviceNameResolver';
import { JamSessionManager } from '@/lib/connect/jam/JamSessionManager';
import { JamSessionState } from '@/lib/connect/jam/JamTypes';
import { haptics } from '@/lib/haptics/HapticEngine';

export function RightQueuePanel() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    currentSong,
    queue,
    queueIndex,
    playSong,
    removeFromQueue,
    likedSongIds,
    toggleLikeSong,
    isAutoplayEnabled,
    toggleAutoplay,
    reorderQueue,
    toggleQueue,
    rightPanelMode,
    setRightPanelMode,
    activePlaybackDeviceId,
    activePlaybackDeviceName,
    setActivePlaybackDeviceId,
    isLocalPlayback,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrev,
    setToastMessage,
    toggleCastModal,
    toggleJamModal,
  } = usePlayerStore();

  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);
  const [rowContextMenuPeerId, setRowContextMenuPeerId] = useState<string | null>(null);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [metrics, setMetrics] = useState<ConnectMetrics>(TransportManager.getInstance().getMetrics());
  const [localDeviceName, setLocalDeviceName] = useState(() =>
    DeviceNameResolver.getInstance().getLocalDeviceDisplayName()
  );

  // Jam Session State & Handlers inside Right Side Panel
  const [jamState, setJamState] = useState<JamSessionState | null>(null);
  const [jamSubTab, setJamSubTab] = useState<'session' | 'join'>('session');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCreatingJam, setIsCreatingJam] = useState(false);
  const [isJoiningJam, setIsJoiningJam] = useState(false);

  useEffect(() => {
    const jamMgr = JamSessionManager.getInstance();
    setJamState(jamMgr.getActiveState());
    const unsub = jamMgr.onStateChanged((state) => {
      setJamState(state);
      if (state && jamSubTab === 'join') {
        setJamSubTab('session');
      }
    });
    return unsub;
  }, [jamSubTab]);

  const handleCreateJam = async () => {
    setIsCreatingJam(true);
    haptics.mediumImpact();
    import('@/lib/playback/AudioUnlocker').then(({ activatePlayer }) => activatePlayer()).catch(() => {});
    try {
      const jamMgr = JamSessionManager.getInstance();
      await jamMgr.createJamRoom();
    } catch {
      setToastMessage('Failed to create Jam session');
    } finally {
      setIsCreatingJam(false);
    }
  };

  const handleJoinJam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsJoiningJam(true);
    haptics.mediumImpact();
    import('@/lib/playback/AudioUnlocker').then(({ activatePlayer }) => activatePlayer()).catch(() => {});
    try {
      const jamMgr = JamSessionManager.getInstance();
      const success = await jamMgr.joinJamRoom(joinCodeInput);
      if (success) {
        setJoinCodeInput('');
      }
    } catch {
      setToastMessage('Failed to join Jam room');
    } finally {
      setIsJoiningJam(false);
    }
  };

  const handleCopyJamCode = () => {
    if (!jamState?.roomCode) return;
    navigator.clipboard.writeText(jamState.roomCode);
    setCopiedCode(true);
    haptics.lightImpact();
    setToastMessage('Room code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareJamInvite = async () => {
    if (!jamState?.roomCode) return;
    const shareText = `🎵 Join my Raaga Jam live session!\nCode: ${jamState.roomCode}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Raaga Jam', text: shareText });
        return;
      } catch {}
    }

    navigator.clipboard.writeText(shareText);
    setToastMessage('Invite link copied to clipboard!');
    haptics.lightImpact();
  };

  const [showHostSettings, setShowHostSettings] = useState(false);

  const handleLeaveJam = () => {
    haptics.mediumImpact();
    JamSessionManager.getInstance().leaveJamRoom();
  };

  const handleUpvoteJamSong = (queueItemId: string) => {
    haptics.lightImpact();
    JamSessionManager.getInstance().voteSongInQueue(queueItemId, 'upvote');
  };

  const handleDownvoteJamSong = (queueItemId: string) => {
    haptics.lightImpact();
    JamSessionManager.getInstance().voteSongInQueue(queueItemId, 'downvote');
  };

  const isJamHost = JamSessionManager.getInstance().isHost();

  useEffect(() => {
    const unsub = DeviceNameResolver.getInstance().onNameChanged((newName) => {
      setLocalDeviceName(newName);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (rightPanelMode !== 'connect') return;

    const discovery = DeviceDiscoveryEngine.getInstance();
    discovery.startDiscovery('controller');
    discovery.requestDiscoveryRefresh();

    const unsubDiscovery = discovery.onPeersUpdated((peers) => {
      setDiscoveredPeers(peers);
    });

    const transportMgr = TransportManager.getInstance();
    const unsubMetrics = transportMgr.on('metricsUpdated', (m: ConnectMetrics) => {
      setMetrics(m);
    });

    return () => {
      unsubDiscovery();
      unsubMetrics();
    };
  }, [rightPanelMode]);

  const currentAccountId = typeof window !== 'undefined' ? localStorage.getItem('raagax_account_id') : null;
  const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();

  const formatLastSeen = (lastSeen: number) => {
    const diffSec = Math.floor((Date.now() - lastSeen) / 1000);
    if (diffSec < 60) return 'last seen just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `last seen ${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `last seen ${diffHours}h ago`;
    return 'offline';
  };

  const disambiguatedPeers = React.useMemo(() => {
    return DeviceNameResolver.getInstance().disambiguatePeers(discoveredPeers);
  }, [discoveredPeers]);

  const yourDevices = disambiguatedPeers.filter(
    (p) => p.deviceId !== myDeviceId && p.accountId && p.accountId === currentAccountId
  );

  const nearbyDevices = disambiguatedPeers.filter(
    (p) => p.deviceId !== myDeviceId && (!p.accountId || p.accountId !== currentAccountId)
  );

  const handleSelectLocal = async () => {
    setToastMessage('Switching playback to this device...');
    await ConnectSessionManager.getInstance().transferPlaybackToLocal(true);
    setToastMessage('Playing on this device');
  };

  const handleSelectRemote = async (peer: DiscoveredPeer) => {
    if (peer.deviceId === activePlaybackDeviceId) return;

    setConnectingPeerId(peer.deviceId);

    const pairing = PairingService.getInstance();
    let authorized = pairing.getAuthorizedPeer(peer.deviceId);

    // Spotify-standard one-tap direct authorization (Zero PIN)
    if (!authorized) {
      authorized = await pairing.authorizeDirect(peer);
    }

    try {
      await ConnectSessionManager.getInstance().transferPlaybackToPeer(authorized);
      setToastMessage(
        jamState
          ? `Routing Jam Room playback to ${peer.deviceName || 'Remote Device'}`
          : `Playing on ${peer.deviceName || 'Remote Device'}`
      );
    } catch (err) {
      console.error('[Connect] Transfer failed:', err);
      setToastMessage(`Couldn't connect to ${peer.deviceName || 'device'}. Playing here instead.`);
      setActivePlaybackDeviceId('dev_local', 'This Device');
    } finally {
      setConnectingPeerId(null);
    }
  };

  const getDeviceIcon = (peer: DiscoveredPeer) => {
    const name = (peer.deviceName || '').toLowerCase();
    if (name.includes('tv') || name.includes('chromecast')) return Tv;
    if (name.includes('mobile') || name.includes('phone') || name.includes('iphone') || name.includes('android')) return Smartphone;
    if (name.includes('speaker') || name.includes('homepod') || name.includes('echo') || name.includes('alexa')) return Speaker;
    return Laptop;
  };

  const getTransportDotColor = (transport?: string) => {
    if (transport === 'mdns' || transport === 'udp_beacon') return 'bg-[#1DB954]'; // LAN = Green
    if (transport === 'p2p') return 'bg-amber-400'; // P2P = Yellow
    return 'bg-orange-500'; // Relay = Orange
  };

  const upNextQueue = mounted ? queue.slice(queueIndex + 1) : [];

  const handleClearQueue = () => {
    if (currentSong) {
      reorderQueue([currentSong]);
    } else {
      reorderQueue([]);
    }
  };

  return (
    <aside className="flex flex-col w-full h-full text-[var(--text-primary)] text-xs select-none p-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2 pb-3 mb-3 border-b border-[var(--border-subtle)] flex-shrink-0">
        {/* Top Control Bar: Segmented Tabs (Queue | Connect) + Close Button */}
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Segmented Control Pills */}
          <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 flex-1 min-w-0 shadow-inner">
            <button
              onClick={() => {
                haptics.lightImpact();
                setRightPanelMode('queue');
              }}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer select-none ${
                rightPanelMode === 'queue'
                  ? 'bg-[#fa233b]/20 text-[#fa233b] border border-[#fa233b]/35 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate min-w-0">Queue</span>
              {upNextQueue.length > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-mono font-extrabold rounded-full bg-[#fa233b]/25 text-[#fa233b] border border-[#fa233b]/30 flex-shrink-0">
                  {upNextQueue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                haptics.lightImpact();
                setRightPanelMode('connect');
              }}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer select-none ${
                rightPanelMode === 'connect' || rightPanelMode === 'jam'
                  ? 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/35 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <MonitorSpeaker className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate min-w-0">Connect</span>
              {jamState && (
                <span className="relative flex h-2 w-2 ml-0.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </button>
          </div>

          {/* Close Panel Button */}
          <button
            onClick={toggleQueue}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border-subtle)] transition-all cursor-pointer flex-shrink-0"
            title="Close Panel"
            aria-label="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Bar Actions */}
        {rightPanelMode === 'queue' ? (
          <div className="flex items-center justify-between px-1 text-[11px] font-medium text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Autoplay</span>
              <button
                onClick={() => toggleAutoplay()}
                className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                  isAutoplayEnabled ? 'bg-[#fa233b]' : 'bg-slate-700'
                }`}
                title="Toggle Autoplay for similar songs"
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                    isAutoplayEnabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {upNextQueue.length > 0 && (
              <button
                onClick={handleClearQueue}
                className="text-[11px] font-bold text-[#fa233b] hover:underline px-1 py-0.5 rounded cursor-pointer transition-colors"
              >
                Clear Queue
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span className="truncate">Active: {activePlaybackDeviceName || 'This Device'}</span>
            {jamState && (
              <span className="text-emerald-400 font-extrabold flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Jam Room ({jamState.roomCode})
              </span>
            )}
          </div>
        )}
      </div>


      {/* ── MODE A: QUEUE VIEW ── */}
      {rightPanelMode === 'queue' ? (
        <>
          {/* Currently Playing Card */}
          {mounted && currentSong && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-[#fa233b]/15 to-[#fa233b]/5 border border-[#fa233b]/30 flex items-center justify-between flex-shrink-0 min-w-0 w-full mb-3 shadow-md shadow-red-500/5">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-white/10 bg-black/40 flex items-center justify-center">
                  <OptimizedImage
                    src={currentSong.coverUrl}
                    alt={currentSong.title}
                    imageFit="contain"
                    className="w-full h-full object-contain"
                    fallbackSrc="/app-icon.png"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-xs text-[var(--text-primary)] truncate leading-tight">
                    {SongFormatter.cleanSongTitle(currentSong.title)}
                  </h4>
                  <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5 font-medium">
                    {SongFormatter.decodeHtml(currentSong.artist) || currentSong.artist || 'Unknown Artist'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => toggleLikeSong(currentSong.id)}
                  className="p-1.5 hover:bg-[#fa233b]/20 rounded-full transition-colors cursor-pointer"
                  title={likedSongIds.includes(currentSong.id) ? 'Unlike' : 'Like'}
                >
                  <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(currentSong.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-[var(--text-muted)]'}`} />
                </button>
                <span className="text-[9px] font-mono text-[#fa233b] font-extrabold px-1.5 py-0.5 rounded-full bg-[#fa233b]/15 border border-[#fa233b]/25">
                  Playing
                </span>
              </div>
            </div>
          )}

          {/* Up Next Queue List */}
          <div className="space-y-1 overflow-y-auto no-scrollbar flex-1 pr-0.5">
            {upNextQueue.length > 0 ? (
              upNextQueue.map((item: any, idx) => {
                const song = item.song || item;
                const addedByName = item.addedByName;

                return (
                  <div
                    key={`${song.id}-${idx}`}
                    className="p-2 rounded-xl hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border-subtle)] flex items-center justify-between group cursor-pointer transition-all min-w-0 w-full"
                  >
                    <div
                      onClick={() => playSong(song)}
                      className="flex items-center gap-3 min-w-0 flex-1 pr-2"
                    >
                      <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-[var(--border-subtle)] bg-black/40 flex items-center justify-center">
                        <OptimizedImage
                          src={song.coverUrl}
                          alt={song.title}
                          imageFit="contain"
                          className="w-full h-full object-contain"
                          fallbackSrc="/app-icon.png"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-[var(--text-primary)] truncate leading-tight group-hover:text-[#fa233b] transition-colors">
                          {SongFormatter.cleanSongTitle(song.title)}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-[var(--text-secondary)] truncate leading-tight font-medium">
                            {SongFormatter.decodeHtml(song.artist) || song.artist || 'Unknown Artist'}
                          </p>
                          {addedByName && (
                            <span className="text-[8px] px-1 py-0.1 rounded-full bg-[#FA233B]/10 text-[#FA233B] border border-[#FA233B]/20">
                              {addedByName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button 
                        onClick={() => toggleLikeSong(song.id)}
                        className={`p-1 transition-colors cursor-pointer ${likedSongIds.includes(song.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title={likedSongIds.includes(song.id) ? 'Unlike' : 'Like'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${likedSongIds.includes(song.id) ? 'fill-[#fa233b] text-[#fa233b]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`} />
                      </button>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] font-medium">
                        {song.duration ? `${Math.floor(Number(song.duration) / 60)}:${Math.floor(Number(song.duration) % 60).toString().padStart(2, '0')}` : '3:45'}
                      </span>
                      <button
                        onClick={() => removeFromQueue(song.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-400 transition-opacity cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center text-[var(--text-muted)] text-xs font-semibold gap-2">
                <Music2 className="w-8 h-8 opacity-60" />
                <p>Queue is empty</p>
                <p className="text-[10px] opacity-70 font-normal">Play a track or add songs to queue</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── MODE B: CONNECT TO DEVICE VIEW (§1-§10) ── */
        <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
          {/* ── SECTION 1: THIS DEVICE (§2) ── */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-wider px-2 block">
              This Device
            </span>

            <button
              onClick={handleSelectLocal}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:outline-none ${
                isLocalPlayback
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'hover:bg-white/5 text-[#b3b3b3] hover:text-white'
              }`}
              aria-label={`${localDeviceName}, ${isLocalPlayback ? 'currently playing' : 'available'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Laptop className={`w-5 h-5 flex-shrink-0 ${isLocalPlayback ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`} />
                <div className="min-w-0">
                  <p className={`text-xs truncate ${isLocalPlayback ? 'font-bold text-white' : 'font-medium'}`}>
                    {localDeviceName} <span className="text-[11px] text-[#b3b3b3] font-normal">(this device)</span>
                  </p>
                  {isLocalPlayback && (
                    <p className="text-[10px] text-[#1DB954] font-medium flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                      <span>Active player</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Status dot: Filled if active, outline if available */}
              {isLocalPlayback ? (
                <div className="w-3.5 h-3.5 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_#1DB954]">
                  <span className="w-1.5 h-1.5 rounded-full bg-black" />
                </div>
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#b3b3b3] flex-shrink-0" />
              )}
            </button>

            {/* Volume slider when active */}
            {isLocalPlayback && (
              <div className="px-3 pt-1 pb-1 flex items-center gap-2">
                <button onClick={toggleMute} className="text-[#b3b3b3] hover:text-white transition-colors cursor-pointer">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-[#1DB954]" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="relative flex-1 h-2 flex items-center group/vol">
                  <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 group-hover/vol:h-1.5 transition-all" />
                  <div
                    className="absolute left-0 h-1 rounded-full bg-[#1DB954] group-hover/vol:h-1.5 transition-all"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    aria-label="Volume slider"
                  />
                </div>
                <span className="text-[10px] text-[#b3b3b3] font-mono min-w-[28px] text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            )}
          </div>



          {/* ── SECTION 2: YOUR DEVICES (§2) ── */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-wider px-2 block">
              Your Devices
            </span>

            {yourDevices.length === 0 ? (
              <p className="text-[11px] text-[#727272] px-3 py-1.5 italic">
                No other devices registered on this account
              </p>
            ) : (
              yourDevices.map((peer) => {
                const isActive = activePlaybackDeviceId === peer.deviceId;
                const isConnecting = connectingPeerId === peer.deviceId;
                const isOffline = Date.now() - peer.lastSeen > 35000;
                const Icon = getDeviceIcon(peer);
                const isMenuOpen = rowContextMenuPeerId === peer.deviceId;

                return (
                  <div key={peer.deviceId} className="relative group/row">
                    <button
                      onClick={() => !isOffline && handleSelectRemote(peer)}
                      disabled={isActive || isConnecting || isOffline}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:outline-none ${
                        isActive
                          ? 'bg-white/10 text-white font-bold'
                          : isOffline
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-white/5 text-[#b3b3b3] hover:text-white cursor-pointer'
                      }`}
                      aria-label={`${peer.deviceName || 'Device'}, ${isActive ? 'currently playing' : isOffline ? 'offline' : 'available'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs truncate ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                              {peer.deviceName || 'Device'}
                            </p>
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getTransportDotColor(peer.transport)}`}
                              title={`Connection: ${peer.transport === 'mdns' ? 'LAN' : 'P2P/Cloud'}`}
                            />
                          </div>
                          <p className="text-[10px] text-[#727272] truncate">
                            {isOffline ? formatLastSeen(peer.lastSeen) : isActive ? 'Listening on this device' : 'Available'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isOffline && !isConnecting && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setRowContextMenuPeerId(isMenuOpen ? null : peer.deviceId);
                            }}
                            className="p-1 rounded text-[#727272] hover:text-white hover:bg-white/10 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"
                            title="More options"
                            aria-label="More options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </div>
                        )}

                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#1DB954] flex-shrink-0" />
                        ) : isActive ? (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_#1DB954]">
                            <span className="w-1.5 h-1.5 rounded-full bg-black" />
                          </div>
                        ) : isOffline ? (
                          <span className="text-[10px] text-[#727272] font-medium font-mono">({formatLastSeen(peer.lastSeen)})</span>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#b3b3b3] flex-shrink-0" />
                        )}
                      </div>
                    </button>

                    {/* Context Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-4 top-12 z-20 w-44 rounded-xl bg-[#282828] border border-white/15 p-1.5 shadow-xl text-xs text-white space-y-1 animate-in fade-in zoom-in-95">
                        <button
                          onClick={() => {
                            setRowContextMenuPeerId(null);
                            handleSelectRemote(peer);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs font-medium cursor-pointer"
                        >
                          Play here
                        </button>
                        <button
                          onClick={() => {
                            setRowContextMenuPeerId(null);
                            setToastMessage(`Connected to ${peer.deviceName} queue`);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs text-[#b3b3b3] hover:text-white cursor-pointer"
                        >
                          View queue
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── SECTION 3: NEARBY (§2) ── */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-wider px-2 block">
              Nearby
            </span>

            {nearbyDevices.length === 0 ? (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center space-y-2">
                <Wifi className="w-4 h-4 text-[#727272] mx-auto animate-pulse" />
                <p className="text-[11px] text-[#b3b3b3]">No devices nearby</p>
                <p className="text-[10px] text-[#727272]">
                  Make sure other devices are on and connected to Wi-Fi.
                </p>
                <button
                  onClick={() => setShowLearnMore(!showLearnMore)}
                  className="text-[10px] text-[#1DB954] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Learn more</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${showLearnMore ? 'rotate-90' : ''}`} />
                </button>
                {showLearnMore && (
                  <div className="text-left mt-2 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[10px] text-[#b3b3b3] space-y-1 animate-in fade-in">
                    <p className="font-bold text-white">Connection checklist:</p>
                    <p>• Connect devices to the same Wi-Fi subnet.</p>
                    <p>• Disable AP/Client isolation on your router.</p>
                    <p>• Ensure RaagaX is open and active on target.</p>
                  </div>
                )}
              </div>
            ) : (
              nearbyDevices.map((peer) => {
                const isActive = activePlaybackDeviceId === peer.deviceId;
                const isConnecting = connectingPeerId === peer.deviceId;
                const Icon = getDeviceIcon(peer);

                return (
                  <button
                    key={peer.deviceId}
                    onClick={() => handleSelectRemote(peer)}
                    disabled={isActive || isConnecting}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:outline-none cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white font-bold'
                        : 'hover:bg-white/5 text-[#b3b3b3] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`} />
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                          {peer.deviceName || 'Alex\'s Speaker'}
                        </p>
                        <p className="text-[10px] text-[#727272] flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${getTransportDotColor(peer.transport)}`} />
                          <span>{isActive ? 'Listening on this device' : 'Available'}</span>
                        </p>
                      </div>
                    </div>

                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1DB954] flex-shrink-0" />
                    ) : isActive ? (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_#1DB954]">
                        <span className="w-1.5 h-1.5 rounded-full bg-black" />
                      </div>
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#b3b3b3] flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* ── SECTION: RAAGA JAM LISTENING ROOM (INLINE BELOW NEARBY DEVICES) ── */}
          <div className="pt-1 pb-1">
            {!jamState ? (
              <div className="p-3.5 rounded-2xl bg-[#181818] border border-[#1DB954]/30 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center text-[#1DB954] flex-shrink-0">
                    <Radio className="w-5 h-5 text-[#1DB954] animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-white flex items-center gap-1.5">
                      Raaga Jam Room
                      <span className="text-[9px] bg-[#1DB954]/20 text-[#1DB954] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold">Live Sync</span>
                    </h4>
                    <p className="text-[10px] text-[#b3b3b3]">Sync listening with friends in real-time</p>
                  </div>
                </div>

                {/* 2 Options: Create Room OR Join Code */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleCreateJam}
                    disabled={isCreatingJam}
                    className="py-2.5 px-3 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.98] text-black font-extrabold shadow-md shadow-[#1DB954]/20 transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer truncate"
                  >
                    <Radio className="w-3.5 h-3.5 text-black flex-shrink-0" />
                    <span className="truncate">{isCreatingJam ? 'Creating...' : 'Create Room'}</span>
                  </button>

                  <button
                    onClick={() => {
                      haptics.lightImpact();
                      toggleJamModal(true);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white font-extrabold border border-white/15 transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer truncate"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">Join Code</span>
                  </button>
                </div>

                {/* Inline Join Code Form */}
                <form onSubmit={handleJoinJam} className="pt-2 border-t border-white/10 flex items-center gap-1.5 w-full min-w-0">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. RAAG)"
                    maxLength={8}
                    className="min-w-0 flex-1 bg-white/5 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-mono uppercase placeholder:text-[#535353] focus:outline-none focus:border-[#1DB954]"
                  />
                  <button
                    type="submit"
                    disabled={!joinCodeInput.trim() || isJoiningJam}
                    className="px-2.5 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black disabled:opacity-40 text-xs font-bold rounded-lg transition-all cursor-pointer flex-shrink-0 flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5 flex-shrink-0 text-black fill-current" />
                    <span className="text-black font-extrabold">{isJoiningJam ? 'Joining...' : 'Join'}</span>
                  </button>
                </form>
              </div>
            ) : (
              /* Active Jam Room View directly inside Devices Tab */
              <div className="p-3.5 rounded-2xl bg-[#181818] border border-[#1DB954]/50 shadow-lg space-y-3.5 animate-in fade-in">
                {/* 1. Header with Room Code, Host Badge & Settings */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
                    <span className="text-xs font-extrabold text-[#1DB954] uppercase tracking-wider">Jam Room Live</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isJamHost && (
                      <span className="text-[9px] bg-[#1DB954]/20 text-[#1DB954] font-black px-2 py-0.5 rounded-full border border-[#1DB954]/30">
                        ★ HOST
                      </span>
                    )}
                    <button
                      onClick={() => setShowHostSettings(!showHostSettings)}
                      className={`p-1 rounded-md transition-colors cursor-pointer border ${
                        showHostSettings
                          ? 'bg-[#1DB954] text-black border-[#1DB954]'
                          : 'bg-white/5 text-[#b3b3b3] hover:text-white hover:bg-white/10 border-white/10'
                      }`}
                      title="Host & Room Settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Host & Room Settings Dropdown Panel */}
                {showHostSettings && (
                  <div className="p-3 rounded-xl bg-black/60 border border-[#1DB954]/40 space-y-2.5 animate-in fade-in text-xs">
                    <div className="flex items-center justify-between pb-1 border-b border-white/10">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#1DB954]" /> Room Controls
                      </span>
                      <button
                        onClick={() => setShowHostSettings(false)}
                        className="text-[10px] text-[#b3b3b3] hover:text-white cursor-pointer"
                      >
                        Done
                      </button>
                    </div>

                    {/* Toggle: Guest Playback Controls */}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="font-bold text-white text-[11px]">Guest Controls</p>
                        <p className="text-[9px] text-[#b3b3b3]">Allow guests to Play / Pause / Skip</p>
                      </div>
                      {isJamHost ? (
                        <button
                          onClick={() => {
                            const next = !jamState.isGuestControlAllowed;
                            setJamState((prev) => prev ? ({ ...prev, isGuestControlAllowed: next }) : null);
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

                    {/* Member Management */}
                    <div className="pt-2 border-t border-white/10 space-y-1">
                      <p className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-wider">
                        Connected Members ({jamState.members.length})
                      </p>
                      {jamState.members.map((member) => (
                        <div key={member.deviceId} className="flex items-center justify-between py-1 px-2 rounded-lg bg-white/5">
                          <span className="text-xs text-white font-medium truncate">{member.displayName}</span>
                          {member.isHost && (
                            <span className="text-[8px] bg-[#1DB954]/20 text-[#1DB954] font-black px-1.5 py-0.2 rounded-full">HOST</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Room Join Code Display */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-[#b3b3b3] font-bold uppercase tracking-wider block">
                      Room Code
                    </span>
                    <div className="text-2xl font-black text-[#1DB954] tracking-widest font-mono drop-shadow-[0_2px_8px_rgba(29,185,84,0.3)]">
                      {jamState.roomCode || 'JAM-ROOM'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyJamCode}
                      className="p-2 rounded-full bg-[#282828] hover:bg-[#333333] text-xs font-semibold text-white transition-all cursor-pointer border border-white/10 active:scale-95"
                      title="Copy Code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-[#1DB954]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={handleShareJamInvite}
                      className="flex items-center gap-1 py-1.5 px-3 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-xs font-extrabold text-black shadow-md shadow-[#1DB954]/20 transition-all cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5 text-black" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {/* 2. Compact Now Playing Track */}
                {jamState.currentSong && (
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shadow-md flex-shrink-0 bg-slate-800 border border-white/10 flex items-center justify-center">
                      <OptimizedImage
                        src={jamState.currentSong.coverUrl}
                        alt={jamState.currentSong.title}
                        size="thumb"
                        imageFit="contain"
                        className="w-full h-full object-contain"
                        fallbackSrc="/app-icon.png"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-[#1DB954] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" /> Jam Playing
                      </p>
                      <p className="text-xs font-bold text-white truncate">{jamState.currentSong.title}</p>
                      <p className="text-[10px] text-[#b3b3b3] truncate">{jamState.currentSong.artist}</p>
                    </div>
                  </div>
                )}

                {/* 3. Connected Friends List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#1DB954]" />
                    Connected ({jamState.members.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {jamState.members.map((member) => (
                      <div
                        key={member.deviceId}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-xs text-white"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                        <span className="font-semibold text-xs">{member.displayName}</span>
                        {member.isHost && (
                          <span className="text-[8px] bg-[#1DB954]/20 text-[#1DB954] font-black px-1.5 py-0.2 rounded-full">HOST</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Collaborative Jam Queue */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#b3b3b3] uppercase tracking-wider flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5 text-[#1DB954]" />
                      Jam Queue ({jamState.queue.length})
                    </span>
                    {currentSong && (
                      <button
                        onClick={() => JamSessionManager.getInstance().addToJamQueue(currentSong)}
                        className="text-[9px] bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3 h-3 text-black" /> Add Playing
                      </button>
                    )}
                  </div>

                  {jamState.queue.length === 0 ? (
                    <div className="p-3 rounded-xl bg-black/20 border border-white/5 text-center text-xs text-[#b3b3b3] space-y-0.5">
                      <p className="font-semibold text-white">Queue is empty</p>
                      <p className="text-[10px] text-[#727272]">Tap 3-dots (⋮) on any song & select "Add to Jam Queue"</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
                      {jamState.queue.map((item) => {
                        const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
                        const upCount = item.upvotes?.length || 0;
                        const downCount = item.downvotes?.length || 0;
                        const hasUpvoted = item.upvotes?.includes(myDeviceId);
                        const hasDownvoted = item.downvotes?.includes(myDeviceId);

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5 hover:bg-[#282828] transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm flex-shrink-0 bg-slate-800 border border-white/10 flex items-center justify-center">
                                <OptimizedImage
                                  src={item.song.coverUrl}
                                  alt={item.song.title}
                                  size="thumb"
                                  imageFit="contain"
                                  className="w-full h-full object-contain"
                                  fallbackSrc="/app-icon.png"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">{item.song.title}</p>
                                <p className="text-[9px] text-[#b3b3b3] truncate">
                                  Added by {item.addedByMemberName}
                                </p>
                              </div>
                            </div>

                            {/* Upvote & Downvote Buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleUpvoteJamSong(item.id)}
                                className={`py-0.5 px-2 rounded-full text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border active:scale-95 ${
                                  hasUpvoted
                                    ? 'bg-[#1DB954]/25 text-[#1DB954] border-[#1DB954]/50 shadow-[0_0_8px_rgba(29,185,84,0.3)]'
                                    : 'bg-[#282828] text-white/70 hover:text-white hover:bg-[#333333] border-white/5'
                                }`}
                                title="Upvote / Like song"
                              >
                                <ThumbsUp className={`w-3 h-3 ${hasUpvoted ? 'fill-[#1DB954]' : ''}`} />
                                <span>{upCount}</span>
                              </button>

                              <button
                                onClick={() => handleDownvoteJamSong(item.id)}
                                className={`py-0.5 px-2 rounded-full text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border active:scale-95 ${
                                  hasDownvoted
                                    ? 'bg-red-500/25 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
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

                {/* 5. Minimal Leave Room Button */}
                <button
                  onClick={handleLeaveJam}
                  className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Leave Jam Room
                </button>
              </div>
            )}
          </div>

          {/* ── REMOTE PLAYBACK ACTIVE CONTROLLER CARD (SPOTIFY CONNECT STYLE) ── */}
          {!isLocalPlayback && currentSong && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#1DB954]/15 via-white/[0.06] to-white/[0.02] border border-[#1DB954]/30 shadow-xl space-y-3">
              {/* Device Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1DB954]">
                  <MonitorSpeaker className="w-4 h-4 animate-pulse text-[#1DB954]" />
                  <span className="truncate max-w-[170px]">Listening on {activePlaybackDeviceName}</span>
                </div>
                <button
                  onClick={handleSelectLocal}
                  className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[#b3b3b3] hover:text-white text-[11px] font-medium transition-all active:scale-95 cursor-pointer border border-white/10"
                  title="Disconnect and play on this device"
                >
                  Disconnect
                </button>
              </div>

              {/* Track Info & Artwork */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black/50 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-md">
                  <OptimizedImage
                    src={currentSong.coverUrl || '/app-icon.png'}
                    alt={currentSong.title}
                    size="thumb"
                    imageFit="contain"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate leading-snug">
                    {SongFormatter.cleanSongTitle(currentSong.title)}
                  </h4>
                  <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                    {SongFormatter.decodeHtml(currentSong.artist) || currentSong.artist}
                  </p>
                </div>
              </div>

              {/* Playback Controls (Prev, Play/Pause, Next) */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  onClick={() => playPrev()}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={() => togglePlayPause()}
                  className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 transition-all hover:scale-105 cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-black text-black stroke-none" />
                  ) : (
                    <Play className="w-4 h-4 fill-black text-black stroke-none ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => playNext()}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>

              {/* Remote Device Volume Slider */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                <button onClick={toggleMute} className="text-[#b3b3b3] hover:text-white transition-colors cursor-pointer" aria-label="Toggle mute">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-[#1DB954]" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="relative flex-1 h-2 flex items-center group/vol">
                  <div className="absolute inset-x-0 h-1 rounded-full bg-white/20 group-hover/vol:h-1.5 transition-all" />
                  <div
                    className="absolute left-0 h-1 rounded-full bg-[#1DB954] group-hover/vol:h-1.5 transition-all"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm pointer-events-none transition-all group-hover/vol:scale-125"
                    style={{ left: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full z-10"
                    aria-label="Remote volume slider"
                  />
                </div>
                <span className="text-[10px] text-[#b3b3b3] font-mono min-w-[28px] text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          )}


        </div>
      )}
    </aside>
  );
}
