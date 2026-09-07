'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Laptop,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Zap,
  Check,
  ExternalLink,
  ChevronRight,
  Music2,
  Radio,
} from 'lucide-react';
import { usePlayerStore } from '@/context/usePlayerStore';
import { haptics } from '@/lib/haptics/HapticEngine';

type PlatformTab = 'windows' | 'mac' | 'android';

const RELEASE_BASE_URL = 'https://github.com/Astrionix/RaagaX/releases/download/v1.0.0';

export const APP_DOWNLOAD_URLS = {
  windowsUniversal: `${RELEASE_BASE_URL}/RaagaX-Windows-Universal.exe`,
  windowsPortable: `${RELEASE_BASE_URL}/RaagaX-Windows-Portable.exe`,
  macUniversal: `${RELEASE_BASE_URL}/RaagaX-macOS-Universal.dmg`,
  androidApk: `${RELEASE_BASE_URL}/RaagaX.apk`,
};

interface PlatformInfo {
  tab: PlatformTab;
  name: string;
  osLabel: string;
  badge: string;
  fileName: string;
  downloadUrl: string;
  size: string;
  subtext: string;
}

function detectUserOS(): PlatformInfo {
  if (typeof window === 'undefined') {
    return {
      tab: 'windows',
      name: 'Windows',
      osLabel: 'Universal Edition (32-bit & 64-bit)',
      badge: 'Universal .EXE',
      fileName: 'RaagaX-Windows-Universal.exe',
      downloadUrl: APP_DOWNLOAD_URLS.windowsUniversal,
      size: '96 MB',
      subtext: 'Auto-detects 32-bit & 64-bit • Compatible with all Windows PCs',
    };
  }

  const nav = navigator as any;
  const platformData = nav.userAgentData?.platform || '';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  const isWindows = /Win/i.test(platformData) || /Windows/i.test(ua) || /Win/i.test(platform);
  const isMac = /macOS/i.test(platformData) || /Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platform);
  const isAndroid = /Android/i.test(platformData) || /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  if (isWindows) {
    return {
      tab: 'windows',
      name: 'Windows',
      osLabel: 'Universal Edition (32-bit & 64-bit)',
      badge: 'Universal .EXE',
      fileName: 'RaagaX-Windows-Universal.exe',
      downloadUrl: APP_DOWNLOAD_URLS.windowsUniversal,
      size: '96 MB',
      subtext: 'Auto-detects 32-bit & 64-bit • Compatible with all Windows PCs',
    };
  }

  if (isMac) {
    return {
      tab: 'mac',
      name: 'macOS',
      osLabel: 'Universal Edition (Intel & Apple Silicon)',
      badge: 'Universal .DMG',
      fileName: 'RaagaX-macOS-Universal.dmg',
      downloadUrl: APP_DOWNLOAD_URLS.macUniversal,
      size: '201 MB',
      subtext: 'Guaranteed native speed on ALL Macs (Intel & M1/M2/M3/M4)',
    };
  }

  if (isAndroid) {
    return {
      tab: 'android',
      name: 'Android',
      osLabel: 'Android 8.0+',
      badge: 'Official .APK',
      fileName: 'RaagaX.apk',
      downloadUrl: APP_DOWNLOAD_URLS.androidApk,
      size: '13 MB',
      subtext: 'Offline downloads • Background playback',
    };
  }

  if (isIOS) {
    return {
      tab: 'mac',
      name: 'macOS',
      osLabel: 'Universal Mac Client',
      badge: 'Universal .DMG',
      fileName: 'RaagaX-macOS-Universal.dmg',
      downloadUrl: APP_DOWNLOAD_URLS.macUniversal,
      size: '201 MB',
      subtext: 'Native macOS build for your Mac',
    };
  }

  // Fallback to Windows
  return {
    tab: 'windows',
    name: 'Windows',
    osLabel: 'Windows 10 / 11 (64-bit)',
    badge: 'Universal .EXE',
    fileName: 'RaagaX-Windows-Universal.exe',
    downloadUrl: APP_DOWNLOAD_URLS.windowsUniversal,
    size: '96 MB',
    subtext: 'Auto-detects 32-bit & 64-bit • All Windows PCs',
  };
}

export function GetAppModal() {
  const { isGetAppModalOpen, toggleGetAppModal } = usePlayerStore();
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformInfo>(detectUserOS);
  const [activeTab, setActiveTab] = useState<PlatformTab>('windows');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detected = detectUserOS();
    setDetectedPlatform(detected);
    setActiveTab(detected.tab);

    // Generate QR code for mobile APK download directly from CDN
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(APP_DOWNLOAD_URLS.androidApk, {
        width: 160,
        margin: 1,
        color: {
          dark: '#FFFFFF',
          light: '#00000000',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    });
  }, [isGetAppModalOpen]);

  if (!isGetAppModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={() => toggleGetAppModal(false)}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0B0D13]/95 border border-white/10 text-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-250 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background accents */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#FA233B]/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-600/15 rounded-full blur-[90px] pointer-events-none" />

        {/* Modal Header */}
        <div className="relative p-5 sm:p-6 pb-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FA233B] to-[#FF4E61] p-0.5 shadow-lg shadow-red-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0E1015] rounded-[14px] flex items-center justify-center">
                <Music2 className="w-5 h-5 text-[#FA233B]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  RaagaX Lossless Pro
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#FA233B]/20 border border-[#FA233B]/30 text-[#FA233B] text-[10px] font-extrabold uppercase tracking-wider">
                  Desktop & Mobile
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero tab throttling • Global media shortcuts • Studio audio engine
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              haptics.lightImpact();
              toggleGetAppModal(false);
            }}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 no-scrollbar">
          {/* ── AUTOMATIC OS DETECTION HERO CARD ── */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-white/[0.07] to-white/[0.02] border border-white/15 relative overflow-hidden group shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Auto-Detected: {detectedPlatform.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-slate-300">
                    {detectedPlatform.badge}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white">
                  Download RaagaX for {detectedPlatform.name}
                </h3>
                <p className="text-xs text-slate-300">
                  {detectedPlatform.osLabel} • {detectedPlatform.subtext}
                </p>
              </div>

              <a
                href={detectedPlatform.downloadUrl}
                download={detectedPlatform.fileName}
                onClick={() => haptics.mediumImpact()}
                className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#FA233B] to-[#FF4E61] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-red-500/25 transition-all cursor-pointer flex-shrink-0 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Now ({detectedPlatform.size})</span>
              </a>
            </div>
          </div>

          {/* Section Divider with Tabs */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Explore All Platforms
              </span>
              <span className="text-[11px] text-slate-500">
                Download for another PC or phone
              </span>
            </div>

            {/* Platform Switcher Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <button
                onClick={() => {
                  haptics.selectionTick();
                  setActiveTab('windows');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'windows'
                    ? 'bg-gradient-to-r from-[#0078D7] to-[#00A4EF] text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
                <span>Windows</span>
              </button>

              <button
                onClick={() => {
                  haptics.selectionTick();
                  setActiveTab('mac');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'mac'
                    ? 'bg-gradient-to-r from-[#FA233B] to-[#FF4E61] text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-1.09 1.74-.95 2.77.99.08 2.04-.52 2.68-1.27z" />
                </svg>
                <span>macOS</span>
              </button>

              <button
                onClick={() => {
                  haptics.selectionTick();
                  setActiveTab('android');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'android'
                    ? 'bg-gradient-to-r from-[#3DDC84] to-[#2BA863] text-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4128 13.8533 8.1 12 8.1s-3.5902.3128-5.1367.8497L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9974 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
                </svg>
                <span>Android</span>
              </button>
            </div>
          </div>

          {/* TAB 1: WINDOWS */}
          {activeTab === 'windows' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Card 1: Universal Installer (Recommended) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[#00A4EF]/40 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">RaagaX Universal Setup</h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#0078D7]/20 border border-[#0078D7]/40 text-[#00A4EF] text-[10px] font-bold">
                      Recommended for All PCs
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      32-bit & 64-bit Dual
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Smart universal installer that auto-detects your Windows system architecture and installs the fastest native version.
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Format: <strong className="text-slate-300">.EXE</strong></span>
                    <span>•</span>
                    <span>Compatibility: <strong className="text-slate-300">Windows 7, 8, 10, 11 (x86 & x64)</strong></span>
                  </div>
                </div>

                <a
                  href={APP_DOWNLOAD_URLS.windowsUniversal}
                  download="RaagaX-Windows-Universal.exe"
                  onClick={() => haptics.mediumImpact()}
                  className="py-3 px-5 rounded-xl bg-gradient-to-r from-[#0078D7] to-[#00A4EF] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#0078D7]/20 flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Universal .EXE</span>
                </a>
              </div>

              {/* Card 2: Portable Edition */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-white/20 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">RaagaX Portable (64-bit)</h3>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 text-[10px] font-bold">
                       Zero Install • Standalone
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Run directly without installing. Ideal for USB flash drives, work PCs, or quick listening.
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Format: <strong className="text-slate-300">Portable .EXE</strong></span>
                    <span>•</span>
                    <span>Architecture: <strong className="text-slate-300">x64</strong></span>
                  </div>
                </div>

                <a
                  href={APP_DOWNLOAD_URLS.windowsPortable}
                  download="RaagaX-Windows-Portable.exe"
                  onClick={() => haptics.lightImpact()}
                  className="py-2.5 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/10 flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Portable</span>
                </a>
              </div>

              {/* Windows Features Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-[#00A4EF] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">Keyboard Media Hotkeys</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Control Play, Pause, Next & Prev with dedicated keyboard keys while working in other apps.</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-start gap-2.5">
                  <Radio className="w-4 h-4 text-[#00A4EF] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-white">System Tray Playback</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Minimizes to notification taskbar tray, streaming lossless audio seamlessly in the background.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MACOS */}
          {activeTab === 'mac' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* Universal Edition (Intel & Apple Silicon) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[#FA233B]/40 transition-colors">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Universal Mac Edition</h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#FA233B]/20 border border-[#FA233B]/40 text-[#FA233B] text-[10px] font-bold">
                      Recommended for All Macs
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Works natively on both Intel MacBook/iMac and Apple Silicon (M1, M2, M3, M4).
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Format: <strong className="text-slate-300">.DMG</strong></span>
                    <span>•</span>
                    <span>Size: <strong className="text-slate-300">201 MB</strong></span>
                    <span>•</span>
                    <span>Arch: <strong className="text-slate-300">Universal (x86_64 + ARM64)</strong></span>
                  </div>
                </div>

                <a
                  href={APP_DOWNLOAD_URLS.macUniversal}
                  download="RaagaX-macOS-Universal.dmg"
                  onClick={() => haptics.mediumImpact()}
                  className="py-3 px-5 rounded-xl bg-gradient-to-r from-[#FA233B] to-[#FF4E61] hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-500/20 flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Universal DMG</span>
                </a>
              </div>

              {/* Smaller Arch-specific choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Intel Mac Specific */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3 group hover:border-white/20 transition-colors">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">Intel Mac Edition (x64)</h4>
                    <p className="text-[10px] text-slate-400">For Intel MacBook Pro / Air / iMac</p>
                  </div>
                  <a
                    href={APP_DOWNLOAD_URLS.macUniversal}
                    download="RaagaX-macOS-Universal.dmg"
                    onClick={() => haptics.lightImpact()}
                    className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-[11px] flex items-center gap-1 transition-colors flex-shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>Universal DMG (201 MB)</span>
                  </a>
                </div>

                {/* Apple Silicon Specific */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3 group hover:border-white/20 transition-colors">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">Apple Silicon (M-Series)</h4>
                    <p className="text-[10px] text-slate-400">For M1, M2, M3, M4 Macs</p>
                  </div>
                  <a
                    href={APP_DOWNLOAD_URLS.macUniversal}
                    download="RaagaX-macOS-Universal.dmg"
                    onClick={() => haptics.lightImpact()}
                    className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-[11px] flex items-center gap-1 transition-colors flex-shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>Universal DMG (201 MB)</span>
                  </a>
                </div>
              </div>

              {/* macOS First-Open Notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-300">First-time opening on macOS:</p>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    If Gatekeeper shows an unsigned app prompt, simply right-click <strong>RaagaX</strong> in Finder, click <strong>Open</strong>, and confirm.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-5 group hover:border-[#3DDC84]/40 transition-colors">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Official RaagaX APK</h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#3DDC84]/20 border border-[#3DDC84]/40 text-[#3DDC84] text-[10px] font-bold">
                      Latest Release
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Full offline downloads, high-res notifications shade, lock-screen controls, and zero browser audio interruptions.
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Format: <strong className="text-slate-300">.APK</strong></span>
                    <span>•</span>
                    <span>Size: <strong className="text-slate-300">~13 MB</strong></span>
                    <span>•</span>
                    <span>Android 8.0+</span>
                  </div>

                  <div className="pt-2">
                    <a
                      href={APP_DOWNLOAD_URLS.androidApk}
                      download="RaagaX.apk"
                      onClick={() => haptics.mediumImpact()}
                      className="inline-flex py-3 px-6 rounded-xl bg-gradient-to-r from-[#3DDC84] to-[#2BA863] hover:brightness-110 text-black font-bold text-xs items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <Download className="w-4 h-4 text-black" />
                      <span>Download RaagaX APK (13 MB)</span>
                    </a>
                  </div>
                </div>

                {/* QR Code for phone scanning */}
                {qrCodeUrl && (
                  <div className="hidden sm:flex flex-col items-center justify-center p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex-shrink-0">
                    <img src={qrCodeUrl} alt="Scan QR to Download" className="w-24 h-24 rounded-lg" />
                    <span className="text-[10px] text-slate-400 font-medium mt-1.5">Scan with phone</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lossless Pro Badges */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06]">
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
              <span className="text-sm">🎧</span>
              <p className="text-[11px] font-bold text-white mt-1">320kbps Audio</p>
              <p className="text-[9px] text-slate-400">Pure Hi-Fi stream</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
              <span className="text-sm">⌨️</span>
              <p className="text-[11px] font-bold text-white mt-1">Media Keys</p>
              <p className="text-[9px] text-slate-400">Universal shortcuts</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
              <span className="text-sm">⚡</span>
              <p className="text-[11px] font-bold text-white mt-1">No Throttling</p>
              <p className="text-[9px] text-slate-400">Zero background lag</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <span>Version 1.0.0 (Lossless Pro Release)</span>
          <button
            onClick={() => toggleGetAppModal(false)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Continue in Web Player
          </button>
        </div>
      </div>
    </div>
  );
}
