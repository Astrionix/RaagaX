import { useState, useEffect, type FormEvent } from 'react';
import {
  Laptop,
  Smartphone,
  Tv,
  Speaker,
  X,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { ConnectIcon } from '@/components/icons/ConnectIcon';
import { useConnect } from '@/playback/connect/connectManager';
import type { ConnectDevice } from '@/playback/connect/types';
import { useUi } from '@/state/ui';

export function ConnectPanel() {
  const closeSidePanel = useUi((s) => s.closeSidePanel);
  const {
    isConnected,
    discoveredDevices,
    pairedDevices,
    activeRemoteDevice,
    connectingDeviceId,
    pairCode,
    pairCodeExpiresAt,
    pairingFeedback,
    transferTo,
    transferBack,
    pairDeviceDirectly,
    unpairDevice,
    generatePairCode,
    cancelPairCode,
    submitPairCode,
    start,
  } = useConnect();

  const [activeTab, setActiveTab] = useState<'devices' | 'pair'>('devices');
  const [pairTab, setPairTab] = useState<'show' | 'enter'>('show');
  const [enteredCode, setEnteredCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Auto-connect to relay when panel is opened
  useEffect(() => {
    start();
  }, [start]);

  // Timer for pair code countdown
  useEffect(() => {
    if (!pairCode || pairCodeExpiresAt <= 0) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((pairCodeExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        cancelPairCode();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pairCode, pairCodeExpiresAt, cancelPairCode]);

  const handleCopyCode = () => {
    if (!pairCode) return;
    navigator.clipboard.writeText(pairCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeviceClick = async (device: ConnectDevice) => {
    if (activeRemoteDevice?.id === device.id) return;
    try {
      await transferTo(device);
    } catch (err: any) {
      alert(err.message || 'Failed to connect to device');
    }
  };

  const handleSubmitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (enteredCode.length !== 6) return;
    await submitPairCode(enteredCode);
    setEnteredCode('');
  };

  const renderDeviceIcon = (type: string, size = 18) => {
    switch (type) {
      case 'PHONE':
        return <Smartphone size={size} />;
      case 'SPEAKER':
        return <Speaker size={size} />;
      default:
        return <Tv size={size} />;
    }
  };

  // Combine discovered and paired
  const pairedIds = new Set(pairedDevices.map((p) => p.id));
  const otherDiscovered = discoveredDevices.filter((d) => !pairedIds.has(d.id));

  return (
    <div className="flex h-full flex-col select-none overflow-hidden text-primary">
      {/* Header Bar */}
      <div className="flex h-14 flex-none items-center justify-between border-b border-quaternary px-5">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid size-8 place-items-center rounded-lg transition-colors ${
              activeRemoteDevice ? 'bg-emerald-500/20 text-emerald-400' : 'bg-key/10 text-key'
            }`}
          >
            <ConnectIcon size={18} connected={Boolean(activeRemoteDevice)} />
          </div>
          <div>
            <h3 className="type-title-3-emphasized leading-none text-primary">Connect to a Device</h3>
            <p className="type-caption-1 text-secondary mt-1 flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              {isConnected ? 'Cloud Relay Active' : 'Connecting to Relay...'}
            </p>
          </div>
        </div>
        <button
          onClick={closeSidePanel}
          className="grid size-8 place-items-center rounded-full text-secondary hover:bg-quaternary hover:text-primary transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Segmented Top Tabs */}
      <div className="flex px-4 pt-3 pb-1 border-b border-quaternary/40 gap-2">
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'devices'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-secondary hover:text-primary'
          }`}
        >
          Devices
        </button>
        <button
          onClick={() => setActiveTab('pair')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'pair'
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-secondary hover:text-primary'
          }`}
        >
          Pair with PIN
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'devices' ? (
          <>
            {/* Current Playing Speaker */}
            <div className="rounded-xl border border-quaternary bg-secondary/25 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                    {activeRemoteDevice ? (
                      renderDeviceIcon(activeRemoteDevice.type, 20)
                    ) : (
                      <Laptop size={20} />
                    )}
                  </div>
                  <div>
                    <div className="type-body-emphasized text-primary">
                      {activeRemoteDevice ? activeRemoteDevice.name : 'This Web Browser'}
                    </div>
                    <div className="type-caption-1 text-emerald-400 flex items-center gap-1.5 mt-0.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      {activeRemoteDevice ? 'Playing on Remote Device' : 'Current Audio Output'}
                    </div>
                  </div>
                </div>
              </div>
              {activeRemoteDevice && (
                <button
                  onClick={transferBack}
                  className="mt-3 w-full rounded-lg bg-white/10 hover:bg-white/15 py-2 type-subheadline font-semibold text-primary transition-colors text-center cursor-pointer"
                >
                  Switch playback back to this computer
                </button>
              )}
            </div>

            {/* Paired Devices Section */}
            {pairedDevices.length > 0 && (
              <div>
                <div className="px-1 mb-2 text-[11px] font-bold tracking-wider text-secondary uppercase">
                  Paired Devices ({pairedDevices.length})
                </div>
                <div className="space-y-1.5">
                  {pairedDevices.map((paired) => {
                    const onlineDev = discoveredDevices.find((d) => d.id === paired.id);
                    const isOnline = Boolean(onlineDev);
                    const isConnecting = connectingDeviceId === paired.id;
                    const isCurrent = activeRemoteDevice?.id === paired.id;

                    return (
                      <div
                        key={paired.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : 'border-quaternary/60 bg-quaternary/20 hover:bg-quaternary/40'
                        } ${isOnline ? 'cursor-pointer' : 'opacity-60'}`}
                        onClick={() => {
                          if (isOnline && onlineDev) handleDeviceClick(onlineDev);
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`grid size-9 place-items-center rounded-full ${
                              isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-secondary'
                            }`}
                          >
                            {renderDeviceIcon(paired.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="type-body-emphasized truncate text-primary">{paired.name}</div>
                            <div className="type-caption-1 text-secondary truncate">
                              {isConnecting
                                ? 'Connecting...'
                                : isCurrent
                                ? 'Currently Playing'
                                : isOnline
                                ? `${onlineDev?.isCloud ? '☁️ Cloud' : '🟢 Local Wi-Fi'} • Tap to switch`
                                : 'Offline'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isConnecting && (
                            <RefreshCw size={16} className="text-emerald-400 animate-spin" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              unpairDevice(paired.id);
                            }}
                            className="p-1.5 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Unpair"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Nearby / Cloud Devices */}
            <div>
              <div className="px-1 mb-2 text-[11px] font-bold tracking-wider text-secondary uppercase">
                Available Devices ({otherDiscovered.length})
              </div>

              {otherDiscovered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-quaternary/60 p-6 text-center text-secondary">
                  <Radio size={24} className="mx-auto mb-2 opacity-50 text-key" />
                  <p className="type-body text-sm font-medium">Looking for nearby devices...</p>
                  <p className="type-caption-1 mt-1 text-secondary">
                    Open Raaga on your Android phone or PC. Make sure both devices are logged into the same account or paired with PIN.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {otherDiscovered.map((dev) => {
                    const isConnecting = connectingDeviceId === dev.id;
                    return (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-quaternary/60 bg-quaternary/20 hover:bg-quaternary/40 transition-all cursor-pointer"
                        onClick={() => handleDeviceClick(dev)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid size-9 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                            {renderDeviceIcon(dev.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="type-body-emphasized truncate text-primary">{dev.name}</div>
                            <div className="type-caption-1 text-emerald-400 truncate">
                              {isConnecting
                                ? 'Connecting...'
                                : dev.isCloud
                                ? '☁️ Cloud • Tap to play'
                                : '🟢 Local Wi-Fi • Tap to play'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isConnecting ? (
                            <RefreshCw size={16} className="text-emerald-400 animate-spin" />
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                pairDeviceDirectly(dev);
                              }}
                              className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                            >
                              + Pair
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* 6-Digit PIN Pairing Sub-tab */
          <div className="space-y-4">
            <div className="flex bg-quaternary/30 p-1 rounded-lg gap-1">
              <button
                onClick={() => setPairTab('show')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  pairTab === 'show' ? 'bg-white/15 text-white' : 'text-secondary'
                }`}
              >
                Show PIN Code
              </button>
              <button
                onClick={() => setPairTab('enter')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  pairTab === 'enter' ? 'bg-white/15 text-white' : 'text-secondary'
                }`}
              >
                Enter PIN Code
              </button>
            </div>

            {pairTab === 'show' ? (
              <div className="rounded-xl border border-quaternary bg-secondary/20 p-5 text-center space-y-4">
                <p className="type-subheadline text-secondary">
                  Generate a 6-digit PIN code to pair this browser with your phone or desktop:
                </p>

                {pairCode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 font-mono text-3xl font-bold tracking-widest text-emerald-400 bg-black/40 py-3 px-4 rounded-xl border border-emerald-500/30">
                      {pairCode}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy PIN'}
                      </button>
                      <button
                        onClick={cancelPairCode}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="type-caption-1 text-secondary">Expires in {timeLeft}s</p>
                  </div>
                ) : (
                  <button
                    onClick={() => generatePairCode()}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    Generate Pairing PIN
                  </button>
                )}

                <p className="type-caption-2 text-secondary/70">
                  On your Android phone, go to Audio Output &gt; Pair Device &gt; Enter Code, and type this PIN.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitCode} className="rounded-xl border border-quaternary bg-secondary/20 p-5 space-y-4">
                <p className="type-subheadline text-secondary">
                  Enter the 6-digit PIN code displayed on your phone or desktop:
                </p>

                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black/40 border border-quaternary rounded-xl px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-primary focus:border-emerald-400 focus:outline-none transition-colors"
                />

                <button
                  type="submit"
                  disabled={enteredCode.length !== 6}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 disabled:opacity-40 text-black font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  Pair Device
                </button>

                {pairingFeedback && (
                  <p className="type-caption-1 text-emerald-400 text-center font-medium">
                    {pairingFeedback}
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

