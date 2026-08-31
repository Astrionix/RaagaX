'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface JamQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Standard ISO/IEC 18004 QR Code Generator for Jam Invites
 */
export function JamQRCode({ value, size = 200, className = '' }: JamQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: Math.round(size * 2), // High-res retina bitmap
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        console.warn('[JamQRCode] QR generation failed:', err);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div
      className={`relative inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-xl border border-white/20 select-none ${className}`}
      style={{ width: size + 24, height: size + 24 }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Jam QR Code"
          width={size}
          height={size}
          className="w-full h-full object-contain rounded-lg"
        />
      ) : (
        <div
          className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400 font-mono"
          style={{ width: size, height: size }}
        >
          Generating QR...
        </div>
      )}
      {/* Center Brand Icon */}
      <div className="absolute w-8 h-8 rounded-lg bg-[#FA233B] flex items-center justify-center shadow-md border-2 border-white pointer-events-none">
        <span className="text-white font-black text-xs tracking-tighter">RX</span>
      </div>
    </div>
  );
}
