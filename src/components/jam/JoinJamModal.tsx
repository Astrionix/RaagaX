import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Wifi,
  Bluetooth,
  ArrowRight,
  Loader2,
  Users,
  Music2,
  Sparkles,
  RefreshCw,
  Camera,
  QrCode,
} from 'lucide-react';
import { useJamStore } from '@/context/useJamStore';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { DiscoveredJam } from '@/types/jam';
import { JamCameraScanner } from './JamCameraScanner';

export function JoinJamModal() {
  const {
    isJoinModalOpen,
    toggleJoinModal,
    discoveredJams,
    isScanningNearby,
    startNearbyDiscovery,
    joinByCode,
    joinJam,
    isLoading,
    error: storeError,
  } = useJamStore();

  const [inputCode, setInputCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (isJoinModalOpen) {
      setInputCode('');
      setLocalError(null);
      startNearbyDiscovery();
    }
  }, [isJoinModalOpen, startNearbyDiscovery]);

  if (!isJoinModalOpen) return null;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Restricted alphabet: 23456789ABCDEFGHJKMNPQRSTUVWXYZ
    const raw = e.target.value.toUpperCase();
    const filtered = raw.replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, '').slice(0, 6);
    setInputCode(filtered);
    setLocalError(null);
  };

  const handleJoinByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputCode.trim()) {
      setLocalError('Please enter a 5-6 character Join Code');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    const session = await joinByCode(inputCode.trim());
    setIsSubmitting(false);

    if (!session) {
      setLocalError(storeError || 'No active Jam found for this code');
    }
  };

  const handleJoinDiscovered = async (jam: DiscoveredJam) => {
    setIsSubmitting(true);
    setLocalError(null);
    const session = await joinJam(jam.jamId);
    setIsSubmitting(false);
    if (!session) {
      setLocalError(storeError || 'Failed to join nearby Jam');
    }
  };

  const handleScanSuccess = async (scannedValue: string) => {
    setIsScannerOpen(false);
    if (!scannedValue) return;

    setIsSubmitting(true);
    setLocalError(null);

    if (scannedValue.length <= 6 && !scannedValue.startsWith('JAM_')) {
      setInputCode(scannedValue.toUpperCase());
      const session = await joinByCode(scannedValue.toUpperCase());
      setIsSubmitting(false);
      if (!session) {
        setLocalError(storeError || `No active Jam found for code "${scannedValue}"`);
      }
    } else {
      const session = await joinJam(scannedValue);
      setIsSubmitting(false);
      if (!session) {
        setLocalError(storeError || `Failed to join Jam "${scannedValue}"`);
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
        <div
          className="w-full max-w-md bg-[#12141C]/95 border border-white/10 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow ambient accent */}
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-[#FA233B]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FA233B]/20 border border-[#FA233B]/30 flex items-center justify-center text-[#FA233B]">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">Join Jam Party</h2>
                <p className="text-xs text-zinc-400">Camera QR • Bluetooth • Join Code</p>
              </div>
            </div>
            <button
              onClick={() => toggleJoinModal(false)}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Container (Scrollable) */}
          <div className="flex-1 overflow-y-auto py-4 space-y-5 relative z-10 custom-scrollbar pr-1">
            
            {/* 1. CAMERA QR SCANNER ACTION (Mobile / Camera Priority) */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#FA233B]/25 via-[#FA233B]/10 to-white/[0.02] border border-[#FA233B]/40 hover:border-[#FA233B] text-white flex items-center justify-between transition-all cursor-pointer group shadow-[0_8px_24px_rgba(250,35,59,0.15)] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FA233B] text-white flex items-center justify-center shadow-[0_0_18px_rgba(250,35,59,0.5)] group-hover:scale-105 transition-transform flex-shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>Scan Host QR Code</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#FA233B]/30 text-[9px] text-rose-300 font-bold uppercase tracking-wider">Camera</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Instantly connect with your mobile camera</p>
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-white/10 text-zinc-300 group-hover:text-white group-hover:translate-x-0.5 transition-all">
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            {/* 2. NEARBY JAMS SECTION (Bluetooth + Wi-Fi) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <div className="flex items-center gap-1 text-[#FA233B]">
                    <Bluetooth className="w-3.5 h-3.5" />
                    <Wifi className="w-3.5 h-3.5" />
                  </div>
                  <span>Nearby Jams</span>
                </div>
                <button
                  onClick={startNearbyDiscovery}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Scan again"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanningNearby ? 'animate-spin' : ''}`} />
                  <span>{isScanningNearby ? 'Scanning...' : 'Refresh'}</span>
                </button>
              </div>

              {/* Discovered Jams List */}
              {discoveredJams.length > 0 ? (
                <div className="space-y-2">
                  {discoveredJams.map((jam) => (
                    <div
                      key={jam.jamId}
                      className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#FA233B]/40 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                      onClick={() => handleJoinDiscovered(jam)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 relative">
                          {jam.currentSongCover ? (
                            <OptimizedImage
                              src={jam.currentSongCover}
                              alt={jam.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                              <Music2 className="w-5 h-5" />
                            </div>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 ring-2 ring-black" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate leading-tight group-hover:text-[#FA233B] transition-colors">
                            {jam.name}
                          </h4>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">
                            Host: <span className="text-zinc-300 font-medium">{jam.hostName}</span>
                          </p>
                          {jam.currentSongTitle && (
                            <p className="text-[11px] text-[#FA233B] truncate mt-0.5 flex items-center gap-1 font-medium">
                              <span>🎵</span>
                              <span>{jam.currentSongTitle}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-zinc-300 text-[10px] font-bold">
                          <Users className="w-3 h-3" />
                          <span>{jam.participantCount}</span>
                        </div>
                        <button
                          disabled={isSubmitting || isLoading}
                          className="px-3 py-1.5 rounded-xl bg-[#FA233B] hover:bg-[#FA233B]/90 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-500">
                    <Bluetooth className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-zinc-400">
                    {isScanningNearby ? 'Searching for nearby Bluetooth & Wi-Fi Jams...' : 'No nearby Jams found yet.'}
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Make sure the host is nearby with Jam active, or scan their QR code above.
                  </p>
                </div>
              )}
            </div>

            {/* DIVIDER */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#12141C] px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 absolute">
                OR ENTER CODE
              </span>
            </div>

            {/* 3. MANUAL JOIN CODE SECTION */}
            <form onSubmit={handleJoinByCode} className="space-y-3">
              <div>
                <label htmlFor="join-code-input" className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Enter 5-Character Join Code
                </label>
                <div className="relative">
                  <input
                    id="join-code-input"
                    type="text"
                    value={inputCode}
                    onChange={handleCodeChange}
                    placeholder="e.g. 7K29P"
                    maxLength={6}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck="false"
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/15 focus:border-[#FA233B] text-white text-center text-xl font-mono font-black tracking-widest uppercase outline-none transition-all placeholder:text-zinc-600 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1.5 text-center">
                  Unambiguous restricted code • Case-insensitive
                </p>
              </div>

              {/* Error Feedback */}
              {(localError || storeError) && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center font-medium">
                  {localError || storeError}
                </div>
              )}

              {/* Join Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isLoading || inputCode.trim().length < 4}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FA233B] to-[#FF4B60] text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg hover:shadow-red-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Jam...</span>
                  </>
                ) : (
                  <>
                    <span>Join Jam Party</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </div>

      {/* Camera QR Scanner Overlay */}
      <JamCameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
}
