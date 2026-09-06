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
  } = usePlayerStore();

  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);
  const [rowContextMenuPeerId, setRowContextMenuPeerId] = useState<string | null>(null);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [showManageDevices, setShowManageDevices] = useState(false);
  const [metrics, setMetrics] = useState<ConnectMetrics>(TransportManager.getInstance().getMetrics());
  const [localDeviceName, setLocalDeviceName] = useState(() =>
    DeviceNameResolver.getInstance().getLocalDeviceDisplayName()
  );
  const [userRenameInput, setUserRenameInput] = useState(() =>
    DeviceNameResolver.getInstance().getUserLabel() || ''
  );

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
      setToastMessage(`Playing on ${peer.deviceName || 'Remote Device'}`);
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
    <aside className="flex-1 flex flex-col text-[var(--text-primary)] text-xs select-none p-4 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-[var(--border-subtle)] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
            rightPanelMode === 'connect'
              ? 'bg-[#1DB954]/15 text-[#1DB954] border-[#1DB954]/25'
              : 'bg-[#fa233b]/15 text-[#fa233b] border-[#fa233b]/25'
          }`}>
            {rightPanelMode === 'connect' ? (
              <MonitorSpeaker className="w-4 h-4" />
            ) : (
              <ListMusic className="w-4 h-4" />
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-black text-sm text-[var(--text-primary)] tracking-tight">
              {rightPanelMode === 'connect' ? 'Connect to a device' : 'Queue'}
            </h3>
            {rightPanelMode === 'queue' && upNextQueue.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-primary)] text-[var(--text-secondary)] font-mono border border-[var(--border-subtle)]">
                {upNextQueue.length}
              </span>
            )}
          </div>
          
          {rightPanelMode === 'queue' && (
            <div className="flex items-center gap-1.5 pl-2.5 border-l border-[var(--border-subtle)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)]">Autoplay</span>
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
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {rightPanelMode === 'queue' && upNextQueue.length > 0 && (
            <button 
              onClick={handleClearQueue} 
              className="text-[11px] font-bold text-[#fa233b] hover:underline px-1.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={toggleQueue}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            title="Close Panel"
            aria-label="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Pill (Queue vs Devices) */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl mb-3 flex-shrink-0 border border-white/5">
        <button
          onClick={() => setRightPanelMode('queue')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            rightPanelMode === 'queue'
              ? 'bg-[#fa233b] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          <span>Queue</span>
          {upNextQueue.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {upNextQueue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setRightPanelMode('connect')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            rightPanelMode === 'connect'
              ? 'bg-[#1DB954] text-black shadow-sm'
              : !isLocalPlayback
              ? 'text-[#1DB954] bg-[#1DB954]/10 hover:bg-[#1DB954]/20'
              : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
          }`}
        >
          <MonitorSpeaker className={`w-3.5 h-3.5 ${!isLocalPlayback ? 'animate-pulse' : ''}`} />
          <span>Devices</span>
          {!isLocalPlayback && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
          )}
        </button>
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


          {/* ── SECTION 5: MANAGE DEVICES (§9) ── */}
          <div className="pt-1 border-t border-white/5">
            <button
              onClick={() => setShowManageDevices(!showManageDevices)}
              className="w-full text-center text-[11px] text-[#727272] hover:text-white hover:underline transition-colors py-1 cursor-pointer block"
            >
              Manage devices
            </button>

            {showManageDevices && (
              <div className="mt-2 p-3 rounded-xl bg-black/30 border border-white/10 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">Device Settings</span>
                  <button
                    onClick={() => setShowManageDevices(false)}
                    className="text-[#b3b3b3] hover:text-white text-[10px] cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {/* Rename this device (§spec) */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-[#b3b3b3] block">
                    Rename this device
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={userRenameInput}
                      onChange={(e) => setUserRenameInput(e.target.value)}
                      placeholder={DeviceNameResolver.getInstance().getDefaultDeviceDisplayName()}
                      className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-[#535353] focus:outline-none focus:border-[#1DB954]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          DeviceNameResolver.getInstance().setUserLabel(userRenameInput);
                          setToastMessage(`Device renamed to "${DeviceNameResolver.getInstance().getLocalDeviceDisplayName()}"`);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        DeviceNameResolver.getInstance().setUserLabel(userRenameInput);
                        setToastMessage(`Device renamed to "${DeviceNameResolver.getInstance().getLocalDeviceDisplayName()}"`);
                      }}
                      className="px-2.5 py-1 bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    {DeviceNameResolver.getInstance().getUserLabel() && (
                      <button
                        onClick={() => {
                          DeviceNameResolver.getInstance().setUserLabel(null);
                          setUserRenameInput('');
                          setToastMessage('Device name reset to default');
                        }}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[#b3b3b3] hover:text-white text-[11px] rounded-lg transition-colors cursor-pointer"
                        title="Reset to default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#727272]">
                    Default: {DeviceNameResolver.getInstance().getDefaultDeviceDisplayName()}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <p className="text-[11px] text-[#727272]">
                    Hardware device ID: <span className="font-mono text-white">{myDeviceId.slice(0, 16)}...</span>
                  </p>
                  <button
                    onClick={() => {
                      PairingService.getInstance().revokeAuthorization(activePlaybackDeviceId);
                      setToastMessage('Device pairing authorization revoked');
                      setShowManageDevices(false);
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold block cursor-pointer"
                  >
                    Revoke current device authorization
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
