import { config } from '@/config';

/**
 * Detects whether the current device is a tablet or iPad (iOS/iPadOS or Android tablet).
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPads running iPadOS 13+ report as Macintosh with multi-touch points
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  return isIpad || isAndroidTablet;
}

/**
 * Mobile phones (excluding tablets and iPads) can't install the desktop extension,
 * so they can show the app notice unless dismissed.
 */
export function isMobileBrowser(): boolean {
  if (isTablet()) return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
  return /iPhone|iPod|Mobile/i.test(navigator.userAgent) || (/Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent));
}

/**
 * Detects whether the primary interaction method is touch (tablets, iPads, phones).
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return isTablet() || isMobileBrowser() || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
}

export type DesktopOs = 'windows' | 'mac' | 'linux';

export interface DetectedDesktop {
  os: DesktopOs;
  name: string;
  url: string;
  fileName: string;
}

/**
 * Auto-detects the desktop operating system (macOS, Windows, or Linux)
 * and returns the appropriate installer URL and filename.
 */
export function detectDesktopOs(): DetectedDesktop {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'windows',
      name: 'Windows',
      url: config.desktopDownloads.windowsSetup,
      fileName: 'Raaga-1.9.9-windows-setup.exe',
    };
  }

  const ua = navigator.userAgent;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '';

  // macOS (Mac desktop/laptop, excluding iPad/iPhone)
  if ((/Macintosh|MacIntel|MacPPC|Mac68K|Mac OS X/i.test(ua) || /Mac/i.test(platform)) && !isTablet() && !/iPhone|iPod/i.test(ua)) {
    return {
      os: 'mac',
      name: 'macOS',
      url: config.desktopDownloads.macArm64,
      fileName: 'Raaga-1.9.9-macos-arm64.dmg',
    };
  }

  // Linux (desktop, excluding Android)
  if ((/Linux/i.test(ua) || /Linux/i.test(platform)) && !/Android/i.test(ua)) {
    return {
      os: 'linux',
      name: 'Linux',
      url: config.desktopDownloads.linuxAppImage,
      fileName: 'Raaga-1.9.9-linux-x86_64.AppImage',
    };
  }

  // Windows (default for desktop/unknown)
  return {
    os: 'windows',
    name: 'Windows',
    url: config.desktopDownloads.windowsSetup,
    fileName: 'Raaga-1.9.9-windows-setup.exe',
  };
}


