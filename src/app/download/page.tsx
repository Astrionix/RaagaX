'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sparkles,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Music2,
  ArrowRight,
  Disc3,
  HardDrive,
  Radio,
  Sliders,
  Play,
  Heart,
  Info
} from 'lucide-react';

const RELEASE_TAG = 'v1.4.0';
const RELEASE_VERSION_CODE = 17;
const RELEASE_DATE = 'September 24, 2026';
const APK_FILE_SIZE = '19.9 MB';
const APK_SHA256 = '44448b99ef4490b7be91b5aaaca9d3e0fa2f3f7d3227d21ce5a2a0d0c4fefcc2';

const DOWNLOAD_LINKS = {
  androidApk: `https://github.com/Astrionix/RaagaX/releases/download/${RELEASE_TAG}/RaagaX.apk`,
  androidMirror: '/api/app/download',
  windowsUniversal: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-Windows-Universal.exe',
  windowsPortable: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-Windows-Portable.exe',
  macUniversal: 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-macOS-Universal.dmg',
  githubRelease: `https://github.com/Astrionix/RaagaX/releases/tag/${RELEASE_TAG}`,
};

type PlatformType = 'android' | 'windows' | 'mac' | 'web';

interface DetectedOS {
  type: PlatformType;
  name: string;
  label: string;
  badge: string;
  primaryUrl: string;
  fileName: string;
  size: string;
}

function detectOS(): DetectedOS {
  if (typeof window === 'undefined') {
    return {
      type: 'android',
      name: 'Android',
      label: 'Android 8.0+ (ARM64 & x86_64)',
      badge: 'Official APK',
      primaryUrl: DOWNLOAD_LINKS.androidApk,
      fileName: 'RaagaX.apk',
      size: APK_FILE_SIZE,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const navAny = navigator as any;
  const platform = (navAny.userAgentData?.platform || navigator.platform || '').toLowerCase();

  if (/android/.test(ua)) {
    return {
      type: 'android',
      name: 'Android',
      label: 'Android 8.0+ (ARM64 & x86_64)',
      badge: 'Official APK',
      primaryUrl: DOWNLOAD_LINKS.androidApk,
      fileName: 'RaagaX.apk',
      size: APK_FILE_SIZE,
    };
  }

  if (/iphone|ipad|ipod/.test(ua)) {
    return {
      type: 'web',
      name: 'iOS / iPhone',
      label: 'Progressive Web App (PWA)',
      badge: 'Safari Web App',
      primaryUrl: '/',
      fileName: 'Install via Safari Share',
      size: '0 MB (Web)',
    };
  }

  if (/win/.test(platform) || /windows/.test(ua)) {
    return {
      type: 'windows',
      name: 'Windows',
      label: 'Windows 10 / 11 (64-bit & 32-bit)',
      badge: 'Universal .EXE',
      primaryUrl: DOWNLOAD_LINKS.windowsUniversal,
      fileName: 'RaagaX-Windows-Universal.exe',
      size: '96 MB',
    };
  }

  if (/mac/.test(platform) || /macintosh|mac os x/.test(ua)) {
    return {
      type: 'mac',
      name: 'macOS',
      label: 'Apple Silicon & Intel Universal',
      badge: 'Universal .DMG',
      primaryUrl: DOWNLOAD_LINKS.macUniversal,
      fileName: 'RaagaX-macOS-Universal.dmg',
      size: '98 MB',
    };
  }

  return {
    type: 'android',
    name: 'Android',
    label: 'Android 8.0+ (ARM64 & x86_64)',
    badge: 'Official APK',
    primaryUrl: DOWNLOAD_LINKS.androidApk,
    fileName: 'RaagaX.apk',
    size: APK_FILE_SIZE,
  };
}

export default function DownloadPage() {
  const [detectedOS, setDetectedOS] = useState<DetectedOS>(detectOS);
  const [activeTab, setActiveTab] = useState<PlatformType>('android');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const os = detectOS();
    setDetectedOS(os);
    setActiveTab(os.type);

    // Dynamically generate QR code for Android direct download
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(DOWNLOAD_LINKS.androidApk, {
        width: 180,
        margin: 1,
        color: {
          dark: '#FFFFFF',
          light: '#00000000',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => {});
    });
  }, []);

  const handleCopySha = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(APK_SHA256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  const handleCopyPageLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white selection:bg-[#E50914] selection:text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* ── Background Ambient Radial Glows ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-[#E50914]/20 via-[#E50914]/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[600px] -left-48 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[800px] -right-48 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* ── 1. NAVIGATION HEADER ── */}
      <header className="relative z-20 w-full border-b border-white/[0.08] bg-[#07090E]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E50914] to-[#FF2E38] flex items-center justify-center shadow-lg shadow-red-500/25 group-hover:scale-105 transition-transform">
              <Disc3 className="w-6 h-6 text-white animate-spin [animation-duration:12s]" />
            </div>
            <div className="flex items-baseline">
              <span className="font-extrabold text-2xl tracking-tight text-white">raaga</span>
              <span className="font-extrabold text-2xl tracking-tight text-[#E50914]">x</span>
            </div>
          </Link>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            <button
              onClick={handleCopyPageLink}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              title="Share download page link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs sm:text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#E50914]" />
              <span>Launch Web Player</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION ── */}
      <section className="relative z-10 pt-10 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 text-center max-w-4xl mx-auto">
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/80 shadow-md mb-6 animate-in fade-in duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-bold">{RELEASE_TAG}</span>
          <span className="text-white/40">•</span>
          <span className="text-white/70">Build {RELEASE_VERSION_CODE}</span>
          <span className="text-white/40">•</span>
          <span className="text-emerald-400 font-medium">Stable Release</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-5">
          Download Raaga App. <br />
          <span className="bg-gradient-to-r from-red-500 via-[#FF1E27] to-amber-400 bg-clip-text text-transparent">
            Free Lossless Music on All Devices.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
          Stream high-fidelity 24-bit lossless music in Telugu, Hindi, Tamil, and English.
          Experience seamless offline playback, synced dynamic lyrics, and uninterrupted background listening.
        </p>

        {/* ── Auto-Detected Primary Download CTA ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto mb-10">
          <a
            href={detectedOS.primaryUrl}
            download={detectedOS.fileName}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-[#E50914] via-[#FF1E27] to-[#E50914] hover:brightness-110 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-3 shadow-2xl shadow-red-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download className="w-5 h-5 animate-bounce" />
            <span>Download for {detectedOS.name}</span>
            <span className="px-2 py-0.5 rounded-md bg-black/25 text-xs font-mono">
              {detectedOS.size}
            </span>
          </a>

          <a
            href="#all-platforms"
            className="w-full sm:w-auto px-5 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
          >
            <span>All Platforms</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </a>
        </div>

        {/* Feature Highlights Pills */}
        <div className="flex items-center justify-center flex-wrap gap-2.5 sm:gap-4 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Free & Open
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> 320 kbps & 24-bit FLAC
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> VirusTotal Verified Safe
          </span>
        </div>
      </section>

      {/* ── 3. ALL PLATFORMS GRID ── */}
      <section id="all-platforms" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 scroll-mt-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Available on Every Screen
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Pick your device below for direct download links and native features.
          </p>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex items-center justify-center gap-2 p-1.5 max-w-md mx-auto mb-10 rounded-2xl bg-white/5 border border-white/10">
          {(
            [
              { id: 'android', label: 'Android', icon: Smartphone },
              { id: 'windows', label: 'Windows', icon: Laptop },
              { id: 'mac', label: 'macOS', icon: Laptop },
              { id: 'web', label: 'Web / PWA', icon: Music2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#E50914] text-white shadow-lg shadow-red-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ── */}

        {/* ── 1. ANDROID (FLAGSHIP APK) ── */}
        {activeTab === 'android' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-in fade-in duration-300">
            {/* Left Main Card (8 cols) */}
            <div className="lg:col-span-7 bg-[#0E1015]/90 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-extrabold text-white">RaagaX for Android</h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                          {RELEASE_TAG}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Direct APK Package • ARM64 &amp; x86_64</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  The definitive music streaming experience built natively for Android. Includes lock screen album artwork, background audio playback with zero stutter, system media notification controls, and offline 320kbps MP3 storage.
                </p>

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#E50914]" /> Background Audio
                    </span>
                    <p className="text-[11px] text-slate-400">Music plays continuously even when screen is locked or switching apps.</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Offline Downloads
                    </span>
                    <p className="text-[11px] text-slate-400">Save full albums and playlists directly to your phone storage in 320kbps MP3.</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" /> 10-Band Equalizer
                    </span>
                    <p className="text-[11px] text-slate-400">Professional hardware DSP audio engine with Bass Boost and Spatial Virtualizer.</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Zero Scroll-Bleed
                    </span>
                    <p className="text-[11px] text-slate-400">Brand new v1.4.0 touch isolation prevents background screen scrolling.</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
                <a
                  href={DOWNLOAD_LINKS.androidApk}
                  download="RaagaX.apk"
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#E50914] to-[#FF2E38] hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-red-500/25 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download RaagaX.apk ({APK_FILE_SIZE})</span>
                </a>

                <a
                  href={DOWNLOAD_LINKS.androidMirror}
                  download="RaagaX.apk"
                  className="py-3.5 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  title="Fast direct stream from domain server"
                >
                  <span>Fast Mirror</span>
                </a>
              </div>
            </div>

            {/* Right QR Code Card (5 cols) */}
            <div className="lg:col-span-5 bg-[#0E1015]/90 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between text-center shadow-2xl relative">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300">
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" /> Scan with Phone
                </div>
                <h4 className="text-lg font-bold text-white">Instant Phone Download</h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  Scan this QR code with your mobile camera or Google Lens to start downloading the APK directly on your phone.
                </p>
              </div>

              {/* QR Code Canvas */}
              <div className="my-6 p-4 rounded-3xl bg-white/5 border border-white/10 shadow-inner flex items-center justify-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="RaagaX APK Download QR Code"
                    className="w-44 h-44 rounded-2xl"
                  />
                ) : (
                  <div className="w-44 h-44 rounded-2xl bg-white/5 flex items-center justify-center text-xs text-slate-500">
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Security info */}
              <div className="w-full pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Signed Package
                </span>
                <span className="font-mono text-slate-500">v{RELEASE_TAG}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. WINDOWS ── */}
        {activeTab === 'windows' && (
          <div className="bg-[#0E1015]/90 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl animate-in fade-in duration-300">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#0078D7]/15 border border-[#0078D7]/30 flex items-center justify-center text-[#00A4EF]">
                    <Laptop className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">RaagaX for Windows</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Windows 10 &amp; 11 • 64-bit and 32-bit compatible</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    Dual 32 &amp; 64-bit
                  </span>
                </div>
              </div>

              {/* Windows Downloads options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Universal Installer */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#0078D7]/40 transition-colors flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-[#0078D7]/20 text-[#00A4EF] text-[10px] font-bold">
                      Recommended
                    </span>
                    <h4 className="text-base font-bold text-white">Universal Setup Installer</h4>
                    <p className="text-xs text-slate-400">
                      Standard installer with desktop shortcuts, Start Menu integration, and auto-updates.
                    </p>
                  </div>

                  <a
                    href={DOWNLOAD_LINKS.windowsUniversal}
                    className="py-3 px-5 rounded-xl bg-gradient-to-r from-[#0078D7] to-[#00A4EF] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Installer (.EXE)</span>
                  </a>
                </div>

                {/* Portable Edition */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 transition-colors flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                      No Installation Required
                    </span>
                    <h4 className="text-base font-bold text-white">Standalone Portable Edition</h4>
                    <p className="text-xs text-slate-400">
                      Run directly from USB drive or folder without touching Windows Registry or system files.
                    </p>
                  </div>

                  <a
                    href={DOWNLOAD_LINKS.windowsPortable}
                    className="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Portable (.EXE)</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. macOS ── */}
        {activeTab === 'mac' && (
          <div className="bg-[#0E1015]/90 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl animate-in fade-in duration-300">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Laptop className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">RaagaX for macOS</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Universal DMG for Apple Silicon (M1/M2/M3/M4) &amp; Intel</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold">
                    Universal Binary
                  </span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-lg">
                  <h4 className="text-base font-bold text-white">RaagaX Universal Disk Image (.dmg)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Native macOS application with media keyboard key controls, Now Playing Notification Center widget, and Apple CoreAudio lossless support.
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono pt-1">
                    Requirements: macOS 11.0 Big Sur or later • 98 MB
                  </p>
                </div>

                <a
                  href={DOWNLOAD_LINKS.macUniversal}
                  className="py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-black" />
                  <span>Download DMG (98 MB)</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. WEB & PWA ── */}
        {activeTab === 'web' && (
          <div className="bg-[#0E1015]/90 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl animate-in fade-in duration-300">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914]">
                    <Music2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">RaagaX Web Player &amp; PWA</h3>
                    <p className="text-xs sm:text-sm text-slate-400">Zero install needed • Works in any browser (iPhone, iPad, Chrome, Safari)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    Instant Play
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#E50914]" /> iPhone &amp; iPad Setup
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Open <strong className="text-white">raaga.me</strong> in Safari, tap the <strong>Share</strong> button at bottom, and select <strong className="text-emerald-400">"Add to Home Screen"</strong>. It launches in fullscreen like a native iOS app.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-cyan-400" /> Desktop Browser PWA
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    In Chrome, Edge, or Brave, click the <strong>Install</strong> icon in the address bar to install RaagaX directly to your taskbar or application launcher.
                  </p>
                </div>
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#E50914] to-[#FF2E38] hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-red-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch RaagaX Web Player</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 4. EASY 3-STEP ANDROID INSTALLATION GUIDE ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#0C0E14] border border-white/[0.08] rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              Quick Installation Guide
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">How to Install on Android</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Follow these simple 3 steps to install the official RaagaX APK on your phone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3 relative">
              <span className="w-8 h-8 rounded-xl bg-[#E50914]/20 border border-[#E50914]/40 flex items-center justify-center text-xs font-mono font-black text-[#E50914]">
                01
              </span>
              <h4 className="text-sm font-bold text-white">Download RaagaX.apk</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tap the "Download for Android" button or scan the QR code to save the package to your device.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3 relative">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-mono font-black text-amber-400">
                02
              </span>
              <h4 className="text-sm font-bold text-white">Confirm Download Prompt</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                If your browser shows a safety warning, tap <strong className="text-white">"Download anyway"</strong>. RaagaX is verified clean and open source.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3 relative">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-mono font-black text-emerald-400">
                03
              </span>
              <h4 className="text-sm font-bold text-white">Tap Install &amp; Enjoy</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tap the downloaded file in your notification bar and press <strong className="text-white">"Install"</strong> to launch RaagaX.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. INTEGRITY & VERIFICATION ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className="p-6 rounded-2xl bg-[#0E1015] border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">Package Security &amp; SHA-256 Checksum</h4>
            </div>
            <a
              href={DOWNLOAD_LINKS.githubRelease}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View GitHub Release</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Official APK SHA-256 Hash:</span>
            <div className="p-3 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-3">
              <code className="text-[11px] font-mono text-emerald-400 break-all select-all">
                {APK_SHA256}
              </code>
              <button
                onClick={handleCopySha}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                title="Copy SHA-256 Hash"
              >
                {copiedSha ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#050609] py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">RaagaX</span>
            <span>•</span>
            <span>Version {RELEASE_TAG} (Build {RELEASE_VERSION_CODE})</span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/" className="hover:text-white transition-colors">
              Web Player
            </Link>
            <Link href="/docs" className="hover:text-white transition-colors">
              Docs &amp; API
            </Link>
            <a
              href="https://github.com/Astrionix/RaagaX"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
