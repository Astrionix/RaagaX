'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Smartphone, Tv, CheckCircle2, RefreshCw, X, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { DeviceKeyManager } from '@/lib/connect/auth/DeviceKeyManager';

interface TVQRPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TVQRPairingModal({ isOpen, onClose }: TVQRPairingModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [pairedDeviceName, setPairedDeviceName] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    // Generate unique 6-digit TV Pairing Code & URL
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingCode(code);

    const deviceId = DeviceKeyManager.getInstance().getOrCreateDeviceId();
    const pairingUrl = `https://raaga.me/connect?tvId=${deviceId}&code=${code}`;

    QRCode.toDataURL(pairingUrl, { width: 320, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('[TV Pairing] QR code generation error:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10020] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 select-none animate-in fade-in duration-300">
      <div className="bg-white/10 border border-white/15 backdrop-blur-3xl rounded-3xl p-8 sm:p-12 w-full max-w-4xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative text-white">
        {/* Close Button */}
        <button
          data-tv-focusable="true"
          onClick={onClose}
          className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer"
          aria-label="Close Pairing Modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3.5 bg-[#fa233b] rounded-2xl shadow-lg shadow-red-500/30">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Connect Phone to RaagaX TV</h2>
            <p className="text-sm font-medium text-white/60 mt-0.5">Scan once to control TV playback and handoff audio seamlessly</p>
          </div>
        </div>

        {/* Content Split: QR Code vs Code & Status */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* LEFT: QR CODE DISPLAY */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-white p-6 rounded-3xl shadow-2xl">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="TV Pairing QR Code" className="w-56 h-56 rounded-xl" />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-gray-400 font-bold">
                Generating QR...
              </div>
            )}
            <span className="text-xs font-black uppercase tracking-wider text-gray-700 mt-3">Scan with Phone Camera</span>
          </div>

          {/* RIGHT: PAIRING CODE & HANDOFF INSTRUCTIONS */}
          <div className="md:col-span-7 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-bold text-[#fa233b] uppercase tracking-widest">Pairing Code</span>
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-white">
                {pairingCode || '------'}
              </div>
              <p className="text-xs text-white/50">Or open RaagaX on your phone → Settings → Connect to TV</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm font-semibold text-white/80">
                <Smartphone className="w-5 h-5 text-[#fa233b]" />
                <span>Control playback, queue & volume from phone</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-white/80">
                <Tv className="w-5 h-5 text-emerald-400" />
                <span>Instant audio handoff — start on phone, continue on TV</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-white/80">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span>Encrypted P2P connection with account isolation</span>
              </div>
            </div>

            {isPaired && (
              <div className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/40 p-4 rounded-2xl text-emerald-300 font-bold text-sm animate-in zoom-in duration-200">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <span>Paired with {pairedDeviceName || 'Mobile Phone'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
