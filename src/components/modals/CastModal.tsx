'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Tv,
  Speaker,
  Smartphone,
  Laptop,
  Check,
  Signal,
  Wifi,
  Radio,
  Volume2,
  VolumeX,
  MonitorSpeaker,
  Loader2,
  ChevronRight,
  ExternalLink,
  MoreVertical,
  HelpCircle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { DeviceDiscoveryEngine } from '@/lib/connect/discovery/DeviceDiscoveryEngine';
import { PairingService } from '@/lib/connect/auth/PairingService';
import { ConnectSessionManager } from '@/lib/connect/session/ConnectSessionManager';
import { TransportManager } from '@/lib/connect/transport/TransportManager';
import { DiscoveredPeer, AuthorizedPeer, ConnectMetrics, TransportKind } from '@/lib/connect/types';
import { DeviceKeyManager } from '@/lib/connect/auth/DeviceKeyManager';
import { DeviceNameResolver } from '@/lib/connect/auth/DeviceNameResolver';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { SongFormatter } from '@/lib/music/SongFormatter';
import { haptics } from '@/lib/haptics/HapticEngine';

export function CastModal() {
  const {
    isCastModalOpen,
    toggleCastModal,
    activePlaybackDeviceId,
    activePlaybackDeviceName,
    setActivePlaybackDeviceId,
    isLocalPlayback,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    setToastMessage,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrev,
  } = usePlayerStore();

  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [connectingPeerId, setConnectingPeerId] = useState<string | null>(null);
  const [rowContextMenuPeerId, setRowContextMenuPeerId] = useState<string | null>(null);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [showManageDevices, setShowManageDevices] = useState(false);
  const [metrics, setMetrics] = useState<ConnectMetrics>(TransportManager.getInstance().getMetrics());
  const [mounted, setMounted] = useState(false);
  const [localDeviceName, setLocalDeviceName] = useState(() =>
    DeviceNameResolver.getInstance().getLocalDeviceDisplayName()
  );
  const [userRenameInput, setUserRenameInput] = useState(() =>
    DeviceNameResolver.getInstance().getUserLabel() || ''
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsub = DeviceNameResolver.getInstance().onNameChanged((newName) => {
      setLocalDeviceName(newName);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isCastModalOpen) return;

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
  }, [isCastModalOpen]);



  if (!mounted || !isCastModalOpen) return null;

  const currentAccountId = typeof window !== 'undefined' ? localStorage.getItem('raagax_account_id') : null;
  const myDeviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();

  // Helper for last seen formatting (§3, §8)
  const formatLastSeen = (lastSeen: number) => {
    const diffSec = Math.floor((Date.now() - lastSeen) / 1000);
    if (diffSec < 60) return 'last seen just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `last seen ${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `last seen ${diffHours}h ago`;
    return 'offline';
  };

  const disambiguatedPeers = DeviceNameResolver.getInstance().disambiguatePeers(discoveredPeers);

  // Categorize Devices into the 3 UI Spec sections (§2):
  // 1. THIS DEVICE
  // 2. YOUR DEVICES (same account)
  // 3. NEARBY (different account / guest)
  const yourDevices = disambiguatedPeers.filter(
    (p) => p.deviceId !== myDeviceId && p.accountId && p.accountId === currentAccountId
  );

  const nearbyDevices = disambiguatedPeers.filter(
    (p) => p.deviceId !== myDeviceId && (!p.accountId || p.accountId !== currentAccountId)
  );

  // Section 5: Tap a device row -> transfers playback there
  const handleSelectLocal = async () => {
    toggleCastModal();
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
      toggleCastModal();
      setToastMessage(`Playing on ${peer.deviceName || 'Remote Device'}`);
    } catch (err) {
      console.error('[Connect] Transfer failed:', err);
      // Section 8: Connection failed mid-transfer -> fallback to local
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Connect to a device"
    >
      {/* Click outside to close */}
      <div 
        className="absolute inset-0" 
        onClick={toggleCastModal} 
      />

      {/* ── MAIN DEVICE PICKER: Layout from UI Spec §2 ── */}
        <div
          className={`relative z-10 w-full md:w-[380px] bg-[#181818] text-white border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-300 ${
            /* Mobile: bottom sheet with rounded top | Desktop: popover anchored above player bar */
            'rounded-t-[28px] md:rounded-2xl max-h-[85vh] md:max-h-[580px] flex flex-col md:fixed md:bottom-[76px] md:right-8'
          }`}
        >
          {/* Mobile Drag Indicator */}
          <div className="md:hidden pt-3 pb-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-white/25" />
          </div>

          {/* Header (§2) */}
          <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MonitorSpeaker className="w-4 h-4 text-[#1DB954]" />
              <h3 className="font-extrabold text-sm tracking-tight text-white">Connect to a device</h3>
            </div>
            <button
              onClick={toggleCastModal}
              className="p-1 text-[#b3b3b3] hover:text-white rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#1DB954]"
              aria-label="Close device picker"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Device List */}
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
            
            {/* ── SECTION 1: THIS DEVICE (Always first, §2) ── */}
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

                {/* Per-row status dot: Filled if active, outline if available */}
                {isLocalPlayback ? (
                  <div className="w-3.5 h-3.5 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_#1DB954]">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                  </div>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-[#b3b3b3] flex-shrink-0" />
                )}
              </button>

              {/* Integrated Volume Slider when playing on this device */}
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

            {/* ── SECTION 2: YOUR DEVICES (Same account, §2) ── */}
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
                              {/* Low-emphasis subtle transport indicator dot (§7) */}
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getTransportDotColor(peer.transport)}`}
                                title={`Connection: ${peer.transport === 'mdns' ? 'LAN' : 'P2P/Cloud'}`}
                              />
                            </div>
                            <p className="text-[10px] text-[#727272] truncate mt-0.5">
                              {isOffline ? (
                                formatLastSeen(peer.lastSeen)
                              ) : isActive ? (
                                <span className="text-[#1DB954] font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                                  <span>Listening on this device</span>
                                </span>
                              ) : peer.audioReady ? (
                                <span className="text-[#1DB954] font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                                  <span>Ready</span>
                                </span>
                              ) : (
                                'Available'
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right State Affordance (§3) */}
                        <div className="flex items-center gap-1.5">
                          {/* Section 5: Context Menu (...) */}
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

                      {/* Section 5: Row Context Menu */}
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

            {/* ── SECTION 3: NEARBY / OTHER ACCOUNTS (§2) ── */}
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
                      <p>• Connect devices to the same Wi-Fi or subnet.</p>
                      <p>• Disable AP/Client isolation on your Wi-Fi router.</p>
                      <p>• Ensure RaagaX is open and active on the target device.</p>
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
                            {peer.deviceName || 'Remote Device'}
                          </p>
                          <p className="text-[10px] text-[#727272] flex items-center gap-1 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${getTransportDotColor(peer.transport)}`} />
                            <span>
                              {isActive ? (
                                'Listening on this device'
                              ) : peer.audioReady ? (
                                <span className="text-[#1DB954] font-medium">Ready</span>
                              ) : (
                                'Available'
                              )}
                            </span>
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
                    <span className="truncate max-w-[180px]">Listening on {activePlaybackDeviceName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectLocal}
                      className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[#b3b3b3] hover:text-white text-[11px] font-medium transition-all active:scale-95 cursor-pointer border border-white/10"
                      title="Disconnect and play on this device"
                    >
                      Disconnect
                    </button>
                    <span className="text-[10px] font-mono text-white/60">
                      {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Track Info & Artwork */}
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-md">
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
                    onClick={() => {
                      haptics.lightImpact();
                      playPrev();
                    }}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
                    title="Previous"
                  >
                    <SkipBack className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    onClick={() => {
                      haptics.mediumImpact();
                      togglePlayPause();
                    }}
                    className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-90 transition-all hover:scale-105 cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4.5 h-4.5 fill-black text-black stroke-none" />
                    ) : (
                      <Play className="w-4.5 h-4.5 fill-black text-black stroke-none ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      haptics.lightImpact();
                      playNext();
                    }}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 cursor-pointer"
                    title="Next"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Remote Device Volume Slider */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/10">
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
                      aria-label="Remote volume slider"
                    />
                  </div>
                  <span className="text-[10px] text-[#b3b3b3] font-mono min-w-[28px] text-right">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>
            )}


            {/* ── SECTION 9: DESKTOP MANAGE DEVICES LINK ── */}
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
        </div>
    </div>
  );
}
