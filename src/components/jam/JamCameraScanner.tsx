'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, Zap, ZapOff, AlertCircle, CheckCircle2, SwitchCamera } from 'lucide-react';
import jsQR from 'jsqr';

interface JamCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
}

export function JamCameraScanner({ isOpen, onClose, onScanSuccess }: JamCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    isScanningRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const parseScannedResult = useCallback((rawValue: string): string => {
    const trimmed = rawValue.trim();
    
    // Check if it's a URL with ?jam= or ?code= or /jam/
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const jamParam = url.searchParams.get('jam') || url.searchParams.get('code');
        if (jamParam) return jamParam;

        const pathParts = url.pathname.split('/').filter(Boolean);
        const jamIndex = pathParts.indexOf('jam');
        if (jamIndex !== -1 && pathParts[jamIndex + 1]) {
          return pathParts[jamIndex + 1];
        }
      }
    } catch {}

    // Clean raw text
    return trimmed;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage(null);
    setIsSuccess(false);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasPermission(false);
      setErrorMessage('Camera access is not supported on this browser or device.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      // Check for flashlight / torch support on track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() as any) || {};
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        isScanningRef.current = true;
        scanLoop();
      }
    } catch (err: any) {
      console.warn('[JamCameraScanner] Camera access failed:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow camera access in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera found on this device.');
      } else {
        setErrorMessage('Failed to start camera. Please try again.');
      }
    }
  }, [facingMode, stopCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('[JamCameraScanner] Torch toggle failed:', err);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleDetectedCode = (codeValue: string) => {
    if (!isScanningRef.current) return;
    isScanningRef.current = false;
    setIsSuccess(true);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(60); } catch {}
    }

    const cleanResult = parseScannedResult(codeValue);
    console.log('[JamCameraScanner] QR code detected successfully:', cleanResult);

    setTimeout(() => {
      stopCamera();
      onScanSuccess(cleanResult);
    }, 450);
  };

  const scanLoop = () => {
    if (!isScanningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Scan via jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && code.data.trim()) {
          handleDetectedCode(code.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 text-white select-none animate-in fade-in duration-200">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Controls Bar */}
      <div className="w-full max-w-md flex items-center justify-between z-20 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#FA233B]/20 border border-[#FA233B]/40 flex items-center justify-center text-[#FA233B]">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Scan Jam QR Code</h3>
            <p className="text-[11px] text-zinc-400">Point at host&apos;s invite screen</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                isTorchOn
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                  : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
              }`}
              title="Toggle Flashlight"
            >
              {isTorchOn ? <Zap className="w-4 h-4 fill-black" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={toggleFacingMode}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer"
            title="Flip Camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Viewport Frame */}
      <div className="relative w-full max-w-sm aspect-square my-auto rounded-3xl overflow-hidden border-2 border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black/60 flex items-center justify-center">
        {/* Video feed */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />

        {/* Reticle Scanner Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div className="relative w-full h-full border-2 border-[#FA233B]/60 rounded-2xl">
            {/* Corner Markers */}
            <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#FA233B] rounded-tl-xl" />
            <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#FA233B] rounded-tr-xl" />
            <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#FA233B] rounded-bl-xl" />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#FA233B] rounded-br-xl" />

            {/* Scanning Laser Animation */}
            {!isSuccess && hasPermission && (
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#FA233B] to-transparent shadow-[0_0_12px_#FA233B] animate-[bounce_2s_infinite_ease-in-out]" />
            )}

            {/* Success Animation Overlay */}
            {isSuccess && (
              <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center animate-in zoom-in-90 duration-200">
                <div className="p-3 rounded-full bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.8)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error / Permission Fallback State */}
        {hasPermission === false && (
          <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-30">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-xs text-rose-200 font-medium px-4 leading-relaxed">
              {errorMessage || 'Camera access is required to scan Jam QR codes.'}
            </p>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-[#FA233B] hover:bg-[#ff3b53] text-white text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Permission</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="w-full max-w-md pb-4 text-center z-20">
        <p className="text-xs text-zinc-400 bg-white/5 border border-white/10 rounded-2xl py-2.5 px-4 backdrop-blur-md">
          Align the QR code within the frame to connect instantly.
        </p>
      </div>
    </div>
  );
}
