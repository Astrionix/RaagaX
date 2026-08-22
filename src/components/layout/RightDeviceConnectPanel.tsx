'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Monitor, Smartphone, Tv, Laptop, Check, Radio, Headphones, 
  Loader2, Volume2, Sparkles, Wifi, ShieldCheck, CheckCircle2, Lock, User, 
  Sliders, ArrowRightLeft, KeyRound
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { RaagaXConnectV2 } from '@/lib/connect/lan/RaagaXConnectV2';
import { ConnectAuthManager } from '@/lib/connect/lan/ConnectAuthManager';
import { DiscoveredLANDevice, TrustedPeer } from '@/lib/connect/lan/types';

export function RightDeviceConnectPanel() {
  const { 
    deviceId, 
    activeDeviceId, 
    connectedDeviceId,
    setRightPanelMode, 
    isActiveDevice,
    remoteDeviceName,
    currentSong,
    isPlaying,
    currentTime,
    duration
  } = usePlayerStore();

  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredLANDevice[]>([]);
  const [trustedPeers, setTrustedPeers] = useState<TrustedPeer[]>([]);
  const [handoverTarget, setHandoverTarget] = useState<string | null>(null);
  const [handoverStep, setHandoverStep] = useState<number>(0);
  const [pairingTargetId, setPairingTargetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Connect V2 LAN engine
    const connectV2 = RaagaXConnectV2.getInstance();
    connectV2.init();

    // Subscribe to discovered LAN devices
    const updateList = () => {
      setDiscoveredDevices(connectV2.getDiscoveredDevices());
    };

    updateList();
    const interval = setInterval(updateList, 2000);

    const unbindPeers = ConnectAuthManager.getInstance().onTrustedPeersChange((peers) => {
      setTrustedPeers(peers);
    });

    return () => {
      clearInterval(interval);
      unbindPeers();
    };
  }, []);

  const isRemoteConnected = !isActiveDevice && Boolean(connectedDeviceId && connectedDeviceId !== deviceId);
  const activeDeviceObj = discoveredDevices.find(d => d.deviceId === activeDeviceId || d.deviceId === connectedDeviceId);
  const localDeviceName = 'This Device';
  const activeDisplayName = isRemoteConnected 
    ? (remoteDeviceName || activeDeviceObj?.deviceName || 'Remote Device') 
    : localDeviceName;

  const handleDeviceSwitch = async (target: DiscoveredLANDevice) => {
    if (target.deviceId === activeDeviceId && isActiveDevice) return;

    setErrorMessage(null);
    setHandoverTarget(target.deviceName);
    setHandoverStep(1); // 1: Song

    try {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().connectToDevice(target.deviceId);
      }).catch(() => {});

      await new Promise(r => setTimeout(r, 120));
      setHandoverStep(2); // 2: Position

      await new Promise(r => setTimeout(r, 120));
      setHandoverStep(3); // 3: Queue

      await new Promise(r => setTimeout(r, 120));
      setHandoverStep(4); // 4: Playback state

      const success = await RaagaXConnectV2.getInstance().switchPlaybackTo(target.deviceId, (step) => {
        setHandoverStep(step);
      });

      if (success) {
        setHandoverStep(5); // 5: Connected
        setTimeout(() => {
          setHandoverTarget(null);
          setHandoverStep(0);
        }, 700);
      } else {
        throw new Error('Device rejected or failed switch');
      }
    } catch (err: any) {
      setHandoverTarget(null);
      setHandoverStep(0);
      setErrorMessage(`Could not switch to ${target.deviceName}. Current playback continued.`);
    }
  };

  const handleDeviceControl = async (target: DiscoveredLANDevice) => {
    try {
      import('@/lib/connect/ConnectManager').then(({ ConnectManager }) => {
        ConnectManager.getInstance().connectToDevice(target.deviceId);
      }).catch(() => {});

      const success = await RaagaXConnectV2.getInstance().connectAndControl(target.deviceId);
      if (!success) {
        usePlayerStore.setState({
          isActiveDevice: false,
          activeDeviceId: target.deviceId,
          connectedDeviceId: target.deviceId,
          remoteDeviceName: target.deviceName,
        });
      }
    } catch {
      usePlayerStore.setState({
        isActiveDevice: false,
        activeDeviceId: target.deviceId,
        connectedDeviceId: target.deviceId,
        remoteDeviceName: target.deviceName,
      });
    }
  };

  const handleRequestPairing = async (target: DiscoveredLANDevice) => {
    setPairingTargetId(target.deviceId);
    setErrorMessage(null);

    try {
      const resp = await ConnectAuthManager.getInstance().requestPairing(
        target.deviceId,
        { allowControl: true, allowSwitch: true },
        'permanent'
      );

      setPairingTargetId(null);
      if (resp.accepted) {
        // Automatically start controlling if approved
        usePlayerStore.setState({
          isActiveDevice: false,
          connectedDeviceId: target.deviceId,
          remoteDeviceName: target.deviceName,
        });
      } else {
        setErrorMessage(`Pairing request to ${target.deviceName} was declined.`);
      }
    } catch (e) {
      setPairingTargetId(null);
      setErrorMessage(`Pairing request timed out.`);
    }
  };

  const handleDisconnect = async () => {
    setErrorMessage(null);
    try {
      RaagaXConnectV2.getInstance().disconnect();
    } catch (err) {
      setErrorMessage('Could not disconnect from remote device.');
    }
  };

  const renderDeviceIcon = (platform?: string, name?: string) => {
    const p = (platform || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (p === 'android' || p === 'ios' || n.includes('phone') || n.includes('mobile')) {
      return <Smartphone className="w-4 h-4 text-emerald-400" />;
    }
    if (n.includes('tv')) {
      return <Tv className="w-4 h-4 text-indigo-400" />;
    }
    if (n.includes('speaker') || n.includes('audio')) {
      return <Headphones className="w-4 h-4 text-amber-400" />;
    }
    return <Laptop className="w-4 h-4 text-blue-400" />;
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handoverStepsText = [
    'Preparing handover...',
    'Syncing track context...',
    'Calibrating position timestamp...',
    'Transferring queue...',
    'Switching audio renderer...',
    'Connected!'
  ];

  const otherDiscoveredDevices = discoveredDevices.filter(d => !d.isLocalDevice && d.deviceId !== deviceId);

  return (
    <aside className="w-80 h-full bg-black/90 backdrop-blur-2xl border-l border-white/10 flex flex-col justify-between p-4 z-40 relative select-none">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-black text-white tracking-wide uppercase">Connect to a Device</h3>
          </div>
          <button
            onClick={() => setRightPanelMode('queue')}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Handover Real-Time Progress Overlay */}
        {handoverTarget && (
          <div className="my-3 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-black border border-emerald-500/30 text-white animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Switching to {handoverTarget}
              </span>
              <span className="text-[10px] font-mono text-emerald-300">
                {Math.min(100, Math.round((handoverStep / 5) * 100))}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mb-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                style={{ width: `${Math.min(100, (handoverStep / 5) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-300">
              {handoverStepsText[handoverStep] || 'Finalizing...'}
            </p>
          </div>
        )}

        {/* Error Toast */}
        {errorMessage && (
          <div className="my-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between animate-in fade-in duration-150">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1 custom-scrollbar">
        {/* SECTION 1: CURRENT PLAYBACK DEVICE */}
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2 px-1">
            Current Playback
          </span>

          <div className={`p-3.5 rounded-2xl border transition-all ${
            isRemoteConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-white' 
              : 'bg-white/[0.04] border-white/10 text-white'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2.5 rounded-xl border ${
                isRemoteConnected 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                  : 'bg-white/10 border-white/20 text-white'
              }`}>
                {renderDeviceIcon(activeDeviceObj?.platform, activeDisplayName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white truncate">{activeDisplayName}</h4>
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                </div>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>Direct LAN Connected (:47104)</span>
                </p>
              </div>
            </div>

            {currentSong && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="truncate max-w-[170px] text-white font-bold">
                  {currentSong.title}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {formatTime(currentTime)} / {formatTime(duration || currentSong.duration || 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: DISCOVERED DEVICES ON THIS WI-FI */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Devices on this Wi-Fi
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {otherDiscoveredDevices.length} found
            </span>
          </div>

          <div className="space-y-2">
            {/* If remote is playing, offer This Device as target */}
            {isRemoteConnected && (
              <button
                onClick={() => RaagaXConnectV2.getInstance().disconnect()}
                className="w-full p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/40 flex items-center justify-between transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 group-hover:text-white group-hover:bg-emerald-500/20">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">{localDeviceName}</h5>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>This Device · Your Account</span>
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-black px-2.5 py-1 bg-emerald-400 rounded-xl shadow-md">
                  Play here
                </span>
              </button>
            )}

            {/* Discovered Wi-Fi Devices */}
            {otherDiscoveredDevices.map((device) => {
              const isSameAccount = device.isSameAccount;
              const isPaired = ConnectAuthManager.getInstance().isPaired(device.deviceId);
              const canControl = ConnectAuthManager.getInstance().canControl(device.deviceId);
              const canSwitch = ConnectAuthManager.getInstance().canSwitch(device.deviceId);
              const isPlaying = device.currentActivity === 'playing';
              const isPairingWaiting = pairingTargetId === device.deviceId;

              return (
                <div
                  key={device.deviceId}
                  className="w-full p-3 rounded-2xl border transition-all flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/20"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div className="p-2 rounded-xl border border-white/5 bg-white/5 text-slate-200">
                      {renderDeviceIcon(device.platform, device.deviceName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h5 className="text-xs font-bold text-white truncate">{device.deviceName}</h5>
                        {isPlaying && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        {isSameAccount ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Your Device {isPlaying ? '● Playing' : '● Available'}
                          </span>
                        ) : isPaired ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                            <KeyRound className="w-2.5 h-2.5" /> Paired {isPlaying ? '● Playing' : '● Available'}
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> {device.accountName || 'Friend'} {isPlaying ? '● Playing' : '● Available'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions based on Account & Pairing Permissions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isSameAccount ? (
                      <>
                        <button
                          onClick={() => handleDeviceControl(device)}
                          className="text-[10px] font-bold text-slate-300 hover:text-white px-2.5 py-1 bg-white/5 hover:bg-white/15 rounded-xl border border-white/10 transition-all cursor-pointer"
                        >
                          Control
                        </button>
                        <button
                          onClick={() => handleDeviceSwitch(device)}
                          className="text-[10px] font-bold text-black px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          Switch
                        </button>
                      </>
                    ) : isPaired ? (
                      <>
                        {canControl && (
                          <button
                            onClick={() => handleDeviceControl(device)}
                            className="text-[10px] font-bold text-slate-300 hover:text-white px-2.5 py-1 bg-white/5 hover:bg-white/15 rounded-xl border border-white/10 transition-all cursor-pointer"
                          >
                            Control
                          </button>
                        )}
                        {canSwitch && (
                          <button
                            onClick={() => handleDeviceSwitch(device)}
                            className="text-[10px] font-bold text-black px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md transition-all cursor-pointer"
                          >
                            Switch
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleRequestPairing(device)}
                        disabled={isPairingWaiting}
                        className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isPairingWaiting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Waiting...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3 h-3" />
                            <span>Request Control</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {otherDiscoveredDevices.length === 0 && !isRemoteConnected && (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs space-y-1">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin mx-auto mb-1" />
                <p className="font-bold text-white">Scanning Local Wi-Fi...</p>
                <p className="text-[11px] text-slate-500">
                  Make sure other RaagaX devices are on the same Wi-Fi network.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: DISCONNECT ACTION */}
        {isRemoteConnected && (
          <div className="pt-2">
            <button
              onClick={handleDisconnect}
              className="w-full py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              Disconnect (Take Back Playback)
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400 space-y-1">
        <p className="font-semibold text-slate-300 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Direct LAN WebSocket Protocol (V2)
        </p>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Zero cloud mediator. Real-time mDNS discovery & secure device-to-device pairing.
        </p>
      </div>
    </aside>
  );
}
