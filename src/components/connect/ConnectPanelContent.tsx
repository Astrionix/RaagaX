'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Smartphone, Laptop, Tv, Speaker, Tablet, Monitor,
  MoreVertical, Play, Pause, SkipForward, SkipBack, 
  Shuffle, Repeat, Volume2, LogOut, Loader2
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { useAuthStore } from '@/context/useAuthStore';
import { DeviceDiscoveryEngine } from '@/lib/connect/discovery/DeviceDiscoveryEngine';
import { VerifiedDevice } from '@/lib/connect/discovery/types';
import { RaagaXConnectV2 } from '@/lib/connect/lan/RaagaXConnectV2';
import { DeviceRegistry } from '@/lib/connect/DeviceRegistry';

interface ConnectPanelContentProps {
  onClose?: () => void;
  isPanel?: boolean;
}

export function ConnectPanelContent({ onClose, isPanel = false }: ConnectPanelContentProps) {
  const {
    deviceId,
    activeDeviceId,
    connectedDeviceId,
    currentSong,
    isPlaying,
    volume,
    setVolume,
    togglePlayPause,
    playNext,
    playPrev,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    transferPlayback,
    connectToDevice,
    disconnectDevice,
    isActiveDevice
  } = usePlayerStore();

  const { signOut } = useAuthStore();

  const [discoveredDevices, setDiscoveredDevices] = useState<VerifiedDevice[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDeviceMenuId, setActiveDeviceMenuId] = useState<string | null>(null);
  const [deviceToLogout, setDeviceToLogout] = useState<{ id: string; name: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (!((event.target as HTMLElement)?.closest?.('.device-menu-container'))) {
        setActiveDeviceMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Initialize discovery engines
  useEffect(() => {
    try {
      const engine = DeviceDiscoveryEngine.getInstance();
      engine.startDiscovery();
      const unsubDiscovery = engine.subscribe((list) => {
        setDiscoveredDevices(Array.isArray(list) ? list : []);
      });

      const connectV2 = RaagaXConnectV2.getInstance();
      connectV2.init();

      return () => {
        try {
          unsubDiscovery();
          engine.stopDiscovery();
        } catch {}
      };
    } catch (err) {
      console.warn('[ConnectPanelContent] Discovery engine init error:', err);
    }
  }, []);

  // Detect whether THIS device is Mobile, Tablet, TV, or Laptop/Desktop
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const cap = (window as any).Capacitor?.isNativePlatform?.();
    return /Mobile|Android|iPhone|iPod/i.test(ua) || Boolean(cap);
  }, []);

  // Generic device icon resolver
  const getDeviceIcon = (platform?: string, name?: string) => {
    const s = `${platform || ''} ${name || ''}`.toLowerCase();
    if (s.includes('tv') || s.includes('cast')) return Tv;
    if (s.includes('speaker') || s.includes('audio')) return Speaker;
    if (s.includes('tablet') || s.includes('ipad')) return Tablet;
    if (s.includes('phone') || s.includes('android') || s.includes('iphone') || s.includes('mobile')) return Smartphone;
    if (s.includes('desktop') || s.includes('imac') || s.includes('pc')) return Monitor;
    return Laptop;
  };

  // Friendly names
  const currentDeviceName = isMobile ? 'This phone' : 'My Laptop';
  const CurrentIcon = isMobile ? Smartphone : Laptop;

  // Session Connection & Audio State Calculation
  const isConnected = Boolean(connectedDeviceId || (!isActiveDevice && activeDeviceId));
  const hasSong = Boolean(currentSong && currentSong.title);
  const songTitle = currentSong?.title || '';
  const artistName = currentSong?.artist || 'Unknown Artist';

  // Audio Output Flag: true if THIS device produces audio, false if another device produces audio
  const isThisDeviceAudioOutput = isActiveDevice;

  // Filter available / connected devices (generic device model)
  const otherDevices = useMemo(() => {
    const list = discoveredDevices.filter(
      (d) => d && d.deviceId !== deviceId
    );

    // If no devices in list but connectedDeviceId exists, synthesize the peer
    if (list.length === 0 && connectedDeviceId) {
      return [{
        deviceId: connectedDeviceId,
        name: isMobile ? 'My Laptop' : 'This phone',
        platform: isMobile ? 'Windows' : 'Android',
        isNearby: true,
        lastSeen: Date.now(),
      } as unknown as VerifiedDevice];
    }

    // Default fallback single peer for two-device environment if nothing discovered yet
    if (list.length === 0) {
      return [{
        deviceId: isMobile ? 'laptop_peer' : 'mobile_peer',
        name: isMobile ? 'My Laptop' : 'This phone',
        platform: isMobile ? 'Windows' : 'Android',
        isNearby: true,
        lastSeen: Date.now(),
      } as unknown as VerifiedDevice];
    }

    return list;
  }, [discoveredDevices, deviceId, connectedDeviceId, isMobile]);

  // Handle Connect to specific device
  const handleConnect = async (targetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setErrorMessage(null);
    setConnectingId(targetId);

    try {
      const ok = await connectToDevice(targetId);
      if (!ok) {
        // Direct LAN fallback
        const lanOk = await RaagaXConnectV2.getInstance().connectAndControl(targetId);
        if (!lanOk) {
          throw new Error('Connection refused');
        }
      }
    } catch {
      setErrorMessage("Couldn't connect. Try again.");
    } finally {
      setConnectingId(null);
    }
  };

  // Handle Disconnect (Disconnect ≠ Stop Music)
  const handleDisconnect = (targetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setErrorMessage(null);
    disconnectDevice();
  };

  // Handle tapping device card when connected -> Transfer playback destination seamlessly
  const handleTransferDestination = async (targetId: string) => {
    if (!isConnected) {
      await handleConnect(targetId);
      return;
    }

    try {
      if (isThisDeviceAudioOutput) {
        // Transfer audio from this device -> target device
        await transferPlayback(targetId);
      } else {
        // Transfer audio from target device -> this device
        await transferPlayback(deviceId || 'local');
      }
    } catch {
      try {
        await RaagaXConnectV2.getInstance().switchPlaybackTo(
          isThisDeviceAudioOutput ? targetId : (deviceId || 'local')
        );
      } catch {}
    }
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await signOut();
    if (onClose) onClose();
  };

  const handleRemoteLogoutConfirm = async () => {
    if (!deviceToLogout) return;
    const targetId = deviceToLogout.id;
    setDeviceToLogout(null);
    setActiveDeviceMenuId(null);

    try {
      // 1. Revoke authorization on backend & notify target device
      await DeviceRegistry.getInstance().revokeRemoteDevice(targetId);

      // 2. Remove immediately from local discovered devices list
      setDiscoveredDevices((prev) => prev.filter((d) => d.deviceId !== targetId));

      // 3. If connected to this device, disconnect cleanly
      if (connectedDeviceId === targetId || activeDeviceId === targetId) {
        disconnectDevice();
      }
    } catch (err) {
      console.warn('[ConnectPanelContent] Error during remote device logout:', err);
    }
  };

  const safeVolume = Number.isFinite(volume) ? volume : 1;

  const isShuffleActive = shuffleMode && shuffleMode !== 'OFF';
  const isRepeatActive = repeatMode && repeatMode !== 'OFF';

  return (
    <div className={`flex flex-col h-full bg-[#111216] text-white select-none ${isPanel ? 'p-4' : 'p-6 max-w-md w-full mx-auto rounded-[28px]'}`}>
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-5">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Connect to Device</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Non-intrusive small error message if connection fails */}
      {errorMessage && (
        <div className="mb-4 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 animate-in fade-in">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-0.5">
        
        {/* ── SECTION 1: CURRENT DEVICE ─────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2 px-0.5">
            CURRENT DEVICE
          </h3>

          <div className="relative bg-[#181a20] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Green Outline Device Icon Box */}
              <div className="w-11 h-11 rounded-2xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                <CurrentIcon className="w-5 h-5" />
              </div>

              {/* Text Meta */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[15px] font-bold text-white leading-tight truncate">
                  {currentDeviceName}
                </h4>

                {/* Subtitle strictly following Section 6 */}
                {!hasSong || !isPlaying ? (
                  <p className="text-xs text-white/50 font-medium mt-0.5">
                    Not playing
                  </p>
                ) : isThisDeviceAudioOutput ? (
                  // Local device is producing audio
                  <div className="mt-0.5 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {songTitle}
                    </p>
                    <p className="text-xs text-white/50 truncate">
                      {artistName}
                    </p>
                  </div>
                ) : (
                  // Another connected device is producing audio
                  <div className="mt-0.5 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {songTitle}
                    </p>
                    <p className="text-xs text-white/50 truncate">
                      {artistName}
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-400 truncate mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                      <span>Playing on {isMobile ? 'My Laptop' : 'This phone'}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Three-Dot Menu Button */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Logout Dropdown */}
              {isMenuOpen && (
                <div className="absolute right-0 top-10 z-50 w-36 py-1.5 bg-[#1e2129] border border-white/15 rounded-xl shadow-2xl animate-in fade-in zoom-in-95">
                  <button 
                    onClick={handleLogout}
                    className="w-full px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: AVAILABLE / CONNECTED DEVICES ───────────────────── */}
        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2 px-0.5">
            {isConnected ? 'CONNECTED DEVICES' : 'AVAILABLE DEVICES'}
          </h3>

          {otherDevices.length === 0 ? (
            <div className="bg-[#181a20]/60 border border-white/[0.05] rounded-2xl p-6 text-center shadow">
              <p className="text-sm font-semibold text-white/70">No other devices found</p>
              <p className="text-xs text-white/40 mt-1">Make sure your devices are on the same Wi-Fi and try again.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {otherDevices.map((dev) => {
                const ItemIcon = getDeviceIcon(dev.platform, dev.name);
                const isTargetConnected = isConnected && (connectedDeviceId === dev.deviceId || (!isActiveDevice && activeDeviceId === dev.deviceId));
                const isTargetActiveAudio = isTargetConnected && !isActiveDevice;
                const isTargetConnecting = connectingId === dev.deviceId;

                return (
                  <div 
                    key={dev.deviceId}
                    onClick={() => isTargetConnected && handleTransferDestination(dev.deviceId)}
                    className={`bg-[#181a20] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between shadow-lg transition-all ${
                      isTargetConnected ? 'cursor-pointer hover:bg-white/[0.06]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Device Icon Box */}
                      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isTargetConnected 
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' 
                          : 'border-white/15 bg-white/5 text-white/60'
                      }`}>
                        <ItemIcon className="w-5 h-5" />
                      </div>

                      {/* Text Meta */}
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-bold text-white leading-tight truncate">
                            {dev.name || (isMobile ? 'My Laptop' : 'This phone')}
                          </h4>
                          {/* Equalizer animation if this device is actively producing audio */}
                          {isTargetActiveAudio && isPlaying && (
                            <div className="flex items-end gap-[2.5px] h-3.5">
                              <span className="w-[2.5px] h-full bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                              <span className="w-[2.5px] h-2/3 bg-emerald-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
                              <span className="w-[2.5px] h-4/5 bg-emerald-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" />
                            </div>
                          )}
                        </div>

                        {/* Subtitle */}
                        {isTargetConnected && hasSong ? (
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            {songTitle} • {artistName}
                          </p>
                        ) : isTargetConnected && !hasSong ? (
                          <p className="text-xs text-white/50 font-medium mt-0.5">
                            Not playing
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* [ Connect ] or [ Disconnect ] Button + Three-dot Menu */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isTargetConnected ? (
                        <button
                          onClick={(e) => handleDisconnect(dev.deviceId, e)}
                          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 shadow"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleConnect(dev.deviceId, e)}
                          disabled={isTargetConnecting}
                          className="px-4 py-1.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-xs font-bold text-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {isTargetConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>{isTargetConnecting ? 'Connecting...' : 'Connect'}</span>
                        </button>
                      )}

                      {/* Three-dot menu for same-account discovered device */}
                      <div className="relative device-menu-container">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDeviceMenuId(activeDeviceMenuId === dev.deviceId ? null : dev.deviceId);
                          }}
                          className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Device options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Minimal Menu: Only Log out (Opens upside above button) */}
                        {activeDeviceMenuId === dev.deviceId && (
                          <div 
                            className="absolute right-0 bottom-full mb-1.5 w-28 bg-[#20232b] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActiveDeviceMenuId(null);
                                setDeviceToLogout({ id: dev.deviceId, name: dev.name || 'Device' });
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-red-400 hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Log out</span>
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── BOTTOM MINI-PLAYER BAR (MOBILE ONLY / NOT ON LAPTOP/DESKTOP PANEL) ── */}
      {hasSong && !isPanel && (
        <div className="mt-4 pt-3 border-t border-white/[0.08]">

          <div className="bg-[#16181f] border border-white/10 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 sm:gap-3 shadow-xl">
            
            {/* Song Cover & Text */}
            <div className="flex items-center gap-2.5 min-w-0 max-w-[120px] sm:max-w-[150px]">
              <img 
                src={currentSong?.coverUrl || '/app-icon.png'} 
                alt={songTitle}
                className="w-10 h-10 rounded-lg object-cover bg-white/5 flex-shrink-0 shadow"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/app-icon.png'; }}
              />
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-white truncate leading-tight">
                  {songTitle}
                </h5>
                <p className="text-[11px] text-white/50 truncate mt-0.5">
                  {artistName}
                </p>
              </div>
            </div>

            {/* Center Transport Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={toggleShuffle}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${isShuffleActive ? 'text-emerald-400' : 'text-white/50 hover:text-white'}`}
                title="Shuffle"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button 
                onClick={playPrev}
                className="p-1.5 rounded-full text-white/70 hover:text-white transition-colors cursor-pointer active:scale-90"
                title="Previous"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button 
                onClick={togglePlayPause}
                className="w-8 h-8 rounded-full bg-white text-black hover:bg-slate-200 flex items-center justify-center shadow transition-transform active:scale-95 cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button 
                onClick={playNext}
                className="p-1.5 rounded-full text-white/70 hover:text-white transition-colors cursor-pointer active:scale-90"
                title="Next"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <button 
                onClick={cycleRepeatMode}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${isRepeatActive ? 'text-emerald-400' : 'text-white/50 hover:text-white'}`}
                title="Repeat"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Volume2 className="w-3.5 h-3.5 text-white/50" />
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={safeVolume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-14 sm:w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                title="Volume"
              />
            </div>

          </div>
        </div>
      )}

      {/* ── REMOTE DEVICE LOGOUT CONFIRMATION MODAL ─────────────────── */}
      {deviceToLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181a20] border border-white/15 rounded-2xl p-5 max-w-xs w-full shadow-2xl text-left animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white mb-1.5">
              Log out this device?
            </h3>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              <span className="font-semibold text-white/90">{deviceToLogout.name}</span> will be removed from your RaagaX devices.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeviceToLogout(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoteLogoutConfirm}
                className="px-4 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white shadow-md transition-all cursor-pointer active:scale-95"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

